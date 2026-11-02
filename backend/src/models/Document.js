const mongoose = require("mongoose");

const documentSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 255 },
    ownerName: { type: String, required: true, trim: true, maxlength: 255 },
    issuingOrganization: { type: String, required: true, trim: true, maxlength: 255 },
    documentType: { type: String, required: true, trim: true, maxlength: 120 },
    uploadDate: { type: Date, required: true, default: Date.now },
    originalFileName: { type: String, required: true },
    mimeType: { type: String, required: true },
    sizeBytes: { type: Number, required: true },
    storageProvider: {
      type: String,
      required: true,
      enum: ["local", "cloud", "ipfs"],
      default: "local",
    },
    storagePath: { type: String, required: true },
    ipfsCid: { type: String, default: null },
    sha256Hash: { type: String, required: true, index: true },
    digitalSignature: { type: String, default: null },
    status: { type: String, required: true, enum: ["pending", "verified", "revoked", "rejected"], default: "pending" },
    expiryDate: { type: Date, default: null },
    rejectionReason: { type: String, default: null },
    isRevoked: { type: Boolean, default: false },
    blockchain: {
      transactionId: { type: String, default: null },
      confirmed: { type: Boolean, default: false },
      blockNumber: { type: Number, default: null },
      timestamp: { type: Number, default: null }, // unix seconds
    },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

// Search/performance indexes
documentSchema.index({ title: 1 });
documentSchema.index({ ownerName: 1 });
documentSchema.index({ issuingOrganization: 1 });
documentSchema.index({ documentType: 1 });
documentSchema.index({ uploadDate: -1 });
documentSchema.index({ "blockchain.transactionId": 1 });
documentSchema.index({ uploadedBy: 1, uploadDate: -1 });
documentSchema.index({
  title: "text",
  ownerName: "text",
  issuingOrganization: "text",
  documentType: "text",
});

const Document = mongoose.model("Document", documentSchema);

module.exports = { Document };

