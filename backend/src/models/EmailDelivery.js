const mongoose = require("mongoose");

const emailDeliverySchema = new mongoose.Schema(
  {
    to: { type: String, required: true, maxlength: 254 },
    subject: { type: String, required: true },
    html: { type: String },
    text: { type: String },
    status: { type: String, enum: ["pending", "sent", "failed"], default: "pending" },
    attempts: [
      {
        at: { type: Date, default: Date.now },
        errorMessage: { type: String, default: null },
        info: { type: mongoose.Schema.Types.Mixed, default: {} },
      },
    ],
    messageId: { type: String, default: null },
    lastAttemptAt: { type: Date, default: null },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

emailDeliverySchema.index({ status: 1, createdAt: -1 });

const EmailDelivery = mongoose.model("EmailDelivery", emailDeliverySchema);

module.exports = { EmailDelivery };
