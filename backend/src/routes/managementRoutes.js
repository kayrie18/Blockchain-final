const express = require("express");
const { listPendingDocuments, approvePendingDocument, rejectPendingDocument } = require("../controllers/managementController");
const { requireAuth, requireRole, attachUser, requireApprovedVerifier } = require("../middleware/auth");

const router = express.Router();

router.get(
  "/pending",
  requireAuth,
  attachUser,
  requireRole("Admin", "Verifier"),
  requireApprovedVerifier,
  listPendingDocuments
);

router.post(
  "/approve/:id",
  requireAuth,
  attachUser,
  requireRole("Admin", "Verifier"),
  requireApprovedVerifier,
  approvePendingDocument
);

router.post(
  "/reject/:id",
  requireAuth,
  attachUser,
  requireRole("Admin", "Verifier"),
  requireApprovedVerifier,
  rejectPendingDocument
);

module.exports = router;
