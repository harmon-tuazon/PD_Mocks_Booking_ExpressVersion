/**
 * POST /api/admin/instructors/create
 * Create a new instructor with Supabase Auth account
 * Permission: 'workcheck.create'
 *
 * Flow:
 * 1. Create Supabase Auth user (email + password, Supabase hashes internally)
 * 2. Insert instructor record with auth_user_id link
 * 3. INSERT into user_roles with role='instructor'
 * Rollback on failure: reverse order cleanup
 */

const { requirePermission } = require('../../middleware/requirePermission');
const { validationMiddleware } = require('../../services/validation');
const { supabaseAdmin } = require('../../services/supabase');
const { sanitizeFields } = require('../../services/sanitize');

const create = async (req, res, next) => {
  try {
    // Verify admin authentication and permission
    await requirePermission(req, 'workcheck.create');

    // Validate request body (now includes password)
    const validator = validationMiddleware('instructorCreate');
    await new Promise((resolve, reject) => {
      validator(req, res, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });

    // Sanitize user-provided string fields to prevent stored XSS
    const sanitized = sanitizeFields(req.validatedData, ['instructor_name']);
    const { instructor_name, email, password } = sanitized;
    const normalizedEmail = email.toLowerCase().trim();

    // Do NOT log password
    console.log('[Instructor Create] Creating instructor:', { instructor_name, email: normalizedEmail });

    // Check for duplicate email in instructors table
    const { data: existingInstructor } = await supabaseAdmin
      .from('instructors')
      .select('id, email')
      .eq('email', normalizedEmail)
      .single();

    if (existingInstructor) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'DUPLICATE_EMAIL',
          message: 'An instructor with this email already exists'
        }
      });
    }

    // Step 1: Create Supabase Auth user
    // Supabase handles password hashing (bcrypt) internally
    // NOTE: Do NOT set user_role or permissions in app_metadata — the custom_access_token_hook
    // injects these from the user_roles and role_permissions tables on login/refresh
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: normalizedEmail,
      password: password,
      email_confirm: true // Skip email verification — admin is vouching for the email
    });

    if (authError) {
      console.error('[Auth ERROR] Failed to create auth user:', authError.message);

      // Handle duplicate auth user (email already exists in auth.users)
      if (authError.message?.includes('already been registered') || authError.status === 422) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'AUTH_EMAIL_EXISTS',
            message: 'A login account with this email already exists in the system'
          }
        });
      }

      throw new Error(`Failed to create auth account: ${authError.message}`);
    }

    const authUserId = authData.user.id;

    // Step 2: Insert instructor record with auth_user_id link
    const { data: newInstructor, error: insertError } = await supabaseAdmin
      .from('instructors')
      .insert({
        instructor_name: instructor_name.trim(),
        email: normalizedEmail,
        is_active: true,
        auth_user_id: authUserId
      })
      .select()
      .single();

    if (insertError) {
      console.error('[Supabase ERROR] Instructor insert failed:', insertError.message);

      // Rollback: delete the auth user we just created
      console.log('[Rollback] Deleting auth user:', authUserId);
      await supabaseAdmin.auth.admin.deleteUser(authUserId);

      if (insertError.code === '23505') {
        return res.status(400).json({
          success: false,
          error: {
            code: 'DUPLICATE_EMAIL',
            message: 'An instructor with this email already exists'
          }
        });
      }

      throw new Error(`Failed to create instructor: ${insertError.message}`);
    }

    // Step 3: Assign 'instructor' role via user_roles table
    // The custom_access_token_hook reads this table on login to inject user_role + permissions into JWT
    const { error: roleError } = await supabaseAdmin
      .from('user_roles')
      .insert({
        user_id: authUserId,
        role: 'instructor',
        granted_by: req.user?.id || null,
        notes: `Auto-provisioned on instructor creation for ${instructor_name}`
      });

    if (roleError) {
      console.error('[RBAC ERROR] Failed to assign instructor role:', roleError.message);
      // Rollback: delete instructor record and auth user
      console.log('[Rollback] Cleaning up instructor record and auth user');
      await supabaseAdmin.from('instructors').delete().eq('id', newInstructor.id);
      await supabaseAdmin.auth.admin.deleteUser(authUserId);
      throw new Error(`Failed to assign role: ${roleError.message}`);
    }

    console.log(`[Instructor Created] ${newInstructor.id} - ${instructor_name} (auth: ${authUserId})`);

    res.status(201).json({
      success: true,
      message: 'Instructor created successfully',
      data: {
        id: newInstructor.id,
        instructor_name: newInstructor.instructor_name,
        email: newInstructor.email,
        is_active: newInstructor.is_active,
        auth_user_id: newInstructor.auth_user_id,
        has_portal_access: true,
        created_at: newInstructor.created_at,
        updated_at: newInstructor.updated_at
      }
    });

  } catch (error) {
    next(error);
  }
};

module.exports = { create };
