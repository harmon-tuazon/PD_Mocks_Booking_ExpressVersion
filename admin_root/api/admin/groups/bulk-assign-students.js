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

    const { groupId, contactIds } = req.validatedData;

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

    // Verify contacts exist
    const { data: contacts, error: contactsError } = await supabaseAdmin
      .from('hubspot_contact_credits')
      .select('id, student_id, email, firstname, lastname')
      .in('id', contactIds);

    if (contactsError) {
      throw new Error(`Failed to fetch contacts: ${contactsError.message}`);
    }

    const foundContactIds = new Set(contacts.map(c => c.id));
    const missingContacts = contactIds.filter(id => !foundContactIds.has(id));

    // Check existing assignments
    const { data: existingAssignments } = await supabaseAdmin
      .from('groups_students')
      .select('contact_id, status')
      .eq('group_id', groupId)
      .in('contact_id', contactIds);

    const existingMap = (existingAssignments || []).reduce((acc, a) => {
      acc[a.contact_id] = a.status;
      return acc;
    }, {});

    // Process assignments
    const results = {
      assigned: [],
      reactivated: [],
      alreadyAssigned: [],
      notFound: missingContacts,
      failed: []
    };

    // Limit to available spots
    const contactsToProcess = contacts.slice(0, availableSpots);
    const skippedDueToCapacity = contacts.slice(availableSpots);

    for (const contact of contactsToProcess) {
      try {
        const existingStatus = existingMap[contact.id];

        if (existingStatus === 'active') {
          results.alreadyAssigned.push({
            contact_id: contact.id,
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
            .eq('contact_id', contact.id);

          if (reactivateError) {
            results.failed.push({
              contact_id: contact.id,
              student_id: contact.student_id,
              reason: reactivateError.message
            });
          } else {
            results.reactivated.push({
              contact_id: contact.id,
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
              contact_id: contact.id,
              status: 'active'
            });

          if (insertError) {
            results.failed.push({
              contact_id: contact.id,
              student_id: contact.student_id,
              reason: insertError.message
            });
          } else {
            results.assigned.push({
              contact_id: contact.id,
              student_id: contact.student_id,
              firstname: contact.firstname,
              lastname: contact.lastname
            });
          }
        }
      } catch (err) {
        results.failed.push({
          contact_id: contact.id,
          student_id: contact.student_id,
          reason: err.message
        });
      }
    }

    // Add skipped due to capacity
    for (const contact of skippedDueToCapacity) {
      results.failed.push({
        contact_id: contact.id,
        student_id: contact.student_id,
        reason: 'Group at capacity'
      });
    }

    // Invalidate cache
    const cache = getCache();
    await cache.del('admin:groups:*');
    await cache.del('admin:groups:statistics');

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
