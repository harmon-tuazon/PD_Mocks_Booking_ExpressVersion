/**
 * Admin API - List Users Endpoint
 * GET /api/users
 */

const { HubSpotService } = require('../_shared/hubspot');
const { verifyAdminToken, requirePermission } = require('../_shared/admin-auth');
const { logAdminAction } = require('../_shared/audit-log');
const Joi = require('joi');

// Query schema
const querySchema = Joi.object({
  page: Joi.number().min(1).default(1),
  limit: Joi.number().min(1).max(100).default(20),
  search: Joi.string().allow('').optional(),
  sortBy: Joi.string().valid('created_at', 'email', 'last_login').default('created_at'),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
  hasBookings: Joi.boolean().optional(),
  creditsMin: Joi.number().min(0).optional(),
  creditsMax: Joi.number().min(0).optional()
});

module.exports = [
  verifyAdminToken,
  requirePermission('users:read'),
  async (req, res) => {
    try {
      // Validate query parameters
      const { error, value: query } = querySchema.validate(req.query);
      if (error) {
        return res.status(400).json({
          error: 'Invalid query parameters',
          details: error.details[0].message
        });
      }

      // Build HubSpot filters
      const filters = [];

      // Search filter (email or name)
      if (query.search) {
        filters.push({
          propertyName: 'email',
          operator: 'CONTAINS',
          value: query.search
        });
      }

      // Credits range filter
      if (query.creditsMin !== undefined) {
        filters.push({
          propertyName: 'mock_exam_tokens',
          operator: 'GTE',
          value: query.creditsMin
        });
      }

      if (query.creditsMax !== undefined) {
        filters.push({
          propertyName: 'mock_exam_tokens',
          operator: 'LTE',
          value: query.creditsMax
        });
      }

      // Fetch contacts from HubSpot
      const contacts = await HubSpotService.searchContacts(
        filters,
        [
          'email',
          'firstname',
          'lastname',
          'mock_exam_tokens',
          'mock_discussion_tokens',
          'createdate',
          'lastmodifieddate',
          'hs_object_id'
        ],
        query.limit,
        (query.page - 1) * query.limit
      );

      // Get booking counts if requested
      if (query.hasBookings !== undefined) {
        // This would need to be implemented based on your booking association logic
        // For now, we'll add a placeholder
        contacts.results = contacts.results.map(contact => ({
          ...contact,
          bookingCount: 0 // Would be fetched from bookings
        }));
      }

      // Format response
      const users = contacts.results.map(contact => ({
        id: contact.properties.hs_object_id,
        email: contact.properties.email,
        firstName: contact.properties.firstname || '',
        lastName: contact.properties.lastname || '',
        fullName: `${contact.properties.firstname || ''} ${contact.properties.lastname || ''}`.trim(),
        credits: {
          mockExams: parseInt(contact.properties.mock_exam_tokens) || 0,
          mockDiscussions: parseInt(contact.properties.mock_discussion_tokens) || 0
        },
        createdAt: contact.properties.createdate,
        lastModified: contact.properties.lastmodifieddate,
        bookingCount: contact.bookingCount || 0
      }));

      // Sort results
      users.sort((a, b) => {
        let compareValue = 0;
        switch (query.sortBy) {
          case 'email':
            compareValue = a.email.localeCompare(b.email);
            break;
          case 'created_at':
            compareValue = new Date(a.createdAt) - new Date(b.createdAt);
            break;
          case 'last_login':
            compareValue = new Date(a.lastModified) - new Date(b.lastModified);
            break;
        }
        return query.sortOrder === 'asc' ? compareValue : -compareValue;
      });

      // Log admin action
      await logAdminAction(req.admin.id, 'LIST_USERS', {
        query,
        resultCount: users.length,
        ip: req.ip,
        userAgent: req.headers['user-agent']
      });

      // Return paginated response
      res.json({
        success: true,
        data: {
          users,
          pagination: {
            page: query.page,
            limit: query.limit,
            total: contacts.total || users.length,
            totalPages: Math.ceil((contacts.total || users.length) / query.limit)
          },
          filters: {
            search: query.search || null,
            hasBookings: query.hasBookings || null,
            creditsRange: {
              min: query.creditsMin || null,
              max: query.creditsMax || null
            }
          }
        }
      });

    } catch (error) {
      console.error('Error listing users:', error);

      // Log failed action
      await logAdminAction(req.admin.id, 'LIST_USERS_FAILED', {
        error: error.message,
        ip: req.ip
      });

      res.status(500).json({
        error: 'Failed to list users',
        code: 'LIST_USERS_ERROR'
      });
    }
  }
];