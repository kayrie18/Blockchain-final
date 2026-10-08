const express = require('express');
const { requireAuth, attachUser, requireApprovedVerifier } = require('../middleware/auth');
const { getBlockchainEvents } = require('../controllers/blockchainEventsController');

const router = express.Router();

// GET /api/blockchain/events/ledger
router.get('/events/ledger', requireAuth, attachUser, requireApprovedVerifier, getBlockchainEvents);

module.exports = router;

