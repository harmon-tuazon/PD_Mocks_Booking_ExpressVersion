/**
 * Unit Tests for Admin Booking Creation Validation Schema
 * Tests the adminBookingCreation Joi schema
 */

const { schemas } = require('../../api/_shared/validation');

describe('Admin Booking Creation Validation Schema', () => {
  describe('Required Fields', () => {
    test('accepts valid booking data with all required fields', () => {
      const validData = {
        mock_exam_id: '12345678',
        student_id: 'ABC123',
        email: 'test@example.com',
        mock_type: 'Mock Discussion',
        exam_date: '2025-12-15'
      };

      const { error, value } = schemas.adminBookingCreation.validate(validData);
      expect(error).toBeUndefined();
      expect(value).toMatchObject(validData);
    });

    test('rejects when mock_exam_id is missing', () => {
      const invalidData = {
        student_id: 'ABC123',
        email: 'test@example.com',
        mock_type: 'Mock Discussion',
        exam_date: '2025-12-15'
      };

      const { error } = schemas.adminBookingCreation.validate(invalidData);
      expect(error).toBeDefined();
      expect(error.details[0].path).toContain('mock_exam_id');
    });

    test('rejects when student_id is missing', () => {
      const invalidData = {
        mock_exam_id: '12345678',
        email: 'test@example.com',
        mock_type: 'Mock Discussion',
        exam_date: '2025-12-15'
      };

      const { error } = schemas.adminBookingCreation.validate(invalidData);
      expect(error).toBeDefined();
      expect(error.details[0].path).toContain('student_id');
    });

    test('rejects when email is missing', () => {
      const invalidData = {
        mock_exam_id: '12345678',
        student_id: 'ABC123',
        mock_type: 'Mock Discussion',
        exam_date: '2025-12-15'
      };

      const { error } = schemas.adminBookingCreation.validate(invalidData);
      expect(error).toBeDefined();
      expect(error.details[0].path).toContain('email');
    });

    test('rejects when mock_type is missing', () => {
      const invalidData = {
        mock_exam_id: '12345678',
        student_id: 'ABC123',
        email: 'test@example.com',
        exam_date: '2025-12-15'
      };

      const { error } = schemas.adminBookingCreation.validate(invalidData);
      expect(error).toBeDefined();
      expect(error.details[0].path).toContain('mock_type');
    });

    test('rejects when exam_date is missing', () => {
      const invalidData = {
        mock_exam_id: '12345678',
        student_id: 'ABC123',
        email: 'test@example.com',
        mock_type: 'Mock Discussion'
      };

      const { error } = schemas.adminBookingCreation.validate(invalidData);
      expect(error).toBeDefined();
      expect(error.details[0].path).toContain('exam_date');
    });
  });

  describe('Student ID Format Validation', () => {
    test('accepts uppercase alphanumeric student ID', () => {
      const validData = {
        mock_exam_id: '12345678',
        student_id: 'ABC123XYZ',
        email: 'test@example.com',
        mock_type: 'Mock Discussion',
        exam_date: '2025-12-15'
      };

      const { error } = schemas.adminBookingCreation.validate(validData);
      expect(error).toBeUndefined();
    });

    test('accepts numeric-only student ID', () => {
      const validData = {
        mock_exam_id: '12345678',
        student_id: '123456',
        email: 'test@example.com',
        mock_type: 'Mock Discussion',
        exam_date: '2025-12-15'
      };

      const { error } = schemas.adminBookingCreation.validate(validData);
      expect(error).toBeUndefined();
    });

    test('rejects student ID with lowercase letters', () => {
      const invalidData = {
        mock_exam_id: '12345678',
        student_id: 'abc123',
        email: 'test@example.com',
        mock_type: 'Mock Discussion',
        exam_date: '2025-12-15'
      };

      const { error } = schemas.adminBookingCreation.validate(invalidData);
      expect(error).toBeDefined();
      expect(error.details[0].path).toContain('student_id');
    });

    test('rejects student ID with special characters', () => {
      const invalidData = {
        mock_exam_id: '12345678',
        student_id: 'ABC-123',
        email: 'test@example.com',
        mock_type: 'Mock Discussion',
        exam_date: '2025-12-15'
      };

      const { error } = schemas.adminBookingCreation.validate(invalidData);
      expect(error).toBeDefined();
      expect(error.details[0].path).toContain('student_id');
    });

    test('rejects student ID with spaces', () => {
      const invalidData = {
        mock_exam_id: '12345678',
        student_id: 'ABC 123',
        email: 'test@example.com',
        mock_type: 'Mock Discussion',
        exam_date: '2025-12-15'
      };

      const { error } = schemas.adminBookingCreation.validate(invalidData);
      expect(error).toBeDefined();
      expect(error.details[0].path).toContain('student_id');
    });
  });

  describe('Email Validation', () => {
    test('accepts valid email address', () => {
      const validData = {
        mock_exam_id: '12345678',
        student_id: 'ABC123',
        email: 'valid.email@example.com',
        mock_type: 'Mock Discussion',
        exam_date: '2025-12-15'
      };

      const { error } = schemas.adminBookingCreation.validate(validData);
      expect(error).toBeUndefined();
    });

    test('rejects invalid email format', () => {
      const invalidData = {
        mock_exam_id: '12345678',
        student_id: 'ABC123',
        email: 'not-an-email',
        mock_type: 'Mock Discussion',
        exam_date: '2025-12-15'
      };

      const { error } = schemas.adminBookingCreation.validate(invalidData);
      expect(error).toBeDefined();
      expect(error.details[0].path).toContain('email');
    });

    test('rejects email without domain', () => {
      const invalidData = {
        mock_exam_id: '12345678',
        student_id: 'ABC123',
        email: 'user@',
        mock_type: 'Mock Discussion',
        exam_date: '2025-12-15'
      };

      const { error } = schemas.adminBookingCreation.validate(invalidData);
      expect(error).toBeDefined();
      expect(error.details[0].path).toContain('email');
    });
  });

  describe('Mock Type Validation', () => {
    test('accepts "Situational Judgment" mock type', () => {
      const validData = {
        mock_exam_id: '12345678',
        student_id: 'ABC123',
        email: 'test@example.com',
        mock_type: 'Situational Judgment',
        exam_date: '2025-12-15',
        attending_location: 'Mississauga'
      };

      const { error } = schemas.adminBookingCreation.validate(validData);
      expect(error).toBeUndefined();
    });

    test('accepts "Clinical Skills" mock type', () => {
      const validData = {
        mock_exam_id: '12345678',
        student_id: 'ABC123',
        email: 'test@example.com',
        mock_type: 'Clinical Skills',
        exam_date: '2025-12-15',
        dominant_hand: 'Right'
      };

      const { error } = schemas.adminBookingCreation.validate(validData);
      expect(error).toBeUndefined();
    });

    test('accepts "Mini-mock" mock type', () => {
      const validData = {
        mock_exam_id: '12345678',
        student_id: 'ABC123',
        email: 'test@example.com',
        mock_type: 'Mini-mock',
        exam_date: '2025-12-15',
        attending_location: 'Calgary'
      };

      const { error } = schemas.adminBookingCreation.validate(validData);
      expect(error).toBeUndefined();
    });

    test('accepts "Mock Discussion" mock type', () => {
      const validData = {
        mock_exam_id: '12345678',
        student_id: 'ABC123',
        email: 'test@example.com',
        mock_type: 'Mock Discussion',
        exam_date: '2025-12-15'
      };

      const { error } = schemas.adminBookingCreation.validate(validData);
      expect(error).toBeUndefined();
    });

    test('rejects invalid mock type', () => {
      const invalidData = {
        mock_exam_id: '12345678',
        student_id: 'ABC123',
        email: 'test@example.com',
        mock_type: 'Invalid Type',
        exam_date: '2025-12-15'
      };

      const { error } = schemas.adminBookingCreation.validate(invalidData);
      expect(error).toBeDefined();
      expect(error.details[0].path).toContain('mock_type');
    });
  });

  describe('Exam Date Validation', () => {
    test('accepts valid date in YYYY-MM-DD format', () => {
      const validData = {
        mock_exam_id: '12345678',
        student_id: 'ABC123',
        email: 'test@example.com',
        mock_type: 'Mock Discussion',
        exam_date: '2025-12-31'
      };

      const { error } = schemas.adminBookingCreation.validate(validData);
      expect(error).toBeUndefined();
    });

    test('rejects date with wrong format (DD-MM-YYYY)', () => {
      const invalidData = {
        mock_exam_id: '12345678',
        student_id: 'ABC123',
        email: 'test@example.com',
        mock_type: 'Mock Discussion',
        exam_date: '31-12-2025'
      };

      const { error } = schemas.adminBookingCreation.validate(invalidData);
      expect(error).toBeDefined();
      expect(error.details[0].path).toContain('exam_date');
    });

    test('rejects date with wrong format (MM/DD/YYYY)', () => {
      const invalidData = {
        mock_exam_id: '12345678',
        student_id: 'ABC123',
        email: 'test@example.com',
        mock_type: 'Mock Discussion',
        exam_date: '12/31/2025'
      };

      const { error } = schemas.adminBookingCreation.validate(invalidData);
      expect(error).toBeDefined();
      expect(error.details[0].path).toContain('exam_date');
    });

    test('rejects invalid date string', () => {
      const invalidData = {
        mock_exam_id: '12345678',
        student_id: 'ABC123',
        email: 'test@example.com',
        mock_type: 'Mock Discussion',
        exam_date: 'not-a-date'
      };

      const { error } = schemas.adminBookingCreation.validate(invalidData);
      expect(error).toBeDefined();
      expect(error.details[0].path).toContain('exam_date');
    });
  });

  describe('Conditional Field: dominant_hand (Clinical Skills)', () => {
    test('accepts Clinical Skills with dominant_hand as boolean true', () => {
      const validData = {
        mock_exam_id: '12345678',
        student_id: 'ABC123',
        email: 'test@example.com',
        mock_type: 'Clinical Skills',
        exam_date: '2025-12-15',
        dominant_hand: true
      };

      const { error } = schemas.adminBookingCreation.validate(validData);
      expect(error).toBeUndefined();
    });

    test('accepts Clinical Skills with dominant_hand as boolean false', () => {
      const validData = {
        mock_exam_id: '12345678',
        student_id: 'ABC123',
        email: 'test@example.com',
        mock_type: 'Clinical Skills',
        exam_date: '2025-12-15',
        dominant_hand: false
      };

      const { error } = schemas.adminBookingCreation.validate(validData);
      expect(error).toBeUndefined();
    });

    test('accepts Clinical Skills with dominant_hand as string "Right"', () => {
      const validData = {
        mock_exam_id: '12345678',
        student_id: 'ABC123',
        email: 'test@example.com',
        mock_type: 'Clinical Skills',
        exam_date: '2025-12-15',
        dominant_hand: 'Right'
      };

      const { error } = schemas.adminBookingCreation.validate(validData);
      expect(error).toBeUndefined();
    });

    test('accepts Clinical Skills with dominant_hand as string "Left"', () => {
      const validData = {
        mock_exam_id: '12345678',
        student_id: 'ABC123',
        email: 'test@example.com',
        mock_type: 'Clinical Skills',
        exam_date: '2025-12-15',
        dominant_hand: 'Left'
      };

      const { error } = schemas.adminBookingCreation.validate(validData);
      expect(error).toBeUndefined();
    });

    test('rejects Clinical Skills without dominant_hand', () => {
      const invalidData = {
        mock_exam_id: '12345678',
        student_id: 'ABC123',
        email: 'test@example.com',
        mock_type: 'Clinical Skills',
        exam_date: '2025-12-15'
      };

      const { error } = schemas.adminBookingCreation.validate(invalidData);
      expect(error).toBeDefined();
      expect(error.details[0].path).toContain('dominant_hand');
    });

    test('rejects Clinical Skills with invalid dominant_hand value', () => {
      const invalidData = {
        mock_exam_id: '12345678',
        student_id: 'ABC123',
        email: 'test@example.com',
        mock_type: 'Clinical Skills',
        exam_date: '2025-12-15',
        dominant_hand: 'invalid'
      };

      const { error } = schemas.adminBookingCreation.validate(invalidData);
      expect(error).toBeDefined();
      expect(error.details[0].path).toContain('dominant_hand');
    });

    test('strips dominant_hand for non-Clinical Skills mock types', () => {
      const validData = {
        mock_exam_id: '12345678',
        student_id: 'ABC123',
        email: 'test@example.com',
        mock_type: 'Mock Discussion',
        exam_date: '2025-12-15',
        dominant_hand: true // Should be stripped
      };

      const { error, value } = schemas.adminBookingCreation.validate(validData);
      expect(error).toBeUndefined();
      expect(value.dominant_hand).toBeUndefined();
    });
  });

  describe('Conditional Field: attending_location (Situational Judgment / Mini-mock)', () => {
    test('accepts Situational Judgment with attending_location', () => {
      const validData = {
        mock_exam_id: '12345678',
        student_id: 'ABC123',
        email: 'test@example.com',
        mock_type: 'Situational Judgment',
        exam_date: '2025-12-15',
        attending_location: 'Mississauga'
      };

      const { error } = schemas.adminBookingCreation.validate(validData);
      expect(error).toBeUndefined();
    });

    test('accepts Mini-mock with attending_location', () => {
      const validData = {
        mock_exam_id: '12345678',
        student_id: 'ABC123',
        email: 'test@example.com',
        mock_type: 'Mini-mock',
        exam_date: '2025-12-15',
        attending_location: 'Calgary'
      };

      const { error } = schemas.adminBookingCreation.validate(validData);
      expect(error).toBeUndefined();
    });

    test('accepts lowercase location names', () => {
      const validData = {
        mock_exam_id: '12345678',
        student_id: 'ABC123',
        email: 'test@example.com',
        mock_type: 'Situational Judgment',
        exam_date: '2025-12-15',
        attending_location: 'mississauga'
      };

      const { error } = schemas.adminBookingCreation.validate(validData);
      expect(error).toBeUndefined();
    });

    test('accepts all valid location options', () => {
      const locations = [
        'mississauga', 'calgary', 'vancouver', 'montreal', 'richmond_hill',
        'Mississauga', 'Calgary', 'Vancouver', 'Montreal', 'Richmond Hill'
      ];

      locations.forEach(location => {
        const validData = {
          mock_exam_id: '12345678',
          student_id: 'ABC123',
          email: 'test@example.com',
          mock_type: 'Situational Judgment',
          exam_date: '2025-12-15',
          attending_location: location
        };

        const { error } = schemas.adminBookingCreation.validate(validData);
        expect(error).toBeUndefined();
      });
    });

    test('rejects Situational Judgment without attending_location', () => {
      const invalidData = {
        mock_exam_id: '12345678',
        student_id: 'ABC123',
        email: 'test@example.com',
        mock_type: 'Situational Judgment',
        exam_date: '2025-12-15'
      };

      const { error } = schemas.adminBookingCreation.validate(invalidData);
      expect(error).toBeDefined();
      expect(error.details[0].path).toContain('attending_location');
    });

    test('rejects Mini-mock without attending_location', () => {
      const invalidData = {
        mock_exam_id: '12345678',
        student_id: 'ABC123',
        email: 'test@example.com',
        mock_type: 'Mini-mock',
        exam_date: '2025-12-15'
      };

      const { error } = schemas.adminBookingCreation.validate(invalidData);
      expect(error).toBeDefined();
      expect(error.details[0].path).toContain('attending_location');
    });

    test('rejects invalid location value', () => {
      const invalidData = {
        mock_exam_id: '12345678',
        student_id: 'ABC123',
        email: 'test@example.com',
        mock_type: 'Situational Judgment',
        exam_date: '2025-12-15',
        attending_location: 'InvalidCity'
      };

      const { error } = schemas.adminBookingCreation.validate(invalidData);
      expect(error).toBeDefined();
      expect(error.details[0].path).toContain('attending_location');
    });

    test('strips attending_location for non-SJ/Mini-mock types', () => {
      const validData = {
        mock_exam_id: '12345678',
        student_id: 'ABC123',
        email: 'test@example.com',
        mock_type: 'Mock Discussion',
        exam_date: '2025-12-15',
        attending_location: 'Mississauga' // Should be stripped
      };

      const { error, value } = schemas.adminBookingCreation.validate(validData);
      expect(error).toBeUndefined();
      expect(value.attending_location).toBeUndefined();
    });
  });

  describe('Edge Cases and Complex Scenarios', () => {
    test('accepts Clinical Skills with all fields', () => {
      const validData = {
        mock_exam_id: '12345678',
        student_id: 'ABC123XYZ',
        email: 'john.doe@example.com',
        mock_type: 'Clinical Skills',
        exam_date: '2025-12-25',
        dominant_hand: 'Right'
      };

      const { error } = schemas.adminBookingCreation.validate(validData);
      expect(error).toBeUndefined();
    });

    test('accepts Situational Judgment with all fields', () => {
      const validData = {
        mock_exam_id: '12345678',
        student_id: 'XYZ789',
        email: 'jane.smith@example.com',
        mock_type: 'Situational Judgment',
        exam_date: '2026-01-15',
        attending_location: 'Vancouver'
      };

      const { error } = schemas.adminBookingCreation.validate(validData);
      expect(error).toBeUndefined();
    });

    test('accepts Mock Discussion without optional fields', () => {
      const validData = {
        mock_exam_id: '12345678',
        student_id: 'TEST001',
        email: 'test@test.com',
        mock_type: 'Mock Discussion',
        exam_date: '2025-11-30'
      };

      const { error } = schemas.adminBookingCreation.validate(validData);
      expect(error).toBeUndefined();
    });

    test('rejects data with multiple validation errors', () => {
      const invalidData = {
        // missing mock_exam_id
        student_id: 'invalid-id', // invalid format
        email: 'not-an-email', // invalid email
        mock_type: 'Invalid Type', // invalid mock type
        exam_date: '31/12/2025' // invalid date format
      };

      const { error } = schemas.adminBookingCreation.validate(invalidData, { abortEarly: false });
      expect(error).toBeDefined();
      expect(error.details.length).toBeGreaterThan(1);
    });

    test('handles empty object', () => {
      const { error } = schemas.adminBookingCreation.validate({});
      expect(error).toBeDefined();
      expect(error.details[0].path).toContain('mock_exam_id');
    });

    test('handles null input', () => {
      const { error } = schemas.adminBookingCreation.validate(null);
      expect(error).toBeDefined();
    });

    test('handles undefined input', () => {
      // Joi treats undefined as empty, which fails required field validation
      const { error, value } = schemas.adminBookingCreation.validate(undefined);
      // Either error is defined or value is undefined (both indicate invalid)
      expect(error || !value).toBeTruthy();
    });
  });
});
