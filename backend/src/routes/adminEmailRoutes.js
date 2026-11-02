const express = require("express");
const { requireAuth, requireRole } = require("../middleware/auth");
const {
  processPending,
  listDeliveries,
  resendDelivery,
  getDeliveryPreview,
} = require("../controllers/adminEmailController");

const router = express.Router();

// GET /api/admin/email/process-pending?limit=20
router.post("/process-pending", requireAuth, requireRole("Admin"), processPending);

// GET /api/admin/email/deliveries?status=pending&skip=0&limit=50
router.get("/deliveries", requireAuth, requireRole("Admin"), listDeliveries);

// POST /api/admin/email/deliveries/:deliveryId/resend
router.post("/deliveries/:deliveryId/resend", requireAuth, requireRole("Admin"), resendDelivery);

// GET /api/admin/email/deliveries/:deliveryId/preview
router.get("/deliveries/:deliveryId/preview", requireAuth, requireRole("Admin"), getDeliveryPreview);

module.exports = router;
