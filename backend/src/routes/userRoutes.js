const express = require("express");
const { createUser, getMe, updateProfile, uploadAvatar, listUsers, approveUser, updateUserRole, deleteUser } = require("../controllers/userController");
const { requireAuth, attachUser, requireRole } = require("../middleware/auth");
const { upload } = require("../middleware/upload");

const router = express.Router();

router.post("/", requireAuth, attachUser, requireRole("Admin"), createUser);

// GET /api/users/me
router.get("/me", requireAuth, attachUser, getMe);

// PATCH /api/users/me
router.patch("/me", requireAuth, attachUser, updateProfile);

// POST /api/users/me/avatar
router.post("/me/avatar", requireAuth, attachUser, upload.single("avatar"), uploadAvatar);

// GET /api/users (admin only)
router.get("/", requireAuth, requireRole("Admin"), listUsers);

// PATCH /api/users/:id/role
router.patch("/:id/role", requireAuth, requireRole("Admin"), updateUserRole);

// DELETE /api/users/:id
router.delete("/:id", requireAuth, requireRole("Admin"), deleteUser);

// POST /api/users/:id/approve - Admin promotes user to Verifier
router.post("/:id/approve", requireAuth, requireRole("Admin"), approveUser);

router.get("/admin-only", requireAuth, requireRole("Admin"), (req, res) => {
  res.status(200).json({ ok: true, message: "Welcome, Admin." });
});

module.exports = router;

