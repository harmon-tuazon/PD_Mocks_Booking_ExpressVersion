/**
 * Audit Logging Service
 * Tracks all admin actions for compliance and security
 */

const { HubSpotService } = require('./hubspot');

// Log admin action to HubSpot timeline
const logAdminAction = async (adminId, action, details = {}) => {
  try {
    const timestamp = new Date().toISOString();

    // Create audit log entry
    const auditEntry = {
      timestamp,
      adminId,
      action,
      details,
      ip: details.ip || 'unknown',
      userAgent: details.userAgent || 'unknown',
      success: details.success !== false
    };

    // Log to HubSpot deal timeline if dealId provided
    if (details.dealId) {
      const noteContent = formatAuditNote(auditEntry);
      await HubSpotService.addDealNote(details.dealId, noteContent);
    }

    // Also log to console for monitoring
    console.log('[ADMIN_AUDIT]', JSON.stringify(auditEntry));

    // Store in audit log custom object if configured
    if (process.env.HUBSPOT_AUDIT_LOG_OBJECT_ID) {
      await HubSpotService.createRecord(process.env.HUBSPOT_AUDIT_LOG_OBJECT_ID, {
        admin_id: adminId,
        action_type: action,
        action_details: JSON.stringify(details),
        timestamp: timestamp,
        ip_address: auditEntry.ip,
        user_agent: auditEntry.userAgent,
        success: auditEntry.success
      });
    }

    return { success: true, auditId: timestamp };
  } catch (error) {
    console.error('[ADMIN_AUDIT_ERROR]', error);
    // Don't throw - audit logging should not break the main operation
    return { success: false, error: error.message };
  }
};

// Format audit note for HubSpot timeline
const formatAuditNote = (auditEntry) => {
  const icon = auditEntry.success ? '🔧' : '⚠️';
  const status = auditEntry.success ? 'SUCCESS' : 'FAILED';

  let html = `
    <div style="font-family: monospace;">
      <h4>${icon} Admin Action: ${auditEntry.action}</h4>
      <table style="border-collapse: collapse;">
        <tr>
          <td style="padding: 4px; font-weight: bold;">Status:</td>
          <td style="padding: 4px;">${status}</td>
        </tr>
        <tr>
          <td style="padding: 4px; font-weight: bold;">Admin ID:</td>
          <td style="padding: 4px;">${auditEntry.adminId}</td>
        </tr>
        <tr>
          <td style="padding: 4px; font-weight: bold;">Timestamp:</td>
          <td style="padding: 4px;">${auditEntry.timestamp}</td>
        </tr>
        <tr>
          <td style="padding: 4px; font-weight: bold;">IP Address:</td>
          <td style="padding: 4px;">${auditEntry.ip}</td>
        </tr>`;

  // Add relevant details
  if (auditEntry.details.targetUserId) {
    html += `
        <tr>
          <td style="padding: 4px; font-weight: bold;">Target User:</td>
          <td style="padding: 4px;">${auditEntry.details.targetUserId}</td>
        </tr>`;
  }

  if (auditEntry.details.changes) {
    html += `
        <tr>
          <td style="padding: 4px; font-weight: bold;">Changes:</td>
          <td style="padding: 4px;"><pre>${JSON.stringify(auditEntry.details.changes, null, 2)}</pre></td>
        </tr>`;
  }

  html += `
      </table>
    </div>`;

  return html;
};

// Middleware to automatically log admin actions
const auditMiddleware = (actionName) => {
  return async (req, res, next) => {
    const startTime = Date.now();
    const originalSend = res.send;
    const originalJson = res.json;

    // Capture response
    let responseData = null;
    let statusCode = null;

    res.send = function(data) {
      responseData = data;
      statusCode = res.statusCode;
      originalSend.call(this, data);
    };

    res.json = function(data) {
      responseData = data;
      statusCode = res.statusCode;
      originalJson.call(this, data);
    };

    // Continue with request
    next();

    // Log after response
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      const success = statusCode >= 200 && statusCode < 300;

      logAdminAction(req.admin?.id || 'unknown', actionName, {
        method: req.method,
        path: req.path,
        query: req.query,
        body: req.body,
        statusCode,
        success,
        duration,
        ip: req.ip,
        userAgent: req.headers['user-agent']
      });
    });
  };
};

// Get audit logs for a specific entity
const getAuditLogs = async (entityType, entityId, limit = 50) => {
  try {
    if (!process.env.HUBSPOT_AUDIT_LOG_OBJECT_ID) {
      return { logs: [], message: 'Audit logging not configured' };
    }

    const filter = {
      propertyName: `${entityType}_id`,
      operator: 'EQ',
      value: entityId
    };

    const logs = await HubSpotService.searchRecords(
      process.env.HUBSPOT_AUDIT_LOG_OBJECT_ID,
      filter,
      ['admin_id', 'action_type', 'action_details', 'timestamp', 'success'],
      limit
    );

    return {
      logs: logs.map(log => ({
        adminId: log.properties.admin_id,
        action: log.properties.action_type,
        details: JSON.parse(log.properties.action_details || '{}'),
        timestamp: log.properties.timestamp,
        success: log.properties.success === 'true'
      })),
      total: logs.length
    };
  } catch (error) {
    console.error('[AUDIT_LOG_RETRIEVAL_ERROR]', error);
    return { logs: [], error: error.message };
  }
};

// Export audit report
const exportAuditReport = async (startDate, endDate, adminId = null) => {
  try {
    const filters = [
      {
        propertyName: 'timestamp',
        operator: 'GTE',
        value: startDate.toISOString()
      },
      {
        propertyName: 'timestamp',
        operator: 'LTE',
        value: endDate.toISOString()
      }
    ];

    if (adminId) {
      filters.push({
        propertyName: 'admin_id',
        operator: 'EQ',
        value: adminId
      });
    }

    const logs = await HubSpotService.searchRecordsWithFilters(
      process.env.HUBSPOT_AUDIT_LOG_OBJECT_ID,
      filters,
      ['admin_id', 'action_type', 'action_details', 'timestamp', 'success', 'ip_address'],
      1000
    );

    return {
      report: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        totalActions: logs.length,
        adminId: adminId || 'all',
        logs: logs.map(log => ({
          adminId: log.properties.admin_id,
          action: log.properties.action_type,
          details: JSON.parse(log.properties.action_details || '{}'),
          timestamp: log.properties.timestamp,
          success: log.properties.success === 'true',
          ip: log.properties.ip_address
        }))
      }
    };
  } catch (error) {
    console.error('[AUDIT_REPORT_ERROR]', error);
    throw error;
  }
};

module.exports = {
  logAdminAction,
  auditMiddleware,
  getAuditLogs,
  exportAuditReport
};