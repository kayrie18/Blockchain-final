const { User, ROLES } = require("../models/User");
const { signAuthToken } = require("../utils/jwt");
const { logAction } = require("./auditController");
const {
  generateToken,
  hashToken,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendPasswordChangeNotification,
} = require("../services/emailService");

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function isValidEmail(email) {
  // Intentionally simple; frontend can enforce stricter rules.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidRole(role) {
  return Object.values(ROLES).includes(role);
}

async function register(req, res, next) {
  try {
    const name = String(req.body?.name || "").trim();
    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || "");
    const requestedRole = String(req.body?.role || ROLES.User);
    const organization = String(req.body?.organization || "").trim() || null;
    const publicRoles = [ROLES.User, ROLES.Verifier];
    if (!publicRoles.includes(requestedRole)) {
      return res.status(403).json({ error: { message: "Public registration cannot assign Issuer or Admin roles" } });
    }
    const role = requestedRole;

    if (!name) return res.status(400).json({ error: { message: "Name is required" } });
    if (!email || !isValidEmail(email)) {
      return res.status(400).json({ error: { message: "Valid email is required" } });
    }
    if (!password || password.length < 8) {
      return res.status(400).json({ error: { message: "Password must be at least 8 characters" } });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({ error: { message: "Email is already registered" } });
    }

    const verificationToken = generateToken();
    const user = new User({
      name,
      email,
      role,
      organization,
      emailVerified: false,
      emailVerificationToken: hashToken(verificationToken),
      emailVerificationTokenExpires: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });
    user.password = password; // triggers bcrypt hashing in model pre-save
    await user.save();
    await logAction({
      userId: user._id,
      userName: user.name,
      action: "USER_REGISTERED",
      details: "Account registration completed",
      type: "success",
      metadata: { role: user.role },
    });

    let verificationEmailSent = false;
    try {
      const delivery = await sendVerificationEmail(user, verificationToken);
      verificationEmailSent = Boolean(delivery?.accepted?.includes(email));
    } catch (emailError) {
      console.error("Failed to send verification email", emailError?.message || emailError);
    }

    const token = signAuthToken({ userId: user._id.toString(), role: user.role });
    return res.status(201).json({
      user: user.toSafeJSON(),
      token,
      message: verificationEmailSent
        ? "Registration successful. A verification email has been sent."
        : "Registration completed, but the verification email could not be sent. Contact an administrator or configure email delivery.",
    });
  } catch (err) {
    // Handle duplicate email race
    if (err?.code === 11000) {
      return res.status(409).json({ error: { message: "Email is already registered" } });
    }
    return next(err);
  }
}

async function login(req, res, next) {
  try {
    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || "");

    if (!email || !isValidEmail(email)) {
      return res.status(400).json({ error: { message: "Valid email is required" } });
    }
    if (!password) return res.status(400).json({ error: { message: "Password is required" } });

    const user = await User.findOne({ email });
    if (!user) {
      await logAction({ action: "FAILED_LOGIN", details: "Login rejected for an unrecognized account", type: "warning", metadata: { reason: "unknown_account" } });
      return res.status(401).json({ error: { message: "Invalid credentials" } });
    }

    if (user.lockUntil && user.lockUntil > new Date()) {
      await logAction({ userId: user._id, userName: user.name, action: "FAILED_LOGIN", details: "Login rejected because the account is temporarily locked", type: "warning", metadata: { reason: "locked" } });
      return res.status(429).json({ error: { message: "Too many failed login attempts. Try again later." } });
    }

    const ok = await user.verifyPassword(password);
    if (!ok) {
      await logAction({ userId: user._id, userName: user.name, action: "FAILED_LOGIN", details: "Login rejected due to invalid credentials", type: "warning", metadata: { reason: "invalid_credentials" } });
      const failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
      const update = { failedLoginAttempts };
      if (failedLoginAttempts >= 5) {
        update.lockUntil = new Date(Date.now() + 15 * 60 * 1000);
      }
      await User.findByIdAndUpdate(user._id, update, { new: true });
      return res.status(401).json({ error: { message: "Invalid credentials" } });
    }

    if (user.failedLoginAttempts || user.lockUntil) {
      await User.findByIdAndUpdate(user._id, { failedLoginAttempts: 0, lockUntil: null });
    }

    const token = signAuthToken({ userId: user._id.toString(), role: user.role });
    await logAction({ userId: user._id, userName: user.name, action: "LOGIN", details: "User login succeeded", type: "success" });
    return res.status(200).json({ user: user.toSafeJSON(), token });
  } catch (err) {
    return next(err);
  }
}

async function verifyRole(req, res) {
  const userId = req.user?._id?.toString() || req.auth.userId;
  const role = req.user?.role || req.auth.role;

  const allowed = req.query?.allowed;
  if (typeof allowed === "string" && allowed.trim()) {
    const allowedRoles = allowed
      .split(",")
      .map((r) => r.trim())
      .filter(Boolean);
    const isAllowed = allowedRoles.includes(role);
    return res.status(200).json({ userId, role, isAllowed, allowedRoles });
  }

  return res.status(200).json({ userId, role });
}

async function verifyEmailToken(req, res, next) {
  try {
    const token = String(req.params.token || "").trim();
    if (!token) {
      return res.status(400).json({ error: { message: "Email verification token is required" } });
    }

    const hashedToken = hashToken(token);
    const user = await User.findOne({
      emailVerificationToken: hashedToken,
      emailVerificationTokenExpires: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({ error: { message: "Invalid or expired email verification token" } });
    }

    user.emailVerified = true;
    user.emailVerificationToken = null;
    user.emailVerificationTokenExpires = null;
    await user.save();

    return res.status(200).json({ message: "Email verified successfully", user: user.toSafeJSON() });
  } catch (err) {
    return next(err);
  }
}

async function requestPasswordReset(req, res, next) {
  try {
    const email = normalizeEmail(req.body?.email);
    if (!email || !isValidEmail(email)) {
      return res.status(400).json({ error: { message: "Valid email is required" } });
    }

    const user = await User.findOne({ email });
    if (user) {
      const resetToken = generateToken();
      user.passwordResetToken = hashToken(resetToken);
      user.passwordResetTokenExpires = new Date(Date.now() + 60 * 60 * 1000);
      await user.save();
      try {
        await sendPasswordResetEmail(user, resetToken);
      } catch (emailError) {
        console.error("Failed to send password reset email", emailError?.message || emailError);
        user.passwordResetToken = null;
        user.passwordResetTokenExpires = null;
        await user.save();
      }
    }

    return res.status(200).json({ message: "If that email is registered and email delivery is available, password reset instructions will be sent." });
  } catch (err) {
    return next(err);
  }
}

async function resetPassword(req, res, next) {
  try {
    const token = String(req.body?.token || "").trim();
    const password = String(req.body?.password || "").trim();
    if (!token || !password || password.length < 8) {
      return res.status(400).json({ error: { message: "Token and a password of at least 8 characters are required" } });
    }

    const hashedToken = hashToken(token);
    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetTokenExpires: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({ error: { message: "Invalid or expired password reset token" } });
    }

    user.password = password;
    user.passwordResetToken = null;
    user.passwordResetTokenExpires = null;
    await user.save();

    try {
      await sendPasswordChangeNotification(user);
    } catch (emailError) {
      console.error("Failed to send password change notification", emailError?.message || emailError);
    }

    return res.status(200).json({ message: "Password reset successfully" });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  register,
  login,
  verifyRole,
  verifyEmailToken,
  requestPasswordReset,
  resetPassword,
};

