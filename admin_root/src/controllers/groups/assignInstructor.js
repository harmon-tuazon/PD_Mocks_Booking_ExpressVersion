/**
 * POST /api/admin/groups/assign-instructor
 * Assign an instructor to a group
 * Permission: 'groups.edit'
 */

const { requirePermission } = require('../../middleware/requirePermission');
const { getCache } = require('../../services/cache');
const { db } = require('../../services/supabase');
const Joi = require('joi');

// Validation schema
const assignInstructorSchema = Joi.object({
  groupId: Joi.string().required(),
  instructorId: Joi.string().required()
});

const assignInstructor = async (req, res, next) => {
  try {
    await requirePermission(req, 'groups.edit');

    const { error, value } = assignInstructorSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: error.details[0].message }
      });
    }

    const { groupId, instructorId } = value;

    // Verify group exists
    const { data: group } = await db
      .from('groups')
      .select('group_id, group_name, status')
      .eq('group_id', groupId)
      .single();

    if (!group) {
      return res.status(404).json({
        success: false,
        error: { code: 'GROUP_NOT_FOUND', message: `Group ${groupId} not found` }
      });
    }

    // Verify instructor exists by UUID
    console.log(`[Assign Instructor] Looking up instructor with ID: ${instructorId}`);

    const { data: instructor, error: lookupError } = await db
      .from('instructors')
      .select('id, instructor_name, email')
      .eq('id', instructorId)
      .single();

    if (lookupError || !instructor) {
      console.log(`[Assign Instructor] Instructor not found with ID: ${instructorId}`, lookupError?.message);
      return res.status(404).json({
        success: false,
        error: { code: 'INSTRUCTOR_NOT_FOUND', message: `Instructor ${instructorId} not found` }
      });
    }

    console.log(`[Assign Instructor] Found instructor:`, instructor.instructor_name);

    const instructorUuid = instructor.id;

    // Check if already assigned
    const { data: existing } = await db
      .from('groups_instructors')
      .select('id, status')
      .eq('group_id', group.group_id)
      .eq('instructor_id', instructorUuid)
      .single();

    if (existing) {
      if (existing.status === 'active') {
        return res.status(400).json({
          success: false,
          error: {
            code: 'ALREADY_ASSIGNED',
            message: `Instructor ${instructor.instructor_name} is already assigned to this group`
          }
        });
      }

      // Reactivate if previously removed
      const { data: reactivated, error: reactivateError } = await db
        .from('groups_instructors')
        .update({
          status: 'active',
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (reactivateError) {
        throw new Error(`Failed to reactivate instructor assignment: ${reactivateError.message}`);
      }

      const cache = getCache();
      await cache.deletePattern('admin:groups:*');

      console.log(`[Instructor Reactivated] ${instructorUuid} -> Group ${group.group_id}`);

      return res.status(200).json({
        success: true,
        message: `Instructor ${instructor.instructor_name} reassigned to group`,
        data: {
          assignment_id: reactivated.id,
          instructor_id: instructorUuid,
          group_id: groupId,
          instructor: instructor,
          reactivated: true
        }
      });
    }

    // Create new assignment
    const { data: assignment, error: assignError } = await db
      .from('groups_instructors')
      .insert({
        group_id: group.group_id,
        instructor_id: instructorUuid,
        status: 'active',
        assigned_date: new Date().toISOString().split('T')[0]
      })
      .select()
      .single();

    if (assignError) {
      throw new Error(`Failed to assign instructor: ${assignError.message}`);
    }

    const cache = getCache();
    await cache.deletePattern('admin:groups:*');

    console.log(`[Instructor Assigned] ${instructorUuid} -> Group ${group.group_id}`);

    res.status(201).json({
      success: true,
      message: `Instructor ${instructor.instructor_name} assigned to group`,
      data: {
        assignment_id: assignment.id,
        instructor_id: instructorUuid,
        group_id: groupId,
        instructor: instructor
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

    console.error('Error assigning instructor:', error);
    next(error);
  }
};

module.exports = { assignInstructor };
