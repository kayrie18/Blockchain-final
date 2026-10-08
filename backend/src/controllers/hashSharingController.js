const { Document } = require("../models/Document");
const { logAction } = require("./auditController");
const { sendSha256HashEmail } = require("../services/emailService");
const { getDocumentHashFromChain } = require("../services/blockchainService");

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function emailDocumentHash(req, res, next) {
  const documentId = String(req.params.id || "").trim();
  const recipientEmail = String(req.body?.recipientEmail || "").trim().toLowerCase();
  const message = String(req.body?.message || "").trim();

  try {
    if (!/^[a-f0-9]{24}$/i.test(documentId)) {
      return res.status(400).json({ success: false, message: "Document ID is invalid" });
    }
    if (recipientEmail.length > 254 || !EMAIL_PATTERN.test(recipientEmail)) {
      return res.status(400).json({ success: false, message: "A valid recipient email is required" });
    }
    if (message.length > 1000) {
      return res.status(400).json({ success: false, message: "Message must be 1000 characters or fewer" });
    }

    const document = await Document.findById(documentId)
      .select("title sha256Hash uploadedBy status blockchain")
      .lean()
      .exec();
    if (!document) {
      return res.status(404).json({ success: false, message: "Document not found" });
    }
    const isOwner = String(document.uploadedBy) === String(req.auth.userId);
    if (req.auth.role !== "Admin" && !isOwner) {
      return res.status(404).json({ success: false, message: "Document not found" });
    }
    if (document.status !== "verified" || !document.blockchain?.confirmed) {
      return res.status(409).json({ success: false, message: "Only blockchain-confirmed documents can share a hash" });
    }
    if (!/^[a-f0-9]{64}$/i.test(String(document.sha256Hash || ""))) {
      return res.status(409).json({ success: false, message: "The stored document hash is invalid" });
    }
    let chainRecord;
    try {
      chainRecord = await getDocumentHashFromChain({ documentId });
    } catch (error) {
      await logAction({
        userId: req.auth.userId,
        userName: req.user?.name,
        action: "HASH_SHARED_BY_EMAIL",
        details: `SHA-256 email delivery failed because blockchain validation was unavailable for document ${documentId}`,
        type: "error",
        metadata: { documentId, recipientEmail, success: false, reason: "blockchain_unavailable" },
      });
      return res.status(error.statusCode || 502).json({ success: false, message: "Unable to verify the blockchain record; hash was not emailed." });
    }
    if (String(chainRecord.sha256HashHex || "").toLowerCase() !== document.sha256Hash.toLowerCase()) {
      await logAction({
        userId: req.auth.userId,
        userName: req.user?.name,
        action: "HASH_SHARED_BY_EMAIL",
        details: `SHA-256 email delivery blocked because the stored hash differed from blockchain for document ${documentId}`,
        type: "error",
        metadata: { documentId, recipientEmail, success: false, reason: "hash_mismatch" },
      });
      return res.status(409).json({ success: false, message: "Stored hash does not match the blockchain record" });
    }

    const verificationUrl = process.env.FRONTEND_BASE_URL
      ? `${process.env.FRONTEND_BASE_URL.replace(/\/$/, "")}/?verify=${encodeURIComponent(document.sha256Hash)}`
      : "";

    try {
      await sendSha256HashEmail({
        to: recipientEmail,
        documentId,
        documentTitle: document.title,
        sha256Hash: document.sha256Hash.toLowerCase(),
        verificationUrl,
        message,
      });
    } catch (emailError) {
      await logAction({
        userId: req.auth.userId,
        userName: req.user?.name,
        action: "HASH_SHARED_BY_EMAIL",
        details: `SHA-256 email delivery failed for document ${documentId} to ${recipientEmail}`,
        type: "error",
        metadata: { documentId, recipientEmail, success: false },
      });
      return res.status(emailError.statusCode || 502).json({
        success: false,
        message: emailError.statusCode === 503
          ? emailError.message
          : "Unable to send SHA-256 hash. Please check the email configuration.",
      });
    }

    await logAction({
      userId: req.auth.userId,
      userName: req.user?.name,
      action: "HASH_SHARED_BY_EMAIL",
      details: `SHA-256 hash emailed for document ${documentId} to ${recipientEmail}`,
      type: "success",
      metadata: { documentId, recipientEmail, success: true },
    });
    return res.status(200).json({ success: true, message: "SHA-256 hash sent successfully." });
  } catch (err) {
    return next(err);
  }
}

module.exports = { emailDocumentHash };