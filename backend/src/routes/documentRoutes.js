const express = require("express");
const {
  uploadDocument,
  downloadDocument,
  revokeDocument,
  viewDocument,
} = require("../controllers/documentController");
const { requireAuth, requireRole, attachUser } = require("../middleware/auth");
const { upload } = require("../middleware/upload");
const { emailDocumentHash } = require("../controllers/hashSharingController");
const { hashEmailLimiter } = require("../middleware/rateLimiters");

const router = express.Router();

// POST /api/documents/upload
router.post("/upload", requireAuth, requireRole("Admin", "Issuer"), attachUser, upload.single("document"), uploadDocument);
router.post("/:id/email-hash", requireAuth, attachUser, hashEmailLimiter, emailDocumentHash);

// Protected document actions
router.get("/:id/download", requireAuth, attachUser, downloadDocument);
router.get("/:id/view", requireAuth, attachUser, viewDocument);
router.patch("/:id/revoke", requireAuth, attachUser, revokeDocument);

module.exports = router;
