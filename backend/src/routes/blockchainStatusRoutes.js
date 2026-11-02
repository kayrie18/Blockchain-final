const express = require('express');
const { getStatus } = require('../controllers/blockchainStatusController');

const router = express.Router();

// GET /api/blockchain/status
router.get('/status', getStatus);

module.exports = router;

