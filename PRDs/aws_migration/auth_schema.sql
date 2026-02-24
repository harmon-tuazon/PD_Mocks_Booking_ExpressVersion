-- ============================================================================
-- AUTH SCHEMA — AWS Migration (Cleaned)
-- Only includes what's needed for self-managed JWT auth on RDS
-- Source: Supabase auth schema dump, 2026-02-23
-- ============================================================================
--
-- MIGRATED:
--   auth.users → admin_users (emails, hashed passwords, metadata)
--   auth.identities → reference only (flattened into admin_users)
--
-- DROPPED (Supabase-internal / unused features):
--   auth.audit_log_entries    — Supabase internal audit trail
--   auth.flow_state           — OAuth/PKCE flow tracking (ephemeral)
--   auth.instances            — Supabase multi-tenant concept
--   auth.mfa_amr_claims       — MFA (out of scope)
--   auth.mfa_challenges       — MFA (out of scope)
--   auth.mfa_factors          — MFA (out of scope)
--   auth.oauth_authorizations — OAuth server (not used)
--   auth.oauth_client_states  — OAuth server (not used)
--   auth.oauth_clients        — OAuth server (not used)
--   auth.oauth_consents       — OAuth server (not used)
--   auth.one_time_tokens      — Ephemeral (password reset tokens expire)
--   auth.refresh_tokens       — Supabase session format; new table on RDS
--   auth.saml_providers       — SAML/SSO (not used)
--   auth.saml_relay_states    — SAML/SSO (not used)
--   auth.schema_migrations    — GoTrue internal migration tracking
--   auth.sessions             — Supabase session format; force re-login on cutover
--   auth.sso_domains          — SSO (not used)
--   auth.sso_providers        — SSO (not used)
--   All enums                 — Supabase-specific (aal_level, factor_type, etc.)
--   All functions             — auth.uid(), auth.role(), etc. read PostgREST headers
--   All RLS policies          — Express middleware handles auth, not RLS
--
-- ============================================================================

-- New admin_users table (replaces auth.users)
-- Maps from Supabase auth.users fields to a clean self-managed structure
CREATE TABLE IF NOT EXISTS "admin_users" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "email" character varying(255) NOT NULL,
  "encrypted_password" character varying(255) NOT NULL,
  "user_role" character varying(50) DEFAULT 'admin'::character varying NOT NULL,
  "permissions" jsonb DEFAULT '[]'::jsonb,
  "instructor_id" uuid,                          -- FK to instructors table (NULL for non-instructor admins)
  "raw_app_meta_data" jsonb DEFAULT '{}'::jsonb,  -- Preserved from Supabase for migration
  "raw_user_meta_data" jsonb DEFAULT '{}'::jsonb, -- Preserved from Supabase for migration
  "last_sign_in_at" timestamp with time zone,
  "email_confirmed_at" timestamp with time zone,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "admin_users_email_key" UNIQUE ("email")
);

-- New refresh_tokens table (replaces auth.refresh_tokens + auth.sessions)
CREATE TABLE IF NOT EXISTS "refresh_tokens" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "token_hash" character varying(255) NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "revoked" boolean DEFAULT false,
  "created_at" timestamp with time zone DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "admin_users"("id") ON DELETE CASCADE,
  CONSTRAINT "refresh_tokens_token_hash_key" UNIQUE ("token_hash")
);

-- Indexes
CREATE INDEX idx_admin_users_email ON admin_users USING btree (email);
CREATE INDEX idx_admin_users_role ON admin_users USING btree (user_role);
CREATE INDEX idx_admin_users_instructor ON admin_users USING btree (instructor_id) WHERE (instructor_id IS NOT NULL);
CREATE INDEX idx_refresh_tokens_user ON refresh_tokens USING btree (user_id);
CREATE INDEX idx_refresh_tokens_expires ON refresh_tokens USING btree (expires_at) WHERE (revoked = false);

-- ============================================================================
-- DATA MIGRATION QUERY (run once during cutover)
-- Copies existing Supabase auth.users → admin_users
-- ============================================================================
--
-- INSERT INTO admin_users (id, email, encrypted_password, user_role, raw_app_meta_data, raw_user_meta_data, last_sign_in_at, email_confirmed_at, created_at, updated_at)
-- SELECT
--   u.id,
--   u.email,
--   u.encrypted_password,
--   COALESCE(u.raw_app_meta_data->>'user_role', 'admin'),
--   u.raw_app_meta_data,
--   u.raw_user_meta_data,
--   u.last_sign_in_at,
--   u.email_confirmed_at,
--   u.created_at,
--   u.updated_at
-- FROM auth.users u
-- WHERE u.deleted_at IS NULL;
--
-- Then link instructor_id:
-- UPDATE admin_users au
-- SET instructor_id = i.id
-- FROM hubspot_sync.instructors i
-- WHERE au.email = i.email;
-- ============================================================================
