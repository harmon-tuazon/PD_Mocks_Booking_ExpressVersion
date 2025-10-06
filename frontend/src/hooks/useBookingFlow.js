import { useState, useCallback, useEffect } from 'react';
import apiService from '../services/api';

const useBookingFlow = (initialMockExamId = null, initialMockType = null) => {
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
  });

  // UI state
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});

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

  // Verify credits step
  const verifyCredits = useCallback(async (studentId, email) => {
    setLoading(true);
    setError(null);
    setValidationErrors({});

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
      const result = await apiService.mockExams.validateCredits(
        studentId,
        email,
        bookingData.mockType
      );

      if (!result.success) {
        throw new Error(result.error || 'Verification failed');
      }

      const { data } = result;

      // Check eligibility
      if (!data.eligible) {
        setError(data.error_message || `You have 0 credits available for ${bookingData.mockType} exams.`);
        setLoading(false);
        return false;
      }

      // Update booking data
      setBookingData(prev => ({
        ...prev,
        studentId,
        email,
        credits: data.available_credits,
        creditBreakdown: data.credit_breakdown,
        contactId: data.contact_id,
        enrollmentId: data.enrollment_id,
        name: data.student_name || prev.name,
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
  }, [bookingData.mockType]);

  // Submit booking - accepts optional overrides for immediate data that hasn't been committed to state yet
  const submitBooking = useCallback(async (immediateData = {}) => {
    setLoading(true);
    setError(null);
    setStep('confirming');

    // Merge immediate data with existing booking data (immediate data takes priority)
    const mergedData = { ...bookingData, ...immediateData };

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
      } else {
        setStep('details');
      }

      return false;
    } finally {
      setLoading(false);
    }
  }, [bookingData]);  // submitBooking now accepts immediateData parameter

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
  }, []);

  return {
    // State
    step,
    bookingData,
    error,
    loading,
    validationErrors,

    // Actions
    verifyCredits,
    submitBooking,
    goBack,
    resetFlow,
    updateBookingData,
    clearError,
    setStep,

    // Computed
    canProceed: step === 'verify'
      ? bookingData.studentId && bookingData.email
      : step === 'details'
      ? bookingData.name && bookingData.name.trim().length >= 2
      : false,
  };
};

export default useBookingFlow;