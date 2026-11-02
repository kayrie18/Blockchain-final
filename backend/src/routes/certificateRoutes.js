const express = require('express');
const { requireAuth, attachUser, requireApprovedVerifier } = require('../middleware/auth');
const { generateCertificate } = require('../controllers/certificateController');

const router = express.Router();

// GET /api/certificates/verification/:documentId/download
router.get('/verification/:documentId/download', requireAuth, attachUser, requireApprovedVerifier, generateCertificate);

module.exports = router;

