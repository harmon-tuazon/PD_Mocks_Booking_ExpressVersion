/**
 * Supabase Data Access Layer
 * Handles reads from Supabase and syncs on writes
 *
 * This is the PRIMARY read source for user_root to eliminate HubSpot 429 errors
 */

const { supabaseAdmin } = require('./supabase');

// ============== READ OPERATIONS (from Supabase) ==============

/**
 * Get bookings for an exam from Supabase
 * @param {string} examId - Mock exam HubSpot ID
 * @returns {Array} - Array of booking objects
 */
async function getBookingsFromSupabase(examId) {
  const { data, error } = await supabaseAdmin
    .from('hubspot_bookings')
    .select('*')
    .eq('associated_mock_exam', examId);

  if (error) {
    console.error(`❌ Supabase read error for exam ${examId}:`, error.message);
    throw error;
  }

  return data || [];
}

/**
 * Get bookings by contact ID from Supabase
 * @param {string} contactId - Contact HubSpot ID
 * @returns {Array} - Array of booking objects
 */
async function getBookingsByContactFromSupabase(contactId) {
  const { data, error } = await supabaseAdmin
    .from('hubspot_bookings')
    .select('*')
    .eq('associated_contact_id', contactId)
    .order('exam_date', { ascending: false });

  if (error) {
    console.error(`❌ Supabase read error for contact ${contactId}:`, error.message);
    throw error;
  }

  return data || [];
}

/**
 * Get all mock exams from Supabase
 * @param {object} filters - Optional filters (is_active, date range, etc.)
 * @returns {Array} - Array of exam objects
 */
async function getExamsFromSupabase(filters = {}) {
  let query = supabaseAdmin.from('hubspot_mock_exams').select('*');

  if (filters.is_active) {
    // Map filter values to Supabase stored values
    // 'active' or 'Yes' → 'true', others pass through
    let activeValue = filters.is_active;
    if (activeValue === 'active' || activeValue === 'Yes') {
      activeValue = 'true';
    }
    query = query.eq('is_active', activeValue);
  }
  if (filters.startDate) {
    query = query.gte('exam_date', filters.startDate);
  }
  if (filters.endDate) {
    query = query.lte('exam_date', filters.endDate);
  }
  if (filters.mock_type) {
    query = query.eq('mock_type', filters.mock_type);
  }
  if (filters.location) {
    query = query.eq('location', filters.location);
  }

  const { data, error } = await query.order('exam_date', { ascending: true });

  if (error) {
    console.error(`❌ Supabase exam read error:`, error.message);
    throw error;
  }

  return data || [];
}

/**
 * Get single exam by ID from Supabase
 * @param {string} examId - HubSpot ID
 * @returns {object|null} - Exam object or null
 */
async function getExamByIdFromSupabase(examId) {
  const { data, error } = await supabaseAdmin
    .from('hubspot_mock_exams')
    .select('*')
    .eq('hubspot_id', examId)
    .single();

  if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
    console.error(`❌ Supabase exam read error:`, error.message);
    throw error;
  }

  return data;
}

/**
 * Get single booking by ID from Supabase
 * @param {string} bookingId - HubSpot ID
 * @returns {object|null} - Booking object or null
 */
async function getBookingByIdFromSupabase(bookingId) {
  const { data, error } = await supabaseAdmin
    .from('hubspot_bookings')
    .select('*')
    .eq('hubspot_id', bookingId)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error(`❌ Supabase booking read error:`, error.message);
    throw error;
  }

  return data;
}

/**
 * Get active bookings count for an exam from Supabase
 * @param {string} examId - Mock exam HubSpot ID
 * @returns {number} - Count of active bookings
 */
async function getActiveBookingsCountFromSupabase(examId) {
  const { count, error } = await supabaseAdmin
    .from('hubspot_bookings')
    .select('*', { count: 'exact', head: true })
    .eq('associated_mock_exam', examId)
    .neq('is_active', 'Cancelled')
    .neq('is_active', 'cancelled');

  if (error) {
    console.error(`❌ Supabase count error for exam ${examId}:`, error.message);
    throw error;
  }

  return count || 0;
}

// ============== WRITE SYNC OPERATIONS (after HubSpot write) ==============

/**
 * Sync booking to Supabase after HubSpot write
 * @param {object} booking - Booking object from HubSpot
 * @param {string} examId - Mock exam ID
 */
async function syncBookingToSupabase(booking, examId) {
  const props = booking.properties || booking;

  // Transform dominant_hand boolean to string
  let dominantHandValue = null;
  if (props.dominant_hand === 'true' || props.dominant_hand === true) {
    dominantHandValue = 'right hand';
  } else if (props.dominant_hand === 'false' || props.dominant_hand === false) {
    dominantHandValue = 'left hand';
  }

  const record = {
    hubspot_id: booking.id,
    booking_id: props.booking_id,
    associated_mock_exam: examId || props.associated_mock_exam || props.mock_exam_id,
    associated_contact_id: props.associated_contact_id || props.contact_id,
    student_id: props.student_id,
    name: props.name || props.student_name,
    student_email: props.student_email || props.email,
    is_active: props.is_active,
    attendance: props.attendance,
    attending_location: props.attending_location,
    exam_date: props.exam_date,
    dominant_hand: dominantHandValue,
    token_used: props.token_used,
    token_refunded_at: props.token_refunded_at ? new Date(parseInt(props.token_refunded_at)).toISOString() : null,
    token_refund_admin: props.token_refund_admin,
    mock_type: props.mock_type,
    start_time: props.start_time,
    end_time: props.end_time,
    ndecc_exam_date: props.ndecc_exam_date,
    idempotency_key: props.idempotency_key,
    created_at: props.createdate || props.created_at,
    updated_at: props.hs_lastmodifieddate || props.updated_at,
    synced_at: new Date().toISOString()
  };

  const { error } = await supabaseAdmin
    .from('hubspot_bookings')
    .upsert(record, { onConflict: 'hubspot_id' });

  if (error) {
    console.error(`❌ Supabase booking sync error:`, error.message);
    throw error;
  }

  console.log(`✅ Synced booking ${booking.id} to Supabase`);
}

/**
 * Sync multiple bookings to Supabase
 * @param {Array} bookings - Array of booking objects
 * @param {string} examId - Mock exam ID
 */
async function syncBookingsToSupabase(bookings, examId) {
  if (!bookings || bookings.length === 0) return;

  const records = bookings.map(booking => {
    const props = booking.properties || booking;
    return {
      hubspot_id: booking.id,
      booking_id: props.booking_id,
      associated_mock_exam: examId || props.associated_mock_exam || props.mock_exam_id,
      associated_contact_id: props.associated_contact_id || props.contact_id,
      student_id: props.student_id,
      name: props.name || props.student_name,
      student_email: props.student_email || props.email,
      is_active: props.is_active,
      attendance: props.attendance,
      attending_location: props.attending_location,
      exam_date: props.exam_date,
      dominant_hand: props.dominant_hand,
      token_used: props.token_used,
      token_refunded_at: props.token_refunded_at,
      token_refund_admin: props.token_refund_admin,
      mock_type: props.mock_type,
      start_time: props.start_time,
      end_time: props.end_time,
      ndecc_exam_date: props.ndecc_exam_date,
      idempotency_key: props.idempotency_key,
      created_at: props.createdate || props.created_at,
      updated_at: props.hs_lastmodifieddate || props.updated_at,
      synced_at: new Date().toISOString()
    };
  });

  const { error } = await supabaseAdmin
    .from('hubspot_bookings')
    .upsert(records, { onConflict: 'hubspot_id' });

  if (error) {
    console.error(`❌ Supabase bulk sync error:`, error.message);
    throw error;
  }

  console.log(`✅ Synced ${records.length} bookings to Supabase`);
}

/**
 * Sync exam to Supabase after HubSpot write
 * @param {object} exam - Exam object from HubSpot
 */
async function syncExamToSupabase(exam) {
  const props = exam.properties || exam;

  const record = {
    hubspot_id: exam.id,
    mock_exam_name: props.mock_exam_name,
    mock_type: props.mock_type,
    exam_date: props.exam_date,
    start_time: props.start_time,
    end_time: props.end_time,
    location: props.location,
    capacity: parseInt(props.capacity) || 0,
    total_bookings: parseInt(props.total_bookings) || 0,
    is_active: props.is_active,
    scheduled_activation_datetime: props.scheduled_activation_datetime,
    created_at: props.createdate || props.created_at,
    updated_at: props.hs_lastmodifieddate || props.updated_at,
    synced_at: new Date().toISOString()
  };

  const { error } = await supabaseAdmin
    .from('hubspot_mock_exams')
    .upsert(record, { onConflict: 'hubspot_id' });

  if (error) {
    console.error(`❌ Supabase exam sync error:`, error.message);
    throw error;
  }

  console.log(`✅ Synced exam ${exam.id} to Supabase`);
}

/**
 * Update booking status in Supabase (for cancellations)
 * @param {string} bookingId - HubSpot ID
 * @param {string} newStatus - New is_active status
 */
async function updateBookingStatusInSupabase(bookingId, newStatus) {
  const { error } = await supabaseAdmin
    .from('hubspot_bookings')
    .update({
      is_active: newStatus,
      updated_at: new Date().toISOString(),
      synced_at: new Date().toISOString()
    })
    .eq('hubspot_id', bookingId);

  if (error) {
    console.error(`❌ Supabase booking status update error:`, error.message);
    throw error;
  }

  console.log(`✅ Updated booking ${bookingId} status to ${newStatus} in Supabase`);
}

/**
 * Update exam total_bookings in Supabase
 * Supports atomic increment/decrement operations to avoid race conditions
 *
 * @param {string} examId - HubSpot ID
 * @param {number|null} totalBookings - Absolute value to set, or null for atomic operations
 * @param {string} operation - 'set' (default), 'increment', or 'decrement'
 * @param {number} delta - Amount to increment/decrement (default: 1)
 *
 * @example
 * // Set absolute value (legacy behavior)
 * await updateExamBookingCountInSupabase('123', 10);
 *
 * // Atomic increment
 * await updateExamBookingCountInSupabase('123', null, 'increment');
 *
 * // Atomic decrement
 * await updateExamBookingCountInSupabase('123', null, 'decrement');
 */
async function updateExamBookingCountInSupabase(examId, totalBookings = null, operation = 'set', delta = 1) {
  try {
    if (operation === 'increment' || operation === 'decrement') {
      // ATOMIC OPERATION: Use PostgreSQL increment/decrement
      const operator = operation === 'increment' ? '+' : '-';

      const { data, error } = await supabaseAdmin.rpc('increment_exam_bookings', {
        p_exam_id: examId,
        p_delta: operation === 'increment' ? delta : -delta
      });

      if (error) {
        // If RPC function doesn't exist, fallback to manual fetch-update-set
        console.warn(`⚠️ RPC function not available, using fallback method`);
        console.warn(`⚠️ RPC Error details:`, JSON.stringify(error, null, 2));

        // Fetch current value
        const { data: exam, error: fetchError } = await supabaseAdmin
          .from('hubspot_mock_exams')
          .select('total_bookings')
          .eq('hubspot_id', examId)
          .single();

        if (fetchError) throw fetchError;

        const currentCount = parseInt(exam?.total_bookings) || 0;
        const newCount = operation === 'increment'
          ? currentCount + delta
          : Math.max(0, currentCount - delta); // Prevent negative counts

        const { error: updateError } = await supabaseAdmin
          .from('hubspot_mock_exams')
          .update({
            total_bookings: newCount,
            updated_at: new Date().toISOString(),
            synced_at: new Date().toISOString()
          })
          .eq('hubspot_id', examId);

        if (updateError) throw updateError;

        console.log(`✅ ${operation === 'increment' ? 'Incremented' : 'Decremented'} exam ${examId} total_bookings to ${newCount} in Supabase (fallback)`);
        return;
      }

      console.log(`✅ ${operation === 'increment' ? 'Incremented' : 'Decremented'} exam ${examId} total_bookings in Supabase (atomic)`);
    } else {
      // ABSOLUTE SET: Set exact value (legacy behavior)
      const { error } = await supabaseAdmin
        .from('hubspot_mock_exams')
        .update({
          total_bookings: totalBookings,
          updated_at: new Date().toISOString(),
          synced_at: new Date().toISOString()
        })
        .eq('hubspot_id', examId);

      if (error) throw error;

      console.log(`✅ Set exam ${examId} total_bookings to ${totalBookings} in Supabase`);
    }
  } catch (error) {
    console.error(`❌ Supabase exam count update error:`, error.message);
    throw error;
  }
}

/**
 * Delete booking from Supabase
 * @param {string} bookingId - HubSpot ID
 */
async function deleteBookingFromSupabase(bookingId) {
  const { error } = await supabaseAdmin
    .from('hubspot_bookings')
    .delete()
    .eq('hubspot_id', bookingId);

  if (error) {
    console.error(`❌ Supabase booking delete error:`, error.message);
    throw error;
  }

  console.log(`✅ Deleted booking ${bookingId} from Supabase`);
}

/**
 * Delete exam from Supabase
 * @param {string} examId - HubSpot ID
 */
async function deleteExamFromSupabase(examId) {
  const { error } = await supabaseAdmin
    .from('hubspot_mock_exams')
    .delete()
    .eq('hubspot_id', examId);

  if (error) {
    console.error(`❌ Supabase exam delete error:`, error.message);
    throw error;
  }

  console.log(`✅ Deleted exam ${examId} from Supabase`);
}

// ============== CONTACT CREDITS OPERATIONS (Secondary Database) ==============

/**
 * Get contact credits from Supabase secondary database
 * Pattern: Same as bookings/exams - Supabase mirrors HubSpot data
 * @param {string} studentId - Student ID
 * @param {string} email - Contact email
 * @returns {object|null} - Contact credits object or null if not found
 */
async function getContactCreditsFromSupabase(studentId, email) {
  const { data, error } = await supabaseAdmin
    .from('hubspot_contact_credits')
    .select('*')
    .eq('student_id', studentId)
    .eq('email', email.toLowerCase())
    .single();

  if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
    console.error(`❌ Supabase contact credits read error:`, error.message);
    throw error;
  }

  return data;
}

/**
 * Sync contact credits to Supabase secondary database after HubSpot read
 * This maintains the read replica - HubSpot remains source of truth
 * @param {object} contact - Contact object from HubSpot (source of truth)
 */
async function syncContactCreditsToSupabase(contact) {
  if (!contact || !contact.properties) {
    console.error('[SUPABASE SYNC] Cannot sync - contact or properties missing');
    return;
  }

  const props = contact.properties;

  const record = {
    hubspot_id: contact.id,
    student_id: props.student_id,
    email: props.email?.toLowerCase(),
    firstname: props.firstname,
    lastname: props.lastname,
    sj_credits: parseInt(props.sj_credits) || 0,
    cs_credits: parseInt(props.cs_credits) || 0,
    sjmini_credits: parseInt(props.sjmini_credits) || 0,
    mock_discussion_token: parseInt(props.mock_discussion_token) || 0,
    shared_mock_credits: parseInt(props.shared_mock_credits) || 0,
    ndecc_exam_date: props.ndecc_exam_date,
    updated_at: props.hs_lastmodifieddate || new Date().toISOString(),
    synced_at: new Date().toISOString()
  };

  const { error } = await supabaseAdmin
    .from('hubspot_contact_credits')
    .upsert(record, { onConflict: 'hubspot_id' });

  if (error) {
    console.error(`❌ [SUPABASE SYNC] Failed to sync contact ${contact.id}:`, error.message);
    throw error;
  }

  console.log(`✅ [SUPABASE SYNC] Updated secondary DB for contact ${contact.id}`);
}

/**
 * Update contact credits in Supabase secondary database after credit deduction
 * Called after HubSpot update to keep secondary DB in sync
 * @param {string} contactId - HubSpot contact ID
 * @param {string} mockType - Mock type to update credits for
 * @param {number} newSpecificCredits - New specific credit value
 * @param {number} newSharedCredits - New shared credit value
 */
async function updateContactCreditsInSupabase(contactId, mockType, newSpecificCredits, newSharedCredits) {
  const updateData = {
    updated_at: new Date().toISOString(),
    synced_at: new Date().toISOString()
  };

  // Update specific credit field based on mock type
  switch (mockType) {
    case 'Situational Judgment':
      updateData.sj_credits = newSpecificCredits;
      updateData.shared_mock_credits = newSharedCredits;
      break;
    case 'Clinical Skills':
      updateData.cs_credits = newSpecificCredits;
      updateData.shared_mock_credits = newSharedCredits;
      break;
    case 'Mini-mock':
      updateData.sjmini_credits = newSpecificCredits;
      break;
    case 'Mock Discussion':
      updateData.mock_discussion_token = newSpecificCredits;
      break;
  }

  const { error } = await supabaseAdmin
    .from('hubspot_contact_credits')
    .update(updateData)
    .eq('hubspot_id', contactId);

  if (error) {
    console.error(`❌ [SUPABASE SYNC] Failed to update contact ${contactId}:`, error.message);
    throw error;
  }

  console.log(`✅ [SUPABASE SYNC] Updated secondary DB for contact ${contactId} (${mockType})`);
}

module.exports = {
  // Reads
  getBookingsFromSupabase,
  getBookingsByContactFromSupabase,
  getExamsFromSupabase,
  getExamByIdFromSupabase,
  getBookingByIdFromSupabase,
  getActiveBookingsCountFromSupabase,
  getContactCreditsFromSupabase,
  // Write syncs
  syncBookingToSupabase,
  syncBookingsToSupabase,
  syncExamToSupabase,
  updateBookingStatusInSupabase,
  updateExamBookingCountInSupabase,
  deleteBookingFromSupabase,
  deleteExamFromSupabase,
  syncContactCreditsToSupabase,
  updateContactCreditsInSupabase
};
