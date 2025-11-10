/**
 * Unit Tests for RefundService
 * Tests token refund functionality for booking cancellations
 */

// Mock hubspot before requiring refund service
jest.mock('../../api/_shared/hubspot', () => {
  const mockApiCall = jest.fn();
  return {
    apiCall: mockApiCall,
    HUBSPOT_OBJECTS: {
      'contacts': '0-1',
      'bookings': '2-50158943'
    }
  };
});
const hubspot = require('../../api/_shared/hubspot');
const refundService = require('../../api/_shared/refund');

describe('RefundService Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    console.log.mockRestore();
    console.warn.mockRestore();
    console.error.mockRestore();
  });

  describe('getTokenPropertyName', () => {
    test('maps Mock Discussion Token correctly', () => {
      const result = refundService.getTokenPropertyName('Mock Discussion Token');
      expect(result).toBe('mock_discussion_token');
    });

    test('maps Clinical Skills Token correctly', () => {
      const result = refundService.getTokenPropertyName('Clinical Skills Token');
      expect(result).toBe('cs_credits');
    });

    test('maps Situational Judgment Token correctly', () => {
      const result = refundService.getTokenPropertyName('Situational Judgment Token');
      expect(result).toBe('sj_credits');
    });

    test('maps Mini-mock Token correctly', () => {
      const result = refundService.getTokenPropertyName('Mini-mock Token');
      expect(result).toBe('sjmini_credits');
    });

    test('returns null for unknown token type', () => {
      const result = refundService.getTokenPropertyName('Unknown Token');
      expect(result).toBeNull();
    });
  });

  describe('validateRefundEligibility', () => {
    test('returns eligible for valid booking', () => {
      const booking = {
        id: '123',
        properties: {
          token_used: 'Mock Discussion Token',
          associated_contact_id: '456',
          token_refunded: 'false'
        }
      };

      const result = refundService.validateRefundEligibility(booking);
      expect(result.eligible).toBe(true);
    });

    test('returns not eligible if token_used missing', () => {
      const booking = {
        id: '123',
        properties: {
          associated_contact_id: '456'
        }
      };

      const result = refundService.validateRefundEligibility(booking);
      expect(result.eligible).toBe(false);
    });

    test('returns not eligible if already refunded', () => {
      const booking = {
        id: '123',
        properties: {
          token_used: 'Mock Discussion Token',
          associated_contact_id: '456',
          token_refunded: 'true'
        }
      };

      const result = refundService.validateRefundEligibility(booking);
      expect(result.eligible).toBe(false);
    });
  });

  describe('groupBookingsByTokenType', () => {
    test('groups bookings correctly', () => {
      const bookings = [
        { id: '1', properties: { token_used: 'Mock Discussion Token', associated_contact_id: '101' } },
        { id: '2', properties: { token_used: 'Clinical Skills Token', associated_contact_id: '102' } },
        { id: '3', properties: { token_used: 'Mock Discussion Token', associated_contact_id: '103' } }
      ];

      const grouped = refundService.groupBookingsByTokenType(bookings);

      expect(Object.keys(grouped)).toHaveLength(2);
      expect(grouped['mock_discussion_token']).toHaveLength(2);
      expect(grouped['cs_credits']).toHaveLength(1);
    });
  });

  describe('processRefunds', () => {
    test('processes valid refunds successfully', async () => {
      const bookings = [
        {
          id: 'booking-1',
          properties: {
            token_used: 'Mock Discussion Token',
            associated_contact_id: '101',
            token_refunded: 'false'
          }
        }
      ];

      hubspot.apiCall
        .mockResolvedValueOnce({
          results: [{ id: '101', properties: { mock_discussion_token: '5' } }]
        })
        .mockResolvedValueOnce({
          results: [{ id: '101', updatedAt: new Date().toISOString() }]
        })
        .mockResolvedValueOnce({
          results: [{ id: 'booking-1', updatedAt: new Date().toISOString() }]
        });

      const results = await refundService.processRefunds(bookings, 'admin@test.com');

      expect(results.successful).toHaveLength(1);
      expect(results.failed).toHaveLength(0);
      expect(results.skipped).toHaveLength(0);
    });

    test('skips bookings without tokens', async () => {
      const bookings = [
        {
          id: 'booking-1',
          properties: {
            associated_contact_id: '101'
          }
        }
      ];

      const results = await refundService.processRefunds(bookings, 'admin@test.com');

      expect(results.skipped).toHaveLength(1);
    });
  });
});
