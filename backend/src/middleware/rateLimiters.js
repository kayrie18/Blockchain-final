const { rateLimit } = require("express-rate-limit");

function createLimiter(windowMs, limit, message) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: { message } },
  });
}

const loginLimiter = createLimiter(15 * 60 * 1000, 10, "Too many login attempts. Try again later.");
const registrationLimiter = createLimiter(60 * 60 * 1000, 5, "Too many registration attempts. Try again later.");
const passwordResetLimiter = createLimiter(60 * 60 * 1000, 5, "Too many password reset requests. Try again later.");
const hashEmailLimiter = createLimiter(60 * 60 * 1000, 10, "Too many hash-sharing requests. Try again later.");
const aiAnalysisLimiter = createLimiter(60 * 60 * 1000, 10, "Too many AI analysis requests. Try again later.");

module.exports = {
  loginLimiter,
  registrationLimiter,
  passwordResetLimiter,
  hashEmailLimiter,
  aiAnalysisLimiter,
};