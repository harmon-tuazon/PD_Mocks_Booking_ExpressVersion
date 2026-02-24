/**
 * GET /api/work-checks/list
 * List user's work check bookings with filtering
 */

const { schemas } = require('../_shared/validation');
const { supabaseAdmin } = require('../_shared/supabase');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: { code: 'METHOD_NOT_ALLOWED', message: 'Only GET requests are allowed' }
    });
  }

  try {
    // Validate query parameters
    const { error, value } = schemas.workCheckList.validate(req.query);
    if (error) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: error.details[0].message }
      });
    }

    const { student_id, email, filter, page, limit } = value;

    console.log(`🔍 [WORK-CHECK] Listing bookings for: ${student_id}, filter: ${filter}`);

    // 1. Validate contact
    const { data: contact, error: contactError } = await supabaseAdmin
      .from('hubspot_contact_credits')
      .select('id, student_id')
      .eq('student_id', student_id)
      .ilike('email', email)
      .single();

    if (contactError || !contact) {
      return res.status(401).json({
        success: false,
        error: { code: 'NOT_AUTHENTICATED', message: 'Session invalid. Please log in again.' }
      });
    }

    // 2. Build base query
    let query = supabaseAdmin
      .from('work_check_bookings')
      .select(`
        id,
        slot_id,
        student_id,
        status,
        lab,
        seat,
        created_at,
        confirmed_at,
        cancelled_at,
        work_check_slots (
          id,
          slot_date,
          slot_time,
          duration_minutes,
          location,
          group_id,
          instructors (
            id,
            instructor_name
          )
        )
      `, { count: 'exact' })
      .eq('student_id', contact.student_id);  // Use string student_id, not UUID

    // 3. Apply filter
    const today = new Date().toISOString().split('T')[0];

    switch (filter) {
      case 'upcoming':
        query = query
          .in('status', ['pending', 'confirmed'])
          .gte('work_check_slots.slot_date', today);
        break;
      case 'pending':
        query = query.eq('status', 'pending');
        break;
      case 'completed':
        query = query
          .in('status', ['marked', 'completed']);
        break;
      case 'cancelled':
        query = query.in('status', ['cancelled', 'rejected']);
        break;
      case 'all':
      default:
        // No additional filter
        break;
    }

    // 4. Apply pagination
    const offset = (page - 1) * limit;
    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data: bookings, error: bookingsError, count } = await query;

    if (bookingsError) {
      console.error('❌ [WORK-CHECK] List error:', bookingsError);
      throw bookingsError;
    }

    // 5. Get group names for all bookings
    const groupIds = [...new Set((bookings || []).flatMap(b => {
      const slot = b.work_check_slots;
      if (!slot) return [];
      return Array.isArray(slot.group_id) ? slot.group_id : [slot.group_id];
    }))];

    let groupNames = {};
    if (groupIds.length > 0) {
      const { data: groups } = await supabaseAdmin
        .from('groups')
        .select('group_id, group_name')
        .in('group_id', groupIds);

      (groups || []).forEach(g => {
        groupNames[g.group_id] = g.group_name;
      });
    }

    // 6. Format bookings for response
    const formattedBookings = (bookings || []).map(booking => {
      const slot = booking.work_check_slots;
      if (!slot) return null;

      // Calculate end time
      const [hours, minutes] = (slot.slot_time || '00:00').split(':').map(Number);
      const endDate = new Date();
      endDate.setHours(hours, minutes + (slot.duration_minutes || 30), 0, 0);
      const endTime = `${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`;

      // Get first group ID for display
      const slotGroups = Array.isArray(slot.group_id) ? slot.group_id : [slot.group_id];
      const primaryGroup = slotGroups[0];

      return {
        id: booking.id,           // UUID for API operations
        booking_id: booking.id,   // Alias for backwards compatibility
        slot_id: booking.slot_id,
        status: booking.status,
        lab: booking.lab || null,
        seat: booking.seat || null,
        slot_date: slot.slot_date,
        slot_time: slot.slot_time,
        end_time: endTime,
        duration_minutes: slot.duration_minutes,
        instructor_name: slot.instructors?.instructor_name || 'TBD',
        group_id: primaryGroup,
        group_name: groupNames[primaryGroup] || primaryGroup,
        location: slot.location,
        created_at: booking.created_at,
        confirmed_at: booking.confirmed_at,
        cancelled_at: booking.cancelled_at
      };
    }).filter(Boolean);

    // 7. Categorize bookings
    const categorized = {
      upcoming: [],
      pending: [],
      completed: [],
      cancelled: []
    };

    formattedBookings.forEach(booking => {
      const isInFuture = booking.slot_date >= today;

      if (booking.status === 'pending') {
        categorized.pending.push(booking);
        if (isInFuture) categorized.upcoming.push(booking);
      } else if (booking.status === 'confirmed') {
        if (isInFuture) {
          categorized.upcoming.push(booking);
        } else {
          categorized.upcoming.push(booking);
        }
      } else if (booking.status === 'marked' || booking.status === 'completed') {
        categorized.completed.push(booking);
      } else if (booking.status === 'cancelled' || booking.status === 'rejected') {
        categorized.cancelled.push(booking);
      }
    });

    // Sort upcoming by date
    categorized.upcoming.sort((a, b) => {
      const dateCompare = a.slot_date.localeCompare(b.slot_date);
      if (dateCompare !== 0) return dateCompare;
      return a.slot_time.localeCompare(b.slot_time);
    });

    // Calculate stats
    const stats = {
      upcoming: categorized.upcoming.length,
      pending: categorized.pending.length,
      completed: categorized.completed.length,
      cancelled: categorized.cancelled.length,
      total: formattedBookings.length
    };

    // Determine which bookings to return based on filter
    let bookingsToReturn;
    if (filter === 'all') {
      bookingsToReturn = formattedBookings;
    } else if (categorized[filter]) {
      bookingsToReturn = categorized[filter];
    } else {
      bookingsToReturn = formattedBookings;
    }

    console.log(`✅ [WORK-CHECK] Found ${bookingsToReturn.length} bookings for ${student_id} (filter: ${filter})`);

    return res.status(200).json({
      success: true,
      pagination: {
        current_page: page,
        total_pages: Math.ceil((count || 0) / limit),
        total_records: count || 0,
        records_per_page: limit
      },
      data: {
        bookings: bookingsToReturn,
        stats
      }
    });

  } catch (error) {
    console.error('❌ [WORK-CHECK] List error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to load bookings' }
    });
  }
};
