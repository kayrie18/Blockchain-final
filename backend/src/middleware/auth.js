const { User } = require("../models/User");
const { verifyAuthToken } = require("../utils/jwt");

function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const [scheme, headerToken] = header.split(" ");
    let token = null;

    if (scheme === "Bearer" && headerToken) {
      token = headerToken;
    }

    if (!token) {
      return res.status(401).json({ error: { message: "Missing Bearer token" } });
    }

    const payload = verifyAuthToken(token);
    req.auth = {
      userId: payload.sub,
      role: payload.role,
    };
    return next();
  } catch (err) {
    return res.status(401).json({ error: { message: "Invalid or expired token" } });
  }
}

function requireRole(...allowedRoles) {
  return async (req, res, next) => {
    if (!req.auth?.role) {
      return res.status(401).json({ error: { message: "Not authenticated" } });
    }
    try {
      const user = req.user || await User.findById(req.auth.userId).select("role organization isVerifierApproved verifierStatus").exec();
      if (!user) return res.status(401).json({ error: { message: "User no longer exists" } });
      req.user = user;
      req.auth.role = user.role;
      if (!allowedRoles.includes(user.role)) {
        return res.status(403).json({ error: { message: "Forbidden" } });
      }
      return next();
    } catch (err) {
      return next(err);
    }
  };
}

async function attachUser(req, res, next) {
  if (!req.auth?.userId) return next();
  try {
    const user = await User.findById(req.auth.userId);
    if (!user) {
      return res.status(401).json({ error: { message: "User no longer exists" } });
    }
    req.user = user;
    req.auth.role = user.role;
    return next();
  } catch (err) {
    return next(err);
  }
}

function requireApprovedVerifier(req, res, next) {
  if (req.auth?.role !== "Verifier") {
    return next();
  }
  if (!req.user) {
    return res.status(401).json({ error: { message: "User context is required" } });
  }
  const status = req.user.verifierStatus || (req.user.isVerifierApproved ? "APPROVED" : "PENDING");
  if (status !== "APPROVED" || !req.user.organization) {
    return res.status(403).json({ error: { message: `Verifier account is ${String(status).toLowerCase()}` } });
  }
  return next();
}

module.exports = { requireAuth, requireRole, attachUser, requireApprovedVerifier };

