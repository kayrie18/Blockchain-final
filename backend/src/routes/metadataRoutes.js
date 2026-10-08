const express = require("express");
const {
  getMetadataById,
  listMetadata,
  updateMetadata,
} = require("../controllers/metadataController");
const { requireAuth, attachUser, requireApprovedVerifier } = require("../middleware/auth");

const router = express.Router();

// GET /api/metadata?skip=0&limit=20
router.get("/", requireAuth, attachUser, requireApprovedVerifier, listMetadata);

// GET /api/metadata/:id
router.get("/:id", requireAuth, attachUser, requireApprovedVerifier, getMetadataById);

// PATCH /api/metadata/:id
router.patch("/:id", requireAuth, attachUser, requireApprovedVerifier, updateMetadata);

module.exports = router;

