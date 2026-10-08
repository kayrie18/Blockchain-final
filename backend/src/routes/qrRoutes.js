const express = require("express");
const { getDocumentQr, verifyFromQrScan } = require("../controllers/qrController");
const { requireAuth, requireRole, attachUser, requireApprovedVerifier } = require("../middleware/auth");

const router = express.Router();

// Generate dynamic QR for a document verification URL.
// GET /api/qr/documents/:documentId
router.get("/documents/:documentId", requireAuth, attachUser, requireRole("Admin", "Issuer", "Verifier", "User"), requireApprovedVerifier, getDocumentQr);

// Verify using QR scan data or direct documentId.
// GET /api/qr/verify?documentId=...
router.get("/verify", verifyFromQrScan);

// POST /api/qr/verify  { scanData: "<qr_payload_or_url>" } or { documentId: "..." }
router.post("/verify", verifyFromQrScan);

module.exports = router;

