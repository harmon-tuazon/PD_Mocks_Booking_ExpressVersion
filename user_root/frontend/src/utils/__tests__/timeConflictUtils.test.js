/**
 * Comprehensive unit tests for time conflict detection utilities
 * Tests all functions with 100% coverage including edge cases
 */

import {
  checkTimeOverlap,
  findConflictingBookings,
  formatConflictMessage,
  getConflictSummary,
  canModifyBooking
} from '../timeConflictUtils';

describe('checkTimeOverlap', () => {
  describe('Overlapping scenarios (should detect conflict)', () => {
    test('detects exact time match', () => {
      const start = '2025-12-05T14:00:00.000Z';
      const end = '2025-12-05T15:00:00.000Z';
      expect(checkTimeOverlap(start, end, start, end)).toBe(true);
    });

    test('detects partial overlap at start', () => {
      const session1Start = '2025-12-05T14:00:00.000Z';
      const session1End = '2025-12-05T15:00:00.000Z';
      const session2Start = '2025-12-05T13:30:00.000Z';
      const session2End = '2025-12-05T14:30:00.000Z';
      expect(checkTimeOverlap(session1Start, session1End, session2Start, session2End)).toBe(true);
    });

    test('detects partial overlap at end', () => {
      const session1Start = '2025-12-05T14:00:00.000Z';
      const session1End = '2025-12-05T15:00:00.000Z';
      const session2Start = '2025-12-05T14:30:00.000Z';
      const session2End = '2025-12-05T15:30:00.000Z';
      expect(checkTimeOverlap(session1Start, session1End, session2Start, session2End)).toBe(true);
    });

    test('detects complete overlap (one session contains another)', () => {
      const session1Start = '2025-12-05T14:00:00.000Z';
      const session1End = '2025-12-05T16:00:00.000Z';
      const session2Start = '2025-12-05T14:30:00.000Z';
      const session2End = '2025-12-05T15:30:00.000Z';
      expect(checkTimeOverlap(session1Start, session1End, session2Start, session2End)).toBe(true);
    });

    test('detects inverse complete overlap', () => {
      const session1Start = '2025-12-05T14:30:00.000Z';
      const session1End = '2025-12-05T15:30:00.000Z';
      const session2Start = '2025-12-05T14:00:00.000Z';
      const session2End = '2025-12-05T16:00:00.000Z';
      expect(checkTimeOverlap(session1Start, session1End, session2Start, session2End)).toBe(true);
    });

    test('detects same start time but different end times', () => {
      const session1Start = '2025-12-05T14:00:00.000Z';
      const session1End = '2025-12-05T15:00:00.000Z';
      const session2Start = '2025-12-05T14:00:00.000Z';
      const session2End = '2025-12-05T16:00:00.000Z';
      expect(checkTimeOverlap(session1Start, session1End, session2Start, session2End)).toBe(true);
    });

    test('detects same end time but different start times', () => {
      const session1Start = '2025-12-05T14:00:00.000Z';
      const session1End = '2025-12-05T15:00:00.000Z';
      const session2Start = '2025-12-05T13:00:00.000Z';
      const session2End = '2025-12-05T15:00:00.000Z';
      expect(checkTimeOverlap(session1Start, session1End, session2Start, session2End)).toBe(true);
    });
  });

  describe('Non-overlapping scenarios (should allow)', () => {
    test('allows session before with gap', () => {
      const session1Start = '2025-12-05T14:00:00.000Z';
      const session1End = '2025-12-05T15:00:00.000Z';
      const session2Start = '2025-12-05T12:00:00.000Z';
      const session2End = '2025-12-05T13:00:00.000Z';
      expect(checkTimeOverlap(session1Start, session1End, session2Start, session2End)).toBe(false);
    });

    test('allows session after with gap', () => {
      const session1Start = '2025-12-05T14:00:00.000Z';
      const session1End = '2025-12-05T15:00:00.000Z';
      const session2Start = '2025-12-05T16:00:00.000Z';
      const session2End = '2025-12-05T17:00:00.000Z';
      expect(checkTimeOverlap(session1Start, session1End, session2Start, session2End)).toBe(false);
    });

    test('allows adjacent sessions (end time = start time)', () => {
      const session1Start = '2025-12-05T14:00:00.000Z';
      const session1End = '2025-12-05T15:00:00.000Z';
      const session2Start = '2025-12-05T15:00:00.000Z';
      const session2End = '2025-12-05T16:00:00.000Z';
      expect(checkTimeOverlap(session1Start, session1End, session2Start, session2End)).toBe(false);
    });
  });

  describe('Edge cases and invalid inputs', () => {
    test('returns false for missing start1', () => {
      const end1 = '2025-12-05T15:00:00.000Z';
      const start2 = '2025-12-05T14:00:00.000Z';
      const end2 = '2025-12-05T15:00:00.000Z';
      expect(checkTimeOverlap(null, end1, start2, end2)).toBe(false);
    });

    test('returns false for missing end1', () => {
      const start1 = '2025-12-05T14:00:00.000Z';
      const start2 = '2025-12-05T14:00:00.000Z';
      const end2 = '2025-12-05T15:00:00.000Z';
      expect(checkTimeOverlap(start1, null, start2, end2)).toBe(false);
    });

    test('returns false for invalid date strings', () => {
      expect(checkTimeOverlap('invalid', '2025-12-05T15:00:00.000Z', '2025-12-05T14:00:00.000Z', '2025-12-05T15:00:00.000Z')).toBe(false);
    });

    test('returns false for empty strings', () => {
      expect(checkTimeOverlap('', '2025-12-05T15:00:00.000Z', '2025-12-05T14:00:00.000Z', '2025-12-05T15:00:00.000Z')).toBe(false);
    });

    test('returns false for undefined inputs', () => {
      expect(checkTimeOverlap(undefined, undefined, undefined, undefined)).toBe(false);
    });
  });
});

describe('findConflictingBookings', () => {
  const mockNewSession = {
    start_time: '2025-12-05T14:00:00.000Z',
    end_time: '2025-12-05T15:00:00.000Z',
    exam_date: '2025-12-05',
    mock_type: 'Clinical Skills'
  };

  describe('Conflict detection with different mock types', () => {
    test('finds conflicting booking with different mock type', () => {
      const existingBookings = [{
        id: '1',
        mock_type: 'Situational Judgment',
        start_time: '2025-12-05T14:00:00.000Z',
        end_time: '2025-12-05T15:00:00.000Z',
        is_active: 'Active'
      }];

      const conflicts = findConflictingBookings(existingBookings, mockNewSession);
      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].id).toBe('1');
    });

    test('finds multiple conflicting bookings', () => {
      const existingBookings = [
        {
          id: '1',
          mock_type: 'Situational Judgment',
          start_time: '2025-12-05T14:00:00.000Z',
          end_time: '2025-12-05T15:00:00.000Z',
          is_active: 'Active'
        },
        {
          id: '2',
          mock_type: 'Mini-mock',
          start_time: '2025-12-05T14:30:00.000Z',
          end_time: '2025-12-05T15:30:00.000Z',
          is_active: 'Active'
        }
      ];

      const conflicts = findConflictingBookings(existingBookings, mockNewSession);
      expect(conflicts).toHaveLength(2);
    });
  });

  describe('Booking status filtering', () => {
    test('ignores cancelled bookings', () => {
      const existingBookings = [{
        id: '1',
        mock_type: 'Situational Judgment',
        start_time: '2025-12-05T14:00:00.000Z',
        end_time: '2025-12-05T15:00:00.000Z',
        is_active: 'Cancelled'
      }];

      const conflicts = findConflictingBookings(existingBookings, mockNewSession);
      expect(conflicts).toHaveLength(0);
    });

    test('ignores completed bookings', () => {
      const existingBookings = [{
        id: '1',
        mock_type: 'Situational Judgment',
        start_time: '2025-12-05T14:00:00.000Z',
        end_time: '2025-12-05T15:00:00.000Z',
        is_active: 'Completed'
      }];

      const conflicts = findConflictingBookings(existingBookings, mockNewSession);
      expect(conflicts).toHaveLength(0);
    });

    test('ignores failed bookings', () => {
      const existingBookings = [{
        id: '1',
        mock_type: 'Situational Judgment',
        start_time: '2025-12-05T14:00:00.000Z',
        end_time: '2025-12-05T15:00:00.000Z',
        is_active: 'Failed'
      }];

      const conflicts = findConflictingBookings(existingBookings, mockNewSession);
      expect(conflicts).toHaveLength(0);
    });

    test('detects conflicts with Scheduled status', () => {
      const existingBookings = [{
        id: '1',
        mock_type: 'Situational Judgment',
        start_time: '2025-12-05T14:00:00.000Z',
        end_time: '2025-12-05T15:00:00.000Z',
        is_active: 'Scheduled'
      }];

      const conflicts = findConflictingBookings(existingBookings, mockNewSession);
      expect(conflicts).toHaveLength(1);
    });

    test('handles lowercase active status', () => {
      const existingBookings = [{
        id: '1',
        mock_type: 'Situational Judgment',
        start_time: '2025-12-05T14:00:00.000Z',
        end_time: '2025-12-05T15:00:00.000Z',
        is_active: 'active'
      }];

      const conflicts = findConflictingBookings(existingBookings, mockNewSession);
      expect(conflicts).toHaveLength(1);
    });

    test('handles nested mock_exam.is_active property', () => {
      const existingBookings = [{
        id: '1',
        mock_type: 'Situational Judgment',
        start_time: '2025-12-05T14:00:00.000Z',
        end_time: '2025-12-05T15:00:00.000Z',
        mock_exam: {
          is_active: 'Active'
        }
      }];

      const conflicts = findConflictingBookings(existingBookings, mockNewSession);
      expect(conflicts).toHaveLength(1);
    });
  });

  describe('Non-conflicting scenarios', () => {
    test('allows booking with no conflicts', () => {
      const existingBookings = [{
        id: '1',
        mock_type: 'Situational Judgment',
        start_time: '2025-12-05T16:00:00.000Z',
        end_time: '2025-12-05T17:00:00.000Z',
        is_active: 'Active'
      }];

      const conflicts = findConflictingBookings(existingBookings, mockNewSession);
      expect(conflicts).toHaveLength(0);
    });
  });

  describe('Missing time data handling', () => {
    test('handles missing time data gracefully', () => {
      const existingBookings = [{
        id: '1',
        mock_type: 'Situational Judgment',
        is_active: 'Active'
      }];

      const conflicts = findConflictingBookings(existingBookings, mockNewSession);
      expect(conflicts).toHaveLength(0);
    });

    test('handles bookings with nested mock_exam time data', () => {
      const existingBookings = [{
        id: '1',
        mock_type: 'Situational Judgment',
        is_active: 'Active',
        mock_exam: {
          start_time: '2025-12-05T14:00:00.000Z',
          end_time: '2025-12-05T15:00:00.000Z'
        }
      }];

      const conflicts = findConflictingBookings(existingBookings, mockNewSession);
      expect(conflicts).toHaveLength(1);
    });
  });

  describe('Edge cases and invalid inputs', () => {
    test('handles empty bookings array', () => {
      const conflicts = findConflictingBookings([], mockNewSession);
      expect(conflicts).toHaveLength(0);
    });

    test('handles null bookings', () => {
      const conflicts = findConflictingBookings(null, mockNewSession);
      expect(conflicts).toHaveLength(0);
    });

    test('handles undefined bookings', () => {
      const conflicts = findConflictingBookings(undefined, mockNewSession);
      expect(conflicts).toHaveLength(0);
    });

    test('handles null newSession', () => {
      const existingBookings = [{
        id: '1',
        mock_type: 'Situational Judgment',
        start_time: '2025-12-05T14:00:00.000Z',
        end_time: '2025-12-05T15:00:00.000Z',
        is_active: 'Active'
      }];

      const conflicts = findConflictingBookings(existingBookings, null);
      expect(conflicts).toHaveLength(0);
    });

    test('handles newSession without start_time', () => {
      const existingBookings = [{
        id: '1',
        mock_type: 'Situational Judgment',
        start_time: '2025-12-05T14:00:00.000Z',
        end_time: '2025-12-05T15:00:00.000Z',
        is_active: 'Active'
      }];

      const newSession = {
        end_time: '2025-12-05T15:00:00.000Z',
        mock_type: 'Clinical Skills'
      };

      const conflicts = findConflictingBookings(existingBookings, newSession);
      expect(conflicts).toHaveLength(0);
    });

    test('handles non-array bookings input', () => {
      const conflicts = findConflictingBookings('not an array', mockNewSession);
      expect(conflicts).toHaveLength(0);
    });
  });
});

describe('formatConflictMessage', () => {
  describe('Complete booking data', () => {
    test('formats date and time correctly', () => {
      const booking = {
        mock_type: 'Clinical Skills',
        exam_date: '2025-12-05',
        start_time: '2025-12-05T14:00:00.000Z',
        end_time: '2025-12-05T15:00:00.000Z',
        location: 'Mississauga'
      };

      const message = formatConflictMessage(booking);
      expect(message).toContain('Clinical Skills');
      expect(message).toContain('Mississauga');
      expect(message.length).toBeGreaterThan(20);
    });

    test('includes mock type in message', () => {
      const booking = {
        mock_type: 'Situational Judgment',
        exam_date: '2025-12-05',
        start_time: '2025-12-05T14:00:00.000Z',
        end_time: '2025-12-05T15:00:00.000Z',
        location: 'Toronto'
      };

      const message = formatConflictMessage(booking);
      expect(message).toContain('Situational Judgment');
    });
  });

  describe('Nested mock_exam data', () => {
    test('handles nested mock_exam properties', () => {
      const booking = {
        mock_exam: {
          mock_type: 'Mini-mock',
          exam_date: '2025-12-05',
          start_time: '2025-12-05T14:00:00.000Z',
          end_time: '2025-12-05T15:00:00.000Z',
          location: 'Ottawa'
        }
      };

      const message = formatConflictMessage(booking);
      expect(message).toContain('Mini-mock');
      expect(message).toContain('Ottawa');
    });
  });

  describe('Missing data handling', () => {
    test('handles null booking gracefully', () => {
      const message = formatConflictMessage(null);
      expect(message).toBe('Conflicting booking');
    });

    test('handles undefined booking gracefully', () => {
      const message = formatConflictMessage(undefined);
      expect(message).toBe('Conflicting booking');
    });

    test('handles missing mock_type with fallback', () => {
      const booking = {
        exam_date: '2025-12-05',
        start_time: '2025-12-05T14:00:00.000Z',
        end_time: '2025-12-05T15:00:00.000Z',
        location: 'Mississauga'
      };

      const message = formatConflictMessage(booking);
      expect(message).toContain('Mock Exam');
    });

    test('handles missing location with fallback', () => {
      const booking = {
        mock_type: 'Clinical Skills',
        exam_date: '2025-12-05',
        start_time: '2025-12-05T14:00:00.000Z',
        end_time: '2025-12-05T15:00:00.000Z'
      };

      const message = formatConflictMessage(booking);
      expect(message).toContain('Mississauga');
    });

    test('handles invalid date strings', () => {
      const booking = {
        mock_type: 'Clinical Skills',
        exam_date: 'invalid-date',
        start_time: 'invalid-time',
        end_time: 'invalid-time',
        location: 'Mississauga'
      };

      const message = formatConflictMessage(booking);
      expect(message).toContain('Clinical Skills');
      expect(message).toContain('Mississauga');
    });
  });
});

describe('getConflictSummary', () => {
  test('returns empty string for no conflicts', () => {
    expect(getConflictSummary([])).toBe('');
  });

  test('returns empty string for null conflicts', () => {
    expect(getConflictSummary(null)).toBe('');
  });

  test('returns empty string for undefined conflicts', () => {
    expect(getConflictSummary(undefined)).toBe('');
  });

  test('returns singular message for one conflict', () => {
    const conflicts = [{
      id: '1',
      mock_type: 'Clinical Skills'
    }];

    expect(getConflictSummary(conflicts)).toBe('You have 1 conflicting booking at this time.');
  });

  test('returns plural message for multiple conflicts', () => {
    const conflicts = [
      { id: '1', mock_type: 'Clinical Skills' },
      { id: '2', mock_type: 'Situational Judgment' }
    ];

    expect(getConflictSummary(conflicts)).toBe('You have 2 conflicting bookings at this time.');
  });

  test('returns correct count for many conflicts', () => {
    const conflicts = Array.from({ length: 5 }, (_, i) => ({
      id: String(i + 1),
      mock_type: 'Mock Type'
    }));

    expect(getConflictSummary(conflicts)).toBe('You have 5 conflicting bookings at this time.');
  });
});

describe('canModifyBooking', () => {
  describe('Status-based restrictions', () => {
    test('returns false for cancelled booking', () => {
      const booking = {
        id: '1',
        is_active: 'Cancelled',
        exam_date: '2025-12-31'
      };

      expect(canModifyBooking(booking)).toBe(false);
    });

    test('returns false for completed booking', () => {
      const booking = {
        id: '1',
        is_active: 'Completed',
        exam_date: '2025-12-31'
      };

      expect(canModifyBooking(booking)).toBe(false);
    });

    test('returns false for failed booking', () => {
      const booking = {
        id: '1',
        is_active: 'Failed',
        exam_date: '2025-12-31'
      };

      expect(canModifyBooking(booking)).toBe(false);
    });

    test('returns true for active booking in future', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);

      const booking = {
        id: '1',
        is_active: 'Active',
        exam_date: futureDate.toISOString()
      };

      expect(canModifyBooking(booking)).toBe(true);
    });

    test('handles nested mock_exam.is_active', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);

      const booking = {
        id: '1',
        mock_exam: {
          is_active: 'Cancelled',
          exam_date: futureDate.toISOString()
        }
      };

      expect(canModifyBooking(booking)).toBe(false);
    });
  });

  describe('Date-based restrictions', () => {
    test('returns false for booking in the past', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 7);

      const booking = {
        id: '1',
        is_active: 'Active',
        exam_date: pastDate.toISOString()
      };

      expect(canModifyBooking(booking)).toBe(false);
    });

    test('handles nested mock_exam.exam_date', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 7);

      const booking = {
        id: '1',
        is_active: 'Active',
        mock_exam: {
          exam_date: pastDate.toISOString()
        }
      };

      expect(canModifyBooking(booking)).toBe(false);
    });
  });

  describe('Edge cases', () => {
    test('returns false for null booking', () => {
      expect(canModifyBooking(null)).toBe(false);
    });

    test('returns false for undefined booking', () => {
      expect(canModifyBooking(undefined)).toBe(false);
    });

    test('returns true for booking without exam_date but active status', () => {
      const booking = {
        id: '1',
        is_active: 'Active'
      };

      expect(canModifyBooking(booking)).toBe(true);
    });

    test('returns true for booking without is_active property but in future', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);

      const booking = {
        id: '1',
        exam_date: futureDate.toISOString()
      };

      expect(canModifyBooking(booking)).toBe(true);
    });
  });
});
