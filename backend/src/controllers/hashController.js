const { Document } = require("../models/Document");

async function getDocumentHash(req, res, next) {
  try {
    const id = req.params.id;
    const doc = await Document.findById(id).select("sha256Hash uploadedBy");
    if (!doc) return res.status(404).json({ error: { message: "Document not found" } });

    return res.status(200).json({
      documentId: doc._id.toString(),
      sha256Hash: doc.sha256Hash,
    });
  } catch (err) {
    return next(err);
  }
}

async function verifyDocumentHash(req, res, next) {
  try {
    const id = req.params.id;
    const expected = String(req.query?.hash || "").trim().toLowerCase();
    if (!expected) {
      return res.status(400).json({ error: { message: "Query param 'hash' is required" } });
    }
    if (!/^[a-f0-9]{64}$/.test(expected)) {
      return res.status(400).json({ error: { message: "Hash must be a 64-char hex SHA-256 value" } });
    }

    const doc = await Document.findById(id).select("sha256Hash");
    if (!doc) return res.status(404).json({ error: { message: "Document not found" } });

    const matches = doc.sha256Hash === expected;
    return res.status(200).json({
      documentId: doc._id.toString(),
      expected,
      actual: doc.sha256Hash,
      matches,
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = { getDocumentHash, verifyDocumentHash };

