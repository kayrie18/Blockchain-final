const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const { Document } = require("../models/Document");
const { decrypt } = require("../utils/crypto");
const { getLocalUploadDir } = require("../services/storageService");
const { logAction } = require("./auditController");
const { analyzeDocumentText, supportsDocumentText } = require("../services/aiAnalysisService");

async function analyzeDocument(req, res, next) {
  const documentId = String(req.body?.documentId || "").trim();
  if (!/^[a-f0-9]{24}$/i.test(documentId)) {
    return res.status(400).json({ success: false, message: "A valid documentId is required" });
  }

  let document;
  try {
    document = await Document.findById(documentId)
      .select("title documentType mimeType originalFileName storagePath sha256Hash uploadedBy issuingOrganization")
      .lean()
      .exec();
    if (!document) return res.status(404).json({ success: false, message: "Document not found" });

    const isOwner = String(document.uploadedBy) === String(req.auth.userId);
    const isAdmin = req.auth.role === "Admin";
    const verifierStatus = req.user?.verifierStatus || (req.user?.isVerifierApproved ? "APPROVED" : "PENDING");
    const isApprovedVerifier = req.auth.role === "Verifier" && verifierStatus === "APPROVED" &&
      req.user?.organization === document.issuingOrganization;
    if (!isOwner && !isAdmin && !isApprovedVerifier) {
      return res.status(404).json({ success: false, message: "Document not found" });
    }

    await logAction({
      userId: req.auth.userId,
      userName: req.user?.name,
      action: "AI_ANALYSIS_REQUESTED",
      details: `AI anomaly analysis requested for document ${documentId}`,
      type: "info",
      metadata: { documentId },
    });

    if (!supportsDocumentText(document)) {
      await logAction({
        userId: req.auth.userId,
        userName: req.user?.name,
        action: "AI_ANALYSIS_FAILED",
        details: `AI anomaly analysis is unsupported for document ${documentId}`,
        type: "warning",
        metadata: { documentId, reason: "unsupported_file_type" },
      });
      return res.status(415).json({
        success: false,
        message: "AI analysis currently supports plain-text and CSV documents only.",
      });
    }

    const uploadRoot = path.resolve(getLocalUploadDir());
    const absolutePath = path.resolve(document.storagePath);
    const relativePath = path.relative(uploadRoot, absolutePath);
    if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
      const error = new Error("Document storage path is invalid");
      error.statusCode = 500;
      throw error;
    }
    const fileBuffer = await fs.readFile(absolutePath);
    const plaintext = decrypt(fileBuffer);
    const actualHash = crypto.createHash("sha256").update(plaintext).digest();
    const expectedHash = Buffer.from(String(document.sha256Hash || ""), "hex");
    if (expectedHash.length !== 32 || !crypto.timingSafeEqual(actualHash, expectedHash)) {
      const error = new Error("Stored document content does not match its registered SHA-256 hash");
      error.statusCode = 409;
      throw error;
    }
    const text = plaintext.toString("utf8");
    const analysis = await analyzeDocumentText({ text, documentType: document.documentType });
    await logAction({
      userId: req.auth.userId,
      userName: req.user?.name,
      action: "AI_ANALYSIS_COMPLETED",
      details: `AI anomaly analysis completed for document ${documentId}`,
      type: "success",
      metadata: { documentId, riskLevel: analysis.riskLevel, model: analysis.model },
    });
    return res.status(200).json({ success: true, data: analysis });
  } catch (error) {
    if (document) {
      await logAction({
        userId: req.auth.userId,
        userName: req.user?.name,
        action: "AI_ANALYSIS_FAILED",
        details: `AI anomaly analysis failed for document ${documentId}`,
        type: "error",
        metadata: { documentId, statusCode: error.statusCode || 500 },
      });
    }
    return next(error);
  }
}

module.exports = { analyzeDocument };