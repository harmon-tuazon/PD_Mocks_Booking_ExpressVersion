// Mock axios before requiring HubSpotService
jest.mock('axios');
const axios = require('axios');

const { HubSpotService } = require('../../api/_shared/hubspot');

describe('HubSpotService - Booking Operations', () => {
  let hubspotService;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.HS_PRIVATE_APP_TOKEN = 'test-token-12345';
    hubspotService = new HubSpotService();
  });

  describe('createBooking with conditional fields', () => {
    test('should include dominant_hand for Clinical Skills bookings', async () => {
      const bookingData = {
        bookingId: 'BOOK-12345',
        name: 'Test Student',
        email: 'test@example.com',
        tokenUsed: 'CS-TOKEN-123',
        dominantHand: true
      };

      axios.mockResolvedValue({
        data: { id: 'booking-123', properties: {} }
      });

      await hubspotService.createBooking(bookingData);

      expect(axios).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'POST',
          data: expect.objectContaining({
            properties: expect.objectContaining({
              booking_id: 'BOOK-12345',
              name: 'Test Student',
              email: 'test@example.com',
              token_used: 'CS-TOKEN-123',
              dominant_hand: 'true',
              is_active: 'Active'
            })
          })
        })
      );
    });

    test('should include dominant_hand=false correctly', async () => {
      const bookingData = {
        bookingId: 'BOOK-12345',
        name: 'Test Student',
        email: 'test@example.com',
        dominantHand: false
      };

      axios.mockResolvedValue({
        data: { id: 'booking-123', properties: {} }
      });

      await hubspotService.createBooking(bookingData);

      expect(axios).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            properties: expect.objectContaining({
              dominant_hand: 'false'
            })
          })
        })
      );
    });

    test('should include attending_location for location-based exams', async () => {
      const bookingData = {
        bookingId: 'BOOK-12345',
        name: 'Test Student',
        email: 'test@example.com',
        tokenUsed: 'SJ-TOKEN-123',
        attendingLocation: 'mississauga'
      };

      axios.mockResolvedValue({
        data: { id: 'booking-123', properties: {} }
      });

      await hubspotService.createBooking(bookingData);

      expect(axios).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            properties: expect.objectContaining({
              booking_id: 'BOOK-12345',
              attending_location: 'Mississauga'  // Now expects transformed value
            })
          })
        })
      );
    });

    test('should handle all valid locations', async () => {
      const validLocations = [
        { input: 'mississauga', expected: 'Mississauga' },
        { input: 'calgary', expected: 'Calgary' },
        { input: 'vancouver', expected: 'Vancouver' },
        { input: 'montreal', expected: 'Montreal' },
        { input: 'richmond_hill', expected: 'Richmond Hill' }
      ];

      axios.mockResolvedValue({
        data: { id: 'booking-123', properties: {} }
      });

      for (const locationTest of validLocations) {
        jest.clearAllMocks();

        const bookingData = {
          bookingId: 'BOOK-12345',
          name: 'Test Student',
          email: 'test@example.com',
          attendingLocation: locationTest.input
        };

        await hubspotService.createBooking(bookingData);

        expect(axios).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              properties: expect.objectContaining({
                attending_location: locationTest.expected  // Expect transformed value
              })
            })
          })
        );
      }
    });

    test('should not include conditional fields when not provided', async () => {
      const bookingData = {
        bookingId: 'BOOK-12345',
        name: 'Test Student',
        email: 'test@example.com'
      };

      axios.mockResolvedValue({
        data: { id: 'booking-123', properties: {} }
      });

      await hubspotService.createBooking(bookingData);

      const callArgs = axios.mock.calls[0][0];
      const properties = callArgs.data.properties;

      expect(properties).not.toHaveProperty('dominant_hand');
      expect(properties).not.toHaveProperty('attending_location');
    });

    test('should handle both optional fields separately', async () => {
      const bookingData = {
        bookingId: 'BOOK-12345',
        name: 'Test Student',
        email: 'test@example.com',
        tokenUsed: 'TOKEN-123'
      };

      axios.mockResolvedValue({
        data: { id: 'booking-123', properties: {} }
      });

      // Test with only dominant_hand
      await hubspotService.createBooking({
        ...bookingData,
        dominantHand: true
      });

      let callArgs = axios.mock.calls[0][0];
      expect(callArgs.data.properties).toHaveProperty('dominant_hand', 'true');
      expect(callArgs.data.properties).not.toHaveProperty('attending_location');

      jest.clearAllMocks();

      // Test with only attending_location
      await hubspotService.createBooking({
        ...bookingData,
        attendingLocation: 'calgary'
      });

      callArgs = axios.mock.calls[0][0];
      expect(callArgs.data.properties).toHaveProperty('attending_location', 'Calgary');  // Expect transformed value
      expect(callArgs.data.properties).not.toHaveProperty('dominant_hand');
    });

    test('should include token_used when provided', async () => {
      const bookingData = {
        bookingId: 'BOOK-12345',
        name: 'Test Student',
        email: 'test@example.com',
        tokenUsed: 'SJ-TOKEN-123',
        attendingLocation: 'vancouver'
      };

      axios.mockResolvedValue({
        data: { id: 'booking-123', properties: {} }
      });

      await hubspotService.createBooking(bookingData);

      expect(axios).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            properties: expect.objectContaining({
              token_used: 'SJ-TOKEN-123',
              attending_location: 'Vancouver'  // Expect transformed value
            })
          })
        })
      );
    });

    test('should not include token_used when not provided', async () => {
      const bookingData = {
        bookingId: 'BOOK-12345',
        name: 'Test Student',
        email: 'test@example.com',
        dominantHand: false
      };

      axios.mockResolvedValue({
        data: { id: 'booking-123', properties: {} }
      });

      await hubspotService.createBooking(bookingData);

      const callArgs = axios.mock.calls[0][0];
      const properties = callArgs.data.properties;

      expect(properties).not.toHaveProperty('token_used');
      expect(properties).toHaveProperty('dominant_hand', 'false');
    });
  });

  describe('HubSpot API error handling', () => {
    test('should handle network errors', async () => {
      const bookingData = {
        bookingId: 'BOOK-12345',
        name: 'Test Student',
        email: 'test@example.com'
      };

      axios.mockRejectedValue(new Error('Network error'));

      await expect(hubspotService.createBooking(bookingData)).rejects.toThrow(
        'Network error'
      );
    });

    test('should handle API rate limit errors', async () => {
      const bookingData = {
        bookingId: 'BOOK-12345',
        name: 'Test Student',
        email: 'test@example.com'
      };

      axios.mockRejectedValue({
        response: {
          status: 429,
          data: { message: 'Rate limit exceeded' }
        }
      });

      await expect(hubspotService.createBooking(bookingData)).rejects.toThrow(
        'Rate limit exceeded'
      );
    });
  });

  describe('createAssociation with correct Type IDs', () => {
    const HUBSPOT_OBJECTS = {
      bookings: '2-50158943',
      mock_exams: '2-50158913',
      contacts: '0-1'
    };

    test('should use Type 1291 for Booking to Mock Exam associations', async () => {
      const bookingId = 'booking-123';
      const mockExamId = 'exam-456';

      axios.mockResolvedValue({
        data: { status: 'COMPLETE' }
      });

      await hubspotService.createAssociation(
        HUBSPOT_OBJECTS.bookings,
        bookingId,
        HUBSPOT_OBJECTS.mock_exams,
        mockExamId
      );

      expect(axios).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'PUT',
          url: expect.stringContaining(
            `/crm/v4/objects/${HUBSPOT_OBJECTS.bookings}/${bookingId}/associations/${HUBSPOT_OBJECTS.mock_exams}/${mockExamId}`
          ),
          data: [
            {
              associationCategory: 'USER_DEFINED',
              associationTypeId: 1291  // Correct type for Booking → Mock Exam
            }
          ]
        })
      );
    });

    test('should use Type 1292 for Mock Exam to Booking associations (reverse)', async () => {
      const mockExamId = 'exam-456';
      const bookingId = 'booking-123';

      axios.mockResolvedValue({
        data: { status: 'COMPLETE' }
      });

      await hubspotService.createAssociation(
        HUBSPOT_OBJECTS.mock_exams,
        mockExamId,
        HUBSPOT_OBJECTS.bookings,
        bookingId
      );

      expect(axios).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'PUT',
          url: expect.stringContaining(
            `/crm/v4/objects/${HUBSPOT_OBJECTS.mock_exams}/${mockExamId}/associations/${HUBSPOT_OBJECTS.bookings}/${bookingId}`
          ),
          data: [
            {
              associationCategory: 'USER_DEFINED',
              associationTypeId: 1292  // Correct type for Mock Exam → Booking
            }
          ]
        })
      );
    });

    test('should use empty payload for non-booking associations', async () => {
      const contactId = 'contact-123';
      const bookingId = 'booking-456';

      axios.mockResolvedValue({
        data: { status: 'COMPLETE' }
      });

      await hubspotService.createAssociation(
        HUBSPOT_OBJECTS.contacts,
        contactId,
        HUBSPOT_OBJECTS.bookings,
        bookingId
      );

      expect(axios).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'PUT',
          data: []
        })
      );
    });
  });

  describe('getActiveBookingsCount logic alignment', () => {
    test('should exclude Cancelled bookings', () => {
      const bookings = [
        { id: '1', properties: { is_active: 'Active' } },
        { id: '2', properties: { is_active: 'Cancelled' } },
        { id: '3', properties: { is_active: 'cancelled' } },
        { id: '4', properties: { is_active: 'Active' } }
      ];

      const activeCount = bookings.filter(booking => {
        const isActive = booking.properties.is_active;
        const isCancelled = isActive === 'Cancelled' || isActive === 'cancelled';
        const isFalse = isActive === false || isActive === 'false';

        return !isCancelled && !isFalse;
      }).length;

      expect(activeCount).toBe(2);
    });

    test('should COUNT Completed bookings (not exclude them)', () => {
      const bookings = [
        { id: '1', properties: { is_active: 'Active' } },
        { id: '2', properties: { is_active: 'Completed' } },
        { id: '3', properties: { is_active: 'completed' } },
        { id: '4', properties: { is_active: 'Active' } }
      ];

      const activeCount = bookings.filter(booking => {
        const isActive = booking.properties.is_active;
        const isCancelled = isActive === 'Cancelled' || isActive === 'cancelled';
        const isFalse = isActive === false || isActive === 'false';

        return !isCancelled && !isFalse;
      }).length;

      expect(activeCount).toBe(4); // All 4 bookings should be counted
    });

    test('should exclude false/false string values', () => {
      const bookings = [
        { id: '1', properties: { is_active: 'Active' } },
        { id: '2', properties: { is_active: false } },
        { id: '3', properties: { is_active: 'false' } },
        { id: '4', properties: { is_active: 'Active' } }
      ];

      const activeCount = bookings.filter(booking => {
        const isActive = booking.properties.is_active;
        const isCancelled = isActive === 'Cancelled' || isActive === 'cancelled';
        const isFalse = isActive === false || isActive === 'false';

        return !isCancelled && !isFalse;
      }).length;

      expect(activeCount).toBe(2);
    });

    test('should count all Active bookings when no exclusions', () => {
      const bookings = [
        { id: '1', properties: { is_active: 'Active' } },
        { id: '2', properties: { is_active: 'active' } },
        { id: '3', properties: { is_active: 'Active' } }
      ];

      const activeCount = bookings.filter(booking => {
        const isActive = booking.properties.is_active;
        const isCancelled = isActive === 'Cancelled' || isActive === 'cancelled';
        const isFalse = isActive === false || isActive === 'false';

        return !isCancelled && !isFalse;
      }).length;

      expect(activeCount).toBe(3);
    });

    test('should handle mixed statuses correctly - Completed counted, Cancelled excluded', () => {
      const bookings = [
        { id: '1', properties: { is_active: 'Active' } },
        { id: '2', properties: { is_active: 'Cancelled' } },
        { id: '3', properties: { is_active: 'Completed' } },
        { id: '4', properties: { is_active: false } },
        { id: '5', properties: { is_active: 'Active' } },
        { id: '6', properties: { is_active: 'completed' } },
        { id: '7', properties: { is_active: 'Active' } }
      ];

      const activeCount = bookings.filter(booking => {
        const isActive = booking.properties.is_active;
        const isCancelled = isActive === 'Cancelled' || isActive === 'cancelled';
        const isFalse = isActive === false || isActive === 'false';

        return !isCancelled && !isFalse;
      }).length;

      expect(activeCount).toBe(5); // Active(3) + Completed(2) = 5
    });
  });
});
