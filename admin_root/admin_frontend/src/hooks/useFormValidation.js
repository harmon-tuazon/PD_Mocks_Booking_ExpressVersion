/**
 * useFormValidation Hook
 * Provides real-time validation for form fields
 */

import { useState, useCallback, useEffect } from 'react';
import { validateField, validateForm } from '../utils/examValidation';

export function useFormValidation(initialData = {}) {
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [isValidating, setIsValidating] = useState(false);

  /**
   * Validate a single field
   */
  const validateSingleField = useCallback((fieldName, value, formData) => {
    const result = validateField(fieldName, value, formData);

    setErrors(prev => ({
      ...prev,
      [fieldName]: result.error
    }));

    return result.isValid;
  }, []);

  /**
   * Validate multiple fields
   */
  const validateMultipleFields = useCallback((fields, formData) => {
    const newErrors = {};
    let allValid = true;

    fields.forEach(fieldName => {
      const result = validateField(fieldName, formData[fieldName], formData);
      if (!result.isValid) {
        newErrors[fieldName] = result.error;
        allValid = false;
      }
    });

    setErrors(prev => ({
      ...prev,
      ...newErrors
    }));

    return allValid;
  }, []);

  /**
   * Validate all fields in the form
   */
  const validateAllFields = useCallback((formData) => {
    setIsValidating(true);

    const { isValid, errors: validationErrors } = validateForm(formData);

    setErrors(validationErrors);
    setIsValidating(false);

    return isValid;
  }, []);

  /**
   * Mark field as touched (for showing errors)
   */
  const touchField = useCallback((fieldName) => {
    setTouched(prev => ({
      ...prev,
      [fieldName]: true
    }));
  }, []);

  /**
   * Mark multiple fields as touched
   */
  const touchFields = useCallback((fieldNames) => {
    setTouched(prev => {
      const newTouched = { ...prev };
      fieldNames.forEach(name => {
        newTouched[name] = true;
      });
      return newTouched;
    });
  }, []);

  /**
   * Touch all fields (used before submit)
   */
  const touchAllFields = useCallback(() => {
    const allFields = [
      'mock_type',
      'exam_date',
      'start_time',
      'end_time',
      'capacity',
      'location',
      'address',
      'is_active'
    ];

    const newTouched = {};
    allFields.forEach(field => {
      newTouched[field] = true;
    });

    setTouched(newTouched);
  }, []);

  /**
   * Clear error for a specific field
   */
  const clearFieldError = useCallback((fieldName) => {
    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[fieldName];
      return newErrors;
    });
  }, []);

  /**
   * Clear all errors
   */
  const clearAllErrors = useCallback(() => {
    setErrors({});
  }, []);

  /**
   * Reset validation state
   */
  const resetValidation = useCallback(() => {
    setErrors({});
    setTouched({});
    setIsValidating(false);
  }, []);

  /**
   * Get error message for a field (only if touched)
   */
  const getFieldError = useCallback((fieldName) => {
    return touched[fieldName] ? errors[fieldName] : null;
  }, [errors, touched]);

  /**
   * Check if form has any errors
   */
  const hasErrors = useCallback(() => {
    return Object.keys(errors).some(key => errors[key]);
  }, [errors]);

  /**
   * Check if specific fields have errors
   */
  const hasFieldErrors = useCallback((fieldNames) => {
    return fieldNames.some(name => errors[name]);
  }, [errors]);

  /**
   * Validate on field change (with debouncing for performance)
   */
  const validateOnChange = useCallback((fieldName, value, formData, delay = 300) => {
    // Clear any existing timeout for this field
    if (window.validationTimeouts && window.validationTimeouts[fieldName]) {
      clearTimeout(window.validationTimeouts[fieldName]);
    }

    // Set up debounced validation
    if (!window.validationTimeouts) {
      window.validationTimeouts = {};
    }

    window.validationTimeouts[fieldName] = setTimeout(() => {
      validateSingleField(fieldName, value, formData);
      touchField(fieldName);
    }, delay);
  }, [validateSingleField, touchField]);

  /**
   * Validate on blur (immediate)
   */
  const validateOnBlur = useCallback((fieldName, value, formData) => {
    validateSingleField(fieldName, value, formData);
    touchField(fieldName);
  }, [validateSingleField, touchField]);

  /**
   * Get validation state summary
   */
  const getValidationState = useCallback(() => {
    const errorCount = Object.keys(errors).filter(key => errors[key]).length;
    const touchedCount = Object.keys(touched).filter(key => touched[key]).length;

    return {
      hasErrors: errorCount > 0,
      errorCount,
      touchedCount,
      isValid: errorCount === 0,
      isValidating
    };
  }, [errors, touched, isValidating]);

  /**
   * Cleanup timeouts on unmount
   */
  useEffect(() => {
    return () => {
      if (window.validationTimeouts) {
        Object.values(window.validationTimeouts).forEach(timeout => {
          clearTimeout(timeout);
        });
        delete window.validationTimeouts;
      }
    };
  }, []);

  return {
    errors,
    touched,
    isValidating,
    validateSingleField,
    validateMultipleFields,
    validateAllFields,
    validateOnChange,
    validateOnBlur,
    touchField,
    touchFields,
    touchAllFields,
    clearFieldError,
    clearAllErrors,
    resetValidation,
    getFieldError,
    hasErrors,
    hasFieldErrors,
    getValidationState
  };
}