const express = require("express");
const {
  register,
  login,
  verifyRole,
  verifyEmailToken,
  requestPasswordReset,
  resetPassword,
} = require("../controllers/authController");
const { requireAuth, attachUser } = require("../middleware/auth");
const { loginLimiter, registrationLimiter, passwordResetLimiter } = require("../middleware/rateLimiters");

const router = express.Router();

// POST /api/auth/register
router.post("/register", registrationLimiter, register);

// POST /api/auth/login
router.post("/login", loginLimiter, login);

// GET /api/auth/verify-email/:token
router.get("/verify-email/:token", verifyEmailToken);

// POST /api/auth/request-password-reset
router.post("/request-password-reset", passwordResetLimiter, requestPasswordReset);

// POST /api/auth/reset-password
router.post("/reset-password", passwordResetLimiter, resetPassword);

// GET /api/auth/verify-role?allowed=Admin,Issuer
router.get("/verify-role", requireAuth, attachUser, verifyRole);

module.exports = router;

