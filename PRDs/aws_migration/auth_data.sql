-- ============================================================================
-- AUTH DATA — AWS Migration (Cleaned)
-- Only auth.users data mapped to admin_users table
-- Source: Supabase auth data dump, 2026-02-23
-- ============================================================================
--
-- MIGRATED:
--   auth.users (8 rows) → admin_users
--
-- DROPPED (not needed on AWS):
--   auth.audit_log_entries   (5520 rows) — Supabase internal audit trail
--   auth.identities          (8 rows)    — Provider links, flattened into admin_users
--   auth.mfa_amr_claims      (38 rows)   — MFA (out of scope)
--   auth.refresh_tokens      (702 rows)  — Supabase session format, force re-login
--   auth.schema_migrations   (74 rows)   — GoTrue internal tracking
--   auth.sessions            (38 rows)   — Supabase session format, force re-login
--
-- ============================================================================

-- 8 users migrated from auth.users → admin_users
-- Preserved: id, email, encrypted_password (bcrypt, compatible with bcryptjs)
-- Mapped: raw_app_meta_data->>'user_role' → user_role (defaulting to 'admin')
-- Note: instructor_id must be linked separately via UPDATE after instructors table exists

INSERT INTO "admin_users" ("id", "email", "encrypted_password", "user_role", "raw_app_meta_data", "raw_user_meta_data", "last_sign_in_at", "email_confirmed_at", "is_active", "created_at", "updated_at") VALUES
('3e38e450-a85d-45a9-96a9-c9aeaa88a063', 'operations@prepdoctors.com', '$2a$10$Gw8isheMxnu3Bgze8x.RQuCYuhNrPGz9a0SIbUfRv65WZh/UN2GQm', 'admin', '{"provider":"email","providers":["email"]}'::jsonb, '{"email_verified":true,"device_fingerprint":"f6806aaa55420823"}'::jsonb, '2026-02-19T15:47:12.639Z', '2025-10-22T15:07:35.407Z', TRUE, '2025-10-22T15:07:35.362Z', '2026-02-23T06:29:53.683Z'),

('f252d579-bda6-46d0-9893-fa37a10d80ea', 'htuazon@prepdoctors.com', '$2a$10$U6oHBKd7qbyEdLEfVnYVZ.5jho47eRN.o1Zbti8kKL9eLcDKDLop6', 'admin', '{"provider":"email","providers":["email"]}'::jsonb, '{"email_verified":true,"device_fingerprint":"816147bedd84317a"}'::jsonb, '2026-02-19T17:40:01.161Z', '2025-11-19T18:17:15.825Z', TRUE, '2025-11-19T18:17:15.782Z', '2026-02-19T20:59:09.415Z'),

('b771d65e-9b16-421a-aaff-e090dcba8ab0', 'ndecc_admin@prepdoctors.com', '$2a$10$gABPO34NTaEGdlywmjgp7.EJsQUknkHxtaDx6PJAcR2tzEvpO3G8y', 'admin', '{"provider":"email","providers":["email"]}'::jsonb, '{"email_verified":true}'::jsonb, '2026-01-07T19:42:40.124Z', '2025-11-19T19:34:48.341Z', TRUE, '2025-11-19T19:34:48.292Z', '2026-02-20T18:43:35.672Z'),

('3508558c-6bad-4d75-94cf-129c37d4bf13', 'montreal@prepdoctors.com', '$2a$10$zOTBXy5VoBk91oAhlPSSIe1ROvCKkibEfqNdXPkDdmpJoMh9dVbwO', 'admin', '{"provider":"email","providers":["email"]}'::jsonb, '{"email_verified":true}'::jsonb, '2026-02-20T13:23:55.831Z', '2025-11-20T19:13:55.787Z', TRUE, '2025-11-20T19:13:55.758Z', '2026-02-21T23:27:15.103Z'),

('8d4608be-9c00-4ef4-a4ba-6179242b40f4', 'rh@prepdoctors.com', '$2a$10$VkcykIb5BoQwtP6wp8SgPuBkj4cmwAdpUkxuLtHdmUMHkylykNPHC', 'admin', '{"provider":"email","providers":["email"]}'::jsonb, '{"email_verified":true}'::jsonb, '2026-01-26T18:35:26.301Z', '2025-11-27T17:04:02.127Z', TRUE, '2025-11-27T17:04:02.123Z', '2026-02-23T13:35:28.871Z'),

('2ca370a3-1da8-42d0-bfdd-4872ebde6e63', 'calgary@prepdoctors.com', '$2a$10$HlKPjNWVuQ4Z0XL/VjY4/.UqYaY8AoRcJXHc0ZMs747P.6F/lDV8.', 'admin', '{"provider":"email","providers":["email"]}'::jsonb, '{"email_verified":true}'::jsonb, '2026-02-20T22:52:15.255Z', '2025-11-27T17:03:22.619Z', TRUE, '2025-11-27T17:03:22.566Z', '2026-02-22T20:41:05.248Z'),

('6ef53825-8fa8-4da4-b9ee-b77780319186', 'vancouver@prepdoctors.com', '$2a$10$6jX7rmRO/tWnDL7pf/RN6.XJxflxXqCNq1JcK37C0jE6.RhCK7n7m', 'admin', '{"provider":"email","providers":["email"]}'::jsonb, '{"email_verified":true}'::jsonb, '2026-02-22T18:40:08.713Z', '2025-11-27T17:03:31.783Z', TRUE, '2025-11-27T17:03:31.769Z', '2026-02-22T21:54:26.851Z'),

('766d3494-8d4c-4b12-846e-17533aae5ec7', 'test@prepdoctors.com', '$2a$10$MM8caQAEYKwDVMRf/RU9/OcGmbUsMEe2eRh9yuO9n.VjpKqe4Qg62', 'admin', '{"provider":"email","providers":["email"]}'::jsonb, '{"email_verified":true,"device_fingerprint":"816147bedd84317a"}'::jsonb, '2026-02-19T17:32:29.684Z', '2026-02-11T23:55:02.841Z', TRUE, '2026-02-11T23:55:02.825Z', '2026-02-19T17:32:29.770Z');

-- ============================================================================
-- POST-INSERT: Link instructor_id from instructors table
-- Run AFTER instructors table is populated on RDS
-- ============================================================================
-- UPDATE admin_users au
-- SET instructor_id = i.id
-- FROM hubspot_sync.instructors i
-- WHERE au.email = i.email;
-- ============================================================================
