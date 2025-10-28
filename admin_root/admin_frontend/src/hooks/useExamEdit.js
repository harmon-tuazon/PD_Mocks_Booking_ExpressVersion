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
    console.log('✅ Success:', message);
    toast.success(message);
  },
  error: (message) => {
    console.error('❌ Error:', message);
    toast.error(message);
  },
  info: (message) => {
    console.log('ℹ️ Info:', message);
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

    try {
      // Create Date object (handles ISO strings, timestamps, etc.)
      const date = new Date(timeValue);

      // Check if valid date
      if (isNaN(date.getTime())) {
        console.warn('Invalid time value:', timeValue);
        return '';
      }

      console.log('🕐 [convertToTimeInput] Converting timestamp to EST time:', {
        input: timeValue,
        inputType: typeof timeValue,
        dateUTC: date.toISOString()
      });

      // Extract hours and minutes in EST timezone (America/Toronto handles EST/EDT automatically)
      // This ensures the displayed time matches what was stored, regardless of user's timezone
      const estTimeString = date.toLocaleTimeString('en-US', {
        timeZone: 'America/Toronto',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });

      console.log('🕐 [convertToTimeInput] Extracted EST time:', estTimeString);

      // Return HH:MM format
      return estTimeString;
    } catch (error) {
      console.error('Error converting time for input:', error, timeValue);
      return '';
    }
  };

  // Initialize form data when exam data changes
  useEffect(() => {
    if (examData) {
      console.log('🔍 [useExamEdit] Initializing formData from examData:', {
        start_time: examData.start_time,
        start_time_type: typeof examData.start_time,
        end_time: examData.end_time,
        end_time_type: typeof examData.end_time
      });

      const initialData = {
        mock_type: examData.mock_type || '',
        exam_date: examData.exam_date || '',
        start_time: convertToTimeInput(examData.start_time),
        end_time: convertToTimeInput(examData.end_time),
        capacity: examData.capacity || 0,
        location: examData.location || '',
        address: examData.address || '',
        is_active: examData.is_active !== undefined ? examData.is_active : true,
        // Keep track of booking count for validation
        booked_count: examData.booked_count || examData.total_bookings || 0,
        total_bookings: examData.total_bookings || examData.booked_count || 0
      };

      console.log('🔍 [useExamEdit] Final formData:', initialData);
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
      return await mockExamsApi.update(examData.id, updates);
    },
    onSuccess: (response) => {
      console.log('✅ [SAVE-SUCCESS] Update response:', response);

      // Extract updated properties from response
      const updatedProperties = response.mockExam?.properties || {};
      console.log('✅ [SAVE-SUCCESS] Updated properties:', updatedProperties);

      // Invalidate queries to refetch fresh data
      // This is simpler and more reliable than manually updating cache
      queryClient.invalidateQueries(['mockExam', examData.id]);
      queryClient.invalidateQueries(['mockExams']);
      queryClient.invalidateQueries(['mockExamMetrics']);
      queryClient.invalidateQueries(['mockExamAggregates']);

      // Update local form state with the updated properties
      const updatedFormData = { ...formData, ...updatedProperties };
      console.log('✅ [SAVE-SUCCESS] Updated formData:', updatedFormData);
      setFormData(updatedFormData);
      originalDataRef.current = { ...updatedFormData };

      // Exit edit mode
      setIsEditing(false);
      setIsDirty(false);
      validation.resetValidation();

      // Show success message
      notify.success('Mock exam updated successfully');
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
    console.log('🔧 [SAVE-CHANGES] Starting save operation');
    console.log('🔧 [SAVE-CHANGES] Current formData:', formData);
    console.log('🔧 [SAVE-CHANGES] Original data:', originalDataRef.current);

    // Touch all fields to show validation errors
    validation.touchAllFields();

    // Validate entire form
    const isValid = validation.validateAllFields(formData);
    console.log('🔧 [SAVE-CHANGES] Validation result:', isValid);
    console.log('🔧 [SAVE-CHANGES] Validation errors:', validation.errors);

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
    console.log('🔧 [SAVE-CHANGES] Changed fields:', changes);
    console.log('🔧 [SAVE-CHANGES] Number of changes:', Object.keys(changes).length);

    if (Object.keys(changes).length === 0) {
      console.log('ℹ️ [SAVE-CHANGES] No changes detected');
      notify.info('No changes to save');
      setIsEditing(false);
      return true;
    }

    // If updating time fields, include exam_date for timezone conversion (even if date didn't change)
    if ((changes.start_time || changes.end_time) && !changes.exam_date && formData.exam_date) {
      console.log('🕐 [SAVE-CHANGES] Time fields updated, appending exam_date from formData:', formData.exam_date);
      changes.exam_date = formData.exam_date;
    }

    // Format data for API
    const apiData = formatFormDataForApi(changes);
    console.log('🔧 [SAVE-CHANGES] Formatted API data:', apiData);
    console.log('🔧 [SAVE-CHANGES] API data keys:', Object.keys(apiData));
    console.log('🔧 [SAVE-CHANGES] API data types:', Object.keys(apiData).map(k => `${k}: ${typeof apiData[k]}`));

    // Execute save mutation
    console.log('🔧 [SAVE-CHANGES] Calling API update...');
    try {
      await saveMutation.mutateAsync(apiData);
      console.log('✅ [SAVE-CHANGES] Save successful');
      return true;
    } catch (error) {
      console.error('❌ [SAVE-CHANGES] Save failed:', error);
      console.error('❌ [SAVE-CHANGES] Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      throw error;
    }
  }, [formData, validation, saveMutation]);

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