/**
 * POST /api/admin/groups/assign-student
 * Assign a student to a group
 * Permission: 'groups.edit'
 */

const { requirePermission } = require('../middleware/requirePermission');
const { validationMiddleware } = require('../../_shared/validation');
const { getCache } = require('../../_shared/cache');
const { supabaseAdmin } = require('../../_shared/supabase');

module.exports = async (req, res) => {
  try {
    // Verify admin authentication and permission
    await requirePermission(req, 'groups.edit');

    // Validate request body
    const validator = validationMiddleware('studentAssignment');
    await new Promise((resolve, reject) => {
      validator(req, res, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });

    const { groupId, contactId } = req.validatedData;

    // Verify group exists
    const { data: group, error: groupError } = await supabaseAdmin
      .from('groups')
      .select('group_id, group_name, max_capacity, status')
      .eq('group_id', groupId)
      .single();

    if (!group) {
      return res.status(404).json({
        success: false,
        error: { code: 'GROUP_NOT_FOUND', message: `Group ${groupId} not found` }
      });
    }

    // Verify contact exists
    const { data: contact, error: contactError } = await supabaseAdmin
      .from('hubspot_contact_credits')
      .select('id, student_id, email, firstname, lastname')
      .eq('id', contactId)
      .single();

    if (!contact) {
      return res.status(404).json({
        success: false,
        error: { code: 'CONTACT_NOT_FOUND', message: `Contact ${contactId} not found` }
      });
    }

    // Check if already assigned
    const { data: existing } = await supabaseAdmin
      .from('groups_students')
      .select('id, status')
      .eq('group_id', groupId)
      .eq('contact_id', contactId)
      .single();

    if (existing) {
      if (existing.status === 'active') {
        return res.status(400).json({
          success: false,
          error: { code: 'STUDENT_ALREADY_ASSIGNED', message: 'Student is already assigned to this group' }
        });
      }

      // Reactivate if previously removed
      const { data: reactivated, error: reactivateError } = await supabaseAdmin
        .from('groups_students')
        .update({ status: 'active', updated_at: new Date().toISOString() })
        .eq('id', existing.id)
        .select()
        .single();

      if (reactivateError) {
        throw new Error(`Failed to reactivate assignment: ${reactivateError.message}`);
      }

      // Invalidate cache
      const cache = getCache();
      await cache.del('admin:groups:*');
      await cache.del('admin:groups:statistics');

      return res.status(200).json({
        success: true,
        message: 'Student reactivated in group',
        data: {
          id: reactivated.id,
          group_id: reactivated.group_id,
          contact_id: reactivated.contact_id,
          status: reactivated.status,
          enrolled_at: reactivated.enrolled_at,
          student: {
            id: contact.id,
            student_id: contact.student_id,
            firstname: contact.firstname,
            lastname: contact.lastname,
            email: contact.email
          }
        }
      });
    }

    // Check group capacity
    const { count: currentCount } = await supabaseAdmin
      .from('groups_students')
      .select('*', { count: 'exact', head: true })
      .eq('group_id', groupId)
      .eq('status', 'active');

    if (currentCount >= group.max_capacity) {
      return res.status(400).json({
        success: false,
        error: { code: 'GROUP_AT_CAPACITY', message: `Group is at maximum capacity (${group.max_capacity})` }
      });
    }

    // Create assignment
    const { data: assignment, error: assignError } = await supabaseAdmin
      .from('groups_students')
      .insert({
        group_id: groupId,
        contact_id: contactId,
        status: 'active'
      })
      .select()
      .single();

    if (assignError) {
      if (assignError.code === '23505') {
        return res.status(400).json({
          success: false,
          error: { code: 'STUDENT_ALREADY_ASSIGNED', message: 'Student is already assigned to this group' }
        });
      }
      throw new Error(`Failed to assign student: ${assignError.message}`);
    }

    // Invalidate cache
    const cache = getCache();
    await cache.del('admin:groups:*');
    await cache.del('admin:groups:statistics');

    console.log(`[Student Assigned] ${contact.student_id} -> ${groupId}`);

    res.status(201).json({
      success: true,
      message: 'Student assigned to group successfully',
      data: {
        id: assignment.id,
        group_id: assignment.group_id,
        contact_id: assignment.contact_id,
        status: assignment.status,
        enrolled_at: assignment.enrolled_at,
        student: {
          id: contact.id,
          student_id: contact.student_id,
          firstname: contact.firstname,
          lastname: contact.lastname,
          email: contact.email
        }
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

    console.error('Error assigning student to group:', error);

    res.status(error.status || 500).json({
      success: false,
      error: error.message || 'Failed to assign student to group'
    });
  }
};
