/**
 * useWorkCheckBooking.js
 * Hook for work check booking flow
 * Uses existing session credentials (student_id + email from login)
 */
import { useState, useCallback, useEffect } from 'react';
import apiService from '../services/api';
import { getUserSession } from '../utils/auth';

export function useWorkCheckBooking() {
  const [step, setStep] = useState('loading'); // loading, select, confirming, confirmed, error
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // User data from session
  const [userData, setUserData] = useState(null);
  const [groups, setGroups] = useState([]);
  const [existingBookingDates, setExistingBookingDates] = useState([]);

  // Slot data
  const [availableSlots, setAvailableSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [selectedGroupFilter, setSelectedGroupFilter] = useState('all');

  // Booking result
  const [bookingResult, setBookingResult] = useState(null);

  // Initialize on mount - fetch user groups using session credentials
  useEffect(() => {
    const initializeBooking = async () => {
      setLoading(true);
      setError(null);

      try {
        // Get credentials from existing session (same pattern as mock booking)
        const session = getUserSession();
        if (!session?.studentId || !session?.email) {
          setError('Please log in to book a work check');
          setStep('error');
          return;
        }

        // Fetch user's groups
        const groupsResponse = await apiService.workChecks.getGroups(
          session.studentId,
          session.email
        );

        if (groupsResponse.success) {
          setUserData({
            studentId: session.studentId,
            email: session.email,
            studentUuid: groupsResponse.data.student_id,
            studentCode: groupsResponse.data.student_code,
            firstName: groupsResponse.data.firstname,
            lastName: groupsResponse.data.lastname
          });
          setGroups(groupsResponse.data.groups);
          setExistingBookingDates(groupsResponse.data.existing_booking_dates || []);

          // Fetch available slots
          const slotsResponse = await apiService.workChecks.getAvailable(
            session.studentId,
            session.email
          );
          if (slotsResponse.success) {
            setAvailableSlots(slotsResponse.data.slots);
          }

          setStep('select');
        } else {
          throw new Error(groupsResponse.error?.message || 'Failed to load groups');
        }
      } catch (err) {
        console.error('Failed to initialize work check booking:', err);
        const errorMessage = err.response?.data?.error?.message ||
                           err.message ||
                           'Failed to load booking page';
        setError(errorMessage);
        setStep('error');
      } finally {
        setLoading(false);
      }
    };

    initializeBooking();
  }, []);

  // Filter by group
  const filteredSlots = selectedGroupFilter === 'all'
    ? availableSlots
    : availableSlots.filter(slot => slot.group_id === selectedGroupFilter);

  // Select slot
  const selectSlot = useCallback((slot) => {
    // Check if slot date conflicts with existing booking
    if (existingBookingDates.includes(slot.slot_date)) {
      setError('You already have a work check scheduled for this date');
      return;
    }

    // Check if slot is available
    if (!slot.is_available) {
      setError('This slot is no longer available');
      return;
    }

    setSelectedSlot(slot);
    setError(null);
  }, [existingBookingDates]);

  // Clear slot selection
  const clearSelectedSlot = useCallback(() => {
    setSelectedSlot(null);
    setError(null);
  }, []);

  // Submit booking with work check type
  const submitBooking = useCallback(async (workCheckType) => {
    if (!userData || !selectedSlot || !workCheckType) return;

    setLoading(true);
    setStep('confirming');
    setError(null);

    try {
      const response = await apiService.workChecks.create(
        userData.studentId,
        userData.email,
        selectedSlot.slot_id,
        workCheckType
      );

      if (response.success) {
        setBookingResult(response.data);
        setStep('confirmed');
        // Add the booked date to existing dates to prevent immediate re-booking
        setExistingBookingDates(prev => [...prev, selectedSlot.slot_date]);
        // Remove the booked slot from available slots
        setAvailableSlots(prev => prev.filter(s => s.slot_id !== selectedSlot.slot_id));
      } else {
        throw new Error(response.error?.message || 'Booking failed');
      }
    } catch (err) {
      const errorCode = err.response?.data?.error?.code || err.code;
      const errorMessage = err.response?.data?.error?.message ||
                          err.message ||
                          'Booking failed';

      // Handle duplicate booking error specifically
      if (errorCode === 'DUPLICATE_BOOKING') {
        setExistingBookingDates(prev =>
          prev.includes(selectedSlot.slot_date) ? prev : [...prev, selectedSlot.slot_date]
        );
      }

      setError(errorMessage);
      setStep('select');
    } finally {
      setLoading(false);
    }
  }, [userData, selectedSlot]);

  // Refresh available slots
  const refreshSlots = useCallback(async () => {
    if (!userData) return;

    try {
      const response = await apiService.workChecks.getAvailable(
        userData.studentId,
        userData.email
      );
      if (response.success) {
        setAvailableSlots(response.data.slots);
        setExistingBookingDates(response.data.existing_booking_dates || []);
      }
    } catch (err) {
      console.error('Failed to refresh slots:', err);
    }
  }, [userData]);

  // Auto-refresh slots every 30 seconds when on select step
  useEffect(() => {
    if (step !== 'select') return;

    const interval = setInterval(refreshSlots, 30000);
    return () => clearInterval(interval);
  }, [step, refreshSlots]);

  // Reset for another booking
  const reset = useCallback(() => {
    setSelectedSlot(null);
    setBookingResult(null);
    setError(null);
    setStep('select');
    refreshSlots();
  }, [refreshSlots]);

  return {
    // State
    step,
    loading,
    error,
    userData,
    groups,
    existingBookingDates,
    availableSlots: filteredSlots,
    allSlots: availableSlots,
    selectedSlot,
    selectedGroupFilter,
    bookingResult,

    // Actions
    setSelectedGroupFilter,
    selectSlot,
    clearSelectedSlot,
    submitBooking,
    refreshSlots,
    reset,
    clearError: () => setError(null)
  };
}

export default useWorkCheckBooking;
