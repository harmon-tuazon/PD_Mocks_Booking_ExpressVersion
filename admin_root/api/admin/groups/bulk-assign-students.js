/**
 * POST /api/admin/groups/bulk-assign-students
 * Bulk assign students to a group
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
    const validator = validationMiddleware('bulkStudentAssignment');
    await new Promise((resolve, reject) => {
      validator(req, res, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });

    const { groupId, studentIds } = req.validatedData;

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

    // Check current capacity
    const { count: currentCount } = await supabaseAdmin
      .from('groups_students')
      .select('*', { count: 'exact', head: true })
      .eq('group_id', groupId)
      .eq('status', 'active');

    const availableSpots = group.max_capacity - currentCount;
    if (availableSpots <= 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'GROUP_AT_CAPACITY', message: `Group is at maximum capacity (${group.max_capacity})` }
      });
    }

    // Verify students exist in hubspot_contact_credits
    const { data: contacts, error: contactsError } = await supabaseAdmin
      .from('hubspot_contact_credits')
      .select('id, student_id, email, firstname, lastname')
      .in('student_id', studentIds);

    if (contactsError) {
      throw new Error(`Failed to fetch students: ${contactsError.message}`);
    }

    const foundStudentIds = new Set(contacts.map(c => c.student_id));
    const missingStudents = studentIds.filter(id => !foundStudentIds.has(id));

    // Check existing assignments
    const { data: existingAssignments } = await supabaseAdmin
      .from('groups_students')
      .select('student_id, status')
      .eq('group_id', groupId)
      .in('student_id', studentIds);

    const existingMap = (existingAssignments || []).reduce((acc, a) => {
      acc[a.student_id] = a.status;
      return acc;
    }, {});

    // Process assignments
    const results = {
      assigned: [],
      reactivated: [],
      alreadyAssigned: [],
      notFound: missingStudents,
      failed: []
    };

    // Limit to available spots
    const contactsToProcess = contacts.slice(0, availableSpots);
    const skippedDueToCapacity = contacts.slice(availableSpots);

    for (const contact of contactsToProcess) {
      try {
        const existingStatus = existingMap[contact.student_id];

        if (existingStatus === 'active') {
          results.alreadyAssigned.push({
            student_id: contact.student_id,
            reason: 'Already assigned'
          });
          continue;
        }

        if (existingStatus) {
          // Reactivate
          const { error: reactivateError } = await supabaseAdmin
            .from('groups_students')
            .update({ status: 'active', updated_at: new Date().toISOString() })
            .eq('group_id', groupId)
            .eq('student_id', contact.student_id);

          if (reactivateError) {
            results.failed.push({
              student_id: contact.student_id,
              reason: reactivateError.message
            });
          } else {
            results.reactivated.push({
              student_id: contact.student_id,
              firstname: contact.firstname,
              lastname: contact.lastname
            });
          }
        } else {
          // New assignment
          const { error: insertError } = await supabaseAdmin
            .from('groups_students')
            .insert({
              group_id: groupId,
              student_id: contact.student_id,
              status: 'active'
            });

          if (insertError) {
            results.failed.push({
              student_id: contact.student_id,
              reason: insertError.message
            });
          } else {
            results.assigned.push({
              student_id: contact.student_id,
              firstname: contact.firstname,
              lastname: contact.lastname
            });
          }
        }
      } catch (err) {
        results.failed.push({
          student_id: contact.student_id,
          reason: err.message
        });
      }
    }

    // Add skipped due to capacity
    for (const contact of skippedDueToCapacity) {
      results.failed.push({
        student_id: contact.student_id,
        reason: 'Group at capacity'
      });
    }

    // Invalidate cache
    const cache = getCache();
    await cache.deletePattern('admin:groups:*');
    await cache.delete('admin:groups:statistics');

    const totalAssigned = results.assigned.length + results.reactivated.length;
    console.log(`[Bulk Assignment] ${totalAssigned} students assigned to ${groupId}`);

    res.status(200).json({
      success: true,
      message: `${totalAssigned} student(s) assigned to group successfully`,
      data: {
        assigned: results.assigned.length,
        reactivated: results.reactivated.length,
        alreadyAssigned: results.alreadyAssigned.length,
        notFound: results.notFound.length,
        failed: results.failed.length,
        results
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

    console.error('Error bulk assigning students:', error);

    res.status(error.status || 500).json({
      success: false,
      error: error.message || 'Failed to bulk assign students'
    });
  }
};
