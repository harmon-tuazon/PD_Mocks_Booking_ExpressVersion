/**
 * Comprehensive unit tests for prerequisite validation helpers
 * Tests checkPrerequisites, getMissingPrerequisites, and formatPrerequisiteDisplay
 * Following PRD v2.1.0 specifications
 */

import {
  checkPrerequisites,
  getMissingPrerequisites,
  formatPrerequisiteDisplay
} from '../prerequisiteHelpers';

describe('checkPrerequisites', () => {
  describe('Valid prerequisite scenarios (should allow booking)', () => {
    test('returns true when user has no prerequisites required', () => {
      const prerequisiteExamIds = [];
      const userBookings = [];

      expect(checkPrerequisites(prerequisiteExamIds, userBookings)).toBe(true);
    });

    test('returns true when prerequisiteExamIds is null', () => {
      const prerequisiteExamIds = null;
      const userBookings = [];

      expect(checkPrerequisites(prerequisiteExamIds, userBookings)).toBe(true);
    });

    test('returns true when prerequisiteExamIds is undefined', () => {
      const prerequisiteExamIds = undefined;
      const userBookings = [];

      expect(checkPrerequisites(prerequisiteExamIds, userBookings)).toBe(true);
    });

    test('returns true when user has active booking for one prerequisite', () => {
      const prerequisiteExamIds = ['prereq1', 'prereq2'];
      const userBookings = [
        {
          mock_exam_id: 'prereq1',
          is_active: 'Active'
        }
      ];

      expect(checkPrerequisites(prerequisiteExamIds, userBookings)).toBe(true);
    });

    test('returns true when user has booking with is_active="Completed"', () => {
      const prerequisiteExamIds = ['prereq1'];
      const userBookings = [
        {
          mock_exam_id: 'prereq1',
          is_active: 'Completed'
        }
      ];

      expect(checkPrerequisites(prerequisiteExamIds, userBookings)).toBe(true);
    });

    test('returns true when user has multiple active bookings (OR logic)', () => {
      const prerequisiteExamIds = ['prereq1', 'prereq2'];
      const userBookings = [
        {
          mock_exam_id: 'prereq1',
          is_active: 'Active'
        },
        {
          mock_exam_id: 'prereq2',
          is_active: 'Completed'
        }
      ];

      expect(checkPrerequisites(prerequisiteExamIds, userBookings)).toBe(true);
    });

    test('returns true when user has active booking for ANY ONE of multiple prerequisites', () => {
      const prerequisiteExamIds = ['prereq1', 'prereq2', 'prereq3'];
      const userBookings = [
        {
          mock_exam_id: 'prereq2',
          is_active: 'Active'
        },
        {
          mock_exam_id: 'other_exam',
          is_active: 'Active'
        }
      ];

      expect(checkPrerequisites(prerequisiteExamIds, userBookings)).toBe(true);
    });

    test('returns true when user has booking regardless of attendance status', () => {
      const prerequisiteExamIds = ['prereq1'];
      const userBookings = [
        {
          mock_exam_id: 'prereq1',
          attendance: 'No', // Attendance not checked anymore
          is_active: 'Active'
        }
      ];

      expect(checkPrerequisites(prerequisiteExamIds, userBookings)).toBe(true);
    });
  });

  describe('Invalid prerequisite scenarios (should block booking)', () => {
    test('returns false when user has no bookings but prerequisites are required', () => {
      const prerequisiteExamIds = ['prereq1'];
      const userBookings = [];

      expect(checkPrerequisites(prerequisiteExamIds, userBookings)).toBe(false);
    });

    test('returns false when user bookings is null', () => {
      const prerequisiteExamIds = ['prereq1'];
      const userBookings = null;

      expect(checkPrerequisites(prerequisiteExamIds, userBookings)).toBe(false);
    });

    test('returns false when user bookings is undefined', () => {
      const prerequisiteExamIds = ['prereq1'];
      const userBookings = undefined;

      expect(checkPrerequisites(prerequisiteExamIds, userBookings)).toBe(false);
    });

    test('returns false when user has booking but is_active="Cancelled"', () => {
      const prerequisiteExamIds = ['prereq1'];
      const userBookings = [
        {
          mock_exam_id: 'prereq1',
          is_active: 'Cancelled'
        }
      ];

      expect(checkPrerequisites(prerequisiteExamIds, userBookings)).toBe(false);
    });

    test('returns false when user has booking but is_active="Failed"', () => {
      const prerequisiteExamIds = ['prereq1'];
      const userBookings = [
        {
          mock_exam_id: 'prereq1',
          is_active: 'Failed'
        }
      ];

      expect(checkPrerequisites(prerequisiteExamIds, userBookings)).toBe(false);
    });

    test('returns false when user has booking for wrong exam', () => {
      const prerequisiteExamIds = ['prereq1'];
      const userBookings = [
        {
          mock_exam_id: 'different_exam',
          is_active: 'Active'
        }
      ];

      expect(checkPrerequisites(prerequisiteExamIds, userBookings)).toBe(false);
    });

    test('returns false when user has booking with is_active missing', () => {
      const prerequisiteExamIds = ['prereq1'];
      const userBookings = [
        {
          mock_exam_id: 'prereq1'
        }
      ];

      expect(checkPrerequisites(prerequisiteExamIds, userBookings)).toBe(false);
    });
  });

  describe('Edge cases', () => {
    test('handles multiple bookings for same exam (one cancelled, one active)', () => {
      const prerequisiteExamIds = ['prereq1'];
      const userBookings = [
        {
          mock_exam_id: 'prereq1',
          is_active: 'Cancelled'
        },
        {
          mock_exam_id: 'prereq1',
          is_active: 'Active'
        }
      ];

      expect(checkPrerequisites(prerequisiteExamIds, userBookings)).toBe(true);
    });

    test('handles numeric exam IDs', () => {
      const prerequisiteExamIds = ['12345', '67890'];
      const userBookings = [
        {
          mock_exam_id: '12345',
          is_active: 'Active'
        }
      ];

      expect(checkPrerequisites(prerequisiteExamIds, userBookings)).toBe(true);
    });

    test('handles booking without attendance field (attendance not required)', () => {
      const prerequisiteExamIds = ['prereq1'];
      const userBookings = [
        {
          mock_exam_id: 'prereq1',
          is_active: 'Active'
        }
      ];

      expect(checkPrerequisites(prerequisiteExamIds, userBookings)).toBe(true);
    });
  });
});

describe('getMissingPrerequisites', () => {
  const allMockExams = [
    {
      id: 'prereq1',
      mock_exam_id: 'prereq1',
      mock_type: 'Clinical Skills',
      exam_date: '2025-12-05',
      location: 'Mississauga'
    },
    {
      id: 'prereq2',
      mock_exam_id: 'prereq2',
      mock_type: 'Situational Judgment',
      exam_date: '2025-12-10',
      location: 'Toronto'
    },
    {
      id: 'prereq3',
      mock_exam_id: 'prereq3',
      mock_type: 'Clinical Skills',
      exam_date: '2025-12-15',
      location: 'Ottawa'
    }
  ];

  describe('Returns missing prerequisites correctly', () => {
    test('returns empty array when no prerequisites required', () => {
      const prerequisiteExamIds = [];
      const userBookings = [];

      expect(getMissingPrerequisites(prerequisiteExamIds, userBookings, allMockExams)).toEqual([]);
    });

    test('returns empty array when prerequisiteExamIds is null', () => {
      expect(getMissingPrerequisites(null, [], allMockExams)).toEqual([]);
    });

    test('returns empty array when prerequisiteExamIds is undefined', () => {
      expect(getMissingPrerequisites(undefined, [], allMockExams)).toEqual([]);
    });

    test('returns all prerequisites when user has no bookings', () => {
      const prerequisiteExamIds = ['prereq1', 'prereq2'];
      const userBookings = [];

      const missing = getMissingPrerequisites(prerequisiteExamIds, userBookings, allMockExams);

      expect(missing).toHaveLength(2);
      expect(missing[0].mock_exam_id).toBe('prereq1');
      expect(missing[1].mock_exam_id).toBe('prereq2');
    });

    test('returns only missing prerequisites when user has booked some', () => {
      const prerequisiteExamIds = ['prereq1', 'prereq2', 'prereq3'];
      const userBookings = [
        {
          mock_exam_id: 'prereq1',
          is_active: 'Active'
        }
      ];

      const missing = getMissingPrerequisites(prerequisiteExamIds, userBookings, allMockExams);

      expect(missing).toHaveLength(2);
      expect(missing[0].mock_exam_id).toBe('prereq2');
      expect(missing[1].mock_exam_id).toBe('prereq3');
    });

    test('returns empty array when all prerequisites have active bookings', () => {
      const prerequisiteExamIds = ['prereq1', 'prereq2'];
      const userBookings = [
        {
          mock_exam_id: 'prereq1',
          is_active: 'Active'
        },
        {
          mock_exam_id: 'prereq2',
          is_active: 'Completed'
        }
      ];

      const missing = getMissingPrerequisites(prerequisiteExamIds, userBookings, allMockExams);

      expect(missing).toEqual([]);
    });

    test('includes prerequisite details from allMockExams', () => {
      const prerequisiteExamIds = ['prereq1'];
      const userBookings = [];

      const missing = getMissingPrerequisites(prerequisiteExamIds, userBookings, allMockExams);

      expect(missing[0].mock_type).toBe('Clinical Skills');
      expect(missing[0].exam_date).toBe('2025-12-05');
      expect(missing[0].location).toBe('Mississauga');
    });
  });

  describe('Handles bookings with invalid status', () => {
    test('treats cancelled booking as not satisfying prerequisite', () => {
      const prerequisiteExamIds = ['prereq1'];
      const userBookings = [
        {
          mock_exam_id: 'prereq1',
          is_active: 'Cancelled'
        }
      ];

      const missing = getMissingPrerequisites(prerequisiteExamIds, userBookings, allMockExams);

      expect(missing).toHaveLength(1);
      expect(missing[0].mock_exam_id).toBe('prereq1');
    });

    test('treats active booking as satisfying prerequisite (attendance not required)', () => {
      const prerequisiteExamIds = ['prereq1'];
      const userBookings = [
        {
          mock_exam_id: 'prereq1',
          is_active: 'Active'
        }
      ];

      const missing = getMissingPrerequisites(prerequisiteExamIds, userBookings, allMockExams);

      expect(missing).toHaveLength(0);
    });
  });

  describe('Handles missing allMockExams parameter', () => {
    test('returns minimal object when allMockExams is null', () => {
      const prerequisiteExamIds = ['prereq1'];
      const userBookings = [];

      const missing = getMissingPrerequisites(prerequisiteExamIds, userBookings, null);

      expect(missing).toHaveLength(1);
      expect(missing[0]).toEqual({ id: 'prereq1', mock_exam_id: 'prereq1' });
    });

    test('returns minimal object when allMockExams is undefined', () => {
      const prerequisiteExamIds = ['prereq1'];
      const userBookings = [];

      const missing = getMissingPrerequisites(prerequisiteExamIds, userBookings, undefined);

      expect(missing).toHaveLength(1);
      expect(missing[0]).toEqual({ id: 'prereq1', mock_exam_id: 'prereq1' });
    });

    test('returns minimal object when prerequisite not found in allMockExams', () => {
      const prerequisiteExamIds = ['unknown_exam'];
      const userBookings = [];

      const missing = getMissingPrerequisites(prerequisiteExamIds, userBookings, allMockExams);

      expect(missing).toHaveLength(1);
      expect(missing[0]).toEqual({ id: 'unknown_exam', mock_exam_id: 'unknown_exam' });
    });
  });
});

describe('formatPrerequisiteDisplay', () => {
  describe('Complete exam data', () => {
    test('formats exam with all details', () => {
      const prereqExam = {
        mock_type: 'Clinical Skills',
        exam_date: '2025-12-05',
        location: 'Mississauga'
      };

      const formatted = formatPrerequisiteDisplay(prereqExam);

      expect(formatted).toBe('Clinical Skills - 2025-12-05 (Mississauga)');
    });

    test('formats exam without location', () => {
      const prereqExam = {
        mock_type: 'Situational Judgment',
        exam_date: '2025-12-10'
      };

      const formatted = formatPrerequisiteDisplay(prereqExam);

      expect(formatted).toBe('Situational Judgment - 2025-12-10');
    });

    test('formats exam with empty string location', () => {
      const prereqExam = {
        mock_type: 'Clinical Skills',
        exam_date: '2025-12-05',
        location: ''
      };

      const formatted = formatPrerequisiteDisplay(prereqExam);

      expect(formatted).toBe('Clinical Skills - 2025-12-05');
    });
  });

  describe('Missing data handling', () => {
    test('returns default message for null exam', () => {
      expect(formatPrerequisiteDisplay(null)).toBe('Unknown Exam');
    });

    test('returns default message for undefined exam', () => {
      expect(formatPrerequisiteDisplay(undefined)).toBe('Unknown Exam');
    });

    test('uses default mock_type when missing', () => {
      const prereqExam = {
        exam_date: '2025-12-05',
        location: 'Toronto'
      };

      const formatted = formatPrerequisiteDisplay(prereqExam);

      expect(formatted).toBe('Mock Exam - 2025-12-05 (Toronto)');
    });

    test('uses default date when missing', () => {
      const prereqExam = {
        mock_type: 'Clinical Skills',
        location: 'Toronto'
      };

      const formatted = formatPrerequisiteDisplay(prereqExam);

      expect(formatted).toBe('Clinical Skills - Date TBD (Toronto)');
    });

    test('handles exam with no properties', () => {
      const prereqExam = {};

      const formatted = formatPrerequisiteDisplay(prereqExam);

      expect(formatted).toBe('Mock Exam - Date TBD');
    });
  });
});
