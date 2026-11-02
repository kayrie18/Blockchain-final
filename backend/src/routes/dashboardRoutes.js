const express = require("express");
const { getMetrics, getAuditLog } = require("../controllers/dashboardController");
const { requireAuth, attachUser } = require("../middleware/auth");


const router = express.Router();

router.get("/metrics", requireAuth, attachUser, getMetrics);
router.get("/audit", requireAuth, attachUser, getAuditLog);

module.exports = router;
