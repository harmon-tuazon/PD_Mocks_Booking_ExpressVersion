/**
 * GET /api/admin/students/search
 * Search for students (contacts) by name, email, or student_id
 * Permission: 'workcheck.view' (or any admin access)
 */

const { requirePermission } = require('../middleware/requirePermission');
const { supabaseAdmin } = require('../../_shared/supabase');

module.exports = async (req, res) => {
  console.log('[Students Search] Endpoint hit:', req.method, req.url);

  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({
      success: false,
      error: { code: 'METHOD_NOT_ALLOWED', message: `Method ${req.method} not allowed` }
    });
  }

  try {
    // Verify admin authentication
    await requirePermission(req, 'workcheck.view');

    const {
      q = '',
      limit = 20,
      group_id
    } = req.query;

    console.log(`[Students Search] Query: "${q}", limit: ${limit}, group_id: ${group_id || 'none'}`);

    let query = supabaseAdmin
      .from('hubspot_contact_credits')
      .select('id, student_id, firstname, lastname, email')
      .limit(parseInt(limit));

    // Apply search filter if query provided
    if (q && q.trim().length > 0) {
      const searchTerm = q.trim().toLowerCase();
      query = query.or(
        `firstname.ilike.%${searchTerm}%,lastname.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,student_id.ilike.%${searchTerm}%`
      );
    }

    // If group_id provided, filter by group membership
    if (group_id) {
      // First get student IDs that belong to the group
      const { data: groupMembers, error: groupError } = await supabaseAdmin
        .from('group_students')
        .select('student_id')
        .eq('group_id', group_id);

      if (groupError) {
        console.error('[Supabase ERROR] Failed to fetch group members:', groupError.message);
      } else if (groupMembers && groupMembers.length > 0) {
        const memberIds = groupMembers.map(m => m.student_id);
        query = query.in('id', memberIds);
      } else {
        // No members in group, return empty
        return res.status(200).json({
          success: true,
          data: []
        });
      }
    }

    // Order by name
    query = query.order('firstname', { ascending: true });

    const { data: students, error } = await query;

    if (error) {
      console.error('[Supabase ERROR] Failed to search students:', error.message);
      throw new Error(`Failed to search students: ${error.message}`);
    }

    // Transform to include full name
    const transformedStudents = (students || []).map(s => ({
      id: s.id,
      student_id: s.student_id,
      firstname: s.firstname,
      lastname: s.lastname,
      full_name: `${s.firstname || ''} ${s.lastname || ''}`.trim() || 'Unknown',
      email: s.email
    }));

    console.log(`[Students Search] Found ${transformedStudents.length} students`);

    res.status(200).json({
      success: true,
      data: transformedStudents
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

    console.error('Error searching students:', error);

    res.status(error.status || 500).json({
      success: false,
      error: error.message || 'Failed to search students'
    });
  }
};
