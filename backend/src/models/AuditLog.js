const mongoose = require("mongoose");

const auditLogSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: false }, // null for system actions
    userName: { type: String, default: "System" },
    action: { type: String, required: true },
    details: { type: String, required: true },
    type: { 
      type: String, 
      enum: ["success", "error", "warning", "info"], 
      default: "info" 
    },
    actionType: {
      type: String,
      enum: ["official", "temporary"],
      default: "official"
    },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: "timestamp", updatedAt: false } }
);

auditLogSchema.index({ timestamp: -1 });
auditLogSchema.index({ userId: 1, timestamp: -1 });
auditLogSchema.index({ type: 1 });

const AuditLog = mongoose.model("AuditLog", auditLogSchema);

module.exports = { AuditLog };
