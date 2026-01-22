/**
 * useExamEdit Hook
 * Manages edit state, form data, and save logic for mock exam editing
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { mockExamsApi } from '../services/adminApi';
import { useFormValidation } from './useFormValidation';
import {
  hasFormChanges,
  formatFormDataForApi,
  getChangedFields
} from '../utils/examValidation';

/**
 * Notification helper using react-hot-toast
 */
const notify = {
  success: (message) => {
    toast.success(message);
  },
  error: (message) => {
    console.error('❌ Error:', message);
    toast.error(message);
  },
  info: (message) => {
    toast(message);
  }
};

export function useExamEdit(examData) {
  const queryClient = useQueryClient();
  const originalDataRef = useRef(null);

  // Edit state
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({});
  const [isDirty, setIsDirty] = useState(false);

  // Initialize validation
  const validation = useFormValidation(formData);

  // Convert ISO string or timestamp to HH:mm format for time inputs
  // IMPORTANT: Always extracts time in EST timezone to match backend storage
  const convertToTimeInput = (timeValue) => {
    if (!timeValue) return '';

    // If already in HH:MM format, return as-is
    if (typeof timeValue === 'string' && /^\d{2}:\d{2}$/.test(timeValue)) {
      return timeValue;
    }

    try {
      // Create Date object (handles ISO strings, timestamps, etc.)
      const date = new Date(timeValue);

      // Check if valid date
      if (isNaN(date.getTime())) {
        console.warn('Invalid time value:', timeValue);
        return '';
      }

      // Extract hours and minutes in EST timezone (America/Toronto handles EST/EDT automatically)
      // This ensures the displayed time matches what was stored, regardless of user's timezone
      const estTimeString = date.toLocaleTimeString('en-US', {
        timeZone: 'America/Toronto',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });

      // Extract just HH:MM from the time string (remove seconds if present)
      // toLocaleTimeString might return "14:00:00" or "14:00"
      const timeParts = estTimeString.split(':');
      return `${timeParts[0]}:${timeParts[1]}`;
    } catch (error) {
      console.error('Error converting time for input:', error, timeValue);
      return '';
    }
  };;;

  // Initialize form data when exam data changes
  useEffect(() => {
    if (examData) {
      const initialData = {
        id: examData.id || '',
        mock_type: examData.mock_type || '',
        mock_set: examData.mock_set || '',
        exam_date: examData.exam_date || '',
        start_time: convertToTimeInput(examData.start_time),
        end_time: convertToTimeInput(examData.end_time),
        capacity: examData.capacity || 0,
        location: examData.location || '',
        address: examData.address || '',
        is_active: examData.is_active !== undefined ? examData.is_active : 'true',
        scheduled_activation_datetime: examData.scheduled_activation_datetime || null,
        // Keep track of booking count for validation
        booked_count: examData.booked_count || examData.total_bookings || 0,
        total_bookings: examData.total_bookings || examData.booked_count || 0,
        // Add prerequisite exam IDs for Mock Discussion
        prerequisite_exam_ids: examData.prerequisite_exam_ids || [],
        prerequisite_exams: examData.prerequisite_exams || []
      };

      setFormData(initialData);
      originalDataRef.current = { ...initialData };
    }
  }, [examData]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (updates) => {
      if (!examData?.id) {
        throw new Error('Mock exam ID is required');
      }

      // Send only the updates - backend already fetches current state for business logic
      return await mockExamsApi.update(examData.id, updates);
    },
    onSuccess: async (response) => {
      try {
        // Extract updated properties from API response
        const updatedProperties = response?.mockExam?.properties || response?.data?.properties || {};

        // OPTIMISTIC UPDATE: Immediately update detail cache (no network wait)
        queryClient.setQueryData(['mockExam', examData.id], (oldData) => {
          return {
            ...oldData,
            data: {
              ...oldData?.data,
              ...updatedProperties,
              id: examData.id
            }
          };
        });

        // OPTIMISTIC UPDATE: Update all list caches immediately
        queryClient.setQueriesData(['mockExams'], (oldData) => {
          if (!oldData?.data) return oldData;

          return {
            ...oldData,
            data: oldData.data.map(exam =>
              exam.id === examData.id
                ? { ...exam, ...updatedProperties }
                : exam
            )
          };
        });

        // Update local form state with response data
        const updatedFormData = { ...updatedProperties };

        // Preserve computed fields
        if (updatedProperties.booked_count !== undefined || updatedProperties.total_bookings !== undefined) {
          updatedFormData.booked_count = updatedProperties.booked_count || updatedProperties.total_bookings || 0;
          updatedFormData.total_bookings = updatedProperties.total_bookings || updatedProperties.booked_count || 0;
        }

        // Convert time fields to input format
        if (updatedProperties.start_time) {
          updatedFormData.start_time = convertToTimeInput(updatedProperties.start_time);
        }
        if (updatedProperties.end_time) {
          updatedFormData.end_time = convertToTimeInput(updatedProperties.end_time);
        }

        // Preserve scheduled activation datetime
        if (updatedProperties.scheduled_activation_datetime) {
          updatedFormData.scheduled_activation_datetime = updatedProperties.scheduled_activation_datetime;
        }

        // Preserve prerequisite data
        updatedFormData.prerequisite_exam_ids = updatedProperties.prerequisite_exam_ids || [];
        updatedFormData.prerequisite_exams = updatedProperties.prerequisite_exams || [];

        setFormData(updatedFormData);
        originalDataRef.current = { ...updatedFormData };

        // Exit edit mode IMMEDIATELY (no waiting for network)
        setIsEditing(false);
        setIsDirty(false);
        validation.resetValidation();

        // Show success message
        notify.success('Mock exam updated successfully');

        // Invalidate metrics only (background refresh)
        queryClient.invalidateQueries(['mockExamsMetrics']);
        queryClient.invalidateQueries(['mockExamAggregates']);
        queryClient.invalidateQueries(['mock-exam-aggregates']);

      } catch (error) {
        console.error('Error updating cache after save:', error);
        notify.error('Saved but failed to update display. Please reload the page.');
      }
    },
    onError: (error) => {
      console.error('❌ [SAVE-ERROR]:', error);
      // Show error message
      const errorMessage = error.response?.data?.error?.message || error.message || 'Failed to save changes';
      notify.error(errorMessage);
    }
  });

  /**
   * Toggle edit mode
   */
  const toggleEdit = useCallback(() => {
    if (isEditing) {
      // Exiting edit mode - check for unsaved changes
      if (isDirty) {
        // Will be handled by confirmation dialog
        return false;
      }
      setIsEditing(false);
      validation.resetValidation();
    } else {
      // Entering edit mode
      setIsEditing(true);
    }
    return true;
  }, [isEditing, isDirty, validation]);

  /**
   * Update a single field
   */
  const updateField = useCallback((fieldName, value) => {
    setFormData(prev => {
      const updated = { ...prev, [fieldName]: value };

      // Special handling for is_active changes
      if (fieldName === 'is_active' && value !== 'scheduled') {
        // Clear scheduled_activation_datetime when changing away from scheduled
        updated.scheduled_activation_datetime = null;
      }

      // Check if form is dirty
      const hasChanges = hasFormChanges(originalDataRef.current, updated);
      setIsDirty(hasChanges);

      // Validate field
      validation.validateOnChange(fieldName, value, updated);

      return updated;
    });
  }, [validation]);

  /**
   * Update multiple fields
   */
  const updateFields = useCallback((updates) => {
    setFormData(prev => {
      const updated = { ...prev, ...updates };

      // Check if form is dirty
      const hasChanges = hasFormChanges(originalDataRef.current, updated);
      setIsDirty(hasChanges);

      // Validate changed fields
      Object.keys(updates).forEach(fieldName => {
        validation.validateSingleField(fieldName, updates[fieldName], updated);
      });

      return updated;
    });
  }, [validation]);

  /**
   * Handle field blur (trigger validation)
   */
  const handleFieldBlur = useCallback((fieldName) => {
    validation.validateOnBlur(fieldName, formData[fieldName], formData);
  }, [validation, formData]);

  /**
   * Reset form to original values
   */
  const resetForm = useCallback(() => {
    if (originalDataRef.current) {
      setFormData({ ...originalDataRef.current });
      setIsDirty(false);
      validation.resetValidation();
    }
  }, [validation]);

  /**
   * Cancel editing
   */
  const cancelEdit = useCallback(() => {
    if (isDirty) {
      // Return false to indicate confirmation needed
      return false;
    }

    // Reset and exit edit mode
    resetForm();
    setIsEditing(false);
    return true;
  }, [isDirty, resetForm]);

  /**
   * Force cancel (after confirmation)
   */
  const forceCancelEdit = useCallback(() => {
    resetForm();
    setIsEditing(false);
    setIsDirty(false);
  }, [resetForm]);

  /**
   * Save changes
   */
  const saveChanges = useCallback(async () => {

    // Touch all fields to show validation errors
    validation.touchAllFields();

    // Validate entire form
    const isValid = validation.validateAllFields(formData);

    if (!isValid) {
      // Find first error field and focus it
      const firstErrorField = Object.keys(validation.errors)[0];
      if (firstErrorField) {
        const element = document.querySelector(`[name="${firstErrorField}"]`);
        if (element) {
          element.focus();
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
      console.error('❌ [SAVE-CHANGES] Validation failed, cannot save');
      notify.error('Please fix the validation errors before saving');
      return false;
    }

    // Get only changed fields
    const changes = getChangedFields(originalDataRef.current, formData);

    if (Object.keys(changes).length === 0) {
      notify.info('No changes to save');
      setIsEditing(false);
      return true;
    }

    // If updating time fields, include exam_date for timezone conversion (even if date didn't change)
    if ((changes.start_time || changes.end_time) && !changes.exam_date && formData.exam_date) {
      changes.exam_date = formData.exam_date;
    }

    // Handle prerequisite exam IDs - don't include full exam objects in changes, just the IDs
    if (changes.prerequisite_exams) {
      delete changes.prerequisite_exams;
    }

    // Extract prerequisite_exam_ids for separate handling if Mock Discussion
    const prerequisiteIds = changes.prerequisite_exam_ids;
    let hasPrerequisiteChanges = false;

    if (formData.mock_type === 'Mock Discussion' && prerequisiteIds !== undefined) {
      hasPrerequisiteChanges = true;
      // Remove from main changes as it's handled separately
      delete changes.prerequisite_exam_ids;
    }

    // Format data for API
    const apiData = formatFormDataForApi(changes);

    // Execute save mutation
    try {
      // First save the main exam updates if there are any
      if (Object.keys(apiData).length > 0) {
        await saveMutation.mutateAsync(apiData);
      }

      // Then update prerequisites if they changed (for Mock Discussion only)
      if (hasPrerequisiteChanges && examData?.id) {
        await mockExamsApi.updatePrerequisites(examData.id, prerequisiteIds || []);

        // Refetch exam data to get updated prerequisite_exams
        await queryClient.invalidateQueries(['mockExam', examData.id]);
        const updatedExamResponse = await queryClient.fetchQuery(['mockExam', examData.id]);

        // Update local state with new data
        const updatedFormData = {
          ...formData,
          prerequisite_exam_ids: prerequisiteIds,
          prerequisite_exams: updatedExamResponse.data?.prerequisite_exams || []
        };
        setFormData(updatedFormData);
        originalDataRef.current = { ...updatedFormData };

        // If ONLY prerequisites changed (no other fields), we need to handle state updates here
        if (Object.keys(apiData).length === 0) {
          // Exit edit mode
          setIsEditing(false);
          setIsDirty(false);
          validation.resetValidation();

          // Show success toast
          notify.success('Mock exam updated successfully');
        }
      }

      return true;
    } catch (error) {
      console.error('❌ [SAVE-CHANGES] Save failed:', error);
      console.error('❌ [SAVE-CHANGES] Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });

      // Show error toast for prerequisite update failures
      const errorMessage = error.response?.data?.error?.message || error.message || 'Failed to save changes';
      notify.error(errorMessage);

      throw error;
    }
  }, [formData, validation, saveMutation, examData, queryClient]);

  /**
   * Check if save is allowed
   */
  const canSave = useCallback(() => {
    return isDirty && !validation.hasErrors() && !saveMutation.isLoading;
  }, [isDirty, validation, saveMutation.isLoading]);

  /**
   * Get field props for form inputs
   */
  const getFieldProps = useCallback((fieldName) => {
    return {
      name: fieldName,
      value: formData[fieldName] || '',
      onChange: (e) => updateField(fieldName, e.target.value),
      onBlur: () => handleFieldBlur(fieldName),
      disabled: !isEditing || saveMutation.isLoading,
      error: validation.getFieldError(fieldName)
    };
  }, [formData, isEditing, saveMutation.isLoading, updateField, handleFieldBlur, validation]);

  /**
   * Get checkbox field props
   */
  const getCheckboxProps = useCallback((fieldName) => {
    return {
      name: fieldName,
      checked: Boolean(formData[fieldName]),
      onChange: (e) => updateField(fieldName, e.target.checked),
      disabled: !isEditing || saveMutation.isLoading,
      error: validation.getFieldError(fieldName)
    };
  }, [formData, isEditing, saveMutation.isLoading, updateField, validation]);

  /**
   * Handle beforeunload event for unsaved changes warning
   */
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (isDirty && isEditing) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
        return e.returnValue;
      }
    };

    if (isDirty && isEditing) {
      window.addEventListener('beforeunload', handleBeforeUnload);
    }

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isDirty, isEditing]);

  return {
    // State
    isEditing,
    formData,
    isDirty,
    isSaving: saveMutation.isLoading,
    saveError: saveMutation.error,

    // Actions
    toggleEdit,
    updateField,
    updateFields,
    handleFieldBlur,
    saveChanges,
    cancelEdit,
    forceCancelEdit,
    resetForm,

    // Utilities
    canSave,
    getFieldProps,
    getCheckboxProps,

    // Validation
    errors: validation.errors,
    touched: validation.touched,
    getFieldError: validation.getFieldError,
    hasErrors: validation.hasErrors,
    validateField: validation.validateSingleField,
    validateAllFields: validation.validateAllFields
  };
}
