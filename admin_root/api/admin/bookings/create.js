/**
 * Admin Booking Creation Endpoint
 * POST /api/admin/bookings/create
 *
 * Creates a booking on behalf of a trainee from the mock exam details page.
 *
 * KEY DIFFERENCES FROM USER BOOKING FLOW:
 * - NO token validation (admin override)
 * - NO capacity enforcement (warning only)
 * - NO Redis locks (admin action is deliberate)
 * - Manual contact search (not from auth)
 * - Enhanced audit trail with admin attribution
 *
 * @requires requireAdmin - Admin authentication
 * @requires adminBookingCreation - Joi validation schema
 */

const { requirePermission } = require('../middleware/requirePermission');
const { HubSpotService, HUBSPOT_OBJECTS } = require('../../_shared/hubspot');
const { validateInput } = require('../../_shared/validation');
const { getCache } = require('../../_shared/cache');
const RedisLockService = require('../../_shared/redis');
const {
  syncBookingToSupabase,
  updateExamBookingCountInSupabase,
  searchContactFromSupabase,
  getExamByIdFromSupabase,
  checkExistingActiveBookingFromSupabase
} = require('../../_shared/supabase-data');

module.exports = async (req, res) => {
  let bookingCreated = false;
  let createdBookingId = null;
  let hubspot = null;
  let redis = null;

  try {
    // Initialize Redis for counter management
    redis = new RedisLockService();
    // ========================================================================
    // STEP 1: Admin Authentication and Permission
    // ========================================================================
    const user = await requirePermission(req, 'bookings.create');
    const adminEmail = user?.email || 'admin@prepdoctors.com';

    console.log(`🔧 [ADMIN BOOKING] Initiated by: ${adminEmail}`);

    // ========================================================================
    // STEP 2: Validate Request Body
    // ========================================================================
    const validatedData = await validateInput(req.body, 'adminBookingCreation');

    const {
      mock_exam_id,
      student_id,
      email,
      mock_type,
      exam_date,
      dominant_hand,
      attending_location
    } = validatedData;

    console.log(`🔧 [ADMIN BOOKING] Creating booking for student_id: ${student_id}, email: ${email}`);

    hubspot = new HubSpotService();

    // ========================================================================
    // STEP 3: Search for Contact in Supabase (Supabase-first)
    // ========================================================================
    console.log(`🔍 [ADMIN BOOKING] Searching for contact in Supabase...`);

    const contact = await searchContactFromSupabase(student_id, email);

    if (!contact) {
      const error = new Error(`No contact found with student_id '${student_id}' and email '${email}'`);
      error.status = 404;
      error.code = 'CONTACT_NOT_FOUND';
      throw error;
    }

    // Supabase uses hubspot_id column, contact data is flat (not nested in properties)
    const contactId = contact.hubspot_id;
    const contactName = `${contact.firstname || ''} ${contact.lastname || ''}`.trim() || student_id;

    console.log(`✅ [ADMIN BOOKING] Contact found: ${contactName} (ID: ${contactId})`);

    // ========================================================================
    // STEP 4: Verify Mock Exam Exists and is Active (Supabase-first)
    // ========================================================================
    console.log(`🔍 [ADMIN BOOKING] Verifying mock exam in Supabase...`);

    const mockExam = await getExamByIdFromSupabase(mock_exam_id);

    if (!mockExam) {
      const error = new Error('Mock exam not found');
      error.status = 404;
      error.code = 'EXAM_NOT_FOUND';
      throw error;
    }

    // Supabase stores is_active as 'true'/'false' string
    if (mockExam.is_active !== 'true') {
      const error = new Error('Cannot create booking for inactive mock exam');
      error.status = 400;
      error.code = 'EXAM_NOT_ACTIVE';
      throw error;
    }

    // WARNING ONLY - Don't block for capacity (admin override)
    // Supabase data is flat (not nested in properties)
    const capacity = parseInt(mockExam.capacity) || 0;

    // Use Redis for current booking count (authoritative source)
    let totalBookings = await redis.get(`exam:${mock_exam_id}:bookings`);

    if (totalBookings === null) {
      // Seed from Supabase if not in Redis (Supabase data is flat)
      totalBookings = parseInt(mockExam.total_bookings) || 0;
      const TTL_1_HOUR = 60 * 60; // 3,600 seconds - reduced from 1 week to prevent stale data
      await redis.setex(`exam:${mock_exam_id}:bookings`, TTL_1_HOUR, totalBookings);
      console.log(`📊 [ADMIN BOOKING] Seeded Redis counter from Supabase: ${totalBookings}`);
    } else {
      totalBookings = parseInt(totalBookings);
    }

    if (totalBookings >= capacity) {
      console.warn(`⚠️ [ADMIN OVERRIDE] Creating booking beyond capacity:`, {
        capacity,
        totalBookings,
        mockExamId: mock_exam_id,
        adminEmail
      });
    }

    console.log(`✅ [ADMIN BOOKING] Mock exam verified (${mockExam.mock_type})`);

    // ========================================================================
    // STEP 5: Check for Duplicate ACTIVE Bookings (Supabase-first)
    // Only checks for ACTIVE bookings - allows rebooking if previous was cancelled
    // ========================================================================
    console.log(`🔍 [ADMIN BOOKING] Checking for active duplicates in Supabase...`);

    // Format booking date for booking_id
    const formatBookingDate = (dateString) => {
      try {
        const dateParts = dateString.split('-');
        if (dateParts.length !== 3) {
          throw new Error('Invalid date format');
        }

        const year = parseInt(dateParts[0]);
        const month = parseInt(dateParts[1]) - 1;
        const day = parseInt(dateParts[2]);
        const date = new Date(year, month, day);

        if (isNaN(date.getTime())) {
          throw new Error('Invalid date');
        }

        const monthNames = [
          'January', 'February', 'March', 'April', 'May', 'June',
          'July', 'August', 'September', 'October', 'November', 'December'
        ];

        return `${monthNames[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
      } catch (err) {
        console.error('❌ [ADMIN BOOKING] Date formatting error:', err.message);
        return dateString;
      }
    };

    const formattedDate = formatBookingDate(exam_date);
    const bookingId = `${mock_type}-${student_id}-${formattedDate}`;

    // Check Supabase for ACTIVE bookings only (cancelled bookings are ignored)
    const isDuplicate = await checkExistingActiveBookingFromSupabase(bookingId);
    if (isDuplicate) {
      const error = new Error('This trainee already has an ACTIVE booking for this exam date');
      error.status = 409;
      error.code = 'DUPLICATE_BOOKING';
      error.details = { existing_booking_id: bookingId };
      throw error;
    }

    console.log(`✅ [ADMIN BOOKING] No active duplicate found`);

    // ========================================================================
    // STEP 6: Create Booking Object (NO TOKEN CHECK, NO CAPACITY BLOCK)
    // ========================================================================
    console.log(`🔧 [ADMIN BOOKING] Creating booking object...`);

    const bookingData = {
      bookingId,
      name: contactName,
      email: contact.email,
      tokenUsed: 'Admin Override' // Special token value for admin bookings
    };

    // Add conditional fields based on mock type
    if (mock_type === 'Clinical Skills') {
      bookingData.dominantHand = dominant_hand;
    } else if (mock_type === 'Situational Judgment' || mock_type === 'Mini-mock') {
      bookingData.attendingLocation = attending_location;
    }

    const createdBooking = await hubspot.createBooking(bookingData);
    bookingCreated = true;
    createdBookingId = createdBooking.id;

    console.log(`✅ [ADMIN BOOKING] Booking created: ${bookingId} (ID: ${createdBookingId})`);

    // ========================================================================
    // STEP 7: Create Associations (Contact + Mock Exam)
    // ========================================================================
    console.log(`🔗 [ADMIN BOOKING] Creating associations...`);

    const associationResults = [];

    // Associate with Contact (Assoc Type ID: 1289)
    try {
      await hubspot.createAssociation(
        HUBSPOT_OBJECTS.bookings,
        createdBookingId,
        HUBSPOT_OBJECTS.contacts,
        contactId
      );
      console.log('✅ [ADMIN BOOKING] Contact association created');
      associationResults.push({ type: 'contact', success: true });
    } catch (err) {
      console.error('❌ [ADMIN BOOKING] Failed to associate with contact:', err.message);
      associationResults.push({ type: 'contact', success: false, error: err.message });
    }

    // Associate with Mock Exam (Assoc Type ID: 1291)
    try {
      await hubspot.createAssociation(
        HUBSPOT_OBJECTS.bookings,
        createdBookingId,
        HUBSPOT_OBJECTS.mock_exams,
        mock_exam_id
      );
      console.log('✅ [ADMIN BOOKING] Mock exam association created');
      associationResults.push({ type: 'mock_exam', success: true });
    } catch (err) {
      console.error('❌ [ADMIN BOOKING] Failed to associate with mock exam:', err.message);
      associationResults.push({ type: 'mock_exam', success: false, error: err.message });
    }

    // ========================================================================
    // STEP 8: Update total_bookings Counter via Redis + Webhook
    // ========================================================================
    console.log(`🔢 [ADMIN BOOKING] Updating total_bookings counter...`);

    // Increment Redis counter immediately (real-time)
    // Note: Key should already exist from capacity check, but handle edge case
    const counterKey = `exam:${mock_exam_id}:bookings`;
    const existingCount = await redis.get(counterKey);
    let newTotalBookings;

    if (existingCount === null) {
      // Key doesn't exist (edge case) - seed with totalBookings + 1
      const TTL_1_HOUR = 60 * 60; // 3,600 seconds - reduced from 1 week to prevent stale data
      newTotalBookings = totalBookings + 1;
      await redis.setex(counterKey, TTL_1_HOUR, newTotalBookings);
      console.log(`✅ [ADMIN BOOKING] Seeded exam counter with TTL: ${counterKey} = ${newTotalBookings}`);
    } else {
      newTotalBookings = await redis.incr(counterKey);
      console.log(`✅ [ADMIN BOOKING] Redis counter incremented: ${totalBookings} → ${newTotalBookings}`);
    }

    // SUPABASE SYNC: Atomically increment exam booking count in Supabase
    try {
      await updateExamBookingCountInSupabase(mock_exam_id, null, 'increment');
    } catch (supabaseError) {
      console.error(`⚠️ Supabase exam count sync failed (non-blocking):`, supabaseError.message);
      // Fallback is built into the function - it will fetch and update if RPC fails
    }

    // Trigger HubSpot workflow via webhook (async, non-blocking)
    const { HubSpotWebhookService } = require('../../_shared/hubspot-webhook');

    process.nextTick(async () => {
      const result = await HubSpotWebhookService.syncWithRetry(
        mock_exam_id,
        newTotalBookings,
        3 // 3 retries with exponential backoff
      );

      if (result.success) {
        console.log(`✅ [WEBHOOK] HubSpot workflow triggered for admin booking: ${result.message}`);
      } else {
        console.error(`❌ [WEBHOOK] All retry attempts failed: ${result.message}`);
        console.error(`⏰ [WEBHOOK] Reconciliation cron will fix drift within 2 hours`);
      }
    });

    // ========================================================================
    // STEP 9: Sync Booking to Supabase
    // ========================================================================
    let supabaseSynced = false;
    try {
      await syncBookingToSupabase({
        id: createdBookingId,
        properties: {
          booking_id: bookingId,
          associated_mock_exam: mock_exam_id,
          associated_contact_id: contactId,
          student_id,
          name: contactName,
          student_email: contact.email,
          is_active: 'Active',
          exam_date,
          dominant_hand,
          attending_location,
          token_used: 'Admin Override',
          mock_type: mockExam.mock_type || null,
          mock_set: mockExam.mock_set || null,
          start_time: mockExam.start_time,
          end_time: mockExam.end_time,
          createdate: new Date().toISOString()
        }
      }, mock_exam_id);
      console.log(`✅ [ADMIN BOOKING] Synced to Supabase`);
      supabaseSynced = true;
    } catch (supabaseError) {
      console.error('❌ Supabase sync failed:', supabaseError.message);
      // Continue - HubSpot is source of truth
    }

    // ========================================================================
    // STEP 10: Create Comprehensive Audit Note (3 associations)
    // ========================================================================
    console.log(`📝 [ADMIN BOOKING] Creating audit note...`);

    try {
      const timestamp = new Date();
      const formattedTimestamp = timestamp.toLocaleString('en-US', {
        timeZone: 'America/Toronto',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });

      const formattedExamDate = new Date(exam_date).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      const noteBody = `
        <h3>🔧 Admin Booking Created</h3>

        <p><strong>Booking Details:</strong></p>
        <ul>
          <li><strong>Booking ID:</strong> ${bookingId}</li>
          <li><strong>Exam Type:</strong> ${mock_type}</li>
          <li><strong>Exam Date:</strong> ${formattedExamDate}</li>
          <li><strong>Location:</strong> ${mockExam.location || 'Mississauga'}</li>
          <li><strong>Created At:</strong> ${formattedTimestamp}</li>
        </ul>

        <p><strong>Trainee Information:</strong></p>
        <ul>
          <li><strong>Name:</strong> ${contactName}</li>
          <li><strong>Student ID:</strong> ${student_id}</li>
          <li><strong>Email:</strong> ${contact.email}</li>
        </ul>

        <p><strong>Admin Override Details:</strong></p>
        <ul>
          <li><strong>Created By:</strong> ${adminEmail}</li>
          <li><strong>Token Check:</strong> Bypassed (Admin Override)</li>
          <li><strong>Capacity Check:</strong> Bypassed (Admin Override)</li>
          <li><strong>Capacity Status:</strong> ${totalBookings + 1}/${capacity}</li>
        </ul>

        <hr style="margin: 15px 0; border: 0; border-top: 1px solid #e0e0e0;">
        <p style="font-size: 12px; color: #666;">
          <em>⚠️ This booking was created manually by an administrator, bypassing standard constraints.</em>
        </p>
      `;

      const notePayload = {
        properties: {
          hs_note_body: noteBody,
          hs_timestamp: timestamp.getTime()
        }
      };

      const note = await hubspot.apiCall('POST', '/crm/v3/objects/notes', notePayload);

      // Associate note with Contact (Assoc Type ID: 1250)
      await hubspot.apiCall('PUT',
        `/crm/v4/objects/0-46/${note.id}/associations/${HUBSPOT_OBJECTS.contacts}/${contactId}`,
        [{
          associationCategory: 'USER_DEFINED',
          associationTypeId: 1250
        }]
      );

      // Associate note with Mock Exam (Assoc Type ID: 1250)
      await hubspot.apiCall('PUT',
        `/crm/v4/objects/0-46/${note.id}/associations/${HUBSPOT_OBJECTS.mock_exams}/${mock_exam_id}`,
        [{
          associationCategory: 'USER_DEFINED',
          associationTypeId: 1250
        }]
      );

      // Associate note with Booking (Assoc Type ID: 1250)
      await hubspot.apiCall('PUT',
        `/crm/v4/objects/0-46/${note.id}/associations/${HUBSPOT_OBJECTS.bookings}/${createdBookingId}`,
        [{
          associationCategory: 'USER_DEFINED',
          associationTypeId: 1250
        }]
      );

      console.log(`✅ [ADMIN BOOKING] Audit note created with all 3 associations`);
    } catch (noteError) {
      console.error('❌ [ADMIN BOOKING] Failed to create audit note:', noteError.message);
      // Non-blocking - don't fail the request if note creation fails
    }

    // ========================================================================
    // STEP 11: Invalidate Relevant Caches
    // ========================================================================
    console.log(`🗑️ [ADMIN BOOKING] Invalidating caches...`);

    try {
      const cache = getCache();

      await Promise.all([
        // Invalidate contact bookings cache
        cache.deletePattern(`bookings:contact:${contactId}:*`),
        // Invalidate mock exam details cache
        cache.delete(`admin:mock-exam:details:${mock_exam_id}`),
        // Invalidate mock exam bookings cache
        cache.deletePattern(`admin:mock-exam:${mock_exam_id}:bookings:*`),
        // Invalidate aggregates (capacity might have changed)
        cache.deletePattern('admin:aggregates:*')
      ]);

      console.log(`✅ [ADMIN BOOKING] Caches invalidated successfully`);
    } catch (cacheError) {
      console.error('❌ [ADMIN BOOKING] Cache invalidation failed:', cacheError.message);
      // Non-blocking - don't fail the request if cache invalidation fails
    }

    // ========================================================================
    // STEP 12: Return Success Response
    // ========================================================================
    const contactAssocSuccess = associationResults.find(r => r.type === 'contact')?.success || false;
    const mockExamAssocSuccess = associationResults.find(r => r.type === 'mock_exam')?.success || false;

    return res.status(201).json({
      success: true,
      message: 'Admin booking created successfully',
      data: {
        booking_id: bookingId,
        booking_record_id: createdBookingId,
        confirmation_message: `Booking created for ${contactName} on ${formattedDate}`,
        exam_details: {
          mock_exam_id,
          exam_date,
          mock_type,
          location: mockExam.location || 'Mississauga'
        },
        contact_details: {
          contact_id: contactId,
          student_id,
          name: contactName,
          email: contact.email
        },
        associations: {
          contact_associated: contactAssocSuccess,
          mock_exam_associated: mockExamAssocSuccess
        }
      },
      meta: {
        created_by: adminEmail,
        created_at: new Date().toISOString(),
        admin_override: true,
        bypass_warnings: totalBookings >= capacity ? ['Capacity limit bypassed'] : []
      },
      supabase_synced: supabaseSynced
    });

  } catch (error) {
    console.error('❌ [ADMIN BOOKING] Error:', {
      message: error.message,
      status: error.status || 500,
      code: error.code || 'INTERNAL_ERROR',
      stack: error.stack
    });

    // Cleanup if booking was created but failed later
    if (bookingCreated && createdBookingId && hubspot) {
      try {
        await hubspot.deleteBooking(createdBookingId);
        console.log(`✅ [ADMIN BOOKING] Cleanup: Booking ${createdBookingId} deleted`);
      } catch (cleanupError) {
        console.error('❌ [ADMIN BOOKING] Cleanup failed:', cleanupError.message);
      }
    }

    const statusCode = error.status || 500;
    const errorCode = error.code || 'INTERNAL_ERROR';

    return res.status(statusCode).json({
      success: false,
      error: {
        code: errorCode,
        message: error.message || 'An error occurred while creating the booking',
        ...(error.details && { details: error.details })
      }
    });
  } finally {
    // Close Redis connection
    if (redis) {
      await redis.close();
    }
  }
};
