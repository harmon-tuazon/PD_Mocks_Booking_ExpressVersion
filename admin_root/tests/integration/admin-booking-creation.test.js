/**
 * Integration Tests for Admin Booking Creation Endpoint
 * Tests the /api/admin/bookings/create endpoint with mocked dependencies
 */

// Mock dependencies before requiring modules
jest.mock('../../api/admin/middleware/requireAdmin', () => ({
  requireAdmin: jest.fn()
}));

// Create shared mock instance
const mockHubSpotInstance = {
  searchContacts: jest.fn(),
  getMockExam: jest.fn(),
  checkExistingBooking: jest.fn(),
  createBooking: jest.fn(),
  createAssociation: jest.fn(),
  updateMockExamBookings: jest.fn(),
  apiCall: jest.fn(),
  deleteBooking: jest.fn()
};

jest.mock('../../api/_shared/hubspot', () => {
  const mockHubSpotService = jest.fn().mockImplementation(() => mockHubSpotInstance);

  return {
    HubSpotService: mockHubSpotService,
    HUBSPOT_OBJECTS: {
      'contacts': '0-1',
      'bookings': '2-50158943',
      'mock_exams': '2-50158913'
    }
  };
});

jest.mock('../../api/_shared/cache', () => ({
  getCache: jest.fn(() => ({
    delete: jest.fn().mockResolvedValue(true),
    deletePattern: jest.fn().mockResolvedValue(true)
  }))
}));

const { requireAdmin } = require('../../api/admin/middleware/requireAdmin');
const { HubSpotService, HUBSPOT_OBJECTS } = require('../../api/_shared/hubspot');
const { getCache } = require('../../api/_shared/cache');
const createBookingEndpoint = require('../../api/admin/bookings/create');

describe('Admin Booking Creation Endpoint', () => {
  let req, res;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Mock console methods to suppress logs
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});

    // Setup request and response objects
    req = {
      body: {}
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };

    // Default mock implementations
    requireAdmin.mockResolvedValue({ email: 'admin@test.com' });
  });

  afterEach(() => {
    console.log.mockRestore();
    console.warn.mockRestore();
    console.error.mockRestore();
  });

  describe('Successful Booking Creation', () => {
    test('creates booking for Mock Discussion successfully', async () => {
      // Arrange
      req.body = {
        mock_exam_id: '12345678',
        student_id: 'ABC123',
        email: 'test@example.com',
        mock_type: 'Mock Discussion',
        exam_date: '2025-12-15'
      };

      const mockContact = {
        id: 'contact-123',
        properties: {
          firstname: 'John',
          lastname: 'Doe',
          email: 'test@example.com'
        }
      };

      const mockExam = {
        id: '12345678',
        properties: {
          mock_type: 'Mock Discussion',
          exam_date: '2025-12-15',
          location: 'Mississauga',
          is_active: 'true',
          capacity: '50',
          total_bookings: '10'
        }
      };

      const mockBooking = {
        id: 'booking-456',
        properties: {
          booking_id: 'Mock Discussion-John Doe-December 15, 2025'
        }
      };

      mockHubSpotInstance.searchContacts.mockResolvedValue(mockContact);
      mockHubSpotInstance.getMockExam.mockResolvedValue(mockExam);
      mockHubSpotInstance.checkExistingBooking.mockResolvedValue(false);
      mockHubSpotInstance.createBooking.mockResolvedValue(mockBooking);
      mockHubSpotInstance.createAssociation.mockResolvedValue({});
      mockHubSpotInstance.updateMockExamBookings.mockResolvedValue({});
      mockHubSpotInstance.apiCall.mockResolvedValue({ id: 'note-789' });

      // Act
      await createBookingEndpoint(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Admin booking created successfully',
          data: expect.objectContaining({
            booking_record_id: 'booking-456',
            contact_details: expect.objectContaining({
              contact_id: 'contact-123',
              student_id: 'ABC123'
            })
          })
        })
      );

      // Verify HubSpot calls
      expect(mockHubSpotInstance.searchContacts).toHaveBeenCalledWith('ABC123', 'test@example.com', 'Mock Discussion');
      expect(mockHubSpotInstance.getMockExam).toHaveBeenCalledWith('12345678');
      expect(mockHubSpotInstance.createBooking).toHaveBeenCalledWith(
        expect.objectContaining({
          tokenUsed: 'Admin Override'
        })
      );
      expect(mockHubSpotInstance.updateMockExamBookings).toHaveBeenCalledWith('12345678', 11);
    });

    test('creates booking for Clinical Skills with dominant_hand', async () => {
      // Arrange
      req.body = {
        mock_exam_id: '12345678',
        student_id: 'XYZ789',
        email: 'clinical@example.com',
        mock_type: 'Clinical Skills',
        exam_date: '2025-12-20',
        dominant_hand: 'Right'
      };

      const mockContact = {
        id: 'contact-456',
        properties: {
          firstname: 'Jane',
          lastname: 'Smith',
          email: 'clinical@example.com'
        }
      };

      const mockExam = {
        id: '12345678',
        properties: {
          mock_type: 'Clinical Skills',
          exam_date: '2025-12-20',
          location: 'Mississauga',
          is_active: 'true',
          capacity: '30',
          total_bookings: '5'
        }
      };

      const mockBooking = {
        id: 'booking-789',
        properties: {}
      };

      mockHubSpotInstance.searchContacts.mockResolvedValue(mockContact);
      mockHubSpotInstance.getMockExam.mockResolvedValue(mockExam);
      mockHubSpotInstance.checkExistingBooking.mockResolvedValue(false);
      mockHubSpotInstance.createBooking.mockResolvedValue(mockBooking);
      mockHubSpotInstance.createAssociation.mockResolvedValue({});
      mockHubSpotInstance.updateMockExamBookings.mockResolvedValue({});
      mockHubSpotInstance.apiCall.mockResolvedValue({ id: 'note-999' });

      // Act
      await createBookingEndpoint(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(201);
      expect(mockHubSpotInstance.createBooking).toHaveBeenCalledWith(
        expect.objectContaining({
          dominantHand: 'Right'
        })
      );
    });

    test('creates booking for Situational Judgment with attending_location', async () => {
      // Arrange
      req.body = {
        mock_exam_id: '12345678',
        student_id: 'TEST001',
        email: 'sj@example.com',
        mock_type: 'Situational Judgment',
        exam_date: '2025-12-25',
        attending_location: 'Calgary'
      };

      const mockContact = {
        id: 'contact-789',
        properties: {
          firstname: 'Test',
          lastname: 'User',
          email: 'sj@example.com'
        }
      };

      const mockExam = {
        id: '12345678',
        properties: {
          mock_type: 'Situational Judgment',
          exam_date: '2025-12-25',
          location: 'Calgary',
          is_active: 'true',
          capacity: '40',
          total_bookings: '15'
        }
      };

      const mockBooking = {
        id: 'booking-321',
        properties: {}
      };

      mockHubSpotInstance.searchContacts.mockResolvedValue(mockContact);
      mockHubSpotInstance.getMockExam.mockResolvedValue(mockExam);
      mockHubSpotInstance.checkExistingBooking.mockResolvedValue(false);
      mockHubSpotInstance.createBooking.mockResolvedValue(mockBooking);
      mockHubSpotInstance.createAssociation.mockResolvedValue({});
      mockHubSpotInstance.updateMockExamBookings.mockResolvedValue({});
      mockHubSpotInstance.apiCall.mockResolvedValue({ id: 'note-111' });

      // Act
      await createBookingEndpoint(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(201);
      expect(mockHubSpotInstance.createBooking).toHaveBeenCalledWith(
        expect.objectContaining({
          attendingLocation: 'Calgary'
        })
      );
    });
  });

  describe('Admin Override Behavior', () => {
    test('creates booking beyond capacity with warning', async () => {
      // Arrange
      req.body = {
        mock_exam_id: '12345678',
        student_id: 'FULL001',
        email: 'full@example.com',
        mock_type: 'Mock Discussion',
        exam_date: '2025-12-30'
      };

      const mockContact = {
        id: 'contact-full',
        properties: {
          firstname: 'Full',
          lastname: 'Capacity',
          email: 'full@example.com'
        }
      };

      const mockExam = {
        id: '12345678',
        properties: {
          mock_type: 'Mock Discussion',
          exam_date: '2025-12-30',
          location: 'Mississauga',
          is_active: 'true',
          capacity: '20',
          total_bookings: '20' // Already at capacity
        }
      };

      const mockBooking = {
        id: 'booking-full',
        properties: {}
      };

      mockHubSpotInstance.searchContacts.mockResolvedValue(mockContact);
      mockHubSpotInstance.getMockExam.mockResolvedValue(mockExam);
      mockHubSpotInstance.checkExistingBooking.mockResolvedValue(false);
      mockHubSpotInstance.createBooking.mockResolvedValue(mockBooking);
      mockHubSpotInstance.createAssociation.mockResolvedValue({});
      mockHubSpotInstance.updateMockExamBookings.mockResolvedValue({});
      mockHubSpotInstance.apiCall.mockResolvedValue({ id: 'note-full' });

      // Act
      await createBookingEndpoint(req, res);

      // Assert - Should succeed despite capacity
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          meta: expect.objectContaining({
            admin_override: true,
            bypass_warnings: expect.arrayContaining(['Capacity limit bypassed'])
          })
        })
      );

      // Verify warning was logged
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('[ADMIN OVERRIDE]'),
        expect.any(Object)
      );
    });

    test('uses "Admin Override" as token value', async () => {
      // Arrange
      req.body = {
        mock_exam_id: '12345678',
        student_id: 'TOKEN001',
        email: 'token@example.com',
        mock_type: 'Mock Discussion',
        exam_date: '2025-12-31'
      };

      const mockContact = {
        id: 'contact-token',
        properties: {
          firstname: 'Token',
          lastname: 'Test',
          email: 'token@example.com'
        }
      };

      const mockExam = {
        id: '12345678',
        properties: {
          mock_type: 'Mock Discussion',
          exam_date: '2025-12-31',
          location: 'Mississauga',
          is_active: 'true',
          capacity: '50',
          total_bookings: '10'
        }
      };

      const mockBooking = {
        id: 'booking-token',
        properties: {}
      };

      mockHubSpotInstance.searchContacts.mockResolvedValue(mockContact);
      mockHubSpotInstance.getMockExam.mockResolvedValue(mockExam);
      mockHubSpotInstance.checkExistingBooking.mockResolvedValue(false);
      mockHubSpotInstance.createBooking.mockResolvedValue(mockBooking);
      mockHubSpotInstance.createAssociation.mockResolvedValue({});
      mockHubSpotInstance.updateMockExamBookings.mockResolvedValue({});
      mockHubSpotInstance.apiCall.mockResolvedValue({ id: 'note-token' });

      // Act
      await createBookingEndpoint(req, res);

      // Assert
      expect(mockHubSpotInstance.createBooking).toHaveBeenCalledWith(
        expect.objectContaining({
          tokenUsed: 'Admin Override'
        })
      );
    });
  });

  describe('Error Handling', () => {
    test('returns 404 when contact not found', async () => {
      // Arrange
      req.body = {
        mock_exam_id: '12345678',
        student_id: 'NOTFOUND',
        email: 'notfound@example.com',
        mock_type: 'Mock Discussion',
        exam_date: '2025-12-15'
      };

      mockHubSpotInstance.searchContacts.mockResolvedValue(null);

      // Act
      await createBookingEndpoint(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'CONTACT_NOT_FOUND'
          })
        })
      );
    });

    test('returns 404 when mock exam not found', async () => {
      // Arrange
      req.body = {
        mock_exam_id: 'INVALID',
        student_id: 'ABC123',
        email: 'test@example.com',
        mock_type: 'Mock Discussion',
        exam_date: '2025-12-15'
      };

      const mockContact = {
        id: 'contact-123',
        properties: {
          firstname: 'John',
          lastname: 'Doe',
          email: 'test@example.com'
        }
      };

      mockHubSpotInstance.searchContacts.mockResolvedValue(mockContact);
      mockHubSpotInstance.getMockExam.mockResolvedValue(null);

      // Act
      await createBookingEndpoint(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'EXAM_NOT_FOUND'
          })
        })
      );
    });

    test('returns 400 when mock exam is inactive', async () => {
      // Arrange
      req.body = {
        mock_exam_id: '12345678',
        student_id: 'ABC123',
        email: 'test@example.com',
        mock_type: 'Mock Discussion',
        exam_date: '2025-12-15'
      };

      const mockContact = {
        id: 'contact-123',
        properties: {
          firstname: 'John',
          lastname: 'Doe',
          email: 'test@example.com'
        }
      };

      const mockExam = {
        id: '12345678',
        properties: {
          mock_type: 'Mock Discussion',
          exam_date: '2025-12-15',
          location: 'Mississauga',
          is_active: 'false', // Inactive
          capacity: '50',
          total_bookings: '10'
        }
      };

      mockHubSpotInstance.searchContacts.mockResolvedValue(mockContact);
      mockHubSpotInstance.getMockExam.mockResolvedValue(mockExam);

      // Act
      await createBookingEndpoint(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'EXAM_NOT_ACTIVE'
          })
        })
      );
    });

    test('returns 409 when duplicate booking exists', async () => {
      // Arrange
      req.body = {
        mock_exam_id: '12345678',
        student_id: 'DUP123',
        email: 'duplicate@example.com',
        mock_type: 'Mock Discussion',
        exam_date: '2025-12-15'
      };

      const mockContact = {
        id: 'contact-dup',
        properties: {
          firstname: 'Duplicate',
          lastname: 'User',
          email: 'duplicate@example.com'
        }
      };

      const mockExam = {
        id: '12345678',
        properties: {
          mock_type: 'Mock Discussion',
          exam_date: '2025-12-15',
          location: 'Mississauga',
          is_active: 'true',
          capacity: '50',
          total_bookings: '10'
        }
      };

      mockHubSpotInstance.searchContacts.mockResolvedValue(mockContact);
      mockHubSpotInstance.getMockExam.mockResolvedValue(mockExam);
      mockHubSpotInstance.checkExistingBooking.mockResolvedValue(true);

      // Act
      await createBookingEndpoint(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'DUPLICATE_BOOKING'
          })
        })
      );
    });

    test('handles booking creation failure with cleanup', async () => {
      // Arrange
      req.body = {
        mock_exam_id: '12345678',
        student_id: 'FAIL123',
        email: 'fail@example.com',
        mock_type: 'Mock Discussion',
        exam_date: '2025-12-15'
      };

      const mockContact = {
        id: 'contact-fail',
        properties: {
          firstname: 'Fail',
          lastname: 'Test',
          email: 'fail@example.com'
        }
      };

      const mockExam = {
        id: '12345678',
        properties: {
          mock_type: 'Mock Discussion',
          exam_date: '2025-12-15',
          location: 'Mississauga',
          is_active: 'true',
          capacity: '50',
          total_bookings: '10'
        }
      };

      const mockBooking = {
        id: 'booking-fail',
        properties: {}
      };

      mockHubSpotInstance.searchContacts.mockResolvedValue(mockContact);
      mockHubSpotInstance.getMockExam.mockResolvedValue(mockExam);
      mockHubSpotInstance.checkExistingBooking.mockResolvedValue(false);
      // Booking creation fails - this should trigger cleanup
      mockHubSpotInstance.createBooking.mockRejectedValue(new Error('Booking creation failed'));
      mockHubSpotInstance.deleteBooking = jest.fn().mockResolvedValue({});

      // Act
      await createBookingEndpoint(req, res);

      // Assert - Should handle error gracefully and not call deleteBooking (booking wasn't created)
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false
        })
      );
      // deleteBooking should not be called because booking creation failed before it was created
      expect(mockHubSpotInstance.deleteBooking).not.toHaveBeenCalled();
    });

    test('handles authentication failure', async () => {
      // Arrange
      req.body = {
        mock_exam_id: '12345678',
        student_id: 'ABC123',
        email: 'test@example.com',
        mock_type: 'Mock Discussion',
        exam_date: '2025-12-15'
      };

      requireAdmin.mockRejectedValue(new Error('Unauthorized'));

      // Act
      await createBookingEndpoint(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false
        })
      );
    });
  });

  describe('Cache Invalidation', () => {
    test('invalidates all relevant caches after successful booking', async () => {
      // Arrange
      req.body = {
        mock_exam_id: '12345678',
        student_id: 'CACHE001',
        email: 'cache@example.com',
        mock_type: 'Mock Discussion',
        exam_date: '2025-12-15'
      };

      const mockContact = {
        id: 'contact-cache',
        properties: {
          firstname: 'Cache',
          lastname: 'Test',
          email: 'cache@example.com'
        }
      };

      const mockExam = {
        id: '12345678',
        properties: {
          mock_type: 'Mock Discussion',
          exam_date: '2025-12-15',
          location: 'Mississauga',
          is_active: 'true',
          capacity: '50',
          total_bookings: '10'
        }
      };

      const mockBooking = {
        id: 'booking-cache',
        properties: {}
      };

      const mockCache = {
        delete: jest.fn().mockResolvedValue(true),
        deletePattern: jest.fn().mockResolvedValue(true)
      };

      getCache.mockReturnValue(mockCache);

      mockHubSpotInstance.searchContacts.mockResolvedValue(mockContact);
      mockHubSpotInstance.getMockExam.mockResolvedValue(mockExam);
      mockHubSpotInstance.checkExistingBooking.mockResolvedValue(false);
      mockHubSpotInstance.createBooking.mockResolvedValue(mockBooking);
      mockHubSpotInstance.createAssociation.mockResolvedValue({});
      mockHubSpotInstance.updateMockExamBookings.mockResolvedValue({});
      mockHubSpotInstance.apiCall.mockResolvedValue({ id: 'note-cache' });

      // Act
      await createBookingEndpoint(req, res);

      // Assert
      expect(mockCache.deletePattern).toHaveBeenCalledWith('bookings:contact:contact-cache:*');
      expect(mockCache.delete).toHaveBeenCalledWith('admin:mock-exam:details:12345678');
      expect(mockCache.deletePattern).toHaveBeenCalledWith('admin:mock-exam:12345678:bookings:*');
      expect(mockCache.deletePattern).toHaveBeenCalledWith('admin:aggregates:*');
    });
  });

  describe('Audit Trail', () => {
    test('creates comprehensive audit note with 3 associations', async () => {
      // Arrange
      req.body = {
        mock_exam_id: '12345678',
        student_id: 'AUDIT001',
        email: 'audit@example.com',
        mock_type: 'Mock Discussion',
        exam_date: '2025-12-15'
      };

      const mockContact = {
        id: 'contact-audit',
        properties: {
          firstname: 'Audit',
          lastname: 'Test',
          email: 'audit@example.com'
        }
      };

      const mockExam = {
        id: '12345678',
        properties: {
          mock_type: 'Mock Discussion',
          exam_date: '2025-12-15',
          location: 'Mississauga',
          is_active: 'true',
          capacity: '50',
          total_bookings: '10'
        }
      };

      const mockBooking = {
        id: 'booking-audit',
        properties: {}
      };

      const mockNote = { id: 'note-audit' };

      mockHubSpotInstance.searchContacts.mockResolvedValue(mockContact);
      mockHubSpotInstance.getMockExam.mockResolvedValue(mockExam);
      mockHubSpotInstance.checkExistingBooking.mockResolvedValue(false);
      mockHubSpotInstance.createBooking.mockResolvedValue(mockBooking);
      mockHubSpotInstance.createAssociation.mockResolvedValue({});
      mockHubSpotInstance.updateMockExamBookings.mockResolvedValue({});

      // Mock note creation and associations
      mockHubSpotInstance.apiCall
        .mockResolvedValueOnce(mockNote) // Note creation
        .mockResolvedValueOnce({}) // Contact association
        .mockResolvedValueOnce({}) // Mock Exam association
        .mockResolvedValueOnce({}); // Booking association

      // Act
      await createBookingEndpoint(req, res);

      // Assert - Verify note was created
      expect(mockHubSpotInstance.apiCall).toHaveBeenCalledWith(
        'POST',
        '/crm/v3/objects/notes',
        expect.objectContaining({
          properties: expect.objectContaining({
            hs_note_body: expect.stringContaining('Admin Booking Created')
          })
        })
      );

      // Verify 3 association calls (Contact, Mock Exam, Booking)
      const associationCalls = mockHubSpotInstance.apiCall.mock.calls.filter(
        call => call[0] === 'PUT' && call[1].includes('associations')
      );
      expect(associationCalls).toHaveLength(3);
    });
  });
});
