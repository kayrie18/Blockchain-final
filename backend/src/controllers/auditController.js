const { AuditLog } = require("../models/AuditLog");

/**
 * Fetch system audit logs with pagination and filters
 */
async function getLogs(req, res, next) {
  try {
    const parsedLimit = Number(req.query?.limit);
    const parsedPage = Number(req.query?.page);
    const limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.min(parsedLimit, 100) : 20;
    const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
    const skip = (page - 1) * limit;

    const filter = {};
    
    // Isolation: Users can only see their own logs unless they are Admin.
    if (req.auth.role !== "Admin") {
      filter.userId = req.auth.userId;
    } else {
      // Admins can filter by userId if provided in query, otherwise they see all.
      if (req.query.userId) {
        filter.userId = req.query.userId;
      }
    }

    if (req.query.type) {
      filter.type = req.query.type;
    }

    const [logs, total] = await Promise.all([
      AuditLog.find(filter)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      AuditLog.countDocuments(filter).exec(),
    ]);

    return res.status(200).json({
      logs: logs.map(l => ({
        id: String(l._id),
        ...l
      })),
      page: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 0,
      },
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * Helper to record an audit log entry internally
 */
async function logAction({ userId, userName, action, details, type, actionType, metadata }) {
  try {
    const entry = new AuditLog({
      userId,
      userName: userName || "System",
      action,
      details,
      type: type || "info",
      actionType: actionType || "official",
      metadata: metadata || {},
    });
    await entry.save();
    return entry;
  } catch (err) {
    console.error("Failed to record audit log:", err);
    // Don't throw, we don't want to break the main flow if logging fails
  }
}

module.exports = { getLogs, logAction };
