const fs = require("fs/promises");
const { Document } = require("../models/Document");
const { generateSha256FromFile } = require("../services/hashService");
const { getDocumentHashFromChain } = require("../services/blockchainService");
const { compareHashesSecure, normalizeSha256 } = require("../services/verificationService");
const { logAction } = require("./auditController");

function computeStatus(doc, hashMatches) {
  if (!doc) return "Not Found";
  if (doc.isRevoked || doc.status === "revoked") return "Revoked";
  if (doc.status === "rejected") return "Rejected";
  if (doc.expiryDate && new Date(doc.expiryDate).getTime() < Date.now()) return "Expired";
  if (doc.status !== "verified" || !doc.blockchain?.confirmed) return "Pending";
  if (!hashMatches) return "Tampered";
  return "Valid";
}

async function verifyByDocumentId(req, res, next) {
  try {
    const documentId = String(req.params.documentId || "").trim();
    if (!/^[a-f0-9]{24}$/i.test(documentId)) {
      return res.status(400).json({ status: "ERROR", isAuthentic: false, error: { message: "Document ID is invalid" } });
    }
    const doc = await Document.findById(documentId).lean();
    if (!doc) {
      if (req.auth) {
        await logAction({
          userId: req.auth.userId,
          userName: req.user?.name,
          action: "Verification Failed",
          details: `Verification failed: Document ID ${documentId} not found.`,
          type: "warning",
          actionType: "official",
        });
      }
      return res.status(200).json({ status: "Not Found", isAuthentic: false });
    }

    if (doc.status !== "verified" || !doc.blockchain?.confirmed) {
      return res.status(200).json({
        status: "Pending",
        isAuthentic: false,
        documentId,
        title: doc.title,
        hash: doc.sha256Hash,
        blockchain: doc.blockchain || null,
        tamperDetectionResult: { hashMatches: null, details: "Blockchain registration is not confirmed." },
      });
    }

    let onChain;
    try {
      onChain = await getDocumentHashFromChain({ documentId });
    } catch (error) {
      return res.status(error.statusCode || 502).json({
        status: "ERROR",
        isAuthentic: false,
        documentId,
        error: { message: "Blockchain verification is unavailable" },
      });
    }

    const chainHash = normalizeSha256(onChain.sha256HashHex);
    const hashMatches = compareHashesSecure(doc.sha256Hash, chainHash);
    const status = computeStatus(doc, hashMatches);
    
    if (req.auth) {
      await logAction({
        userId: req.auth.userId,
        userName: req.user?.name,
        action: "Document Verified",
        details: `Verification of document "${doc.title}": ${status}`,
        type: "info",
        actionType: "official",
        metadata: { documentId, status, isAuthentic: status === "Valid" },
      });
    }
    
    const verificationTimestamp = doc?.blockchain?.timestamp || (onChain?.timestamp ?? undefined);

    const tamperDetectionResult = {
      hashMatches,
      details: hashMatches
        ? "Uploaded SHA-256 matches on-chain stored hash."
        : "Uploaded SHA-256 does not match on-chain stored hash.",
    };

    return res.status(200).json({
      status,
      isAuthentic: status === "Valid",
      verificationTimestamp,

      // Fields expected by PublicVerifyFlow
      hash: doc.sha256Hash,
      blockchainHash: chainHash,
      tamperDetectionResult,

      documentId,
      title: doc.title,
      ownerName: doc.ownerName,
      issuer: doc.issuingOrganization,
      issuingOrganization: doc.issuingOrganization,
      uploadDate: doc.uploadDate,
      blockchain: doc.blockchain || null,
      documentType: doc.documentType,
      originalFileName: doc.originalFileName,
    });
  } catch (err) {
    return next(err);
  }
}

async function verifyByFile(req, res, next) {
  try {
    if (!req.file) return res.status(400).json({ error: { message: "Document file is required" } });

    const requestedDocumentId = String(req.body?.documentId || "").trim();
    if (requestedDocumentId && !/^[a-f0-9]{24}$/i.test(requestedDocumentId)) {
      return res.status(400).json({ status: "ERROR", isAuthentic: false, error: { message: "Document ID is invalid" } });
    }
    let uploadedHash;
    try {
      uploadedHash = await generateSha256FromFile(req.file.path);
    } finally {
      await fs.unlink(req.file.path).catch(() => {});
    }

    let doc = null;
    if (requestedDocumentId) {
      doc = await Document.findById(requestedDocumentId).lean();
      if (doc && uploadedHash !== doc.sha256Hash) {
        if (req.auth) {
          await logAction({
            userId: req.auth.userId,
            userName: req.user?.name,
            action: "Tamper Detected",
            details: `Document "${doc.title}" failed verification: submitted file hash does not match registered record.`,
            type: "warning",
            actionType: "official",
            metadata: { documentId: String(doc._id), status: "Tampered" },
          });
        }

        return res.status(200).json({
          status: "Tampered",
          isAuthentic: false,
          hash: uploadedHash,
          expectedHash: doc.sha256Hash,
          tamperDetectionResult: {
            hashMatches: false,
            details: "Uploaded SHA-256 does not match the registered document hash.",
          },
          documentId: String(doc._id),
          title: doc.title,
          ownerName: doc.ownerName,
          issuer: doc.issuingOrganization,
          issuingOrganization: doc.issuingOrganization,
          documentType: doc.documentType,
          uploadDate: doc.uploadDate,
          blockchain: doc.blockchain || null,
          originalFileName: doc.originalFileName,
        });
      }
    }

    if (!doc) {
      doc = await Document.findOne({ sha256Hash: uploadedHash }).lean();
    }

    if (!doc) {
      if (req.auth) {
        await logAction({
          userId: req.auth.userId,
          userName: req.user?.name,
          action: "Verification Failed",
          details: `File verification failed: Hash ${uploadedHash} not found in database.`,
          type: "warning",
          actionType: "official",
        });
      }
      return res.status(200).json({ status: "Not Found", isAuthentic: false, hash: uploadedHash });
    }

    if (doc.status !== "verified" || !doc.blockchain?.confirmed) {
      return res.status(200).json({
        status: "Pending",
        isAuthentic: false,
        hash: uploadedHash,
        documentId: String(doc._id),
        title: doc.title,
        tamperDetectionResult: { hashMatches: null, details: "Blockchain registration is not confirmed." },
      });
    }

    let onChain;
    try {
      onChain = await getDocumentHashFromChain({ documentId: String(doc._id) });
    } catch (error) {
      return res.status(error.statusCode || 502).json({
        status: "ERROR",
        isAuthentic: false,
        documentId: String(doc._id),
        hash: uploadedHash,
        error: { message: "Blockchain verification is unavailable" },
      });
    }

    const chainHash = normalizeSha256(onChain.sha256HashHex);
    const hashMatches = compareHashesSecure(uploadedHash, chainHash);
    const status = computeStatus(doc, hashMatches);
    
    if (req.auth) {
      await logAction({
        userId: req.auth.userId,
        userName: req.user?.name,
        action: "Document Verified by File",
        details: `File verification for document "${doc.title}": ${status}`,
        type: "info",
        actionType: "official",
        metadata: { documentId: String(doc._id), status, isAuthentic: status === "Valid" },
      });
    }
    
    const verificationTimestamp = doc?.blockchain?.timestamp || (onChain?.timestamp ?? undefined);

    const tamperDetectionResult = {
      hashMatches,
      details: hashMatches
        ? "Uploaded SHA-256 matches on-chain stored hash."
        : "Uploaded SHA-256 does not match on-chain stored hash.",
    };

    return res.status(200).json({
      status,
      isAuthentic: status === "Valid",
      verificationTimestamp,

      hash: uploadedHash,
      blockchainHash: chainHash,
      tamperDetectionResult,

      documentId: String(doc._id),
      title: doc.title,
      ownerName: doc.ownerName,
      issuer: doc.issuingOrganization,
      issuingOrganization: doc.issuingOrganization,
      documentType: doc.documentType,
      uploadDate: doc.uploadDate,
      blockchain: doc.blockchain || null,
      originalFileName: doc.originalFileName,
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = { verifyByDocumentId, verifyByFile };
