const express = require("express");
const { analyzeDocument } = require("../controllers/aiController");
const { requireAuth, attachUser, requireApprovedVerifier } = require("../middleware/auth");
const { aiAnalysisLimiter } = require("../middleware/rateLimiters");

const router = express.Router();

router.post("/analyze-document", requireAuth, attachUser, requireApprovedVerifier, aiAnalysisLimiter, analyzeDocument);

module.exports = router;