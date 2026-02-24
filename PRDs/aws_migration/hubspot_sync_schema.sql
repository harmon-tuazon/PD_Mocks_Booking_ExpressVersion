-- Schema structure dump: hubspot_sync
-- Generated: 2026-02-23T15:06:19.197Z

CREATE SCHEMA IF NOT EXISTS "hubspot_sync";

CREATE TYPE "hubspot_sync"."mock_set_enum" AS ENUM ('A', 'B', 'C', 'D', 'E', 'F', 'G', 'H');

CREATE TABLE "hubspot_sync"."audit_log" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "table_name" text NOT NULL,
  "operation" text NOT NULL,
  "record_id" text,
  "performed_at" timestamp without time zone DEFAULT now(),
  "performed_by" text,
  "old_values" jsonb,
  "new_values" jsonb,
  "changed_fields" text[],
  PRIMARY KEY ("id")
);

CREATE TABLE "hubspot_sync"."groups" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "group_id" character varying(50) NOT NULL,
  "group_name" character varying(100) NOT NULL,
  "time_period" character varying(10) NOT NULL,
  "start_date" date NOT NULL,
  "end_date" date,
  "max_capacity" integer DEFAULT 20,
  "status" character varying(20) DEFAULT 'active'::character varying,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  "location" text DEFAULT 'Mississauga'::text NOT NULL,
  "cycle" text,
  "phase" text DEFAULT 'Learning'::text,
  PRIMARY KEY ("id"),
  CONSTRAINT "groups_group_id_key" UNIQUE ("group_id")
);

CREATE TABLE "hubspot_sync"."groups_instructors" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "group_id" character varying(50) NOT NULL,
  "instructor_id" uuid NOT NULL,
  "status" text DEFAULT 'active'::text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "assigned_date" date NOT NULL,
  PRIMARY KEY ("id"),
  CONSTRAINT "groups_instructors_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "hubspot_sync"."groups"("group_id"),
  CONSTRAINT "groups_instructors_instructor_id_fkey" FOREIGN KEY ("instructor_id") REFERENCES "hubspot_sync"."instructors"("id"),
  CONSTRAINT "unique_group_instructor_date" UNIQUE ("group_id", "instructor_id", "assigned_date")
);

CREATE TABLE "hubspot_sync"."groups_students" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "group_id" character varying(50) NOT NULL,
  "student_id" text NOT NULL,
  "status" character varying(20) DEFAULT 'active'::character varying,
  "enrolled_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "groups_students_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "hubspot_sync"."groups"("group_id"),
  CONSTRAINT "groups_students_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "hubspot_sync"."hubspot_contact_credits"("student_id"),
  CONSTRAINT "unique_group_student" UNIQUE ("group_id", "student_id")
);

CREATE TABLE "hubspot_sync"."hubspot_bookings" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "hubspot_id" text,
  "booking_id" text,
  "associated_mock_exam" text,
  "associated_contact_id" text,
  "student_id" text,
  "name" text,
  "student_email" text,
  "is_active" text,
  "attendance" text,
  "dominant_hand" text,
  "created_at" timestamp without time zone,
  "updated_at" timestamp without time zone,
  "synced_at" timestamp without time zone DEFAULT now(),
  "token_used" text,
  "token_refunded_at" timestamp with time zone,
  "token_refund_admin" text,
  "start_time" text,
  "end_time" text,
  "ndecc_exam_date" date,
  "idempotency_key" text,
  "attending_location" text,
  "exam_date" timestamp with time zone,
  "mock_type" text,
  "hubspot_last_sync_at" timestamp with time zone,
  "mock_set" "hubspot_sync"."mock_set_enum",
  "token_refunded" text,
  PRIMARY KEY ("id"),
  CONSTRAINT "hubspot_bookings_hubspot_id_key" UNIQUE ("hubspot_id"),
  CONSTRAINT "hubspot_bookings_idempotency_key_key" UNIQUE ("idempotency_key")
);

CREATE TABLE "hubspot_sync"."hubspot_contact_credits" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "hubspot_id" text,
  "student_id" text NOT NULL,
  "email" text NOT NULL,
  "firstname" text,
  "lastname" text,
  "sj_credits" integer DEFAULT 0,
  "cs_credits" integer DEFAULT 0,
  "sjmini_credits" integer DEFAULT 0,
  "mock_discussion_token" integer DEFAULT 0,
  "shared_mock_credits" integer DEFAULT 0,
  "ndecc_exam_date" text,
  "created_at" timestamp without time zone DEFAULT now(),
  "updated_at" timestamp without time zone DEFAULT now(),
  "synced_at" timestamp without time zone DEFAULT now(),
  "hubspot_last_sync_at" timestamp with time zone,
  PRIMARY KEY ("id", "student_id"),
  CONSTRAINT "hubspot_contact_credits_hubspot_id_key" UNIQUE ("hubspot_id"),
  CONSTRAINT "hubspot_contact_credits_student_id_key" UNIQUE ("student_id"),
  CONSTRAINT "unique_student_email" UNIQUE ("student_id", "email")
);

CREATE TABLE "hubspot_sync"."hubspot_mock_exams" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "hubspot_id" text NOT NULL,
  "mock_exam_name" text,
  "mock_type" text,
  "exam_date" timestamp without time zone,
  "start_time" text,
  "end_time" text,
  "location" text,
  "capacity" integer,
  "total_bookings" integer DEFAULT 0,
  "is_active" text,
  "created_at" timestamp without time zone,
  "updated_at" timestamp without time zone,
  "synced_at" timestamp without time zone DEFAULT now(),
  "scheduled_activation_datetime" timestamp with time zone,
  "hubspot_last_sync_at" timestamp with time zone,
  "mock_set" "hubspot_sync"."mock_set_enum",
  "prerequisite_exam_ids" text[] DEFAULT '{}'::text[],
  PRIMARY KEY ("id"),
  CONSTRAINT "hubspot_mock_exams_hubspot_id_key" UNIQUE ("hubspot_id")
);

CREATE TABLE "hubspot_sync"."instructors" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "instructor_name" character varying(100) NOT NULL,
  "email" character varying(255) NOT NULL,
  "is_active" boolean DEFAULT true,
  "auth_user_id" uuid,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "instructors_email_key" UNIQUE ("email")
);

CREATE TABLE "hubspot_sync"."sync_metadata" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "sync_type" text NOT NULL,
  "last_sync_timestamp" bigint NOT NULL,
  "updated_at" timestamp without time zone DEFAULT now(),
  "created_at" timestamp without time zone DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "sync_metadata_sync_type_key" UNIQUE ("sync_type")
);

CREATE TABLE "hubspot_sync"."work_check_bookings" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "slot_id" uuid NOT NULL,
  "student_id" text NOT NULL,
  "status" character varying(20) DEFAULT 'pending'::character varying NOT NULL,
  "created_at" timestamp with time zone DEFAULT now(),
  "confirmed_at" timestamp with time zone,
  "cancelled_at" timestamp with time zone,
  "type" text DEFAULT 'Work Check'::text,
  "marked_at" timestamp with time zone,
  "seat" smallint,
  "lab" text,
  PRIMARY KEY ("id"),
  CONSTRAINT "work_check_bookings_slot_id_fkey" FOREIGN KEY ("slot_id") REFERENCES "hubspot_sync"."work_check_slots"("id"),
  CONSTRAINT "work_check_bookings_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "hubspot_sync"."hubspot_contact_credits"("student_id")
);

CREATE TABLE "hubspot_sync"."work_check_slots" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "instructor_id" uuid NOT NULL,
  "group_id" varchar[] NOT NULL,
  "slot_date" date NOT NULL,
  "slot_time" time without time zone NOT NULL,
  "duration_minutes" integer DEFAULT 30 NOT NULL,
  "total_slots" integer DEFAULT 1 NOT NULL,
  "location" character varying(255),
  "is_active" boolean DEFAULT true,
  "available_from" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  "auto_approve" boolean DEFAULT true NOT NULL,
  PRIMARY KEY ("id"),
  CONSTRAINT "work_check_slots_instructor_id_fkey" FOREIGN KEY ("instructor_id") REFERENCES "hubspot_sync"."instructors"("id"),
  CONSTRAINT "unique_slot" UNIQUE ("instructor_id", "group_id", "slot_date", "slot_time")
);

-- Indexes
CREATE UNIQUE INDEX audit_log_pkey ON hubspot_sync.audit_log USING btree (id);
CREATE UNIQUE INDEX groups_group_id_key ON hubspot_sync.groups USING btree (group_id);
CREATE UNIQUE INDEX groups_pkey ON hubspot_sync.groups USING btree (id);
CREATE INDEX idx_groups_start_date ON hubspot_sync.groups USING btree (start_date);
CREATE INDEX idx_groups_status ON hubspot_sync.groups USING btree (status);
CREATE UNIQUE INDEX groups_instructors_pkey ON hubspot_sync.groups_instructors USING btree (id);
CREATE INDEX idx_groups_instructors_group_id ON hubspot_sync.groups_instructors USING btree (group_id);
CREATE INDEX idx_groups_instructors_group_status ON hubspot_sync.groups_instructors USING btree (group_id, status);
CREATE INDEX idx_groups_instructors_instructor_id ON hubspot_sync.groups_instructors USING btree (instructor_id);
CREATE INDEX idx_groups_instructors_status ON hubspot_sync.groups_instructors USING btree (status);
CREATE UNIQUE INDEX unique_group_instructor_date ON hubspot_sync.groups_instructors USING btree (group_id, instructor_id, assigned_date);
CREATE UNIQUE INDEX groups_students_pkey ON hubspot_sync.groups_students USING btree (id);
CREATE INDEX idx_gs_group ON hubspot_sync.groups_students USING btree (group_id);
CREATE INDEX idx_gs_student ON hubspot_sync.groups_students USING btree (student_id);
CREATE UNIQUE INDEX unique_group_student ON hubspot_sync.groups_students USING btree (group_id, student_id);
CREATE UNIQUE INDEX hubspot_bookings_hubspot_id_key ON hubspot_sync.hubspot_bookings USING btree (hubspot_id);
CREATE UNIQUE INDEX hubspot_bookings_idempotency_key_key ON hubspot_sync.hubspot_bookings USING btree (idempotency_key);
CREATE UNIQUE INDEX hubspot_bookings_pkey ON hubspot_sync.hubspot_bookings USING btree (id);
CREATE INDEX idx_bookings_contact_id ON hubspot_sync.hubspot_bookings USING btree (associated_contact_id);
CREATE INDEX idx_bookings_exam_id ON hubspot_sync.hubspot_bookings USING btree (associated_mock_exam);
CREATE INDEX idx_bookings_hubspot_id ON hubspot_sync.hubspot_bookings USING btree (hubspot_id);
CREATE INDEX idx_bookings_no_hubspot_id ON hubspot_sync.hubspot_bookings USING btree (id) WHERE (hubspot_id IS NULL);
CREATE INDEX idx_bookings_student_email ON hubspot_sync.hubspot_bookings USING btree (student_email);
CREATE INDEX idx_bookings_student_id ON hubspot_sync.hubspot_bookings USING btree (student_id);
CREATE INDEX idx_hubspot_bookings_mock_set ON hubspot_sync.hubspot_bookings USING btree (mock_set) WHERE (mock_set IS NOT NULL);
CREATE UNIQUE INDEX hubspot_contact_credits_hubspot_id_key ON hubspot_sync.hubspot_contact_credits USING btree (hubspot_id);
CREATE UNIQUE INDEX hubspot_contact_credits_pkey ON hubspot_sync.hubspot_contact_credits USING btree (id, student_id);
CREATE UNIQUE INDEX hubspot_contact_credits_student_id_key ON hubspot_sync.hubspot_contact_credits USING btree (student_id);
CREATE INDEX idx_contact_credits_no_hubspot_id ON hubspot_sync.hubspot_contact_credits USING btree (id) WHERE (hubspot_id IS NULL);
CREATE INDEX idx_email ON hubspot_sync.hubspot_contact_credits USING btree (email);
CREATE INDEX idx_hubspot_id ON hubspot_sync.hubspot_contact_credits USING btree (hubspot_id);
CREATE INDEX idx_student_id ON hubspot_sync.hubspot_contact_credits USING btree (student_id);
CREATE INDEX idx_synced_at ON hubspot_sync.hubspot_contact_credits USING btree (synced_at);
CREATE UNIQUE INDEX unique_student_email ON hubspot_sync.hubspot_contact_credits USING btree (student_id, email);
CREATE UNIQUE INDEX hubspot_mock_exams_hubspot_id_key ON hubspot_sync.hubspot_mock_exams USING btree (hubspot_id);
CREATE UNIQUE INDEX hubspot_mock_exams_pkey ON hubspot_sync.hubspot_mock_exams USING btree (id);
CREATE INDEX idx_exams_active ON hubspot_sync.hubspot_mock_exams USING btree (is_active);
CREATE INDEX idx_exams_date ON hubspot_sync.hubspot_mock_exams USING btree (exam_date);
CREATE INDEX idx_exams_hubspot_id ON hubspot_sync.hubspot_mock_exams USING btree (hubspot_id);
CREATE INDEX idx_hubspot_mock_exams_prerequisite_ids ON hubspot_sync.hubspot_mock_exams USING gin (prerequisite_exam_ids) WHERE ((prerequisite_exam_ids IS NOT NULL) AND (array_length(prerequisite_exam_ids, 1) > 0));
CREATE INDEX idx_instructors_auth_user_id ON hubspot_sync.instructors USING btree (auth_user_id);
CREATE INDEX idx_instructors_email ON hubspot_sync.instructors USING btree (email);
CREATE INDEX idx_instructors_is_active ON hubspot_sync.instructors USING btree (is_active);
CREATE UNIQUE INDEX instructors_email_key ON hubspot_sync.instructors USING btree (email);
CREATE UNIQUE INDEX instructors_pkey ON hubspot_sync.instructors USING btree (id);
CREATE INDEX idx_sync_metadata_type ON hubspot_sync.sync_metadata USING btree (sync_type);
CREATE UNIQUE INDEX sync_metadata_pkey ON hubspot_sync.sync_metadata USING btree (id);
CREATE UNIQUE INDEX sync_metadata_sync_type_key ON hubspot_sync.sync_metadata USING btree (sync_type);
CREATE INDEX idx_wcb_slot ON hubspot_sync.work_check_bookings USING btree (slot_id);
CREATE INDEX idx_wcb_status ON hubspot_sync.work_check_bookings USING btree (status);
CREATE INDEX idx_wcb_student ON hubspot_sync.work_check_bookings USING btree (student_id);
CREATE UNIQUE INDEX unique_active_booking ON hubspot_sync.work_check_bookings USING btree (slot_id, student_id) WHERE ((status)::text = ANY ((ARRAY['pending'::character varying, 'confirmed'::character varying, 'marked'::character varying, 'completed'::character varying])::text[]));
CREATE UNIQUE INDEX work_check_bookings_pkey ON hubspot_sync.work_check_bookings USING btree (id);
CREATE INDEX idx_wcs_date ON hubspot_sync.work_check_slots USING btree (slot_date);
CREATE INDEX idx_wcs_group ON hubspot_sync.work_check_slots USING gin (group_id);
CREATE INDEX idx_wcs_instructor ON hubspot_sync.work_check_slots USING btree (instructor_id);
CREATE UNIQUE INDEX unique_slot ON hubspot_sync.work_check_slots USING btree (instructor_id, group_id, slot_date, slot_time);
CREATE UNIQUE INDEX work_check_slots_pkey ON hubspot_sync.work_check_slots USING btree (id);

-- Functions and Procedures
CREATE OR REPLACE FUNCTION hubspot_sync.cancel_booking_atomic(p_booking_id uuid, p_credit_field text, p_restored_credit_value integer)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_booking hubspot_sync.hubspot_bookings;  -- Full record from helper
  v_contact hubspot_sync.hubspot_contact_credits;  -- Full record from helper
  v_result JSONB;
BEGIN
  -- Use helper function to get booking record
  v_booking := hubspot_sync.get_booking(p_id := p_booking_id);

  IF v_booking.id IS NULL THEN
    RAISE EXCEPTION 'Booking not found: %', p_booking_id;
  END IF;

  -- Use helper function to get contact record (using booking's student info)
  v_contact := hubspot_sync.get_contact_credits(
    p_student_id := v_booking.student_id,
    p_email := v_booking.student_email
  );

  -- Update booking status
  UPDATE hubspot_sync.hubspot_bookings
  SET is_active = 'Cancelled',
      updated_at = NOW(),
      synced_at = NOW()
  WHERE id = p_booking_id;

  -- Restore contact credits using contact.id from helper
  EXECUTE format(
    'UPDATE hubspot_sync.hubspot_contact_credits
     SET %I = $1, updated_at = NOW(), synced_at = NOW()
     WHERE id = $2',
    p_credit_field
  ) USING p_restored_credit_value, v_contact.id;

  v_result := jsonb_build_object(
    'success', true,
    'booking_id', p_booking_id,
    'booking_hubspot_id', v_booking.hubspot_id,
    'student_id', v_booking.student_id,
    'mock_exam_id', v_booking.associated_mock_exam
  );

  RETURN v_result;
END;
$function$
;

CREATE OR REPLACE FUNCTION hubspot_sync.check_idempotency_key(p_idempotency_key text)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_booking hubspot_sync.hubspot_bookings;
BEGIN
  IF p_idempotency_key IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_booking
  FROM hubspot_sync.hubspot_bookings
  WHERE idempotency_key = p_idempotency_key;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'found', true,
    'booking_id', v_booking.booking_id,
    'id', v_booking.id,
    'hubspot_id', v_booking.hubspot_id,
    'is_active', v_booking.is_active,
    'student_id', v_booking.student_id,
    'mock_exam_id', v_booking.mock_exam_id,
    'created_at', v_booking.created_at
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION hubspot_sync.create_booking_atomic(p_booking_id text, p_student_id text, p_student_email text, p_mock_exam_id text, p_student_name text, p_token_used text, p_attending_location text, p_dominant_hand text, p_idempotency_key text, p_credit_field text, p_new_credit_value integer, p_mock_set text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_booking_uuid UUID;
  v_contact hubspot_sync.hubspot_contact_credits;
  v_exam_date DATE;
  v_mock_type TEXT;
  v_start_time TEXT;
  v_end_time TEXT;
  v_result JSONB;
  v_location TEXT;
BEGIN
  -- Use helper function to get contact record
  v_contact := hubspot_sync.get_contact_credits(
    p_student_id := p_student_id,
    p_email := p_student_email
  );

  IF v_contact.id IS NULL THEN
    RAISE EXCEPTION 'Contact not found for student_id: %, email: %', p_student_id, p_student_email;
  END IF;


  -- Get exam data including mock_type, start_time, end_time
  SELECT exam_date, mock_type, start_time, end_time,
    COALESCE(p_attending_location, location) AS attending_location
  INTO v_exam_date, v_mock_type, v_start_time, v_end_time, v_location
  FROM hubspot_sync.hubspot_mock_exams
  WHERE hubspot_id = p_mock_exam_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Mock exam not found: %', p_mock_exam_id;
  END IF;

  -- Insert booking with exam-related fields populated
  INSERT INTO hubspot_sync.hubspot_bookings (
    hubspot_id,
    booking_id,
    student_id,
    student_email,
    associated_contact_id,
    associated_mock_exam,
    name,
    is_active,
    token_used,
    attending_location,
    dominant_hand,
    idempotency_key,
    exam_date,
    mock_type,
    start_time,
    end_time,
    created_at,
    synced_at,
    mock_set
  ) VALUES (
    NULL,
    p_booking_id,
    p_student_id,
    p_student_email,
    v_contact.hubspot_id,
    p_mock_exam_id,
    p_student_name,
    'Active',
    p_token_used,
    v_location,
    p_dominant_hand,
    p_idempotency_key,
    v_exam_date,
    v_mock_type,
    v_start_time,
    v_end_time,
    NOW(),
    NOW(),
    p_mock_set::mock_set_enum 
  )
  RETURNING id INTO v_booking_uuid;

  -- Update contact credits
  EXECUTE format(
    'UPDATE hubspot_sync.hubspot_contact_credits
     SET %I = $1, updated_at = NOW(), synced_at = NOW()
     WHERE id = $2',
    p_credit_field
  ) USING p_new_credit_value, v_contact.id;

  v_result := jsonb_build_object(
    'success', true,
    'booking_id', v_booking_uuid,
    'booking_code', p_booking_id,
    'contact_hubspot_id', v_contact.hubspot_id,
    'mock_exam_hubspot_id', p_mock_exam_id
  );

  RETURN v_result;
END;
$function$
;

CREATE OR REPLACE FUNCTION hubspot_sync.create_booking_atomic_v1(p_booking_id text, p_student_id text, p_student_email text, p_mock_exam_id text, p_student_name text, p_token_used text, p_attending_location text, p_dominant_hand text, p_idempotency_key text, p_credit_field text, p_new_credit_value integer)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$DECLARE
  v_booking_uuid UUID;
  v_contact hubspot_sync.hubspot_contact_credits;
  v_exam_date DATE;
  v_mock_type TEXT;
  v_start_time TEXT;
  v_end_time TEXT;
  v_result JSONB;
  v_location TEXT;
BEGIN
  -- Use helper function to get contact record
  v_contact := hubspot_sync.get_contact_credits(
    p_student_id := p_student_id,
    p_email := p_student_email
  );

  IF v_contact.id IS NULL THEN
    RAISE EXCEPTION 'Contact not found for student_id: %, email: %', p_student_id, p_student_email;
  END IF;


  -- Get exam data including mock_type, start_time, end_time
  SELECT exam_date, mock_type, start_time, end_time,
    COALESCE(p_attending_location, location) AS attending_location
  INTO v_exam_date, v_mock_type, v_start_time, v_end_time, v_location
  FROM hubspot_sync.hubspot_mock_exams
  WHERE hubspot_id = p_mock_exam_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Mock exam not found: %', p_mock_exam_id;
  END IF;

  -- Insert booking with exam-related fields populated
  INSERT INTO hubspot_sync.hubspot_bookings (
    hubspot_id,
    booking_id,
    student_id,
    student_email,
    associated_contact_id,
    associated_mock_exam,
    name,
    is_active,
    token_used,
    attending_location,
    dominant_hand,
    idempotency_key,
    exam_date,
    mock_type,
    start_time,
    end_time,
    created_at,
    synced_at
  ) VALUES (
    NULL,
    p_booking_id,
    p_student_id,
    p_student_email,
    v_contact.hubspot_id,
    p_mock_exam_id,
    p_student_name,
    'Active',
    p_token_used,
    v_location,
    p_dominant_hand,
    p_idempotency_key,
    v_exam_date,
    v_mock_type,
    v_start_time,
    v_end_time,
    NOW(),
    NOW()
  )
  RETURNING id INTO v_booking_uuid;

  -- Update contact credits
  EXECUTE format(
    'UPDATE hubspot_sync.hubspot_contact_credits
     SET %I = $1, updated_at = NOW(), synced_at = NOW()
     WHERE id = $2',
    p_credit_field
  ) USING p_new_credit_value, v_contact.id;

  v_result := jsonb_build_object(
    'success', true,
    'booking_id', v_booking_uuid,
    'booking_code', p_booking_id,
    'contact_hubspot_id', v_contact.hubspot_id,
    'mock_exam_hubspot_id', p_mock_exam_id
  );

  RETURN v_result;
END;$function$
;

CREATE OR REPLACE FUNCTION hubspot_sync.get_booking(p_id uuid DEFAULT NULL::uuid, p_hubspot_id text DEFAULT NULL::text, p_booking_id text DEFAULT NULL::text)
 RETURNS hubspot_sync.hubspot_bookings
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_result hubspot_sync.hubspot_bookings;
BEGIN
  IF p_id IS NOT NULL THEN
    SELECT * INTO v_result FROM hubspot_sync.hubspot_bookings WHERE id = p_id;
  ELSIF p_hubspot_id IS NOT NULL THEN
    SELECT * INTO v_result FROM hubspot_sync.hubspot_bookings WHERE hubspot_id = p_hubspot_id;
  ELSIF p_booking_id IS NOT NULL THEN
    SELECT * INTO v_result FROM hubspot_sync.hubspot_bookings WHERE booking_id = p_booking_id;
  ELSE
    RAISE EXCEPTION 'Must provide id, hubspot_id, or booking_id';
  END IF;
  
  RETURN v_result;
END;
$function$
;

CREATE OR REPLACE FUNCTION hubspot_sync.get_booking_aggregates(p_location text DEFAULT NULL::text, p_date_from date DEFAULT NULL::date, p_date_to date DEFAULT NULL::date, p_status text DEFAULT NULL::text, p_type text DEFAULT NULL::text, p_instructor_id uuid DEFAULT NULL::uuid, p_limit integer DEFAULT 20, p_offset integer DEFAULT 0)
 RETURNS TABLE(aggregate_key text, slot_date date, slot_time time without time zone, location text, total_bookings bigint, pending_count bigint, confirmed_count bigint, marked_count bigint, completed_count bigint, rejected_count bigint, cancelled_count bigint, work_check_count bigint, demo_count bigint, supervised_count bigint, instructor_names text[], groups text[], bookings json)
 LANGUAGE plpgsql
AS $function$
    BEGIN
      RETURN QUERY
      WITH filtered_bookings AS (
        SELECT *
        FROM hubspot_sync.booking_details_view v
        WHERE (p_location IS NULL OR v.location = p_location)
          AND (p_date_from IS NULL OR v.slot_date >= p_date_from)
          AND (p_date_to IS NULL OR v.slot_date <= p_date_to)
          AND (p_status IS NULL OR v.status = p_status)
          AND (p_type IS NULL OR v.type = p_type)
          AND (p_instructor_id IS NULL OR v.instructor_id = p_instructor_id)
      ),
      unnested_groups AS (
        SELECT
          fb.booking_id,
          unnest(fb.group_id)::TEXT as single_group
        FROM filtered_bookings fb
        WHERE fb.group_id IS NOT NULL
      )
      SELECT
        fb.aggregate_key::TEXT,
        fb.slot_date,
        fb.slot_time::TIME,
        fb.location::TEXT,
        COUNT(DISTINCT fb.booking_id)::BIGINT as total_bookings,
        COUNT(DISTINCT fb.booking_id) FILTER (WHERE fb.status = 'pending')::BIGINT as pending_count,
        COUNT(DISTINCT fb.booking_id) FILTER (WHERE fb.status = 'confirmed')::BIGINT as confirmed_count,
        COUNT(DISTINCT fb.booking_id) FILTER (WHERE fb.status = 'marked')::BIGINT as marked_count,
        COUNT(DISTINCT fb.booking_id) FILTER (WHERE fb.status = 'completed')::BIGINT as completed_count,
        COUNT(DISTINCT fb.booking_id) FILTER (WHERE fb.status = 'rejected')::BIGINT as rejected_count,
        COUNT(DISTINCT fb.booking_id) FILTER (WHERE fb.status = 'cancelled')::BIGINT as cancelled_count,
        COUNT(DISTINCT fb.booking_id) FILTER (WHERE fb.type = 'Work Check')::BIGINT as work_check_count,
        COUNT(DISTINCT fb.booking_id) FILTER (WHERE fb.type = 'Demo')::BIGINT as demo_count,
        COUNT(DISTINCT fb.booking_id) FILTER (WHERE fb.type = 'Supervised Session')::BIGINT as supervised_count,
        ARRAY_AGG(DISTINCT fb.instructor_name::TEXT)::TEXT[] as instructor_names,
        COALESCE(ARRAY_AGG(DISTINCT ug.single_group) FILTER (WHERE ug.single_group IS NOT NULL), ARRAY[]::TEXT[]) as groups,
        JSON_AGG(
          DISTINCT JSONB_BUILD_OBJECT(
            'id', fb.booking_id,
            'slot_id', fb.slot_id,
            'student_id', fb.student_id,
            'student_name', CONCAT(COALESCE(fb.student_firstname, ''), ' ', COALESCE(fb.student_lastname, '')),
            'student_email', fb.student_email,
            'status', fb.status,
            'type', fb.type,
            'instructor_id', fb.instructor_id,
            'instructor_name', fb.instructor_name,
            'group_id', fb.group_id,
            'created_at', fb.created_at,
            'confirmed_at', fb.confirmed_at,
            'cancelled_at', fb.cancelled_at,
            'marked_at', fb.marked_at
          )
        )::JSON as bookings
      FROM filtered_bookings fb
      LEFT JOIN unnested_groups ug ON fb.booking_id = ug.booking_id
      GROUP BY fb.aggregate_key, fb.slot_date, fb.slot_time, fb.location
      ORDER BY fb.slot_date DESC, fb.slot_time ASC
      LIMIT p_limit OFFSET p_offset;
    END;
    $function$
;

CREATE OR REPLACE FUNCTION hubspot_sync.get_booking_aggregates_count(p_location text DEFAULT NULL::text, p_date_from date DEFAULT NULL::date, p_date_to date DEFAULT NULL::date, p_status text DEFAULT NULL::text, p_type text DEFAULT NULL::text, p_instructor_id uuid DEFAULT NULL::uuid)
 RETURNS integer
 LANGUAGE plpgsql
AS $function$
  DECLARE
    result INT;
  BEGIN
    SELECT COUNT(DISTINCT aggregate_key) INTO result
    FROM hubspot_sync.booking_details_view v
    WHERE (p_location IS NULL OR v.location = p_location)
      AND (p_date_from IS NULL OR v.slot_date >= p_date_from)
      AND (p_date_to IS NULL OR v.slot_date <= p_date_to)
      AND (p_status IS NULL OR v.status = p_status)
      AND (p_type IS NULL OR v.type = p_type)
      AND (p_instructor_id IS NULL OR v.instructor_id = p_instructor_id);

    RETURN COALESCE(result, 0);
  END;
  $function$
;

CREATE OR REPLACE FUNCTION hubspot_sync.get_changed_fields(old_row jsonb, new_row jsonb)
 RETURNS text[]
 LANGUAGE plpgsql
 IMMUTABLE
AS $function$
DECLARE
  changed TEXT[] := ARRAY[]::TEXT[];
  field TEXT;
BEGIN
  IF old_row IS NULL OR new_row IS NULL THEN
    RETURN changed;
  END IF;

  FOR field IN SELECT jsonb_object_keys(new_row)
  LOOP
    IF field NOT IN ('synced_at', 'updated_at') THEN
      IF old_row->field IS DISTINCT FROM new_row->field THEN
        changed := array_append(changed, field);
      END IF;
    END IF;
  END LOOP;

  RETURN changed;
END;
$function$
;

CREATE OR REPLACE FUNCTION hubspot_sync.get_contact_credits(p_student_id text DEFAULT NULL::text, p_email text DEFAULT NULL::text, p_id uuid DEFAULT NULL::uuid, p_hubspot_id text DEFAULT NULL::text)
 RETURNS hubspot_sync.hubspot_contact_credits
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_result hubspot_sync.hubspot_contact_credits;
BEGIN
  IF p_id IS NOT NULL THEN
    SELECT * INTO v_result FROM hubspot_sync.hubspot_contact_credits WHERE id = p_id;
  ELSIF p_hubspot_id IS NOT NULL THEN
    SELECT * INTO v_result FROM hubspot_sync.hubspot_contact_credits WHERE hubspot_id = p_hubspot_id;
  ELSIF p_student_id IS NOT NULL AND p_email IS NOT NULL THEN
    SELECT * INTO v_result FROM hubspot_sync.hubspot_contact_credits WHERE student_id = p_student_id AND email = p_email;
  ELSE
    RAISE EXCEPTION 'Must provide id, hubspot_id, or (student_id AND email)';
  END IF;
  
  RETURN v_result;
END;
$function$
;

CREATE OR REPLACE FUNCTION hubspot_sync.increment_exam_bookings(p_exam_id text, p_delta integer)
 RETURNS integer
 LANGUAGE plpgsql
AS $function$DECLARE
  v_new_count INTEGER;
BEGIN
  -- Atomic update with RETURNING clause
  UPDATE hubspot_sync.hubspot_mock_exams
  SET
    total_bookings = GREATEST(0, COALESCE(total_bookings, 0) + p_delta),
    updated_at = NOW(),
    synced_at = NOW()
  WHERE hubspot_id = p_exam_id
  RETURNING total_bookings INTO v_new_count;

  -- If no rows updated, exam doesn't exist in Supabase yet
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Exam % not found in Supabase', p_exam_id;
  END IF;

  RETURN v_new_count;
END;$function$
;

CREATE OR REPLACE FUNCTION hubspot_sync.log_booking_changes()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  old_json JSONB;
  new_json JSONB;
  changed_fields TEXT[];
BEGIN
  -- Convert rows to JSONB
  IF TG_OP = 'DELETE' THEN
    old_json := to_jsonb(OLD);
    new_json := NULL;
  ELSIF TG_OP = 'INSERT' THEN
    old_json := NULL;
    new_json := to_jsonb(NEW);
  ELSE -- UPDATE
    old_json := to_jsonb(OLD);
    new_json := to_jsonb(NEW);
    changed_fields := hubspot_sync.get_changed_fields(old_json, new_json);
  END IF;

  -- Insert audit record with new columns
  INSERT INTO hubspot_sync.audit_log (
    table_name,
    operation,
    record_id,
    performed_by,
    old_values,
    new_values,
    changed_fields
  ) VALUES (
    'hubspot_bookings',
    TG_OP,
    COALESCE(NEW.hubspot_id, OLD.hubspot_id),
    current_user,
    old_json,
    new_json,
    changed_fields
  );

  RETURN COALESCE(NEW, OLD);
END;
$function$
;

CREATE OR REPLACE FUNCTION hubspot_sync.log_contact_credits_changes()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  old_json JSONB;
  new_json JSONB;
  changed_fields TEXT[];
BEGIN
  IF TG_OP = 'DELETE' THEN
    old_json := to_jsonb(OLD);
    new_json := NULL;
  ELSIF TG_OP = 'INSERT' THEN
    old_json := NULL;
    new_json := to_jsonb(NEW);
  ELSE -- UPDATE
    old_json := to_jsonb(OLD);
    new_json := to_jsonb(NEW);
    changed_fields := hubspot_sync.get_changed_fields(old_json, new_json);
  END IF;

  INSERT INTO hubspot_sync.audit_log (
    table_name,
    operation,
    record_id,
    performed_by,
    old_values,
    new_values,
    changed_fields
  ) VALUES (
    'hubspot_contact_credits',
    TG_OP,
    COALESCE(NEW.hubspot_id, OLD.hubspot_id),
    current_user,
    old_json,
    new_json,
    changed_fields
  );

  RETURN COALESCE(NEW, OLD);
END;
$function$
;

CREATE OR REPLACE FUNCTION hubspot_sync.log_exam_changes()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  old_json JSONB;
  new_json JSONB;
  changed_fields TEXT[];
BEGIN
  IF TG_OP = 'DELETE' THEN
    old_json := to_jsonb(OLD);
    new_json := NULL;
  ELSIF TG_OP = 'INSERT' THEN
    old_json := NULL;
    new_json := to_jsonb(NEW);
  ELSE -- UPDATE
    old_json := to_jsonb(OLD);
    new_json := to_jsonb(NEW);
    changed_fields := hubspot_sync.get_changed_fields(old_json, new_json);
  END IF;

  INSERT INTO hubspot_sync.audit_log (
    table_name,
    operation,
    record_id,
    performed_by,
    old_values,
    new_values,
    changed_fields
  ) VALUES (
    'hubspot_mock_exams',
    TG_OP,
    COALESCE(NEW.hubspot_id, OLD.hubspot_id),
    current_user,
    old_json,
    new_json,
    changed_fields
  );

  RETURN COALESCE(NEW, OLD);
END;
$function$
;

CREATE OR REPLACE FUNCTION hubspot_sync.update_exam_prerequisites(p_exam_id text, p_add_ids text[] DEFAULT '{}'::text[], p_remove_ids text[] DEFAULT '{}'::text[])
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_result TEXT[];
  v_previous TEXT[];
  v_added_count INTEGER := 0;
  v_removed_count INTEGER := 0;
BEGIN
  -- Get current prerequisites for logging
  SELECT COALESCE(prerequisite_exam_ids, '{}')
  INTO v_previous
  FROM hubspot_sync.hubspot_mock_exams
  WHERE hubspot_id = p_exam_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Exam % not found in Supabase', p_exam_id;
  END IF;

  -- Perform atomic update with add and remove operations
  UPDATE hubspot_sync.hubspot_mock_exams
  SET
    prerequisite_exam_ids = (
      SELECT COALESCE(array_agg(DISTINCT elem ORDER BY elem), '{}')
      FROM (
        -- Start with existing prerequisites
        SELECT unnest(COALESCE(prerequisite_exam_ids, '{}')) AS elem
        -- Exclude items being removed
        EXCEPT
        SELECT unnest(p_remove_ids)
        -- Union with items being added
        UNION
        SELECT unnest(p_add_ids)
      ) sub
      WHERE elem IS NOT NULL AND elem != ''
    ),
    updated_at = NOW()
  WHERE hubspot_id = p_exam_id
  RETURNING prerequisite_exam_ids INTO v_result;

  -- Calculate what was actually added/removed
  v_added_count := (
    SELECT COUNT(*) FROM unnest(v_result) AS elem
    WHERE elem = ANY(p_add_ids) AND NOT elem = ANY(v_previous)
  );

  v_removed_count := (
    SELECT COUNT(*) FROM unnest(v_previous) AS elem
    WHERE elem = ANY(p_remove_ids) AND NOT elem = ANY(v_result)
  );

  -- Return detailed result
  RETURN jsonb_build_object(
    'success', true,
    'exam_id', p_exam_id,
    'prerequisite_exam_ids', v_result,
    'previous_count', array_length(v_previous, 1),
    'current_count', array_length(v_result, 1),
    'added_count', v_added_count,
    'removed_count', v_removed_count,
    'requested_add', p_add_ids,
    'requested_remove', p_remove_ids
  );
END;
$function$
;

-- Triggers
CREATE TRIGGER bookings_audit_trigger AFTER INSERT OR DELETE OR UPDATE ON hubspot_sync.hubspot_bookings FOR EACH ROW EXECUTE FUNCTION hubspot_sync.log_booking_changes();

CREATE TRIGGER contact_credits_audit_trigger AFTER INSERT OR DELETE OR UPDATE ON hubspot_sync.hubspot_contact_credits FOR EACH ROW EXECUTE FUNCTION hubspot_sync.log_contact_credits_changes();

CREATE TRIGGER exams_audit_trigger AFTER INSERT OR DELETE OR UPDATE ON hubspot_sync.hubspot_mock_exams FOR EACH ROW EXECUTE FUNCTION hubspot_sync.log_exam_changes();

-- Row Level Security
ALTER TABLE "hubspot_sync"."audit_log" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "hubspot_sync"."groups" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "hubspot_sync"."groups_instructors" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "hubspot_sync"."groups_students" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "hubspot_sync"."hubspot_bookings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "hubspot_sync"."hubspot_contact_credits" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "hubspot_sync"."hubspot_mock_exams" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "hubspot_sync"."instructors" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "hubspot_sync"."sync_metadata" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "hubspot_sync"."work_check_bookings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "hubspot_sync"."work_check_slots" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Deny direct access to audit log" ON "hubspot_sync"."audit_log" AS PERMISSIVE FOR ALL TO anon USING (false);

CREATE POLICY "Deny anon access to groups" ON "hubspot_sync"."groups" AS PERMISSIVE FOR ALL TO anon USING (false) WITH CHECK (false);

CREATE POLICY "Deny authenticated access to groups" ON "hubspot_sync"."groups" AS PERMISSIVE FOR ALL TO authenticated USING (false) WITH CHECK (false);

CREATE POLICY "Service role has full access" ON "hubspot_sync"."groups" AS PERMISSIVE FOR ALL  USING (true) WITH CHECK (true);

CREATE POLICY "Deny anon access to groups_instructors" ON "hubspot_sync"."groups_instructors" AS PERMISSIVE FOR ALL TO anon USING (false) WITH CHECK (false);

CREATE POLICY "Deny authenticated access to groups_instructors" ON "hubspot_sync"."groups_instructors" AS PERMISSIVE FOR ALL TO authenticated USING (false) WITH CHECK (false);

CREATE POLICY "Service role has full access" ON "hubspot_sync"."groups_instructors" AS PERMISSIVE FOR ALL  USING (true) WITH CHECK (true);

CREATE POLICY "Service role has full access to groups_instructors" ON "hubspot_sync"."groups_instructors" AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Deny anon access to groups_students" ON "hubspot_sync"."groups_students" AS PERMISSIVE FOR ALL TO anon USING (false) WITH CHECK (false);

CREATE POLICY "Deny authenticated access to groups_students" ON "hubspot_sync"."groups_students" AS PERMISSIVE FOR ALL TO authenticated USING (false) WITH CHECK (false);

CREATE POLICY "Service role has full access" ON "hubspot_sync"."groups_students" AS PERMISSIVE FOR ALL  USING (true) WITH CHECK (true);

CREATE POLICY "Allow zapier_sync_user to insert bookings" ON "hubspot_sync"."hubspot_bookings" AS PERMISSIVE FOR INSERT TO zapier_sync_user WITH CHECK (true);

CREATE POLICY "Allow zapier_sync_user to read bookings" ON "hubspot_sync"."hubspot_bookings" AS PERMISSIVE FOR SELECT TO zapier_sync_user USING (true);

CREATE POLICY "Allow zapier_sync_user to update bookings" ON "hubspot_sync"."hubspot_bookings" AS PERMISSIVE FOR UPDATE TO zapier_sync_user USING (true) WITH CHECK (true);

CREATE POLICY "Deny direct access to bookings" ON "hubspot_sync"."hubspot_bookings" AS PERMISSIVE FOR ALL TO anon, authenticated USING (false);

CREATE POLICY "Service role has full access" ON "hubspot_sync"."hubspot_contact_credits" AS PERMISSIVE FOR ALL  USING (true) WITH CHECK (true);

CREATE POLICY "Allow zapier_sync_user to insert exams" ON "hubspot_sync"."hubspot_mock_exams" AS PERMISSIVE FOR INSERT TO zapier_sync_user WITH CHECK (true);

CREATE POLICY "Allow zapier_sync_user to read exams" ON "hubspot_sync"."hubspot_mock_exams" AS PERMISSIVE FOR SELECT TO zapier_sync_user USING (true);

CREATE POLICY "Allow zapier_sync_user to update exams" ON "hubspot_sync"."hubspot_mock_exams" AS PERMISSIVE FOR UPDATE TO zapier_sync_user USING (true) WITH CHECK (true);

CREATE POLICY "Deny direct access to mock_exams" ON "hubspot_sync"."hubspot_mock_exams" AS PERMISSIVE FOR ALL TO anon, authenticated USING (false);

CREATE POLICY "Deny anon access to instructors" ON "hubspot_sync"."instructors" AS PERMISSIVE FOR ALL TO anon USING (false) WITH CHECK (false);

CREATE POLICY "Deny authenticated access to instructors" ON "hubspot_sync"."instructors" AS PERMISSIVE FOR ALL TO authenticated USING (false) WITH CHECK (false);

CREATE POLICY "Service role has full access" ON "hubspot_sync"."instructors" AS PERMISSIVE FOR ALL  USING (true) WITH CHECK (true);

CREATE POLICY "Service role can manage sync metadata" ON "hubspot_sync"."sync_metadata" AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_all_access" ON "hubspot_sync"."sync_metadata" AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Deny anon access to work_check_bookings" ON "hubspot_sync"."work_check_bookings" AS PERMISSIVE FOR ALL TO anon USING (false) WITH CHECK (false);

CREATE POLICY "Deny authenticated access to work_check_bookings" ON "hubspot_sync"."work_check_bookings" AS PERMISSIVE FOR ALL TO authenticated USING (false) WITH CHECK (false);

CREATE POLICY "Service role has full access" ON "hubspot_sync"."work_check_bookings" AS PERMISSIVE FOR ALL  USING (true) WITH CHECK (true);

CREATE POLICY "Deny anon access to work_check_slots" ON "hubspot_sync"."work_check_slots" AS PERMISSIVE FOR ALL TO anon USING (false) WITH CHECK (false);

CREATE POLICY "Deny authenticated access to work_check_slots" ON "hubspot_sync"."work_check_slots" AS PERMISSIVE FOR ALL TO authenticated USING (false) WITH CHECK (false);

CREATE POLICY "Service role has full access" ON "hubspot_sync"."work_check_slots" AS PERMISSIVE FOR ALL  USING (true) WITH CHECK (true);
