/**
 * GET /api/dashboard
 * Unified dashboard data endpoint
 * Returns user info, this week's activities, tokens, and groups
 */

const { schemas } = require('./_shared/validation');
const { supabaseAdmin } = require('./_shared/supabase');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' }
    });
  }

  try {
    // Validate query parameters using existing authCheck schema
    const { error, value } = schemas.authCheck.validate(req.query);
    if (error) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: error.details[0].message }
      });
    }

    const { student_id, email } = value;

    console.log(`[Dashboard] Fetching dashboard for student: ${student_id}`);

    // 1. Validate user and get basic info with credits
    const { data: contact, error: contactError } = await supabaseAdmin
      .from('hubspot_contact_credits')
      .select('id, hubspot_id, student_id, email, firstname, lastname, sj_credits, cs_credits, sjmini_credits, mock_discussion_token, shared_mock_credits')
      .eq('student_id', student_id)
      .ilike('email', email)
      .single();

    if (contactError || !contact) {
      console.error('[Dashboard] Contact not found:', contactError?.message);
      return res.status(401).json({
        success: false,
        error: { code: 'NOT_AUTHENTICATED', message: 'Invalid credentials' }
      });
    }

    // 2. Calculate date range (today onwards, max 15 items)
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const maxUpcomingItems = 15;

    console.log(`[Dashboard] Fetching upcoming activities from: ${today}`);

    // 3. Fetch upcoming activities in parallel (from today onwards)
    const [mockBookingsResult, workCheckBookingsResult, groupsResult] = await Promise.all([
      // Upcoming mock exam bookings
      supabaseAdmin
        .from('hubspot_bookings')
        .select('id, exam_date, start_time, end_time, mock_type, attending_location, is_active')
        .eq('student_id', contact.student_id)
        .gte('exam_date', today)
        .in('is_active', ['Active', 'Completed'])
        .order('exam_date', { ascending: true })
        .limit(maxUpcomingItems),

      // Upcoming work check bookings
      supabaseAdmin
        .from('work_check_bookings')
        .select(`
          id, status, created_at,
          work_check_slots!inner (
            slot_date, slot_time, duration_minutes, location,
            instructors ( instructor_name ),
            group_id
          )
        `)
        .eq('student_id', contact.student_id)
        .gte('work_check_slots.slot_date', today)
        .in('status', ['pending', 'confirmed'])
        .order('work_check_slots(slot_date)', { ascending: true })
        .limit(maxUpcomingItems),

      // User's active groups
      supabaseAdmin
        .from('groups_students')
        .select(`
          group_id, status,
          groups ( group_id, group_name, status )
        `)
        .eq('student_id', contact.student_id)
        .eq('status', 'active')
    ]);

    // Log any errors but continue
    if (mockBookingsResult.error) {
      console.warn('[Dashboard] Mock bookings query error:', mockBookingsResult.error.message);
    }
    if (workCheckBookingsResult.error) {
      console.warn('[Dashboard] Work check bookings query error:', workCheckBookingsResult.error.message);
    }
    if (groupsResult.error) {
      console.warn('[Dashboard] Groups query error:', groupsResult.error.message);
    }

    // 4. Transform mock exam activities
    const mockActivities = (mockBookingsResult.data || []).map(b => ({
      id: b.id,
      type: 'mock_exam',
      date: b.exam_date,
      start_time: b.start_time?.substring(0, 5) || null,
      end_time: b.end_time?.substring(0, 5) || null,
      status: 'confirmed',
      mock_type: b.mock_type,
      location: b.attending_location
    }));

    // 5. Transform work check activities
    const workCheckActivities = (workCheckBookingsResult.data || []).map(b => {
      const slot = b.work_check_slots;
      return {
        id: b.id,
        type: 'work_check',
        date: slot?.slot_date || null,
        start_time: slot?.slot_time?.substring(0, 5) || null,
        end_time: null, // Can calculate from duration if needed
        status: b.status,
        instructor_name: slot?.instructors?.instructor_name || null,
        group_id: Array.isArray(slot?.group_id) ? slot.group_id[0] : slot?.group_id,
        room: slot?.location || null
      };
    });

    // 6. Merge, sort by date/time, and limit to max items
    const allActivities = [...mockActivities, ...workCheckActivities]
      .filter(a => a.date) // Filter out activities without dates
      .sort((a, b) => {
        const dateCompare = a.date.localeCompare(b.date);
        if (dateCompare !== 0) return dateCompare;
        return (a.start_time || '').localeCompare(b.start_time || '');
      })
      .slice(0, maxUpcomingItems); // Cap at max items

    // 7. Transform groups
    const groups = (groupsResult.data || [])
      .filter(g => g.groups?.status === 'active')
      .map(g => ({
        group_id: g.groups?.group_id || g.group_id,
        group_name: g.groups?.group_name || g.group_id,
        status: g.status
      }));

    console.log(`[Dashboard] Found ${mockActivities.length} mock activities, ${workCheckActivities.length} work check activities, ${groups.length} groups`);

    // 8. Build response
    return res.status(200).json({
      success: true,
      data: {
        user: {
          student_id: contact.student_id,
          student_uuid: contact.id,
          firstname: contact.firstname,
          lastname: contact.lastname,
          email: contact.email
        },
        activities: {
          upcoming: allActivities,
          has_today: allActivities.some(a => a.date === today),
          total_upcoming: allActivities.length
        },
        tokens: {
          sj_credits: contact.sj_credits || 0,
          cs_credits: contact.cs_credits || 0,
          sjmini_credits: contact.sjmini_credits || 0,
          mock_discussion_token: contact.mock_discussion_token || 0,
          shared_mock_credits: contact.shared_mock_credits || 0,
          total_available: (contact.sj_credits || 0) + (contact.cs_credits || 0) +
                          (contact.sjmini_credits || 0) + (contact.shared_mock_credits || 0)
        },
        groups: groups,
        has_active_groups: groups.length > 0
      }
    });

  } catch (error) {
    console.error('[Dashboard] Error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to load dashboard' }
    });
  }
};
