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

/**
 * Check if active booking exists for contact on specific exam date
 * Used for duplicate detection during booking creation (Tier 2 after Redis cache)
 * @param {string} contactId - Numeric HubSpot contact ID (associated_contact_id)
 * @param {string} examDate - Exam date in YYYY-MM-DD format
 * @returns {Promise<boolean>} - True if active booking exists, false otherwise
 */
async function checkExistingBookingInSupabase(contactId, examDate) {
  const { data, error } = await supabaseAdmin
    .from('hubspot_bookings')
    .select('id, booking_id, is_active')
    .eq('associated_contact_id', contactId)
    .eq('exam_date', examDate)
    .neq('is_active', 'Cancelled')
    .neq('is_active', 'cancelled')
    .limit(1);

  if (error) {
    console.error(`❌ Supabase duplicate check error for contact ${contactId} on ${examDate}:`, error.message);
    throw error;
  }

  return data && data.length > 0;
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
 * @param {string} examId - HubSpot ID
 * @param {number} totalBookings - New total bookings count
 */
/**
 * Update exam booking count in Supabase
 * Supports three modes: 'set' (absolute), 'increment', 'decrement'
 * @param {string} examId - HubSpot exam ID
 * @param {number} totalBookings - For 'set' mode: absolute value. For increment/decrement: delta amount
 * @param {string} operation - 'set' | 'increment' | 'decrement'
 */
async function updateExamBookingCountInSupabase(examId, totalBookings, operation = 'set') {
  try {
    if (operation === 'increment' || operation === 'decrement') {
      // ATOMIC OPERATION: Use PostgreSQL increment/decrement RPC
      const delta = operation === 'increment' ? totalBookings : -totalBookings;

      console.log(`🔍 [RPC DEBUG] Calling increment_exam_bookings with:`, {
        examId,
        operation,
        delta
      });

      const { data, error } = await supabaseAdmin.rpc('increment_exam_bookings', {
        p_exam_id: examId,
        p_delta: delta
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
          ? currentCount + totalBookings
          : Math.max(0, currentCount - totalBookings); // Prevent negative counts

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

      console.log(`✅ ${operation === 'increment' ? 'Incremented' : 'Decremented'} exam ${examId} total_bookings in Supabase (atomic RPC) - new value: ${data}`);
    } else {
      // ABSOLUTE SET: Set exact value (legacy behavior for cron sync)
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

/**
 * Create booking atomically via RPC
 * @param {Object} params - Booking parameters
 * @returns {Promise<Object>} Booking result
 */

async function createBookingAtomic({
  bookingId,
  studentId,
  studentEmail,
  mockExamId,
  studentName,
  tokenUsed,
  attendingLocation,
  dominantHand,
  idempotencyKey,
  creditField,
  newCreditValue
}) {
  console.log('[SUPABASE] Creating booking atomically:', { bookingId, studentId });

  const { data, error } = await supabaseAdmin.rpc('create_booking_atomic', {
    p_booking_id: bookingId,
    p_student_id: studentId,
    p_student_email: studentEmail,
    p_mock_exam_id: mockExamId,
    p_student_name: studentName,
    p_token_used: tokenUsed,
    p_attending_location: attendingLocation,
    p_dominant_hand: dominantHand,
    p_idempotency_key: idempotencyKey,
    p_credit_field: creditField,
    p_new_credit_value: newCreditValue
  });

  if (error) {
    console.error('[SUPABASE] Atomic booking failed:', {
      error: error.message,
      code: error.code,
      bookingId,
      studentId
    });

    // Check for idempotency (duplicate key)
    if (error.code === '23505') {
      return {
        success: true,
        idempotent: true,
        message: 'Duplicate request - booking already exists'
      };
    }

    throw new Error(error.message);
  }

  console.log('[SUPABASE] Booking created successfully:', {
    bookingId: data.booking_id,
    bookingCode: data.booking_code
  });

  return {
    success: true,
    idempotent: false,
    data
  };
}

/**
 * Cancel booking atomically via RPC
 * @param {Object} params - Cancellation parameters
 * @returns {Promise<Object>} Cancellation result
 */
async function cancelBookingAtomic({
  bookingId,  // UUID (id column, not hubspot_id)
  creditField,
  restoredCreditValue
}) {
  console.log('[SUPABASE] Cancelling booking atomically:', { bookingId });

  const { data, error } = await supabaseAdmin.rpc('cancel_booking_atomic', {
    p_booking_id: bookingId,
    p_credit_field: creditField,
    p_restored_credit_value: restoredCreditValue
  });

  if (error) {
    console.error('[SUPABASE] Atomic cancellation failed:', {
      error: error.message,
      code: error.code,
      bookingId
    });
    throw new Error(error.message);
  }

  console.log('[SUPABASE] Booking cancelled successfully:', {
    bookingId: data.booking_id
  });

  return {
    success: true,
    data
  };
}

/**
 * Check idempotency key via RPC
 * @param {string} idempotencyKey - The key to check
 * @returns {Promise<Object|null>} Existing booking or null
 */
async function checkIdempotencyKey(idempotencyKey) {
  if (!idempotencyKey) return null;

  const { data, error } = await supabaseAdmin.rpc('check_idempotency_key', {
    p_idempotency_key: idempotencyKey
  });

  if (error) {
    console.warn('[SUPABASE] Idempotency check failed:', error.message);
    return null;  // Treat as not found
  }

  if (data && data.found) {
    console.log('[SUPABASE] Idempotency key found:', {
      bookingId: data.booking_id,
      isActive: data.is_active
    });
    return data;
  }

  return null;
}


/**
 * Get booking with cascading lookup
 * Priority: hubspot_id → id (UUID) → booking_id
 *
 * @param {string} identifier - The booking identifier (could be any of the 3 types)
 * @returns {Promise<Object|null>} Booking record or null
 */

async function getBookingCascading(identifier) {
  if (!identifier) return null;

  console.log('[SUPABASE] Cascading booking lookup:', { identifier });

  // Determine identifier type
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);

  // Priority 1: If it's a UUID, search by id (primary key - fastest)
  if (isUUID) {
    const { data, error } = await supabaseAdmin
      .from('hubspot_bookings')
      .select('*')
      .eq('id', identifier)
      .single();

    if (!error && data) {
      console.log('[SUPABASE] Found by id (UUID):', identifier);
      return data;
    }
  }

  // Priority 2: Otherwise assume it's hubspot_id (numeric string or legacy)
  const { data, error } = await supabaseAdmin
    .from('hubspot_bookings')
    .select('*')
    .eq('hubspot_id', identifier)
    .single();

  if (!error && data) {
    console.log('[SUPABASE] Found by hubspot_id:', identifier);
    return data;
  }

  // Not found
  console.warn('[SUPABASE] Booking not found with identifier:', identifier);
  return null;
}





module.exports = {
  // Reads
  getBookingsFromSupabase,
  getBookingsByContactFromSupabase,
  getExamsFromSupabase,
  getExamByIdFromSupabase,
  getBookingByIdFromSupabase,
  getActiveBookingsCountFromSupabase,
  checkExistingBookingInSupabase,
  getContactCreditsFromSupabase,
  getBookingCascading,
  // Write syncs
  syncBookingToSupabase,
  syncBookingsToSupabase,
  syncExamToSupabase,
  updateBookingStatusInSupabase,
  updateExamBookingCountInSupabase,
  deleteExamFromSupabase,
  syncContactCreditsToSupabase,
  updateContactCreditsInSupabase,
  createBookingAtomic,
  cancelBookingAtomic,
  checkIdempotencyKey,
};
