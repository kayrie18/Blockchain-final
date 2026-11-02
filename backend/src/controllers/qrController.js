const { Document } = require("../models/Document");
const { getDocumentHashFromChain } = require("../services/blockchainService");
const { compareHashesSecure, normalizeSha256, isSha256Hex } = require("../services/verificationService");
const { buildVerificationUrl, parseScanData, generateQrCodeDataUrl } = require("../services/qrService");

async function getDocumentQr(req, res, next) {
  try {
    const documentId = String(req.params.documentId || "").trim();
    if (!/^[a-f0-9]{24}$/i.test(documentId)) {
      return res.status(400).json({ error: { message: "A valid documentId is required" } });
    }

    const doc = await Document.findById(documentId)
      .select("title ownerName issuingOrganization documentType uploadDate sha256Hash blockchain uploadedBy")
      .lean()
      .exec();
    if (!doc) return res.status(404).json({ error: { message: "Document not found" } });
    const isOwner = String(doc.uploadedBy) === String(req.auth.userId);
    const isAdmin = req.auth.role === "Admin";
    const verifierStatus = req.user?.verifierStatus || (req.user?.isVerifierApproved ? "APPROVED" : "PENDING");
    const isApprovedVerifier = req.auth.role === "Verifier" && verifierStatus === "APPROVED" &&
      req.user?.organization === doc.issuingOrganization;
    if (!isOwner && !isAdmin && !isApprovedVerifier) {
      return res.status(404).json({ error: { message: "Document not found" } });
    }

    const verificationUrl = buildVerificationUrl(documentId);
    const qrCodeDataUrl = await generateQrCodeDataUrl(verificationUrl);

    return res.status(200).json({
      documentId,
      verificationUrl,
      qrCodeDataUrl,
      metadata: {
        title: doc.title,
        ownerName: doc.ownerName,
        issuingOrganization: doc.issuingOrganization,
        documentType: doc.documentType,
        uploadDate: doc.uploadDate,
        sha256Hash: doc.sha256Hash,
        blockchain: doc.blockchain || null,
      },
    });
  } catch (err) {
    return next(err);
  }
}

async function verifyFromQrScan(req, res, next) {
  try {
    const queryDocumentId = String(req.query?.documentId || "").trim();
    const bodyScanData = String(req.body?.scanData || "").trim();
    const bodyDocumentId = String(req.body?.documentId || "").trim();

    const parsed = parseScanData(bodyScanData);
    const documentId = queryDocumentId || bodyDocumentId || parsed.documentId;

    if (documentId && req.accepts("html") && req.method === "GET") {
      const frontendUrl = process.env.FRONTEND_BASE_URL || process.env.FRONTEND_URL || "";
      if (frontendUrl) {
        return res.redirect(`${frontendUrl}/?verify=${documentId}`);
      }
      // If no FRONTEND_URL set, return the document ID so frontend can handle routing
      return res.status(400).json({
        error: { message: "Frontend URL not configured for QR redirect" },
      });
    }

    if (!documentId) {
      return res.status(400).json({
        error: { message: "Provide documentId or scanData (URL/raw ID) to verify" },
      });
    }
    if (!/^[a-f0-9]{24}$/i.test(documentId)) {
      return res.status(400).json({ status: "ERROR", error: { message: "Document ID is invalid" } });
    }

    const doc = await Document.findById(documentId)
      .select("title ownerName issuingOrganization documentType uploadDate sha256Hash blockchain status isRevoked expiryDate")
      .lean()
      .exec();
    if (!doc) return res.status(404).json({ error: { message: "Document not found" } });

    if (doc.status !== "verified" || !doc.blockchain?.confirmed) {
      return res.status(200).json({
        status: "PENDING",
        verdict: "Verification pending",
        isAuthentic: false,
        documentId,
        metadata: { title: doc.title, ownerName: doc.ownerName, issuingOrganization: doc.issuingOrganization },
        blockchain: { transactionId: doc.blockchain?.transactionId || null, confirmed: false },
      });
    }
    if (doc.isRevoked || doc.status === "revoked") {
      return res.status(200).json({ status: "REVOKED", verdict: "REVOKED", isAuthentic: false, documentId });
    }
    if (doc.expiryDate && new Date(doc.expiryDate).getTime() < Date.now()) {
      return res.status(200).json({ status: "EXPIRED", verdict: "EXPIRED", isAuthentic: false, documentId });
    }

    const dbHash = normalizeSha256(doc.sha256Hash);
    let chainHash = "";
    let chainTimestamp = null;
    let chainError = null;

    try {
      const chain = await getDocumentHashFromChain({ documentId });

      chainHash = normalizeSha256(chain.sha256HashHex);
      chainTimestamp = chain.timestamp;
    } catch (err) {
      chainError = err?.message || "Blockchain lookup failed";
    }

    const hashesComparable = isSha256Hex(dbHash) && isSha256Hex(chainHash);
    const isAuthentic = hashesComparable ? compareHashesSecure(dbHash, chainHash) : false;
    const verdict = chainError ? "ERROR" : isAuthentic ? "VALID" : "TAMPERED";

    return res.status(200).json({
      status: verdict,
      verdict,
      isAuthentic,
      documentId,
      metadata: {
        title: doc.title,
        ownerName: doc.ownerName,
        issuingOrganization: doc.issuingOrganization,
        documentType: doc.documentType,
        uploadDate: doc.uploadDate,
      },
      hashes: {
        databaseHash: dbHash,
        blockchainHash: chainHash || null,
        blockchainTimestamp: chainTimestamp,
      },
      blockchain: {
        transactionId: doc.blockchain?.transactionId || null,
        confirmed: Boolean(doc.blockchain?.confirmed),
        blockNumber: doc.blockchain?.blockNumber ?? null,
        lookupError: chainError,
      },
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = { getDocumentQr, verifyFromQrScan };

