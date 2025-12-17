import { useState, useCallback, useEffect } from 'react';
import apiService from '../services/api';
import useCachedCredits from './useCachedCredits';
import { useCachedBookings } from './useCachedBookings';
import { findConflictingBookings } from '../utils/timeConflictUtils';

const useBookingFlow = (initialMockExamId = null, initialMockType = null) => {
  // Import the cached credits hook at the top level
  const { credits, loading: creditsLoading, fetchCredits, invalidateCache } = useCachedCredits();

  // Import the cached bookings hook for conflict checking
  const { bookings: cachedBookings, fetchBookings: fetchCachedBookings } = useCachedBookings();

  // Multi-step form state
  const [step, setStep] = useState('verify'); // 'verify' | 'details' | 'confirming' | 'confirmed'

  // Booking data
  const [bookingData, setBookingData] = useState({
    mockExamId: initialMockExamId,
    mockType: initialMockType,
    examDate: null,
    studentId: '',
    email: '',
    name: '',
    dominantHand: true,
    credits: null,
    contactId: null,
    enrollmentId: null,
    creditBreakdown: null,
    startTime: null,
    endTime: null,
  });

  // UI state
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});
  const [timeConflicts, setTimeConflicts] = useState([]);

  // Session storage for form persistence
  useEffect(() => {
    const savedData = sessionStorage.getItem('bookingFlow');
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        // Only restore if it's for the same exam
        if (parsed.mockExamId === initialMockExamId) {
          setBookingData(parsed);
          // Resume at the last step if data is valid
          if (parsed.contactId && parsed.credits !== null) {
            setStep('details');
          }
        }
      } catch (e) {
        console.error('Failed to restore booking data:', e);
      }
    }
  }, [initialMockExamId]);

  // Save booking data to session storage
  useEffect(() => {
    if (bookingData.mockExamId) {
      sessionStorage.setItem('bookingFlow', JSON.stringify(bookingData));
    }
  }, [bookingData]);

  // Validate student ID format
  const validateStudentId = (id) => {
    if (!id) return 'Student ID is required';
    if (!/^[A-Z0-9]+$/.test(id)) {
      return 'Student ID must contain only uppercase letters and numbers';
    }
    return null;
  };

  // Validate email format
  const validateEmail = (email) => {
    if (!email) return 'Email is required';
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return 'Please enter a valid email address';
    }
    return null;
  };

  // Check for time conflicts with existing bookings
  const checkTimeConflicts = useCallback(async (sessionData) => {
    try {
      console.log('🕐 Checking for time conflicts with session:', sessionData);

      // Try to use cached bookings first (instant conflict check!)
      let bookingsToCheck = cachedBookings;

      // If no cached bookings, fetch them
      if (!bookingsToCheck) {
        console.log('📥 No cached bookings found, fetching from backend...');
        bookingsToCheck = await fetchCachedBookings(bookingData.studentId, bookingData.email, {
          filter: 'upcoming',
          limit: 50
        });
      } else {
        console.log('✅ Using cached bookings for conflict check (instant!)');
      }

      if (!bookingsToCheck || bookingsToCheck.length === 0) {
        console.log('ℹ️ No existing bookings to check conflicts against');
        return [];
      }

      // Find conflicts using the utility function
      const conflicts = findConflictingBookings(
        bookingsToCheck,
        sessionData
      );

      console.log('🕐 Time conflict check result:', {
        totalBookings: bookingsToCheck.length,
        conflictsFound: conflicts.length,
        conflicts: conflicts
      });

      setTimeConflicts(conflicts);
      return conflicts;
    } catch (error) {
      console.error('Error checking time conflicts:', error);
      // If we can't check conflicts, allow submission (backend will validate)
      return [];
    }
  }, [bookingData.studentId, bookingData.email, cachedBookings, fetchCachedBookings]);

  // Verify credits step - now uses cached credits
  const verifyCredits = useCallback(async (studentId, email) => {
    setLoading(true);
    setError(null);
    setTimeConflicts([]); // Clear time conflicts when going back
    setValidationErrors({});
    setTimeConflicts([]);

    // Validate inputs
    const studentIdError = validateStudentId(studentId);
    const emailError = validateEmail(email);

    if (studentIdError || emailError) {
      setValidationErrors({
        studentId: studentIdError,
        email: emailError,
      });
      setLoading(false);
      return false;
    }

    try {
      // Fetch credits from API and use the returned data directly
      // (React state updates are async, so we can't rely on credits state immediately)
      const freshCredits = await fetchCredits(studentId, email);

      // Extract the specific mock type data from the fetched result
      const result = freshCredits?.[bookingData.mockType];

      if (!result) {
        throw new Error('Unable to verify credits. Please try again.');
      }

      // Check eligibility - accessing properties directly (no .data wrapper)
      if (!result.eligible) {
        setError(result.error_message || `You have 0 credits available for ${bookingData.mockType} exams.`);
        setLoading(false);
        return false;
      }

      // Update booking data - using result directly without .data wrapper
      setBookingData(prev => ({
        ...prev,
        studentId,
        email,
        credits: result.available_credits,
        creditBreakdown: result.credit_breakdown,
        contactId: result.contact_id,
        hubspotId: result.hubspot_id,  // ✅ Store HubSpot ID for backend fallback
        enrollmentId: result.enrollment_id,
        name: result.student_name || prev.name,
      }));

      setStep('details');
      return true;

    } catch (err) {
      console.error('Credit verification error:', err);

      // FIX: Always create error object with code property for consistent handling
      const errorObj = {
        code: err.code || null,
        message: err.message || 'An error occurred during verification'
      };

      console.log('📋 Setting error object in verifyCredits:', errorObj);
      setError(errorObj);

      return false;
    } finally {
      setLoading(false);
    }
  }, [bookingData.mockType, fetchCredits]);

  // Submit booking - accepts optional overrides for immediate data that hasn't been committed to state yet
  const submitBooking = useCallback(async (immediateData = {}) => {
    setLoading(true);
    setError(null);

    // Merge immediate data with existing booking data (immediate data takes priority)
    const mergedData = { ...bookingData, ...immediateData };

    // NEW: Check for time conflicts before submission
    if (mergedData.startTime && mergedData.endTime) {
      const conflicts = await checkTimeConflicts({
        start_time: mergedData.startTime,
        end_time: mergedData.endTime,
        exam_date: mergedData.examDate,
        mock_type: mergedData.mockType
      });

      if (conflicts.length > 0) {
        // Show conflict warning
        console.log('⚠️ Time conflict detected, blocking submission');
        setError({
          code: 'TIME_CONFLICT',
          message: 'You already have a booking that overlaps with this session time.',
          conflicts: conflicts
        });
        setLoading(false);
        return false;
      }
    }

    setStep('confirming');

    // Debug logging to trace the issue
    console.log('🔍 submitBooking called with:', {
      immediateData,
      bookingData: {
        mockType: bookingData.mockType,
        attending_location: bookingData.attending_location,
        dominant_hand: bookingData.dominant_hand
      },
      mergedData: {
        mockType: mergedData.mockType,
        attending_location: mergedData.attending_location,
        dominant_hand: mergedData.dominant_hand
      }
    });

    // Validate name
    if (!mergedData.name || mergedData.name.trim().length < 2) {
      setError({
        code: 'VALIDATION_ERROR',
        message: 'Please enter your full name'
      });
      setStep('details');
      setLoading(false);
      return false;
    }

    try {
      const bookingPayload = {
        mock_exam_id: mergedData.mockExamId,
        contact_id: mergedData.contactId,
        hubspot_id: mergedData.hubspotId,  // ✅ Include HubSpot ID for fallback
        student_id: mergedData.studentId,
        name: mergedData.name.trim(),
        email: mergedData.email,
        mock_type: mergedData.mockType,
        exam_date: mergedData.examDate,
      };

      // Add conditional fields based on mock type
      if (mergedData.mockType === 'Clinical Skills') {
        bookingPayload.dominant_hand = mergedData.dominant_hand !== undefined ? mergedData.dominant_hand : mergedData.dominantHand;
        console.log('🔧 Adding dominant_hand to payload:', bookingPayload.dominant_hand);
      } else if (mergedData.mockType === 'Situational Judgment' || mergedData.mockType === 'Mini-mock') {
        bookingPayload.attending_location = mergedData.attending_location;
        console.log('📍 Adding attending_location to payload:', bookingPayload.attending_location);
      }

      // Final payload logging before API call
      console.log('📤 Final booking payload being sent to API:', bookingPayload);


      const result = await apiService.bookings.create(bookingPayload);

      if (!result || !result.success) {
        throw new Error(result?.error || 'Booking failed - invalid response from server');
      }

      // Enhanced logging for debugging API responses
      console.log('📨 Raw API Response:', {
        success: result?.success,
        hasData: !!result?.data,
        dataKeys: result?.data ? Object.keys(result.data) : [],
        fullResponse: result
      });

      // FIX: Check if this is an idempotent (duplicate) request
      if (result.data?.idempotent_request === true) {
        console.log('⚠️ Duplicate booking detected - idempotent request');

        // Extract the date from the confirmation message or booking details
        const examDate = result.data?.exam_details?.exam_date || mergedData.examDate;
        const mockType = result.data?.exam_details?.mock_type || mergedData.mockType;

        // Create a user-friendly error message for duplicate bookings
        const duplicateError = {
          code: 'DUPLICATE_BOOKING',
          message: `You already have a ${mockType} booking for this date (${new Date(examDate).toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            year: 'numeric'
          })}). Please check your existing bookings or select a different session.`,
          isUserError: true
        };

        console.log('📋 Setting duplicate booking error:', duplicateError);
        setError(duplicateError);
        setStep('verify'); // Go back to verify step to show the error
        setLoading(false);

        return false; // Indicate booking was not successful (duplicate)
      }

      // Enhanced validation with detailed logging
      if (!result.data?.booking_id) {
        console.error('🚨 API Response Validation Failed:', {
          expectedStructure: {
            success: 'boolean',
            data: {
              booking_id: 'string (REQUIRED)',
              booking_record_id: 'string',
              confirmation_message: 'string',
              exam_details: 'object',
              credit_details: 'object'
            }
          },
          actualStructure: {
            success: result?.success,
            data: result?.data ? {
              keys: Object.keys(result.data),
              booking_id: result.data.booking_id,
              booking_record_id: result.data.booking_record_id,
              hasBookingId: 'booking_id' in result.data,
              bookingIdType: typeof result.data.booking_id
            } : 'undefined'
          },
          fullResult: result
        });
        throw new Error('Booking completed but confirmation data is incomplete - missing booking_id');
      }

      console.log('✅ API Response validation passed:', {
        booking_id: result.data.booking_id,
        booking_record_id: result.data.booking_record_id,
        credit_details: result.data.credit_details
      });

      // FIX: Enhanced logging to debug token display issue
      console.log('💳 Frontend received credit_details:', {
        raw_credit_details: result.data?.credit_details,
        remaining_credits: result.data?.credit_details?.remaining_credits,
        credit_breakdown: result.data?.credit_details?.credit_breakdown,
        has_breakdown: !!result.data?.credit_details?.credit_breakdown
      });

      // FIX: Validate that credit_breakdown exists
      if (!result.data?.credit_details?.credit_breakdown) {
        console.error('🚨 FRONTEND ERROR: credit_breakdown is missing from API response!', {
          full_response: result.data,
          credit_details: result.data?.credit_details
        });
      }

      // Create updated booking data with proper null checking, using mergedData as base
      const updatedBookingData = {
        ...mergedData,  // Use mergedData instead of bookingData to include immediate updates
        bookingId: result.data?.booking_id || null,
        bookingRecordId: result.data?.booking_record_id || null,
        confirmationMessage: result.data?.confirmation_message || 'Booking confirmed successfully',
        // Safe access with fallback values
        examLocation: result.data?.exam_details?.location || 'Mississauga',
        remainingCredits: result.data?.credit_details?.remaining_credits || 0,
        // Include the full credit breakdown from API response
        creditBreakdown: result.data?.credit_details?.credit_breakdown || {
          specific_credits: 0,
          shared_credits: 0
        },
      };

      // FIX: Log what will be passed to BookingConfirmation
      console.log('💳 BookingData being passed to confirmation:', {
        remainingCredits: updatedBookingData.remainingCredits,
        creditBreakdown: updatedBookingData.creditBreakdown,
        mockType: updatedBookingData.mockType
      });

      // Update state with confirmation data
      setBookingData(updatedBookingData);

      setStep('confirmed');

      // Clear session storage on successful booking
      sessionStorage.removeItem('bookingFlow');

      // Invalidate the cache and immediately fetch fresh credits
      invalidateCache();

      // Fetch fresh credits immediately to update localStorage and all components
      fetchCredits(mergedData.studentId, mergedData.email, true).catch(err => {
        console.error('Failed to refresh credits after booking:', err);
        // Non-blocking - booking already succeeded
      });

      // Return the updated booking data instead of just true
      return updatedBookingData;

    } catch (err) {
      console.error('🚨 Booking submission error:', err);

      // FIX: Enhanced error logging for debugging
      console.error('🔍 Error details:', {
        hasCode: !!err.code,
        code: err.code,
        message: err.message,
        responseData: err.response?.data,
        fullError: err
      });

      // FIX: Extract error code from response data if not directly on error object
      // This handles cases where axios interceptor might not have set error.code
      let errorCode = err.code;
      let errorMessage = err.message;

      // Check if error code is in response data but not on error object
      if (!errorCode && err.response?.data?.code) {
        errorCode = err.response.data.code;
        console.log('📌 Extracted error code from response.data.code:', errorCode);
      }

      // Check if error message is in response data
      if (err.response?.data?.error) {
        errorMessage = err.response.data.error;
        console.log('📌 Using error message from response.data.error:', errorMessage);
      }

      // FIX: Always pass error object with code for better error display
      const errorObj = {
        code: errorCode || null,
        message: errorMessage || 'An error occurred while creating your booking'
      };

      console.log('📋 Setting error object in submitBooking:', errorObj);
      setError(errorObj);

      // Special handling for insufficient credits - go back to verify step
      if (errorCode === 'INSUFFICIENT_CREDITS') {
        setStep('verify');
      } else if (errorCode === 'DUPLICATE_BOOKING') {
        // FIX: Handle duplicate booking errors properly
        setStep('verify');
      } else {
        setStep('details');
      }

      return false;
    } finally {
      setLoading(false);
    }
  }, [bookingData, invalidateCache, checkTimeConflicts]);  // Added invalidateCache to dependencies

  // Go back to previous step
  const goBack = useCallback(() => {
    if (step === 'details') {
      setStep('verify');
    } else if (step === 'confirming') {
      setStep('details');
    }
    setError(null);
  }, [step]);

  // Reset the entire flow
  const resetFlow = useCallback(() => {
    setStep('verify');
    setError(null);
    setValidationErrors({});
    setBookingData({
      mockExamId: initialMockExamId,
      mockType: initialMockType,
      examDate: null,
      studentId: '',
      email: '',
      name: '',
      dominantHand: true,
      credits: null,
      contactId: null,
      enrollmentId: null,
      creditBreakdown: null,
      startTime: null,
      endTime: null,
    });
    sessionStorage.removeItem('bookingFlow');
  }, [initialMockExamId, initialMockType]);

  // Update specific booking data fields
  const updateBookingData = useCallback((updates) => {
    setBookingData(prev => ({
      ...prev,
      ...updates,
    }));
  }, []);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
    setValidationErrors({});
    setTimeConflicts([]);
  }, []);

  // Combine loading states from both the hook and cached credits
  const combinedLoading = loading || creditsLoading;

  return {
    // State
    step,
    bookingData,
    error,
    loading: combinedLoading,  // Use combined loading state
    validationErrors,
    timeConflicts, // Expose time conflicts

    // Actions
    verifyCredits,
    submitBooking,
    checkTimeConflicts, // Expose conflict checking function
    goBack,
    resetFlow,
    updateBookingData,
    clearError,
    setStep,
    invalidateCache,  // Expose cache invalidation

    // Computed
    canProceed: step === 'verify'
      ? bookingData.studentId && bookingData.email
      : step === 'details'
      ? bookingData.name && bookingData.name.trim().length >= 2
      : false,
  };
};

export default useBookingFlow;