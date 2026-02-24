/**
 * GET /api/admin/instructors/dropdown
 * Get active instructors for dropdown/select components
 * Permission: 'workcheck.view'
 *
 * Returns minimal fields (id, instructor_name, email) for dropdown usage
 */

const { requirePermission } = require('../middleware/requirePermission');
const { supabaseAdmin } = require('../../_shared/supabase');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({
      success: false,
      error: { code: 'METHOD_NOT_ALLOWED', message: `Method ${req.method} not allowed` }
    });
  }

  try {
    // Verify admin authentication and permission
    await requirePermission(req, 'workcheck.view');

    console.log('[Instructors Dropdown] Fetching active instructors for dropdown');

    // Fetch only active instructors with minimal fields
    const { data: instructors, error } = await supabaseAdmin
      .from('instructors')
      .select('id, instructor_name, email')
      .eq('is_active', true)
      .order('instructor_name', { ascending: true });

    if (error) {
      console.error('[Supabase ERROR]', error.message);
      throw new Error(`Failed to fetch instructors: ${error.message}`);
    }

    // Transform results for dropdown usage
    const dropdownOptions = (instructors || []).map(instructor => ({
      id: instructor.id,
      instructor_name: instructor.instructor_name,
      email: instructor.email,
      // Include label and value for common dropdown component patterns
      label: instructor.instructor_name,
      value: instructor.id
    }));

    console.log(`[Instructors Dropdown] Returning ${dropdownOptions.length} active instructors`);

    res.status(200).json({
      success: true,
      data: dropdownOptions
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

    console.error('Error fetching instructors for dropdown:', error);

    res.status(error.status || 500).json({
      success: false,
      error: error.message || 'Failed to fetch instructors'
    });
  }
};
