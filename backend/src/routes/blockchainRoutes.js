const express = require("express");
const { storeHash, getHash } = require("../controllers/blockchainController");
const { requireAuth, requireRole, attachUser } = require("../middleware/auth");

const router = express.Router();

// POST /api/blockchain/store-hash
// Body: { documentId: string, sha256HashHex: string, timestamp?: unixSeconds }
router.post("/store-hash", requireAuth, requireRole("Admin", "Issuer"), storeHash);

// GET /api/blockchain/hashes/:documentId
router.get("/hashes/:documentId", requireAuth, attachUser, getHash);

module.exports = router;

