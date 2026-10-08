const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const ROLES = Object.freeze({
  Admin: "Admin",
  Issuer: "Issuer",
  Verifier: "Verifier",
  User: "User",
});

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
      index: true,
      maxlength: 254,
    },
    passwordHash: { type: String, required: true },
    role: {
      type: String,
      required: true,
      enum: Object.values(ROLES),
      default: ROLES.User,
    },
    organization: { type: String, trim: true, maxlength: 255, default: null },
    isVerifierApproved: { type: Boolean, default: false },
    verifierStatus: {
      type: String,
      enum: ["PENDING", "APPROVED", "REJECTED", "REVOKED", null],
      default: null,
    },
    profilePictureUrl: { type: String, default: null },
    emailVerified: { type: Boolean, default: false },
    emailVerificationToken: { type: String, default: null },
    emailVerificationTokenExpires: { type: Date, default: null },
    passwordResetToken: { type: String, default: null },
    passwordResetTokenExpires: { type: Date, default: null },
    failedLoginAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date, default: null },
  },
  { timestamps: true }
);

userSchema
  .virtual("password")
  .set(function setPassword(plainPassword) {
    this._plainPassword = plainPassword;
  });

userSchema.pre("validate", async function validatePassword(next) {
  try {
    if (this._plainPassword) {
      const saltRounds = 12;
      this.passwordHash = await bcrypt.hash(this._plainPassword, saltRounds);
      this._plainPassword = undefined;
      return next();
    }

    if (this.isNew && !this.passwordHash) {
      this.invalidate("password", "Password is required");
    }

    next();
  } catch (err) {
    next(err);
  }
});

userSchema.methods.verifyPassword = async function verifyPassword(plainPassword) {
  return bcrypt.compare(plainPassword, this.passwordHash);
};

userSchema.methods.toSafeJSON = function toSafeJSON() {
  return {
    id: this._id.toString(),
    name: this.name,
    email: this.email,
    role: this.role,
    organization: this.organization || null,
    isVerifierApproved: this.isVerifierApproved || false,
    verifierStatus: this.role === ROLES.Verifier
      ? (this.verifierStatus || (this.isVerifierApproved ? "APPROVED" : "PENDING"))
      : null,
    emailVerified: this.emailVerified || false,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

const User = mongoose.model("User", userSchema);

module.exports = { User, ROLES };

