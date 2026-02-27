/**
 * Database Data Access Layer (PostgreSQL)
 * Replaces Supabase client for data queries.
 * Supabase is now used ONLY for authentication (JWT verification).
 */

const { query } = require('./database');
const { db } = require('./supabase');

// ============== HELPER FUNCTIONS ==============

function parseTimestamp(value) {
  if (!value || value === '' || value === 'null' || value === 'undefined') return null;
  const parsed = parseInt(value);
  if (isNaN(parsed)) return null;
  try { return new Date(parsed).toISOString(); } catch (e) { return null; }
}

function parseDateString(value) {
  if (!value || value === '' || value === 'null' || value === 'undefined') return null;
  return value;
}

// ============== READ OPERATIONS ==============

async function getBookingsFromSupabase(examId) {
  const { rows } = await query(
    'SELECT * FROM hubspot_bookings WHERE associated_mock_exam = $1',
    [examId]
  );
  return rows;
}

async function getBookingsByContactFromSupabase(contactId) {
  const { rows } = await query(
    'SELECT * FROM hubspot_bookings WHERE associated_contact_id = $1 ORDER BY exam_date DESC',
    [contactId]
  );
  return rows;
}

async function getExamsFromSupabase(filters) {
  if (!filters) filters = {};
  const conditions = [];
  const params = [];

  if (filters.is_active) {
    let activeValue = filters.is_active;
    if (activeValue === 'active' || activeValue === 'Yes') activeValue = 'true';
    params.push(activeValue);
    conditions.push('is_active = $' + params.length);
  }
  if (filters.startDate) {
    params.push(filters.startDate);
    conditions.push('exam_date >= $' + params.length);
  }
  if (filters.endDate) {
    params.push(filters.endDate);
    conditions.push('exam_date <= $' + params.length);
  }
  if (filters.mock_type) {
    params.push(filters.mock_type);
    conditions.push('mock_type = $' + params.length);
  }
  if (filters.location) {
    params.push(filters.location);
    conditions.push('location = $' + params.length);
  }

  const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
  const { rows } = await query('SELECT * FROM hubspot_mock_exams ' + where + ' ORDER BY exam_date ASC', params);
  return rows;
}

async function getExamByIdFromSupabase(examId) {
  const { rows } = await query(
    'SELECT * FROM hubspot_mock_exams WHERE hubspot_id = $1 LIMIT 1',
    [examId]
  );
  return rows[0] || null;
}

async function getBookingByIdFromSupabase(bookingId) {
  const { rows } = await query(
    'SELECT * FROM hubspot_bookings WHERE hubspot_id = $1 LIMIT 1',
    [bookingId]
  );
  return rows[0] || null;
}

async function getActiveBookingsCountFromSupabase(examId) {
  const { rows } = await query(
    "SELECT COUNT(*) FROM hubspot_bookings WHERE associated_mock_exam = $1 AND is_active NOT IN ('Cancelled', 'cancelled')",
    [examId]
  );
  return parseInt(rows[0].count) || 0;
}

async function checkExistingBookingInSupabase(contactId, examDate) {
  const { rows } = await query(
    "SELECT id, booking_id, is_active FROM hubspot_bookings WHERE associated_contact_id = $1 AND exam_date = $2 AND is_active NOT IN ('Cancelled', 'cancelled') LIMIT 1",
    [contactId, examDate]
  );
  return rows.length > 0;
}

async function checkExistingBookingByMockType(contactId, examDate, mockType) {
  const normalizedDate = examDate.includes('T') ? examDate.split('T')[0] : examDate;
  const { rows } = await query(
    "SELECT id, booking_id, mock_type, exam_date, start_time, end_time, is_active FROM hubspot_bookings WHERE associated_contact_id = $1 AND exam_date = $2 AND mock_type = $3 AND is_active NOT IN ('Cancelled', 'cancelled') LIMIT 1",
    [contactId, normalizedDate, mockType]
  );
  const exists = rows.length > 0;
  return { exists: exists, existingBooking: exists ? rows[0] : null };
}

async function getContactCreditsFromSupabase(studentId, email) {
  const { rows } = await query(
    'SELECT * FROM hubspot_contact_credits WHERE student_id = $1 AND email = $2 LIMIT 1',
    [studentId, email.toLowerCase()]
  );
  return rows[0] || null;
}

async function getBookingCascading(identifier) {
  if (!identifier) return null;
  console.log('[DB] Cascading booking lookup:', { identifier: identifier });

  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);

  if (isUUID) {
    const { rows } = await query('SELECT * FROM hubspot_bookings WHERE id = $1 LIMIT 1', [identifier]);
    if (rows.length > 0) {
      console.log('[DB] Found by id (UUID):', identifier);
      return rows[0];
    }
  }

  const { rows } = await query('SELECT * FROM hubspot_bookings WHERE hubspot_id = $1 LIMIT 1', [identifier]);
  if (rows.length > 0) {
    console.log('[DB] Found by hubspot_id:', identifier);
    return rows[0];
  }

  console.warn('[DB] Booking not found with identifier:', identifier);
  return null;
}

// ============== WRITE SYNC OPERATIONS ==============

async function syncBookingToSupabase(booking, examId) {
  const props = booking.properties || booking;

  let dominantHandValue = null;
  if (props.dominant_hand === true || props.dominant_hand === 'true' ||
      props.dominant_hand === 'right hand' || props.dominant_hand === 'Right') {
    dominantHandValue = 'true';
  } else if (props.dominant_hand === false || props.dominant_hand === 'false' ||
             props.dominant_hand === 'left hand' || props.dominant_hand === 'Left') {
    dominantHandValue = 'false';
  }

  const refundedAt = props.token_refunded_at ? new Date(parseInt(props.token_refunded_at)).toISOString() : null;

  await query(
    'INSERT INTO hubspot_bookings (hubspot_id, booking_id, associated_mock_exam, associated_contact_id, student_id, name, student_email, is_active, attendance, attending_location, exam_date, dominant_hand, token_used, token_refunded_at, token_refund_admin, mock_type, mock_set, start_time, end_time, ndecc_exam_date, idempotency_key, created_at, updated_at, synced_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24) ON CONFLICT (hubspot_id) DO UPDATE SET booking_id=EXCLUDED.booking_id, associated_mock_exam=EXCLUDED.associated_mock_exam, associated_contact_id=EXCLUDED.associated_contact_id, student_id=EXCLUDED.student_id, name=EXCLUDED.name, student_email=EXCLUDED.student_email, is_active=EXCLUDED.is_active, attendance=EXCLUDED.attendance, attending_location=EXCLUDED.attending_location, exam_date=EXCLUDED.exam_date, dominant_hand=EXCLUDED.dominant_hand, token_used=EXCLUDED.token_used, token_refunded_at=EXCLUDED.token_refunded_at, token_refund_admin=EXCLUDED.token_refund_admin, mock_type=EXCLUDED.mock_type, mock_set=EXCLUDED.mock_set, start_time=EXCLUDED.start_time, end_time=EXCLUDED.end_time, ndecc_exam_date=EXCLUDED.ndecc_exam_date, idempotency_key=EXCLUDED.idempotency_key, updated_at=EXCLUDED.updated_at, synced_at=EXCLUDED.synced_at',
    [booking.id, props.booking_id, examId || props.associated_mock_exam || props.mock_exam_id, props.associated_contact_id || props.contact_id, props.student_id, props.name || props.student_name, props.student_email || props.email, props.is_active, props.attendance, props.attending_location, props.exam_date, dominantHandValue, props.token_used, refundedAt, props.token_refund_admin, props.mock_type, props.mock_set || null, props.start_time, props.end_time, props.ndecc_exam_date, props.idempotency_key, props.createdate || props.created_at, props.hs_lastmodifieddate || props.updated_at, new Date().toISOString()]
  );
  console.log('Synced booking ' + booking.id + ' to DB');
}

async function syncBookingsToSupabase(bookings, examId) {
  if (!bookings || bookings.length === 0) return;
  for (const booking of bookings) {
    await syncBookingToSupabase(booking, examId);
  }
  console.log('Synced ' + bookings.length + ' bookings to DB');
}

async function syncExamToSupabase(exam) {
  const props = exam.properties || exam;

  function convertTimestamp(value) {
    if (!value) return null;
    if (typeof value === 'string' && value.includes('T')) return value;
    const ts = parseInt(value);
    if (!isNaN(ts)) return new Date(ts).toISOString();
    return null;
  }

  await query(
    'INSERT INTO hubspot_mock_exams (hubspot_id, mock_exam_name, mock_type, exam_date, start_time, end_time, location, capacity, total_bookings, is_active, scheduled_activation_datetime, created_at, updated_at, synced_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) ON CONFLICT (hubspot_id) DO UPDATE SET mock_exam_name=EXCLUDED.mock_exam_name, mock_type=EXCLUDED.mock_type, exam_date=EXCLUDED.exam_date, start_time=EXCLUDED.start_time, end_time=EXCLUDED.end_time, location=EXCLUDED.location, capacity=EXCLUDED.capacity, total_bookings=EXCLUDED.total_bookings, is_active=EXCLUDED.is_active, scheduled_activation_datetime=EXCLUDED.scheduled_activation_datetime, updated_at=EXCLUDED.updated_at, synced_at=EXCLUDED.synced_at',
    [exam.id, props.mock_exam_name, props.mock_type, props.exam_date, convertTimestamp(props.start_time), convertTimestamp(props.end_time), props.location, parseInt(props.capacity) || 0, parseInt(props.total_bookings) || 0, props.is_active, convertTimestamp(props.scheduled_activation_datetime), props.createdate || props.created_at, props.hs_lastmodifieddate || props.updated_at, new Date().toISOString()]
  );
  console.log('Synced exam ' + exam.id + ' to DB');
}

async function updateBookingStatusInSupabase(bookingId, newStatus) {
  const now = new Date().toISOString();
  await query(
    'UPDATE hubspot_bookings SET is_active=$1, updated_at=$2, synced_at=$2 WHERE hubspot_id=$3',
    [newStatus, now, bookingId]
  );
  console.log('Updated booking ' + bookingId + ' status to ' + newStatus);
}

async function updateExamBookingCountInSupabase(examId, totalBookings, operation) {
  if (!operation) operation = 'set';
  const now = new Date().toISOString();
  try {
    if (operation === 'increment' || operation === 'decrement') {
      const delta = operation === 'increment' ? totalBookings : -totalBookings;
      try {
        const { rows } = await query('SELECT increment_exam_bookings($1, $2) AS new_count', [examId, delta]);
        console.log('Atomic ' + operation + ' exam ' + examId + ' - new: ' + rows[0].new_count);
      } catch (rpcErr) {
        console.warn('increment_exam_bookings not found, using fallback:', rpcErr.message);
        const { rows } = await query('SELECT total_bookings FROM hubspot_mock_exams WHERE hubspot_id=$1', [examId]);
        const current = parseInt(rows[0] && rows[0].total_bookings) || 0;
        const newCount = Math.max(0, current + delta);
        await query('UPDATE hubspot_mock_exams SET total_bookings=$1, updated_at=$2, synced_at=$2 WHERE hubspot_id=$3', [newCount, now, examId]);
        console.log('Fallback ' + operation + ' exam ' + examId + ' to ' + newCount);
      }
    } else {
      await query('UPDATE hubspot_mock_exams SET total_bookings=$1, updated_at=$2, synced_at=$2 WHERE hubspot_id=$3', [totalBookings, now, examId]);
      console.log('Set exam ' + examId + ' total_bookings to ' + totalBookings);
    }
  } catch (err) {
    console.error('Exam count update error:', err.message);
    throw err;
  }
}

async function deleteExamFromSupabase(examId) {
  await query('DELETE FROM hubspot_mock_exams WHERE hubspot_id=$1', [examId]);
  console.log('Deleted exam ' + examId + ' from DB');
}

async function syncContactCreditsToSupabase(contact) {
  if (!contact || !contact.properties) {
    console.error('[SYNC] Cannot sync contact - missing properties');
    return;
  }
  const props = contact.properties;
  await query(
    'INSERT INTO hubspot_contact_credits (hubspot_id, student_id, email, firstname, lastname, sj_credits, cs_credits, sjmini_credits, mock_discussion_token, shared_mock_credits, ndecc_exam_date, updated_at, synced_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) ON CONFLICT (hubspot_id) DO UPDATE SET student_id=EXCLUDED.student_id, email=EXCLUDED.email, firstname=EXCLUDED.firstname, lastname=EXCLUDED.lastname, sj_credits=EXCLUDED.sj_credits, cs_credits=EXCLUDED.cs_credits, sjmini_credits=EXCLUDED.sjmini_credits, mock_discussion_token=EXCLUDED.mock_discussion_token, shared_mock_credits=EXCLUDED.shared_mock_credits, ndecc_exam_date=EXCLUDED.ndecc_exam_date, updated_at=EXCLUDED.updated_at, synced_at=EXCLUDED.synced_at',
    [contact.id, props.student_id, props.email ? props.email.toLowerCase() : null, props.firstname, props.lastname, parseInt(props.sj_credits) || 0, parseInt(props.cs_credits) || 0, parseInt(props.sjmini_credits) || 0, parseInt(props.mock_discussion_token) || 0, parseInt(props.shared_mock_credits) || 0, props.ndecc_exam_date, props.hs_lastmodifieddate || new Date().toISOString(), new Date().toISOString()]
  );
  console.log('[SYNC] Updated secondary DB for contact ' + contact.id);
}

async function updateContactCreditsInSupabase(contactId, mockType, newSpecificCredits, newSharedCredits) {
  const now = new Date().toISOString();
  let sql = '';
  let params = [];
  if (mockType === 'Situational Judgment') {
    sql = 'UPDATE hubspot_contact_credits SET sj_credits=$1, shared_mock_credits=$2, updated_at=$3, synced_at=$3 WHERE hubspot_id=$4';
    params = [newSpecificCredits, newSharedCredits, now, contactId];
  } else if (mockType === 'Clinical Skills') {
    sql = 'UPDATE hubspot_contact_credits SET cs_credits=$1, shared_mock_credits=$2, updated_at=$3, synced_at=$3 WHERE hubspot_id=$4';
    params = [newSpecificCredits, newSharedCredits, now, contactId];
  } else if (mockType === 'Mini-mock') {
    sql = 'UPDATE hubspot_contact_credits SET sjmini_credits=$1, updated_at=$2, synced_at=$2 WHERE hubspot_id=$3';
    params = [newSpecificCredits, now, contactId];
  } else if (mockType === 'Mock Discussion') {
    sql = 'UPDATE hubspot_contact_credits SET mock_discussion_token=$1, updated_at=$2, synced_at=$2 WHERE hubspot_id=$3';
    params = [newSpecificCredits, now, contactId];
  } else {
    console.warn('[SYNC] Unknown mockType: ' + mockType);
    return;
  }
  await query(sql, params);
  console.log('[SYNC] Updated secondary DB for contact ' + contactId + ' (' + mockType + ')');
}

// ============== RPC / STORED PROCEDURE CALLS ==============

async function createBookingAtomic(params) {
  const { bookingId, studentId, studentEmail, mockExamId, studentName, tokenUsed, attendingLocation, dominantHand, idempotencyKey, creditField, newCreditValue, mockSet } = params;
  console.log('[DB] Creating booking atomically:', { bookingId: bookingId, studentId: studentId });
  try {
    const { rows } = await query(
      'SELECT * FROM create_booking_atomic($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)',
      [bookingId, studentId, studentEmail, mockExamId, studentName, tokenUsed, attendingLocation, dominantHand, idempotencyKey, creditField, newCreditValue, mockSet || null]
    );
    const data = rows[0];
    console.log('[DB] Booking created:', { bookingId: data && data.booking_id });
    return { success: true, idempotent: false, data: data };
  } catch (err) {
    if (err.code === '23505') {
      return { success: true, idempotent: true, message: 'Duplicate request - booking already exists' };
    }
    console.error('[DB] Atomic booking failed:', { error: err.message, code: err.code });
    throw new Error(err.message);
  }
}

async function cancelBookingAtomic(params) {
  const { bookingId, creditField, restoredCreditValue } = params;
  console.log('[DB] Cancelling booking atomically:', { bookingId: bookingId });
  const { rows } = await query(
    'SELECT * FROM cancel_booking_atomic($1, $2, $3)',
    [bookingId, creditField, restoredCreditValue]
  );
  const data = rows[0];
  console.log('[DB] Booking cancelled:', { bookingId: data && data.booking_id });
  return { success: true, data: data };
}

async function checkIdempotencyKey(idempotencyKey) {
  if (!idempotencyKey) return null;
  try {
    const { rows } = await query('SELECT * FROM check_idempotency_key($1)', [idempotencyKey]);
    const data = rows[0];
    if (data && data.found) {
      console.log('[DB] Idempotency key found:', { bookingId: data.booking_id });
      return data;
    }
    return null;
  } catch (err) {
    console.warn('[DB] Idempotency check failed:', err.message);
    return null;
  }
}

module.exports = {
  getBookingsFromSupabase: getBookingsFromSupabase,
  getBookingsByContactFromSupabase: getBookingsByContactFromSupabase,
  getExamsFromSupabase: getExamsFromSupabase,
  getExamByIdFromSupabase: getExamByIdFromSupabase,
  getBookingByIdFromSupabase: getBookingByIdFromSupabase,
  getActiveBookingsCountFromSupabase: getActiveBookingsCountFromSupabase,
  checkExistingBookingInSupabase: checkExistingBookingInSupabase,
  checkExistingBookingByMockType: checkExistingBookingByMockType,
  getContactCreditsFromSupabase: getContactCreditsFromSupabase,
  getBookingCascading: getBookingCascading,
  syncBookingToSupabase: syncBookingToSupabase,
  syncBookingsToSupabase: syncBookingsToSupabase,
  syncExamToSupabase: syncExamToSupabase,
  updateBookingStatusInSupabase: updateBookingStatusInSupabase,
  updateExamBookingCountInSupabase: updateExamBookingCountInSupabase,
  deleteExamFromSupabase: deleteExamFromSupabase,
  syncContactCreditsToSupabase: syncContactCreditsToSupabase,
  updateContactCreditsInSupabase: updateContactCreditsInSupabase,
  createBookingAtomic: createBookingAtomic,
  cancelBookingAtomic: cancelBookingAtomic,
  checkIdempotencyKey: checkIdempotencyKey,
  db: db
};
