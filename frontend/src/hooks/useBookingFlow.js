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

      if (err.code === 'STUDENT_NOT_FOUND') {
        setError('Student ID not found in our records. Please check and try again.');
      } else if (err.code === 'EMAIL_MISMATCH') {
        setError('Email does not match student record. Please use your registered email.');
      } else {
        setError(err.message || 'An error occurred during verification');
      }

      return false;
    } finally {
      setLoading(false);
    }
  }, [bookingData.mockType]);

  // Submit booking
  const submitBooking = useCallback(async () => {
    setLoading(true);
    setError(null);
    setStep('confirming');

    // Validate name
    if (!bookingData.name || bookingData.name.trim().length < 2) {
      setError('Please enter your full name');
      setStep('details');
      setLoading(false);
      return false;
    }

    try {
      const bookingPayload = {
        mock_exam_id: bookingData.mockExamId,
        contact_id: bookingData.contactId,
        student_id: bookingData.studentId,
        name: bookingData.name.trim(),
        email: bookingData.email,
        mock_type: bookingData.mockType,
        exam_date: bookingData.examDate,
      };

      // Add conditional fields based on mock type
      if (bookingData.mockType === 'Clinical Skills') {
        bookingPayload.dominant_hand = bookingData.dominant_hand !== undefined ? bookingData.dominant_hand : bookingData.dominantHand;
      } else if (bookingData.mockType === 'Situational Judgment' || bookingData.mockType === 'Mini-mock') {
        bookingPayload.attending_location = bookingData.attending_location;
      }


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
        booking_record_id: result.data.booking_record_id
      });

      // Create updated booking data with proper null checking
      const updatedBookingData = {
        ...bookingData,
        bookingId: result.data?.booking_id || null,
        bookingRecordId: result.data?.booking_record_id || null,
        confirmationMessage: result.data?.confirmation_message || 'Booking confirmed successfully',
        // Safe access with fallback values
        examLocation: result.data?.exam_details?.location || 'Mississauga',
        remainingCredits: result.data?.credit_details?.remaining_credits || 0,
      };

      // Update state with confirmation data
      setBookingData(updatedBookingData);

      setStep('confirmed');

      // Clear session storage on successful booking
      sessionStorage.removeItem('bookingFlow');

      // Return the updated booking data instead of just true
      return updatedBookingData;

    } catch (err) {
      console.error('Booking submission error:', err);

      if (err.code === 'DUPLICATE_BOOKING') {
        setError('You already have a booking for this exam date.');
      } else if (err.code === 'EXAM_FULL') {
        setError('Sorry, this exam session is now full. Please select another date.');
      } else if (err.code === 'INSUFFICIENT_CREDITS') {
        setError('Your credits have changed. Please verify your eligibility again.');
        setStep('verify');
      } else {
        setError(err.message || 'An error occurred while creating your booking');
      }

      if (err.code !== 'INSUFFICIENT_CREDITS') {
        setStep('details');
      }

      return false;
    } finally {
      setLoading(false);
    }
  }, [bookingData]);

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