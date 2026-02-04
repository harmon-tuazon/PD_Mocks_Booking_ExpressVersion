/**
 * POST /api/admin/groups/assign-instructor
 * Assign an instructor to a group
 * Permission: 'groups.edit'
 */

const { requirePermission } = require('../middleware/requirePermission');
const { getCache } = require('../../_shared/cache');
const { supabaseAdmin } = require('../../_shared/supabase');
const Joi = require('joi');

// Validation schema
const assignInstructorSchema = Joi.object({
  groupId: Joi.string().required(),
  instructorId: Joi.string().required()
});

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({
      success: false,
      error: { code: 'METHOD_NOT_ALLOWED', message: `Method ${req.method} not allowed` }
    });
  }

  try {
    // Verify admin authentication and permission
    await requirePermission(req, 'groups.edit');

    // Validate request body
    const { error, value } = assignInstructorSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: error.details[0].message }
      });
    }

    const { groupId, instructorId } = value;

    // Verify group exists (need UUID for groups_instructors table)
    const { data: group, error: groupError } = await supabaseAdmin
      .from('groups')
      .select('id, group_id, group_name, status')
      .eq('group_id', groupId)
      .single();

    if (!group) {
      return res.status(404).json({
        success: false,
        error: { code: 'GROUP_NOT_FOUND', message: `Group ${groupId} not found` }
      });
    }

    // Use group UUID for foreign key references
    const groupUuid = group.id;

    // Verify instructor exists by UUID
    console.log(`[Assign Instructor] Looking up instructor with ID: ${instructorId}`);

    const { data: instructor, error: lookupError } = await supabaseAdmin
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

    // Use the UUID for assignments
    const instructorUuid = instructor.id;

    // Check if already assigned (using UUIDs)
    const { data: existing } = await supabaseAdmin
      .from('groups_instructors')
      .select('id, status')
      .eq('group_id', groupUuid)
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
      const { data: reactivated, error: reactivateError } = await supabaseAdmin
        .from('groups_instructors')
        .update({ status: 'active', updated_at: new Date().toISOString() })
        .eq('id', existing.id)
        .select()
        .single();

      if (reactivateError) {
        throw new Error(`Failed to reactivate instructor assignment: ${reactivateError.message}`);
      }

      // Invalidate cache
      const cache = getCache();
      await cache.deletePattern('admin:groups:*');

      console.log(`[Instructor Reactivated] ${instructorUuid} -> Group ${groupId}`);

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
    const { data: assignment, error: assignError } = await supabaseAdmin
      .from('groups_instructors')
      .insert({
        group_id: groupUuid,
        instructor_id: instructorUuid,
        status: 'active'
      })
      .select()
      .single();

    if (assignError) {
      throw new Error(`Failed to assign instructor: ${assignError.message}`);
    }

    // Invalidate cache
    const cache = getCache();
    await cache.deletePattern('admin:groups:*');

    console.log(`[Instructor Assigned] ${instructorUuid} -> Group ${groupId}`);

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
    // Auth-specific error handling
    if (error.message.includes('authorization') || error.message.includes('token') || error.message.includes('Permission denied')) {
      const statusCode = error.statusCode || 401;
      return res.status(statusCode).json({
        success: false,
        error: { code: error.code || 'UNAUTHORIZED', message: error.message }
      });
    }

    console.error('Error assigning instructor:', error);

    res.status(error.status || 500).json({
      success: false,
      error: error.message || 'Failed to assign instructor'
    });
  }
};
