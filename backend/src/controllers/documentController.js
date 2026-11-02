const path = require("path");
const crypto = require("crypto");
const fs = require("fs/promises");
const { Document } = require("../models/Document");
const { generateSha256FromFile } = require("../services/hashService");
const { persistUploadedFile, getLocalUploadDir } = require("../services/storageService");
const { submitDocumentHashToBlockchain } = require("../services/blockchainService");
const { signHash } = require("../services/signingService");
const { logAction } = require("./auditController");
const { encrypt, decrypt } = require("../utils/crypto");
const { sendDocumentUploadNotification } = require("../services/emailService");

function ensureSafeStoragePath(filePath) {
  const uploadRoot = path.resolve(getLocalUploadDir());
  const absolutePath = path.resolve(filePath);
  const relativePath = path.relative(uploadRoot, absolutePath);
  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new Error("Invalid storage path detected");
  }
  return absolutePath;
}

function assertStoredContentHash(document, content) {
  const actualHash = crypto.createHash("sha256").update(content).digest("hex");
  const expectedHash = String(document.sha256Hash || "").toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(expectedHash) || !crypto.timingSafeEqual(Buffer.from(actualHash, "hex"), Buffer.from(expectedHash, "hex"))) {
    const error = new Error("Stored document content does not match its registered SHA-256 hash");
    error.statusCode = 409;
    throw error;
  }
}

function safeResponseFilename(value) {
  return path.basename(String(value || "document"))
    .replace(/[\r\n"\\]/g, "_")
    .replace(/[^\x20-\x7E]/g, "_") || "document";
}

/**
 * Upload and Sign Document
 */
async function uploadDocument(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: { message: "Document file is required" } });
    }

    const title = String(req.body?.title || "").trim();
    const ownerName = String(req.body?.ownerName || "").trim();
    const issuingOrganization = String(req.body?.issuingOrganization || "").trim();
    const documentType = String(req.body?.documentType || "").trim();
    const expiryDateRaw = req.body?.expiryDate;

    if (!title || !ownerName || !issuingOrganization || !documentType) {
      return res.status(400).json({
        error: { message: "title, ownerName, issuingOrganization, and documentType are required" },
      });
    }
    if (req.auth.role === "Issuer" && issuingOrganization !== req.user?.organization) {
      await fs.unlink(req.file.path).catch(() => {});
      return res.status(403).json({ error: { message: "Issuer uploads must use the organization assigned to the account" } });
    }

    let expiryDate = null;
    if (expiryDateRaw) {
      expiryDate = new Date(expiryDateRaw);
      if (Number.isNaN(expiryDate.getTime())) {
        await fs.unlink(req.file.path).catch(() => {});
        return res.status(400).json({ error: { message: "Invalid expiry date format" } });
      }
    }

    const sha256Hash = await generateSha256FromFile(req.file.path);
    
    // Check for duplicate hash
    const existingDoc = await Document.findOne({ sha256Hash });
    if (existingDoc) {
      await fs.unlink(req.file.path).catch(() => {});
      return res.status(409).json({ error: { message: "This document has already been uploaded." } });
    }

    // Encrypt physical file at rest before committing metadata
    try {
      const fileData = await fs.readFile(req.file.path);
      const encryptedData = encrypt(fileData);
      await fs.writeFile(req.file.path, encryptedData);
    } catch (encryptErr) {
      await fs.unlink(req.file.path).catch(() => {});
      throw encryptErr;
    }

    const digitalSignature = signHash(sha256Hash);

    const stored = await persistUploadedFile(req.file);
    
    const doc = await Document.create({
      title,
      ownerName,
      issuingOrganization,
      documentType,
      uploadDate: new Date(),
      expiryDate,
      originalFileName: req.file.originalname,
      mimeType: req.file.mimetype || "application/octet-stream",
      sizeBytes: req.file.size,
      storageProvider: stored.storageProvider,
      storagePath: stored.storagePath,
      sha256Hash,
      digitalSignature,
      uploadedBy: req.auth.userId,
      status: "pending",
    });

    // Anchor hash on blockchain synchronously: wait for transaction confirmation.
    // This ensures the upload response reflects whether blockchain anchoring succeeded.
    try {
      const blockchainResult = await submitDocumentHashToBlockchain({
        documentId: doc._id.toString(),
        sha256HashHex: sha256Hash,
      });

      await Document.findByIdAndUpdate(doc._id, {
        $set: {
          status: "verified",
          blockchain: {
            transactionId: blockchainResult.transactionId,
            confirmed: true,
            blockNumber: blockchainResult.blockNumber,
            timestamp: blockchainResult.timestamp,
          },
        },
      });

      await logAction({
        userId: req.auth.userId,
        userName: req.user?.name,
        action: "BLOCKCHAIN_REGISTERED",
        details: `Document "${title}" anchored on blockchain (TX: ${blockchainResult.transactionId})`,
        type: "info",
        actionType: "official",
        metadata: { documentId: doc._id },
      });
    } catch (blockchainErr) {
      console.error("Blockchain anchoring failed:", blockchainErr?.message || blockchainErr);
      try {
        // Record failure in document record so admins can inspect
        await Document.findByIdAndUpdate(doc._id, {
          $set: {
            status: "pending",
            "blockchain.transactionId": null,
            "blockchain.confirmed": false,
            "blockchain.blockNumber": null,
            "blockchain.timestamp": null,
            "blockchain.error": blockchainErr?.message || String(blockchainErr),
          },
        });

        await logAction({
          userId: req.auth.userId,
          userName: req.user?.name,
          action: "BLOCKCHAIN_FAILED",
          details: `Document "${title}" uploaded but blockchain anchoring failed: ${blockchainErr?.message || String(blockchainErr)}`,
          type: "error",
          actionType: "official",
          metadata: { documentId: doc._id },
        });
      } catch (auditErr) {
        console.error("Audit log error:", auditErr.message);
      }
    }

    // Log upload immediately (blockchain confirmation happens async)
    await logAction({
      userId: req.auth.userId,
      userName: req.user?.name,
      action: "DOCUMENT_REGISTERED",
      details: `Document "${doc.title}" uploaded; blockchain status: ${doc.status}.`,
      type: "info",
      actionType: "official",
      metadata: { documentId: doc._id },
    });

    try {
      if (req.user && req.user.email) {
        await sendDocumentUploadNotification(req.user, doc);
      }
    } catch (emailError) {
      console.error("Document upload notification failed:", emailError?.message || emailError);
    }

    const finalDocument = await Document.findById(doc._id).lean();
    return res.status(201).json({ status: finalDocument?.status || doc.status, document: finalDocument || doc });
  } catch (err) {
    return next(err);
  }
}

/**
 * SECURE Download with Access Control
 */
async function downloadDocument(req, res, next) {
  try {
    const docId = req.params.id;
    const doc = await Document.findById(docId);

    if (!doc) {
      return res.status(404).json({ error: { message: "Document not found" } });
    }

    // Binary document access is limited to the owner, admin, or an approved institutional verifier.
    const isOwner = String(doc.uploadedBy) === String(req.auth.userId);
    const isAdmin = req.auth.role === "Admin";
    const verifierStatus = req.user?.verifierStatus || (req.user?.isVerifierApproved ? "APPROVED" : "PENDING");
    const isApprovedVerifier = doc.status === "verified" && doc.blockchain?.confirmed && !doc.isRevoked && req.auth.role === "Verifier" &&
      verifierStatus === "APPROVED" &&
      req.user?.organization === doc.issuingOrganization;

    if (!isOwner && !isAdmin && !isApprovedVerifier) {
      await logAction({
        userId: req.auth.userId,
        action: "Unauthorized Download Attempt",
        details: `User tried to download non-verified/private document ID: ${docId}`,
        type: "error",
      });
      return res.status(403).json({ error: { message: "Access denied. Private document require ownership or admin rights." } });
    }

    let absolutePath;
    try {
      absolutePath = ensureSafeStoragePath(doc.storagePath);
    } catch {
      return res.status(500).json({ error: { message: "Document storage path is invalid." } });
    }

    try {
      await fs.access(absolutePath);
    } catch {
      return res.status(404).json({ error: { message: "Physical file missing on server." } });
    }

    await logAction({
      userId: req.auth.userId,
      userName: req.user?.name,
      action: "Document Downloaded",
      details: `Downloaded "${doc.title}"`,
      type: "info",
    });

    // Decrypt on-the-fly and send directly as stream/buffer
    const encryptedData = await fs.readFile(absolutePath);
    const decryptedData = decrypt(encryptedData);
    assertStoredContentHash(doc, decryptedData);
    res.setHeader("Content-Type", doc.mimeType || "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename="${safeResponseFilename(doc.originalFileName)}"`);
    return res.send(decryptedData);
  } catch (err) {
    return next(err);
  }
}

/**
 * Revoke Document (Advanced Feature)
 */
async function revokeDocument(req, res, next) {
  try {
    const docId = req.params.id;
    const doc = await Document.findById(docId);

    if (!doc) return res.status(404).json({ error: { message: "Document not found" } });

    // Access Control: Owner or Admin only
    if (String(doc.uploadedBy) !== String(req.auth.userId) && req.auth.role !== "Admin") {
      return res.status(403).json({ error: { message: "You are not authorized to revoke this document." } });
    }

    doc.status = "revoked";
    doc.isRevoked = true;
    await doc.save();

    await logAction({
      userId: req.auth.userId,
      userName: req.user?.name,
      action: "DOCUMENT_REVOKED",
      details: `Document "${doc.title}" has been permanently neutralized.`,
      type: "warning",
      metadata: { documentId: docId },
    });

    return res.status(200).json({ status: "revoked", message: "Document has been revoked successfully." });
  } catch (err) {
    return next(err);
  }
}

/**
 * View Document Inline (for Read Feature)
 */
async function viewDocument(req, res, next) {
  try {
    const docId = req.params.id;
    const doc = await Document.findById(docId);
    if (!doc) return res.status(404).json({ error: { message: "Document not found" } });

    const isOwner = String(doc.uploadedBy) === String(req.auth.userId);
    const isAdmin = req.auth.role === "Admin";
    const verifierStatus = req.user?.verifierStatus || (req.user?.isVerifierApproved ? "APPROVED" : "PENDING");
    const isApprovedVerifier = doc.status === "verified" && doc.blockchain?.confirmed && !doc.isRevoked && req.auth.role === "Verifier" &&
      verifierStatus === "APPROVED" &&
      req.user?.organization === doc.issuingOrganization;

    if (!isOwner && !isAdmin && !isApprovedVerifier) {
      return res.status(403).json({ error: { message: "Access denied." } });
    }

    let absolutePath;
    try {
      absolutePath = ensureSafeStoragePath(doc.storagePath);
    } catch {
      return res.status(500).json({ error: { message: "Document storage path is invalid." } });
    }

    try {
      await fs.access(absolutePath);
    } catch {
      return res.status(404).json({ error: { message: "Physical file missing on server." } });
    }

    // Decrypt on-the-fly and send inline
    const encryptedData = await fs.readFile(absolutePath);
    const decryptedData = decrypt(encryptedData);
    assertStoredContentHash(doc, decryptedData);
    res.setHeader("Content-Type", doc.mimeType || "application/octet-stream");
    res.setHeader("Content-Disposition", `inline; filename="${safeResponseFilename(doc.originalFileName)}"`);
    return res.send(decryptedData);
  } catch (err) {
    return next(err);
  }
}

module.exports = { uploadDocument, downloadDocument, revokeDocument, viewDocument };
