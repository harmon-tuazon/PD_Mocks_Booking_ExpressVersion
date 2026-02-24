/**
 * POST /api/admin/instructors/:id/provision-access
 * Create auth account for an existing instructor that doesn't have one
 * Permission: 'workcheck.create'
 *
 * Flow (same as create.js steps 1-3 but for existing instructor):
 * 1. Create Supabase Auth user (email + password)
 * 2. INSERT into user_roles with role='instructor'
 * 3. Update auth_user_id on the existing instructor row
 * Rollback on failure: reverse order cleanup
 */

const { requirePermission } = require('../../middleware/requirePermission');
const { validationMiddleware } = require('../../../_shared/validation');
const { supabaseAdmin } = require('../../../_shared/supabase');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({
      success: false,
      error: { code: 'METHOD_NOT_ALLOWED', message: `Method ${req.method} not allowed` }
    });
  }

  try {
    await requirePermission(req, 'workcheck.create');

    // Validate request body
    const validator = validationMiddleware('instructorProvisionAccess');
    await new Promise((resolve, reject) => {
      validator(req, res, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });

    const { id } = req.query;
    const { password } = req.validatedData;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!id || !uuidRegex.test(id)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_ID', message: 'Instructor ID must be a valid UUID' }
      });
    }

    // Get instructor record
    const { data: instructor, error: fetchError } = await supabaseAdmin
      .from('instructors')
      .select('id, instructor_name, email, auth_user_id, is_active')
      .eq('id', id)
      .single();

    if (fetchError || !instructor) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Instructor not found' }
      });
    }

    if (instructor.auth_user_id) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'ALREADY_PROVISIONED',
          message: 'This instructor already has a portal login account'
        }
      });
    }

    console.log(`[Provision Access] Creating auth account for instructor: ${instructor.instructor_name}`);

    // Step 1: Create Supabase Auth user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: instructor.email,
      password: password,
      email_confirm: true
    });

    if (authError) {
      console.error('[Auth ERROR] Failed to create auth user:', authError.message);

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

    // Step 2: Assign 'instructor' role via user_roles table
    const { error: roleError } = await supabaseAdmin
      .from('user_roles')
      .insert({
        user_id: authUserId,
        role: 'instructor',
        granted_by: req.user?.id || null,
        notes: `Portal access provisioned for existing instructor ${instructor.instructor_name}`
      });

    if (roleError) {
      console.error('[RBAC ERROR] Failed to assign instructor role:', roleError.message);
      // Rollback: delete auth user
      console.log('[Rollback] Deleting auth user:', authUserId);
      await supabaseAdmin.auth.admin.deleteUser(authUserId);
      throw new Error(`Failed to assign role: ${roleError.message}`);
    }

    // Step 3: Link auth user to instructor record
    const { error: updateError } = await supabaseAdmin
      .from('instructors')
      .update({ auth_user_id: authUserId, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (updateError) {
      console.error('[Supabase ERROR] Failed to link auth user:', updateError.message);
      // Rollback: delete user_roles and auth user
      console.log('[Rollback] Cleaning up role and auth user');
      await supabaseAdmin.from('user_roles').delete().eq('user_id', authUserId);
      await supabaseAdmin.auth.admin.deleteUser(authUserId);
      throw new Error(`Failed to link auth account: ${updateError.message}`);
    }

    // If instructor is inactive, ban the auth user immediately
    if (!instructor.is_active) {
      await supabaseAdmin.auth.admin.updateUserById(authUserId, {
        ban_duration: '876000h'
      });
    }

    console.log(`[Provision Access] Completed for ${instructor.instructor_name} (auth: ${authUserId})`);

    res.status(200).json({
      success: true,
      message: `Portal access provisioned for ${instructor.instructor_name}`,
      data: {
        id: instructor.id,
        instructor_name: instructor.instructor_name,
        email: instructor.email,
        auth_user_id: authUserId,
        has_portal_access: true
      }
    });

  } catch (error) {
    if (error.message.includes('authorization') || error.message.includes('token') || error.message.includes('Permission denied')) {
      const statusCode = error.statusCode || 401;
      return res.status(statusCode).json({
        success: false,
        error: { code: error.code || 'UNAUTHORIZED', message: error.message }
      });
    }

    console.error('Error provisioning instructor access:', error);

    res.status(error.status || 500).json({
      success: false,
      error: error.message || 'Failed to provision portal access'
    });
  }
};
