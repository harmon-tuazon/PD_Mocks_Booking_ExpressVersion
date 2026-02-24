-- Schema structure dump: public
-- Generated: 2026-02-23T15:06:18.410Z

CREATE SCHEMA IF NOT EXISTS "public";

CREATE TYPE "public"."app_permission" AS ENUM ('bookings.create', 'bookings.cancel', 'bookings.batch_cancel', 'bookings.view', 'exams.create', 'exams.edit', 'exams.delete', 'exams.activate', 'exams.view', 'bookings.export', 'contacts.tokens', 'workcheck.create', 'workcheck.view', 'workcheck.edit', 'workcheck.delete', 'groups.create', 'groups.edit', 'groups.view', 'groups.delete');

CREATE TYPE "public"."app_role" AS ENUM ('super_admin', 'admin', 'viewer', 'instructor');

CREATE TABLE "public"."role_permissions" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "role" "public"."app_role" NOT NULL,
  "permission" "public"."app_permission" NOT NULL,
  PRIMARY KEY ("id"),
  CONSTRAINT "unique_role_permission" UNIQUE ("role", "permission")
);

CREATE TABLE "public"."user_roles" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "role" "public"."app_role" NOT NULL,
  "granted_by" uuid,
  "granted_at" timestamp with time zone,
  "notes" text,
  PRIMARY KEY ("id"),
  CONSTRAINT "unique_user_role" UNIQUE ("user_id")
);

-- Indexes
CREATE UNIQUE INDEX role_permissions_pkey ON public.role_permissions USING btree (id);
CREATE UNIQUE INDEX unique_role_permission ON public.role_permissions USING btree (role, permission);
CREATE INDEX idx_user_roles_user_id ON public.user_roles USING btree (user_id);
CREATE UNIQUE INDEX unique_user_role ON public.user_roles USING btree (user_id);
CREATE UNIQUE INDEX user_roles_pkey ON public.user_roles USING btree (id);

-- Functions and Procedures
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
DECLARE
  user_role TEXT;
  user_permissions TEXT[];
BEGIN
  -- Fetch user's role from user_roles table
  SELECT role::TEXT INTO user_role
  FROM public.user_roles
  WHERE user_id = (event->>'user_id')::uuid;

  -- Default to 'viewer' if no role assigned
  IF user_role IS NULL THEN
    user_role := 'viewer';
    RAISE LOG 'User % has no assigned role, defaulting to viewer', event->>'user_id';
  END IF;

  -- Fetch permissions for this role
  SELECT ARRAY_AGG(permission::TEXT) INTO user_permissions
  FROM public.role_permissions
  WHERE role = user_role::app_role;

  -- Inject custom claims into JWT
  event := jsonb_set(
    event,
    '{claims, user_role}',
    to_jsonb(user_role)
  );

  event := jsonb_set(
    event,
    '{claims, permissions}',
    to_jsonb(user_permissions)
  );

  -- Add metadata for debugging
  event := jsonb_set(
    event,
    '{claims, role_assigned_at}',
    to_jsonb(NOW())
  );

  RAISE LOG 'Auth hook: User % assigned role % with % permissions',
    event->>'user_id', user_role, array_length(user_permissions, 1);

  RETURN event;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.log_booking_changes()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  INSERT INTO hubspot_sync.audit_log (table_name, operation, record_id, performed_by)
  VALUES (
    'hubspot_bookings',
    TG_OP,
    COALESCE(NEW.hubspot_id, OLD.hubspot_id),
    current_user
  );
  RETURN COALESCE(NEW, OLD);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.log_exam_changes()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  INSERT INTO hubspot_sync.audit_log (table_name, operation, record_id, performed_by)
  VALUES (
    'hubspot_mock_exams',
    TG_OP,
    COALESCE(NEW.hubspot_id, OLD.hubspot_id),
    current_user
  );
  RETURN COALESCE(NEW, OLD);
END;
$function$
;

-- Row Level Security
ALTER TABLE "public"."role_permissions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."user_roles" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read permissions" ON "public"."role_permissions" AS PERMISSIVE FOR SELECT TO authenticated USING (true);

CREATE POLICY "Auth admin bypass" ON "public"."role_permissions" AS PERMISSIVE FOR ALL TO supabase_auth_admin USING (true) WITH CHECK (true);

CREATE POLICY "Super admins can modify permissions" ON "public"."role_permissions" AS PERMISSIVE FOR ALL TO authenticated USING ((EXISTS ( SELECT 1
   FROM user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'super_admin'::app_role)))));

CREATE POLICY "Auth admin bypass" ON "public"."user_roles" AS PERMISSIVE FOR ALL TO supabase_auth_admin USING (true) WITH CHECK (true);

CREATE POLICY "Super admins can manage roles" ON "public"."user_roles" AS PERMISSIVE FOR ALL TO authenticated USING ((EXISTS ( SELECT 1
   FROM user_roles user_roles_1
  WHERE ((user_roles_1.user_id = auth.uid()) AND (user_roles_1.role = 'super_admin'::app_role)))));

CREATE POLICY "Users can view own role" ON "public"."user_roles" AS PERMISSIVE FOR SELECT TO authenticated USING ((auth.uid() = user_id));
