const { Document } = require("../models/Document");
const { isSha256Hex } = require("../services/verificationService");
const { logAction } = require("./auditController");

function computeVerificationStatus(doc) {
  if (!doc) return "Not Found";
  if (doc.isRevoked || doc.status === "revoked") return "Revoked";
  if (doc.status === "rejected") return "Rejected";
  if (doc.expiryDate && new Date(doc.expiryDate).getTime() < Date.now()) return "Expired";
  if (doc?.blockchain?.confirmed) return "Valid";
  if (doc?.blockchain?.transactionId) return "Pending";
  return "Not Found";
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function searchDocuments(req, res, next) {
  try {
    const {
      q,
      title,
      ownerName,
      issuingOrganization,
      documentType,
      uploadDateFrom,
      uploadDateTo,
      sha256Hash,
      blockchainTx,
    } = req.query || {};

    const parsedLimit = Number(req.query?.limit);
    const parsedPage = Number(req.query?.page);
    const limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.min(parsedLimit, 100) : 20;
    const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
    const skip = (page - 1) * limit;

    const allowedSortBy = new Set([
      "uploadDate",
      "createdAt",
      "updatedAt",
      "title",
      "ownerName",
      "issuingOrganization",
      "documentType",
    ]);
    const requestedSortBy = String(req.query?.sortBy || "uploadDate");
    const sortBy = allowedSortBy.has(requestedSortBy) ? requestedSortBy : "uploadDate";
    const sortDir = String(req.query?.sortDir || "desc").toLowerCase() === "asc" ? 1 : -1;
    const sort = { [sortBy]: sortDir, _id: -1 };

    const filter = {};

    if (req.auth) {
      if (req.auth.role === "User") {
        filter.uploadedBy = req.auth.userId;
      } else if (req.auth.role === "Issuer") {
        filter.uploadedBy = req.auth.userId;
      } else if (req.auth.role === "Verifier") {
        filter.issuingOrganization = req.user?.organization;
      }
    }

    if (sha256Hash) {
      filter.sha256Hash = String(sha256Hash).trim().toLowerCase();
    }

    if (blockchainTx) {
      filter["blockchain.transactionId"] = String(blockchainTx).trim();
    }

    // Support frontend filtering: ?status=verified (or other cases)
    const requestedStatus = typeof req.query?.status === 'string' ? req.query.status.trim() : null;
    if (requestedStatus) {
      const normalized = requestedStatus.toLowerCase();
      if (normalized === 'verified') {
        filter.status = 'verified';
      } else if (normalized === 'tampered') {
        return res.status(400).json({ error: { message: "Tampered is a verification result, not a stored document status" } });
      } else if (normalized === 'pending') {
        filter.status = 'pending';
      } else {
        // Fallback to direct match (supports other existing app statuses)
        filter.status = requestedStatus;
      }
    }

    const uploadDate = {};
    if (uploadDateFrom) {
      const d = new Date(uploadDateFrom);
      if (Number.isNaN(d.getTime())) {
        return res.status(400).json({ error: { message: "uploadDateFrom is invalid" } });
      }
      uploadDate.$gte = d;
    }
    if (uploadDateTo) {
      const d = new Date(uploadDateTo);
      if (Number.isNaN(d.getTime())) {
        return res.status(400).json({ error: { message: "uploadDateTo is invalid" } });
      }
      uploadDate.$lte = d;
    }
    if (Object.keys(uploadDate).length) {
      filter.uploadDate = uploadDate;
    }

    const and = [];
    const addRegex = (field, value) => {
      const v = String(value || "").trim();
      if (!v) return;
      and.push({ [field]: { $regex: escapeRegex(v), $options: "i" } });
    };

    addRegex("title", title);
    addRegex("ownerName", ownerName);
    addRegex("issuingOrganization", issuingOrganization);
    addRegex("documentType", documentType);

    const quick = String(q || "").trim();
    if (quick) {
      // Prefer text search when possible; fallback to regex OR if text index isn’t used by Mongo for any reason.
      // Note: cannot mix $text with other regex clauses efficiently; keep it simple.
      and.push({
        $or: [
          { title: { $regex: escapeRegex(quick), $options: "i" } },
          { ownerName: { $regex: escapeRegex(quick), $options: "i" } },
          { issuingOrganization: { $regex: escapeRegex(quick), $options: "i" } },
          { documentType: { $regex: escapeRegex(quick), $options: "i" } },
          { sha256Hash: { $regex: escapeRegex(quick.toLowerCase()), $options: "i" } },
          { "blockchain.transactionId": { $regex: escapeRegex(quick), $options: "i" } },
        ],
      });
    }

    if (and.length) filter.$and = and;

    const projection =
      "title ownerName issuingOrganization documentType uploadDate sha256Hash blockchain storageProvider ipfsCid uploadedBy status isRevoked expiryDate digitalSignature createdAt updatedAt originalFileName";

    const [dbItems, total] = await Promise.all([
      Document.find(filter).select(projection).sort(sort).skip(skip).limit(limit).lean().exec(),
      Document.countDocuments(filter).exec(),
    ]);

    const items = dbItems.map((d) => {
      const verificationStatus = computeVerificationStatus(d);
      const isAuthentic = Boolean(d.status === 'verified' && d.blockchain?.confirmed);

      return {
        id: String(d._id),
        title: d.title,
        ownerName: d.ownerName,
        issuingOrganization: d.issuingOrganization,
        documentType: d.documentType,
        uploadDate: d.uploadDate,
        sha256Hash: d.sha256Hash,
        status: d.status,
        isRevoked: d.isRevoked,
        expiryDate: d.expiryDate,
        digitalSignature: d.digitalSignature,
        blockchain: d.blockchain || null,
        verificationStatus,
        isAuthentic,
        storageProvider: d.storageProvider,
        ipfsCid: d.ipfsCid,
        uploadedBy: d.uploadedBy,
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
      };
    });

    if (req.auth) {
      await logAction({
        userId: req.auth.userId,
        userName: req.user?.name,
        action: "Dashboard Search",
        details: `User performed a search query: "${q || title || sha256Hash || 'General'}"`,
        type: "info",
      });
    }

    return res.status(200).json({
      items,
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

async function publicSearchDocuments(req, res, next) {
  try {
    const rawQ = String(req.query?.q || "");
    const q = rawQ.trim();
    if (!q) {
      return res.status(400).json({ error: { message: "Search query is required." } });
    }

    // UML enforcement: Public SEARCH returns metadata only for pre-verified documents.
    // It must NEVER execute verification logic or read blockchain hashes during search.

    const filter = { status: "verified" };

    // Normalize SHA-256 input for exact hash lookup
    const normalizedExactHash = q.replace(/\s+/g, "").toLowerCase();
    const isExactId = q.length === 24 && /^[0-9a-fA-F]{24}$/.test(q);
    const isExactHash = normalizedExactHash.length === 64 && /^[a-f0-9]{64}$/.test(normalizedExactHash);

    if (isExactId) {
      filter._id = q;
    } else if (isExactHash) {
      filter.sha256Hash = normalizedExactHash;
    } else {
      const escaped = escapeRegex(q);
      filter.$or = [
        { title: { $regex: escaped, $options: "i" } },
        { ownerName: { $regex: escaped, $options: "i" } },
        { issuingOrganization: { $regex: escaped, $options: "i" } },
        { documentType: { $regex: escaped, $options: "i" } },
      ];
    }

    const projection =
      "title ownerName issuingOrganization documentType uploadDate sha256Hash blockchain storageProvider ipfsCid status isRevoked expiryDate createdAt originalFileName";

    const docs = await Document.find(filter).select(projection).limit(20).lean().exec();

    if (!docs || !docs.length) {
      return res.status(404).json({ status: "Not Found", error: { message: "No verified document found matching this query." } });
    }

    const mapped = docs.map((doc) => ({
      id: String(doc._id),
      title: doc.title,
      ownerName: doc.ownerName,
      issuingOrganization: doc.issuingOrganization,
      documentType: doc.documentType,
      uploadDate: doc.uploadDate,
      sha256Hash: doc.sha256Hash,
      status: doc.status,
      isRevoked: doc.isRevoked,
      expiryDate: doc.expiryDate,
      blockchain: doc.blockchain || null,
      storageProvider: doc.storageProvider,
      ipfsCid: doc.ipfsCid,
      createdAt: doc.createdAt,
      originalFileName: doc.originalFileName,
    }));

    await logAction({
      userId: null,
      userName: "Public User",
      action: "Document Metadata Search",
      details: `Public metadata search for query: ${q}. Found ${mapped.length} verified document(s).`,
      type: "info",
      metadata: { query: q, count: mapped.length },
    });

    return res.status(200).json({ documents: mapped, total: mapped.length });
  } catch (err) {
    return next(err);
  }
}


module.exports = { searchDocuments, publicSearchDocuments };


