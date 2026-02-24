-- Data dump: public
-- Generated: 2026-02-23T15:06:18.998Z

-- Table: public.role_permissions (40 rows)
INSERT INTO "public"."role_permissions" ("id", "role", "permission") VALUES ('fb757ae0-44b8-4cb6-ac5d-f1fc1b3862c1', 'super_admin', 'bookings.create');
INSERT INTO "public"."role_permissions" ("id", "role", "permission") VALUES ('12066732-7969-498b-a485-6ee2e84b070e', 'super_admin', 'bookings.cancel');
INSERT INTO "public"."role_permissions" ("id", "role", "permission") VALUES ('f4459e5b-ad0d-4766-a477-a197d8ada23f', 'super_admin', 'bookings.batch_cancel');
INSERT INTO "public"."role_permissions" ("id", "role", "permission") VALUES ('5e814cfe-3db4-487d-9007-dce8035928d7', 'super_admin', 'bookings.view');
INSERT INTO "public"."role_permissions" ("id", "role", "permission") VALUES ('d000be84-a5c7-4eb8-a2d3-e4fb9199381e', 'super_admin', 'exams.create');
INSERT INTO "public"."role_permissions" ("id", "role", "permission") VALUES ('1bcdb28c-3ab2-40f9-8ae6-6528b0809004', 'super_admin', 'exams.edit');
INSERT INTO "public"."role_permissions" ("id", "role", "permission") VALUES ('981ddbcc-7a84-498c-a5b5-12e1ed3d0a55', 'super_admin', 'exams.delete');
INSERT INTO "public"."role_permissions" ("id", "role", "permission") VALUES ('18038027-57f0-4350-9d8c-00f620a039e2', 'super_admin', 'exams.activate');
INSERT INTO "public"."role_permissions" ("id", "role", "permission") VALUES ('27cbdda3-419c-460f-9734-eb308dd8dd1b', 'super_admin', 'exams.view');
INSERT INTO "public"."role_permissions" ("id", "role", "permission") VALUES ('d3f6fafe-6119-4d47-a423-f1f5567c602c', 'admin', 'bookings.create');
INSERT INTO "public"."role_permissions" ("id", "role", "permission") VALUES ('7de72dd2-1795-4b83-b450-cd8d22383884', 'admin', 'bookings.cancel');
INSERT INTO "public"."role_permissions" ("id", "role", "permission") VALUES ('020b18b6-48b6-4e6f-a8bc-bbd1786f1b5b', 'admin', 'bookings.batch_cancel');
INSERT INTO "public"."role_permissions" ("id", "role", "permission") VALUES ('44adb290-2d0c-4bc2-8a03-d925f16a6f9b', 'admin', 'bookings.view');
INSERT INTO "public"."role_permissions" ("id", "role", "permission") VALUES ('310ef8c5-9acc-49f4-9196-a8ecab4c5b3e', 'admin', 'exams.view');
INSERT INTO "public"."role_permissions" ("id", "role", "permission") VALUES ('3edcc2a7-a03a-4fce-9098-2944d4007efd', 'viewer', 'bookings.view');
INSERT INTO "public"."role_permissions" ("id", "role", "permission") VALUES ('ddf0fe43-abf7-4a42-a031-3ce04dcd27e7', 'viewer', 'exams.view');
INSERT INTO "public"."role_permissions" ("id", "role", "permission") VALUES ('251a615d-eb70-4e2e-bd68-e532075495af', 'super_admin', 'bookings.export');
INSERT INTO "public"."role_permissions" ("id", "role", "permission") VALUES ('f6c1f894-3c1c-4a8f-8d8f-bb058f4c79ee', 'admin', 'bookings.export');
INSERT INTO "public"."role_permissions" ("id", "role", "permission") VALUES ('bc0144dc-44be-4ec4-9b0d-f0dcaff88851', 'super_admin', 'contacts.tokens');
INSERT INTO "public"."role_permissions" ("id", "role", "permission") VALUES ('b0c78b80-b577-42d5-a038-d6300a0497ee', 'admin', 'contacts.tokens');
INSERT INTO "public"."role_permissions" ("id", "role", "permission") VALUES ('7814e132-42ed-4bf2-ab74-b253becbebe0', 'instructor', 'workcheck.create');
INSERT INTO "public"."role_permissions" ("id", "role", "permission") VALUES ('b3de9289-98be-4ca6-b9aa-0896dee49c30', 'instructor', 'workcheck.edit');
INSERT INTO "public"."role_permissions" ("id", "role", "permission") VALUES ('c95fe45c-2c77-4a00-95a5-a45b3ba54d23', 'instructor', 'workcheck.view');
INSERT INTO "public"."role_permissions" ("id", "role", "permission") VALUES ('b85e446f-f9e4-494e-b9a4-8abed38e125b', 'super_admin', 'workcheck.create');
INSERT INTO "public"."role_permissions" ("id", "role", "permission") VALUES ('b5f00c29-807b-4fb8-bf92-697f72c77ca2', 'super_admin', 'workcheck.edit');
INSERT INTO "public"."role_permissions" ("id", "role", "permission") VALUES ('32078875-4c9b-4ea8-a0a2-db133c989090', 'super_admin', 'workcheck.delete');
INSERT INTO "public"."role_permissions" ("id", "role", "permission") VALUES ('34e14a2b-bb20-40b9-a21d-beb3b457db54', 'super_admin', 'workcheck.view');
INSERT INTO "public"."role_permissions" ("id", "role", "permission") VALUES ('86993861-5bed-4505-9c8b-2c1c52a6592d', 'admin', 'workcheck.create');
INSERT INTO "public"."role_permissions" ("id", "role", "permission") VALUES ('7df660aa-edf0-4a90-bfad-f18bd4d9b3f8', 'admin', 'workcheck.edit');
INSERT INTO "public"."role_permissions" ("id", "role", "permission") VALUES ('5e1724b8-3a94-48b2-b108-a10f5dd95012', 'admin', 'workcheck.delete');
INSERT INTO "public"."role_permissions" ("id", "role", "permission") VALUES ('6948d79a-66a4-4052-979a-d59e6f35842d', 'admin', 'workcheck.view');
INSERT INTO "public"."role_permissions" ("id", "role", "permission") VALUES ('3410bec0-8372-486c-89b7-d49ecfe23b86', 'super_admin', 'groups.create');
INSERT INTO "public"."role_permissions" ("id", "role", "permission") VALUES ('4d56dd36-68ea-45df-89d9-1295740f33e5', 'super_admin', 'groups.edit');
INSERT INTO "public"."role_permissions" ("id", "role", "permission") VALUES ('8064d109-0057-4f70-bcea-45eeb17d7d26', 'super_admin', 'groups.delete');
INSERT INTO "public"."role_permissions" ("id", "role", "permission") VALUES ('31a7ffe2-822f-4728-b887-c42945830c55', 'super_admin', 'groups.view');
INSERT INTO "public"."role_permissions" ("id", "role", "permission") VALUES ('9c59843a-f703-4ccd-9140-c25a39b161ed', 'admin', 'groups.create');
INSERT INTO "public"."role_permissions" ("id", "role", "permission") VALUES ('f96ed9d8-85e5-4acd-8c03-86bc31bbed0e', 'admin', 'groups.edit');
INSERT INTO "public"."role_permissions" ("id", "role", "permission") VALUES ('dc285283-c89b-4c73-9a8a-6ad4ce605a71', 'admin', 'groups.delete');
INSERT INTO "public"."role_permissions" ("id", "role", "permission") VALUES ('d0824cb4-f9b7-4236-b555-b79b61fe24a7', 'admin', 'groups.view');
INSERT INTO "public"."role_permissions" ("id", "role", "permission") VALUES ('1b580b6f-0a1e-4f28-950a-1258d0b78599', 'instructor', 'groups.view');

-- Table: public.user_roles (8 rows)
INSERT INTO "public"."user_roles" ("id", "user_id", "role", "granted_by", "granted_at", "notes") VALUES ('091ee94f-e0e4-4804-8015-a38340ec5382', '3e38e450-a85d-45a9-96a9-c9aeaa88a063', 'super_admin', NULL, '2025-11-19T19:02:37.384Z', 'Initial super admin - bootstrapped during setup');
INSERT INTO "public"."user_roles" ("id", "user_id", "role", "granted_by", "granted_at", "notes") VALUES ('c861e110-4aa9-4058-bab5-05864db1b311', 'f252d579-bda6-46d0-9893-fa37a10d80ea', 'super_admin', NULL, '2025-11-19T19:35:36.892Z', NULL);
INSERT INTO "public"."user_roles" ("id", "user_id", "role", "granted_by", "granted_at", "notes") VALUES ('699abf8a-6487-495f-b5be-d3b320fb95d7', '2ca370a3-1da8-42d0-bfdd-4872ebde6e63', 'admin', 'f252d579-bda6-46d0-9893-fa37a10d80ea', '2025-11-27T17:11:00.047Z', 'remote locations profile');
INSERT INTO "public"."user_roles" ("id", "user_id", "role", "granted_by", "granted_at", "notes") VALUES ('ec51f2bc-965d-44f0-8061-d78a1494a7df', '8d4608be-9c00-4ef4-a4ba-6179242b40f4', 'admin', 'f252d579-bda6-46d0-9893-fa37a10d80ea', '2025-11-27T17:11:00.047Z', 'remote locations profile');
INSERT INTO "public"."user_roles" ("id", "user_id", "role", "granted_by", "granted_at", "notes") VALUES ('9c534cf4-7b7c-4607-93fe-bd084796bc07', '6ef53825-8fa8-4da4-b9ee-b77780319186', 'admin', 'f252d579-bda6-46d0-9893-fa37a10d80ea', '2025-11-27T17:11:00.047Z', 'remote locations profile');
INSERT INTO "public"."user_roles" ("id", "user_id", "role", "granted_by", "granted_at", "notes") VALUES ('ce164d07-9914-4625-a156-28296c697fdf', '3508558c-6bad-4d75-94cf-129c37d4bf13', 'admin', 'f252d579-bda6-46d0-9893-fa37a10d80ea', '2025-11-20T19:15:20.168Z', 'remote locations profile');
INSERT INTO "public"."user_roles" ("id", "user_id", "role", "granted_by", "granted_at", "notes") VALUES ('be7aab12-6694-4494-920b-84fec5bbe97b', 'b771d65e-9b16-421a-aaff-e090dcba8ab0', 'admin', NULL, '2025-11-19T19:35:45.952Z', 'account for Dr.Hasan and Dr.Obay');
INSERT INTO "public"."user_roles" ("id", "user_id", "role", "granted_by", "granted_at", "notes") VALUES ('e0bd41a6-3a38-445a-8bc1-56f1454aa4bb', '766d3494-8d4c-4b12-846e-17533aae5ec7', 'instructor', 'f252d579-bda6-46d0-9893-fa37a10d80ea', '2026-02-12T15:08:15.000Z', NULL);
