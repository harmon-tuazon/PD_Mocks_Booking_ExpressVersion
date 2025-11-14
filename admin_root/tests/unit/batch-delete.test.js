/**
 * Unit Tests for Batch Delete Mock Exam Sessions Endpoint
 * POST /api/admin/mock-exams/batch-delete
 */

jest.mock('../../api/admin/middleware/requireAdmin');
jest.mock('../../api/_shared/validation');
jest.mock('../../api/_shared/cache');
jest.mock('../../api/_shared/hubspot');

const batchDeleteHandler = require('../../api/admin/mock-exams/batch-delete');
const { requireAdmin } = require('../../api/admin/middleware/requireAdmin');
const { validationMiddleware } = require('../../api/_shared/validation');
const { getCache } = require('../../api/_shared/cache');
const hubspot = require('../../api/_shared/hubspot');

describe('Batch Delete Mock Exam Sessions', () => {
  let mockReq, mockRes, mockCache;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});

    mockReq = {
      method: 'POST',
      body: { sessionIds: ['123456', '123457'] },
      validatedData: { sessionIds: ['123456', '123457'] }
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };

    mockCache = { deletePattern: jest.fn().mockResolvedValue(true) };
    getCache.mockReturnValue(mockCache);
    requireAdmin.mockResolvedValue({ email: 'admin@prepdoctors.com', id: 'admin123' });
    validationMiddleware.mockImplementation(() => (req, res, next) => next());
    hubspot.apiCall = jest.fn();
    hubspot.getMockExamWithBookings = jest.fn();
  });

  afterEach(() => {
    console.log.mockRestore();
    console.warn.mockRestore();
    console.error.mockRestore();
  });

  describe('Authentication', () => {
    test('should require admin authentication', async () => {
      requireAdmin.mockRejectedValue(new Error('token invalid'));
      await batchDeleteHandler(mockReq, mockRes);
      expect(requireAdmin).toHaveBeenCalledWith(mockReq);
      expect(mockRes.status).toHaveBeenCalledWith(401);
    });
  });

  describe('Method Validation', () => {
    test('should reject non-POST requests', async () => {
      mockReq.method = 'GET';
      await batchDeleteHandler(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(405);
    });
  });

  describe('Batch Size Validation', () => {
    test('should reject more than 100 sessions', async () => {
      const sessionIds = Array.from({ length: 101 }, (_, i) => String(i));
      mockReq.validatedData.sessionIds = sessionIds;
      await batchDeleteHandler(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(400);
    });
  });

  describe('Booking Protection', () => {
    test('should block deletion of sessions with active bookings', async () => {
      hubspot.apiCall.mockResolvedValueOnce({
        results: [{ id: '123456', properties: { total_bookings: '3' } }]
      });
      hubspot.getMockExamWithBookings.mockResolvedValueOnce({
        id: '123456',
        bookings: [{ properties: { is_active: 'Active' } }]
      });
      mockReq.validatedData.sessionIds = ['123456'];
      await batchDeleteHandler(mockReq, mockRes);
      const response = mockRes.json.mock.calls[0][0];
      expect(response.deleted).toEqual([]);
      expect(response.failed).toContain('123456');
    });

    test('should allow deletion of sessions with no bookings', async () => {
      hubspot.apiCall
        .mockResolvedValueOnce({
          results: [{ id: '123456', properties: { total_bookings: '0' } }]
        })
        .mockResolvedValueOnce({
          results: [{ id: '123456' }]
        });
      mockReq.validatedData.sessionIds = ['123456'];
      await batchDeleteHandler(mockReq, mockRes);
      const response = mockRes.json.mock.calls[0][0];
      expect(response.deleted).toContain('123456');
    });
  });

  describe('Cache Invalidation', () => {
    test('should invalidate caches after successful deletion', async () => {
      hubspot.apiCall
        .mockResolvedValueOnce({
          results: [{ id: '123456', properties: { total_bookings: '0' } }]
        })
        .mockResolvedValueOnce({
          results: [{ id: '123456' }]
        });
      mockReq.validatedData.sessionIds = ['123456'];
      await batchDeleteHandler(mockReq, mockRes);
      expect(mockCache.deletePattern).toHaveBeenCalled();
    });
  });
});
