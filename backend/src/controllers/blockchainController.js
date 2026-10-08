const { storeDocumentHashOnChain, getDocumentHashFromChain } = require("../services/blockchainService");
const { Document } = require("../models/Document");
const { logAction } = require("./auditController");

function normalizeHash(hash) {
  return String(hash || "").replace(/^0x/i, "").trim().toLowerCase();
}

function canAccessDocument(req, doc) {
  return req.auth?.role === "Admin" || String(doc.uploadedBy) === String(req.auth?.userId);
}

async function storeHash(req, res, next) {
  try {
    const documentId = String(req.body?.documentId || "").trim();
    const sha256HashHex = String(req.body?.sha256HashHex || "").trim().toLowerCase();

    if (!documentId) {
      return res.status(400).json({ error: { message: "documentId is required" } });
    }
    if (!/^[a-f0-9]{24}$/i.test(documentId)) {
      return res.status(400).json({ error: { message: "documentId is invalid" } });
    }
    if (!/^[a-f0-9]{64}$/.test(sha256HashHex)) {
      return res.status(400).json({ error: { message: "sha256HashHex must be a 64-char hex SHA-256 value" } });
    }

    const doc = await Document.findById(documentId)
      .select("sha256Hash uploadedBy blockchain")
      .lean()
      .exec();
    if (!doc) return res.status(404).json({ error: { message: "Document not found" } });
    if (!canAccessDocument(req, doc)) {
      return res.status(404).json({ error: { message: "Document not found" } });
    }
    if (normalizeHash(sha256HashHex) !== normalizeHash(doc.sha256Hash)) {
      return res.status(409).json({ error: { message: "Hash does not match the registered document" } });
    }
    if (doc.blockchain?.confirmed || doc.blockchain?.transactionId) {
      return res.status(409).json({ error: { message: "Document already has a blockchain registration" } });
    }

    const result = await storeDocumentHashOnChain({
      documentId,
      sha256HashHex,
    });

    await Document.findByIdAndUpdate(documentId, {
      $set: {
        status: result.confirmed ? "verified" : "pending",
        blockchain: {
          transactionId: result.transactionId || null,
          confirmed: result.confirmed,
          blockNumber: result.blockNumber ?? null,
          timestamp: result.timestamp ?? null,
        },
      },
    }).exec();

    await logAction({
      userId: req.auth.userId,
      userName: req.user?.name,
      action: result.confirmed ? "BLOCKCHAIN_REGISTERED" : "BLOCKCHAIN_FAILED",
      details: `${result.confirmed ? "Blockchain registration confirmed" : "Blockchain registration failed"} for document ${documentId}`,
      type: result.confirmed ? "success" : "error",
      metadata: { documentId, transactionId: result.transactionId || null, blockNumber: result.blockNumber || null },
    });

    return res.status(200).json({
      status: result.confirmed ? "confirmed" : "pending",
      documentId,
      sha256HashHex,
      transactionId: result.transactionId,
      confirmed: result.confirmed,
      blockNumber: result.blockNumber,
      timestamp: result.timestamp,
    });
  } catch (err) {
    return next(err);
  }
}

async function getHash(req, res, next) {
  try {
    const documentId = String(req.params.documentId || "").trim();
    if (!documentId) return res.status(400).json({ error: { message: "documentId is required" } });
    if (!/^[a-f0-9]{24}$/i.test(documentId)) {
      return res.status(400).json({ error: { message: "documentId is invalid" } });
    }

    const doc = await Document.findById(documentId)
      .select("sha256Hash uploadedBy blockchain")
      .lean()
      .exec();
    if (!doc) return res.status(404).json({ error: { message: "Document not found" } });
    if (!canAccessDocument(req, doc)) {
      return res.status(404).json({ error: { message: "Document not found" } });
    }

    const result = await getDocumentHashFromChain({ documentId });
    if (normalizeHash(result.sha256HashHex) !== normalizeHash(doc.sha256Hash)) {
      return res.status(409).json({ error: { message: "Stored and on-chain document hashes do not match" } });
    }

    return res.status(200).json(result);
  } catch (err) {
    return next(err);
  }
}

module.exports = { storeHash, getHash };

