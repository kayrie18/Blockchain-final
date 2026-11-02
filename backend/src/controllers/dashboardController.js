const fs = require("fs/promises");
const path = require("path");
const { Document } = require("../models/Document");
const { User } = require("../models/User");
const { getLocalUploadDir } = require("../services/storageService");

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = Number(bytes);
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value.toFixed(2)} ${units[index]}`;
}

async function getUploadDirSize() {
  const root = path.resolve(getLocalUploadDir());
  try {
    const items = await fs.readdir(root, { withFileTypes: true });
    const totals = await Promise.all(
      items.map(async (item) => {
        if (!item.isFile()) return 0;
        const info = await fs.stat(path.join(root, item.name));
        return info.size;
      })
    );
    return totals.reduce((sum, value) => sum + value, 0);
  } catch (err) {
    return 0;
  }
}

async function getMetrics(req, res, next) {
  try {
    const filter = req.auth.role === "Admin"
      ? {}
      : req.auth.role === "Verifier"
        ? { issuingOrganization: req.user?.organization }
        : { uploadedBy: req.auth.userId };
    const totalDocuments = await Document.countDocuments(filter);
    const totalPending = await Document.countDocuments({ ...filter, status: "pending" });
    const verifiedDocuments = await Document.countDocuments({ ...filter, status: "verified", "blockchain.confirmed": true });
    const aggregate = await Document.aggregate([
      { $match: filter },
      { $group: { _id: null, totalBytes: { $sum: "$sizeBytes" } } },
    ]);
    const storedBytes = aggregate?.[0]?.totalBytes || 0;
    const since = new Date();
    since.setDate(1);
    since.setHours(0, 0, 0, 0);
    since.setMonth(since.getMonth() - 11);
    const monthly = await Document.aggregate([
      { $match: { ...filter, uploadDate: { $gte: since } } },
      {
        $group: {
          _id: { year: { $year: "$uploadDate" }, month: { $month: "$uploadDate" } },
          uploads: { $sum: 1 },
          verifications: { $sum: { $cond: [{ $and: [{ $eq: ["$status", "verified"] }, { $eq: ["$blockchain.confirmed", true] }] }, 1, 0] } },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]);
    const monthlyCounts = new Map(monthly.map((entry) => [`${entry._id.year}-${entry._id.month}`, entry]));
    const activity = Array.from({ length: 12 }, (_, index) => {
      const date = new Date(since.getFullYear(), since.getMonth() + index, 1);
      const entry = monthlyCounts.get(`${date.getFullYear()}-${date.getMonth() + 1}`);
      return {
        name: date.toLocaleString("en", { month: "short", year: "2-digit" }),
        Uploads: entry?.uploads || 0,
        Verifications: entry?.verifications || 0,
      };
    });
    const diskBytes = req.auth.role === "Admin" ? await getUploadDirSize() : storedBytes;

    return res.status(200).json({
      totalDocuments,
      totalVerified: verifiedDocuments,
      totalPending,
      totalIssuers: req.auth.role === "Admin" ? await User.countDocuments({ role: "Issuer" }) : null,
      storageUsedBytes: diskBytes,
      storageUsedHuman: formatBytes(diskBytes),
      storageDeclaredBytes: storedBytes,
      activity,
    });
  } catch (err) {
    return next(err);
  }
}

const { AuditLog } = require("../models/AuditLog");

async function getAuditLog(req, res, next) {
  try {
    const parsedLimit = Number(req.query?.limit);
    const parsedPage = Number(req.query?.page);
    const limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.min(parsedLimit, 50) : 20;
    const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.auth.role !== "Admin") {
      filter.userId = req.auth.userId;
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
      logs: logs.map((entry) => ({
        id: String(entry._id),
        userId: entry.userId ? String(entry.userId) : null,
        userName: entry.userName,
        action: entry.action,
        details: entry.details,
        type: entry.type,
        metadata: entry.metadata || {},
        timestamp: entry.timestamp,
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

module.exports = { getMetrics, getAuditLog };
