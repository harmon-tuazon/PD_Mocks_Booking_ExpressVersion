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
/**
 * Get contact by email from Supabase
 * @param {string} email - Contact email address
 * @returns {object|null} - Contact object or null if not found
 */
async function getContactByEmailFromSupabase(email) {
  const { data, error } = await supabaseAdmin
    .from('hubspot_contact_credits')
    .select('*')
    .ilike('email', email) // Case-insensitive match
    .single();

  if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
    console.error(`❌ Supabase contact read error (email):`, error.message);
    throw error;
  }

  return data;
}

/**
 * Get contact by student ID from Supabase
 * @param {string} studentId - Student ID
 * @returns {object|null} - Contact object or null if not found
 */
async function getContactByStudentIdFromSupabase(studentId) {
  const { data, error } = await supabaseAdmin
    .from('hubspot_contact_credits')
    .select('*')
    .eq('student_id', studentId)
    .single();

  if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
    console.error(`❌ Supabase contact read error (student_id):`, error.message);
    throw error;
  }

  return data;
}

/**
 * Get contact by HubSpot ID from Supabase
 * @param {string} contactId - HubSpot contact ID
 * @returns {object|null} - Contact object or null if not found
 */
async function getContactByIdFromSupabase(contactId) {
  const { data, error} = await supabaseAdmin
    .from('hubspot_contact_credits')
    .select('*')
    .eq('hubspot_id', contactId)
    .single();

  if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
    console.error(`❌ Supabase contact read error (hubspot_id):`, error.message);
    throw error;
  }

  return data;
}

/**
 * Sync contact to Supabase (auto-populate on cache miss)
 * @param {object} contact - Contact object from HubSpot
 */
async function syncContactToSupabase(contact) {
  if (!contact || !contact.properties) {
    console.error('[SYNC] Cannot sync contact - missing properties');
    return;
  }

  const props = contact.properties;

  const record = {
    hubspot_id: contact.id,
    student_id: props.student_id,
    email: props.email?.toLowerCase(),
    firstname: props.firstname,
    lastname: props.lastname,
    phone: props.phone,
    sj_credits: parseInt(props.sj_credits) || 0,
    cs_credits: parseInt(props.cs_credits) || 0,
    sjmini_credits: parseInt(props.sjmini_credits) || 0,
    mock_discussion_token: parseInt(props.mock_discussion_token) || 0,
    shared_mock_credits: parseInt(props.shared_mock_credits) || 0,
    ndecc_exam_date: props.ndecc_exam_date,
    created_at: props.createdate || props.created_at,
    updated_at: props.hs_lastmodifieddate || props.updated_at,
    synced_at: new Date().toISOString()
  };

  const { error } = await supabaseAdmin
    .from('hubspot_contact_credits')
    .upsert(record, { onConflict: 'hubspot_id' });

  if (error) {
    console.error(`❌ Supabase contact sync error:`, error.message);
    throw error;
  }

  console.log(`✅ Synced contact ${contact.id} to Supabase`);
}

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
  } else if (props.dominant_hand === 'right hand' || props.dominant_hand === 'left hand') {
    // Already in correct format
    dominantHandValue = props.dominant_hand;
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
  const now = new Date().toISOString();

  // Defensive: Extract timestamps with multiple fallback layers
  // Priority: HubSpot top-level → properties (multiple formats) → current time
  const createdAt = exam.createdAt || props.hs_createdate || props.createdate || props.created_at || now;
  const updatedAt = exam.updatedAt || props.hs_lastmodifieddate || props.lastmodifieddate || props.updated_at || now;

  const record = {
    hubspot_id: exam.id,
    mock_exam_name: props.mock_exam_name || null,
    mock_type: props.mock_type || null,
    exam_date: props.exam_date || null,
    start_time: props.start_time || null,
    end_time: props.end_time || null,
    location: props.location || null,
    capacity: parseInt(props.capacity) || 0,
    total_bookings: parseInt(props.total_bookings) || 0,
    is_active: props.is_active || null,
    // Convert Unix timestamp (milliseconds) to ISO string for Supabase TIMESTAMPTZ
    scheduled_activation_datetime: props.scheduled_activation_datetime
      ? (typeof props.scheduled_activation_datetime === 'string' && props.scheduled_activation_datetime.includes('T')
          ? props.scheduled_activation_datetime // Already ISO format
          : new Date(parseInt(props.scheduled_activation_datetime)).toISOString()) // Convert Unix timestamp
      : null,
    // Defensive timestamps with multiple fallbacks
    created_at: createdAt,
    updated_at: updatedAt,
    synced_at: now
  };

  const { error, data } = await supabaseAdmin
    .from('hubspot_mock_exams')
    .upsert(record, { onConflict: 'hubspot_id' })
    .select(); // Add .select() to get returned data

  if (error) {
    console.error(`❌ Supabase exam sync error:`, error.message);
    console.error(`❌ Error details:`, JSON.stringify(error, null, 2));
    throw error;
  }

  // Verify upsert actually worked
  if (!data || data.length === 0) {
    console.error(`⚠️ Supabase upsert returned no data for exam ${exam.id} - record may have been deleted`);
    console.error(`⚠️ Record attempted to sync:`, JSON.stringify(record, null, 2));
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
 * @param {string} examId - HubSpot ID
 * @param {number} totalBookings - New total bookings count
 */
async function updateExamBookingCountInSupabase(examId, totalBookings) {
  const { error } = await supabaseAdmin
    .from('hubspot_mock_exams')
    .update({
      total_bookings: totalBookings,
      updated_at: new Date().toISOString(),
      synced_at: new Date().toISOString()
    })
    .eq('hubspot_id', examId);

  if (error) {
    console.error(`❌ Supabase exam count update error:`, error.message);
    throw error;
  }

  console.log(`✅ Updated exam ${examId} total_bookings to ${totalBookings} in Supabase`);
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

/**
 * Update contact credits in Supabase secondary database after credit changes
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
  // Contact reads
  getContactByEmailFromSupabase,
  getContactByStudentIdFromSupabase,
  getContactByIdFromSupabase,
  syncContactToSupabase,
  // Booking reads
  getBookingsFromSupabase,
  getBookingsByContactFromSupabase,
  getExamsFromSupabase,
  getExamByIdFromSupabase,
  getBookingByIdFromSupabase,
  getActiveBookingsCountFromSupabase,
  // Write syncs
  syncBookingToSupabase,
  syncBookingsToSupabase,
  syncExamToSupabase,
  updateBookingStatusInSupabase,
  updateExamBookingCountInSupabase,
  deleteBookingFromSupabase,
  deleteExamFromSupabase,
  updateContactCreditsInSupabase
};
