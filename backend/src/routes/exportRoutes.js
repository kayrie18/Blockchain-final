const express = require('express');
const { requireAuth, attachUser, requireRole } = require('../middleware/auth');
const { exportLedgerCsv } = require('../controllers/exportController');

const router = express.Router();

// GET /api/export/ledger?type=&page=&limit=
router.get(
  '/ledger',
  requireAuth,
  attachUser,
  requireRole('Admin', 'Issuer', 'Verifier', 'User'),
  exportLedgerCsv
);

module.exports = router;

