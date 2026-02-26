/**
 * POST /api/admin/instructors/bulk-delete
 * Bulk delete multiple instructors
 * Permission: 'workcheck.delete'
 *
 * Note: Instructors assigned to active groups cannot be deleted.
 * The frontend should be informed which instructors were blocked.
 */

const { requirePermission } = require('../../middleware/requirePermission');
const { validationMiddleware } = require('../../services/validation');
const { db } = require('../../services/supabase');

const bulkDelete = async (req, res, next) => {
  try {
    // Verify admin authentication and permission
    await requirePermission(req, 'workcheck.delete');

    // Validate request body
    const validator = validationMiddleware('instructorBulkDelete');
    await new Promise((resolve, reject) => {
      validator(req, res, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });

    const { ids } = req.validatedData;

    console.log(`[Bulk Delete Instructors] Attempting to delete ${ids.length} instructors:`, ids);

    // First, check which instructors are assigned to active groups
    const { data: instructorsWithGroups, error: checkError } = await db
      .from('groups_instructors')
      .select('instructor_id')
      .in('instructor_id', ids)
      .eq('status', 'active');

    if (checkError) {
      console.error('[Supabase ERROR] Failed to check group assignments:', checkError.message);
      throw new Error('Failed to verify instructor group assignments');
    }

    // Get unique instructor IDs that have active group assignments
    const blockedInstructorIds = new Set(instructorsWithGroups?.map(gi => gi.instructor_id) || []);

    // Filter out instructors that have active group assignments
    const deletableIds = ids.filter(id => !blockedInstructorIds.has(id));
    const blockedIds = ids.filter(id => blockedInstructorIds.has(id));

    console.log(`[Bulk Delete Instructors] Deletable: ${deletableIds.length}, Blocked: ${blockedIds.length}`);

    if (deletableIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'NO_DELETABLE_INSTRUCTORS',
          message: 'All selected instructors are assigned to active groups and cannot be deleted'
        },
        data: {
          blocked: blockedIds.length,
          blockedIds: blockedIds
        }
      });
    }

    // Fetch auth_user_ids for instructors that will be deleted (for auth cleanup)
    const { data: instructorsToDelete } = await db
      .from('instructors')
      .select('id, auth_user_id')
      .in('id', deletableIds);

    // Clean up auth users and user_roles before deleting instructor rows
    const authUserIds = (instructorsToDelete || [])
      .filter(i => i.auth_user_id)
      .map(i => i.auth_user_id);

    if (authUserIds.length > 0) {
      console.log(`[Bulk Delete Instructors] Cleaning up ${authUserIds.length} auth user(s)`);

      for (const authUserId of authUserIds) {
        // Remove role assignment first
        await db
          .from('user_roles')
          .delete()
          .eq('user_id', authUserId);

        // Delete auth user
        const { error: authDeleteError } = await db.auth.admin.deleteUser(authUserId);
        if (authDeleteError) {
          console.error(`[Auth WARNING] Failed to delete auth user ${authUserId}:`, authDeleteError.message);
        }
      }
    }

    // Delete the instructors that don't have active group assignments
    const { data: deletedInstructors, error: deleteError } = await db
      .from('instructors')
      .delete()
      .in('id', deletableIds)
      .select('id, instructor_id, instructor_name, email');

    if (deleteError) {
      console.error('[Supabase ERROR] Failed to delete instructors:', deleteError.message);
      throw new Error(`Failed to delete instructors: ${deleteError.message}`);
    }

    const summary = {
      requested: ids.length,
      deleted: deletedInstructors?.length || 0,
      blocked: blockedIds.length
    };

    console.log(`[Bulk Delete Instructors] Completed:`, summary);

    res.status(200).json({
      success: true,
      message: `Successfully deleted ${summary.deleted} instructor(s)`,
      data: {
        deleted: summary.deleted,
        blocked: summary.blocked,
        deletedInstructors: deletedInstructors?.map(i => ({
          id: i.id,
          instructor_id: i.instructor_id,
          instructor_name: i.instructor_name,
          email: i.email
        })) || [],
        blockedIds: blockedIds
      }
    });

  } catch (error) {
    next(error);
  }
};

module.exports = { bulkDelete };
