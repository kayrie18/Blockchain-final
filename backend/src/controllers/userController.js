const { User, ROLES } = require("../models/User");
const { logAction } = require("./auditController");
const VERIFIER_STATUSES = new Set(["PENDING", "APPROVED", "REJECTED", "REVOKED"]);

async function createUser(req, res, next) {
  try {
    const name = String(req.body?.name || "").trim();
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");
    const role = String(req.body?.role || ROLES.User).trim();
    const organization = String(req.body?.organization || "").trim() || null;

    if (!name) return res.status(400).json({ error: { message: "Name is required" } });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: { message: "Valid email is required" } });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: { message: "Password must be at least 8 characters" } });
    }
    if (!Object.values(ROLES).includes(role)) {
      return res.status(400).json({ error: { message: "Invalid role specified" } });
    }
    if ([ROLES.Issuer, ROLES.Verifier].includes(role) && !organization) {
      return res.status(400).json({ error: { message: "Organization is required for Issuer and Verifier accounts" } });
    }
    if (await User.findOne({ email })) {
      return res.status(409).json({ error: { message: "Email is already registered" } });
    }

    const user = new User({
      name,
      email,
      role,
      organization,
      emailVerified: true,
      isVerifierApproved: false,
      verifierStatus: role === ROLES.Verifier ? "PENDING" : null,
    });
    user.password = password;
    await user.save();
    await logAction({
      userId: req.auth.userId,
      userName: req.user?.name,
      action: "USER_CREATED",
      details: `Created ${role} account for ${email}`,
      type: "success",
      metadata: { targetUserId: user._id.toString(), role },
    });

    return res.status(201).json({ user: user.toSafeJSON() });
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ error: { message: "Email is already registered" } });
    }
    return next(err);
  }
}

async function getMe(req, res) {
  // `attachUser` middleware loads the full user model as `req.user`
  return res.status(200).json({ user: req.user.toSafeJSON() });
}

async function updateProfile(req, res, next) {
  try {
    const user = req.user;
    const name = String(req.body?.name || user.name).trim();
    const email = String(req.body?.email || user.email).trim().toLowerCase();
    const requestedOrganization = req.body?.organization == null
      ? user.organization
      : String(req.body.organization).trim() || null;
    if (req.auth.role !== ROLES.Admin && requestedOrganization !== user.organization) {
      return res.status(403).json({ error: { message: "Only an administrator can change an account's organization" } });
    }
    const organization = req.auth.role === ROLES.Admin ? requestedOrganization : user.organization;
    const password = req.body?.password ? String(req.body.password) : undefined;

    if (!name) {
      return res.status(400).json({ error: { message: "Name is required" } });
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: { message: "Valid email is required" } });
    }
    if (password !== undefined && password.length < 8) {
      return res.status(400).json({ error: { message: "Password must be at least 8 characters" } });
    }

    if (email !== user.email) {
      const existing = await User.findOne({ email });
      if (existing) {
        return res.status(409).json({ error: { message: "Email is already registered" } });
      }
    }

    user.name = name;
    user.email = email;
    user.organization = organization;
    if (password) user.password = password;

    await user.save();
    return res.status(200).json({ user: user.toSafeJSON(), message: "Profile updated successfully" });
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ error: { message: "Email is already registered" } });
    }
    return next(err);
  }
}

async function uploadAvatar(req, res, next) {
  try {
    const user = req.user;
    if (!req.file) {
      return res.status(400).json({ error: { message: "Avatar image is required" } });
    }
    if (!new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]).has(req.file.mimetype) || req.file.size > 2 * 1024 * 1024) {
      const fs = require("fs/promises");
      await fs.unlink(req.file.path).catch(() => {});
      return res.status(415).json({ error: { message: "Avatar must be a JPEG, PNG, WebP, or GIF image up to 2 MB" } });
    }

    // Since upload middleware saves it to `uploads`, we just need the filename.
    // persistUploadedFile also registers the document, but this is an avatar, so we just use the req.file.filename directly.
    const fileUrl = `/uploads/${req.file.filename}`;
    
    user.profilePictureUrl = fileUrl;
    await user.save();
    
    return res.status(200).json({ user: user.toSafeJSON(), message: "Profile picture updated successfully" });
  } catch (err) {
    return next(err);
  }
}

async function listUsers(req, res) {
  try {
    const users = await User.find({}, '-passwordHash').sort({ createdAt: -1 });
    return res.status(200).json({ users: users.map(u => u.toSafeJSON()) });
  } catch (err) {
    return res.status(500).json({ error: { message: "Failed to fetch users" } });
  }
}

async function updateUserRole(req, res, next) {
  try {
    const targetId = req.params.id;
    const targetUser = await User.findById(targetId);
    if (!targetUser) return res.status(404).json({ error: { message: "User not found" } });
    if (targetUser.role === ROLES.Admin && req.auth.userId !== targetId) {
      return res.status(403).json({ error: { message: "Cannot change Admin role" } });
    }

    const role = String(req.body?.role || targetUser.role).trim();
    const isVerifierApproved = req.body?.isVerifierApproved === true || req.body?.isVerifierApproved === 'true';
    const requestedVerifierStatus = String(req.body?.verifierStatus || "").trim().toUpperCase();
    if (req.body?.organization != null) {
      const organization = String(req.body.organization).trim();
      if (organization.length > 255) {
        return res.status(400).json({ error: { message: "Organization must be 255 characters or fewer" } });
      }
      targetUser.organization = organization || null;
    }

    if (!Object.values(ROLES).includes(role)) {
      return res.status(400).json({ error: { message: "Invalid role specified" } });
    }
    if ([ROLES.Issuer, ROLES.Verifier].includes(role) && !targetUser.organization) {
      return res.status(400).json({ error: { message: "Assign an organization before granting Issuer or Verifier access" } });
    }

    targetUser.role = role;
    if (role === ROLES.Verifier) {
      if (requestedVerifierStatus && !VERIFIER_STATUSES.has(requestedVerifierStatus)) {
        return res.status(400).json({ error: { message: "Invalid verifier status" } });
      }
      targetUser.verifierStatus = requestedVerifierStatus || (isVerifierApproved ? "APPROVED" : "PENDING");
      if (targetUser.verifierStatus === "APPROVED" && !targetUser.organization) {
        return res.status(400).json({ error: { message: "Assign an organization before approving a verifier" } });
      }
      targetUser.isVerifierApproved = targetUser.verifierStatus === "APPROVED";
    } else {
      targetUser.isVerifierApproved = false;
      targetUser.verifierStatus = null;
    }

    await targetUser.save();
    await logAction({
      userId: req.auth.userId,
      userName: req.user?.name,
      action: role === ROLES.Verifier ? `VERIFIER_${targetUser.verifierStatus}` : "USER_ROLE_UPDATED",
      details: `Updated ${targetUser.email} role to ${role}${targetUser.verifierStatus ? ` (${targetUser.verifierStatus})` : ""}`,
      type: "info",
      metadata: { targetUserId: targetUser._id.toString(), role, verifierStatus: targetUser.verifierStatus },
    });
    return res.status(200).json({ user: targetUser.toSafeJSON(), message: "User role updated successfully" });
  } catch (err) {
    return next(err);
  }
}

async function deleteUser(req, res, next) {
  try {
    const targetId = req.params.id;
    const targetUser = await User.findById(targetId);
    if (!targetUser) return res.status(404).json({ error: { message: "User not found" } });
    if (targetUser.role === ROLES.Admin) {
      return res.status(400).json({ error: { message: "Cannot delete an Admin user" } });
    }

    await User.deleteOne({ _id: targetId });
    await logAction({
      userId: req.auth.userId,
      userName: req.user?.name,
      action: "ADMIN_USER_DELETED",
      details: `Deleted user account ${targetId}`,
      type: "warning",
      metadata: { targetUserId: targetId },
    });
    return res.status(200).json({ message: "User account deleted successfully" });
  } catch (err) {
    return next(err);
  }
}

async function approveUser(req, res, next) {
  try {
    const targetId = req.params.id;
    const targetUser = await User.findById(targetId);
    if (!targetUser) return res.status(404).json({ error: { message: "User not found" } });
    if (targetUser.role === 'Admin') return res.status(400).json({ error: { message: "Cannot approve Admin" } });
    if (!targetUser.organization) return res.status(400).json({ error: { message: "Assign an organization before approving a verifier" } });

    targetUser.role = 'Verifier';
    targetUser.isVerifierApproved = true;
    targetUser.verifierStatus = "APPROVED";
    await targetUser.save();
    await logAction({
      userId: req.auth.userId,
      userName: req.user?.name,
      action: "VERIFIER_APPROVED",
      details: `Approved verifier account ${targetUser._id}`,
      type: "success",
      metadata: { targetUserId: targetUser._id.toString(), organization: targetUser.organization },
    });

    return res.status(200).json({ user: targetUser.toSafeJSON(), message: "User promoted to Verifier" });
  } catch (err) {
    return next(err);
  }
}

module.exports = { createUser, getMe, updateProfile, uploadAvatar, listUsers, approveUser, updateUserRole, deleteUser };

