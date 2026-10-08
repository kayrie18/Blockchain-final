const { EmailDelivery } = require("../models/EmailDelivery");
const { processPendingDeliveries } = require("../services/emailService");
const { AuditLog } = require("../models/AuditLog");

async function processPending(req, res, next) {
  try {
    const limit = Number(req.query?.limit) || 20;
    const result = await processPendingDeliveries(limit);

    await AuditLog.create({
      userId: req.auth.userId,
      userName: req.auth.userName || "Admin",
      action: "email_process_pending",
      details: `Processed ${result.processed || 0} pending email deliveries`,
      type: "info",
      metadata: { processedCount: result.processed, reason: result.reason },
    });

    return res.status(200).json({
      status: "ok",
      processed: result.processed,
      reason: result.reason || null,
    });
  } catch (err) {
    return next(err);
  }
}

async function listDeliveries(req, res, next) {
  try {
    const status = String(req.query?.status || "").trim() || null;
    const limit = Math.min(Number(req.query?.limit) || 50, 500);
    const skip = Math.max(Number(req.query?.skip) || 0, 0);

    const query = status ? { status } : {};
    const deliveries = await EmailDelivery.find(query)
      .select("-html -text")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean()
      .exec();

    const total = await EmailDelivery.countDocuments(query).exec();

    return res.status(200).json({
      items: deliveries,
      pagination: { skip, limit, total },
    });
  } catch (err) {
    return next(err);
  }
}

async function resendDelivery(req, res, next) {
  try {
    const deliveryId = String(req.params.deliveryId || "").trim();
    if (!deliveryId) {
      return res.status(400).json({ error: { message: "deliveryId is required" } });
    }

    const delivery = await EmailDelivery.findById(deliveryId).exec();
    if (!delivery) {
      return res.status(404).json({ error: { message: "EmailDelivery not found" } });
    }
    if (delivery.metadata?.type === "hash_share") {
      return res.status(409).json({ error: { message: "This hash-sharing email cannot be resent because its message content is intentionally not retained" } });
    }

    // Reset delivery to pending and clear status
    delivery.status = "pending";
    delivery.attempts = [];
    delivery.lastAttemptAt = null;
    await delivery.save();

    await AuditLog.create({
      userId: req.auth.userId,
      userName: req.auth.userName || "Admin",
      action: "email_resend_delivery",
      details: `Queued email to ${delivery.to} for resend (subject: ${delivery.subject})`,
      type: "info",
      metadata: { deliveryId, to: delivery.to },
    });

    return res.status(200).json({ status: "queued", deliveryId, to: delivery.to });
  } catch (err) {
    return next(err);
  }
}

async function getDeliveryPreview(req, res, next) {
  try {
    const deliveryId = String(req.params.deliveryId || "").trim();
    if (!deliveryId) {
      return res.status(400).json({ error: { message: "deliveryId is required" } });
    }

    const delivery = await EmailDelivery.findById(deliveryId).lean().exec();
    if (!delivery) {
      return res.status(404).json({ error: { message: "EmailDelivery not found" } });
    }

    const previewUrl = delivery.attempts?.[delivery.attempts.length - 1]?.info?.previewUrl || null;
    return res.status(200).json({
      deliveryId,
      to: delivery.to,
      subject: delivery.subject,
      status: delivery.status,
      previewUrl,
      attempts: delivery.attempts.length,
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  processPending,
  listDeliveries,
  resendDelivery,
  getDeliveryPreview,
};
