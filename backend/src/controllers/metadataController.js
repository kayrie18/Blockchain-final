const { Document } = require("../models/Document");

function toMetadataDTO(doc) {
  return {
    id: doc._id.toString(),
    title: doc.title,
    ownerName: doc.ownerName,
    issuingOrganization: doc.issuingOrganization,
    documentType: doc.documentType,
    uploadDate: doc.uploadDate,
    sha256Hash: doc.sha256Hash,
    blockchain: doc.blockchain || null,
    storageProvider: doc.storageProvider,
    ipfsCid: doc.ipfsCid,
    uploadedBy: doc.uploadedBy?.toString ? doc.uploadedBy.toString() : doc.uploadedBy,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

function canReadDocument(req, doc) {
  if (req.auth.role === "Admin" || String(doc.uploadedBy) === String(req.auth.userId)) return true;
  const verifierStatus = req.user?.verifierStatus || (req.user?.isVerifierApproved ? "APPROVED" : "PENDING");
  return req.auth.role === "Verifier" && verifierStatus === "APPROVED" &&
    req.user?.organization === doc.issuingOrganization;
}

async function getMetadataById(req, res, next) {
  try {
    const id = req.params.id;
    if (!/^[a-f0-9]{24}$/i.test(id)) return res.status(400).json({ error: { message: "Document ID is invalid" } });
    const doc = await Document.findById(id).exec();
    if (!doc) return res.status(404).json({ error: { message: "Document metadata not found" } });
    if (!canReadDocument(req, doc)) return res.status(404).json({ error: { message: "Document metadata not found" } });
    return res.status(200).json({ metadata: toMetadataDTO(doc) });
  } catch (err) {
    return next(err);
  }
}

async function listMetadata(req, res, next) {
  try {
    const parsedLimit = Number(req.query?.limit);
    const parsedSkip = Number(req.query?.skip);
    const limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.min(parsedLimit, 100) : 20;
    const skip = Number.isFinite(parsedSkip) && parsedSkip >= 0 ? parsedSkip : 0;

    const filter = req.auth.role === "Admin"
      ? {}
      : req.auth.role === "Verifier"
        ? { issuingOrganization: req.user?.organization }
        : { uploadedBy: req.auth.userId };
    const docs = await Document.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select("title ownerName issuingOrganization documentType uploadDate sha256Hash blockchain uploadedBy createdAt updatedAt storageProvider ipfsCid")
      .exec();

    return res.status(200).json({
      items: docs.map(toMetadataDTO),
      page: { skip, limit },
    });
  } catch (err) {
    return next(err);
  }
}

async function updateMetadata(req, res, next) {
  try {
    const id = req.params.id;
    if (!/^[a-f0-9]{24}$/i.test(id)) return res.status(400).json({ error: { message: "Document ID is invalid" } });
    const doc = await Document.findById(id).exec();
    if (!doc) return res.status(404).json({ error: { message: "Document metadata not found" } });

    const isAdmin = req.auth.role === "Admin";
    const isOwner = String(doc.uploadedBy) === String(req.auth.userId);

    if (!isAdmin && !isOwner) {
      return res.status(404).json({ error: { message: "Document metadata not found" } });
    }

    const allowedFields = ["title", "ownerName", "documentType", "uploadDate"];
    for (const field of allowedFields) {
      if (req.body?.[field] != null) {
        if (field === "uploadDate") {
          const d = new Date(req.body.uploadDate);
          if (Number.isNaN(d.getTime())) {
            return res.status(400).json({ error: { message: "uploadDate is invalid" } });
          }
          doc.uploadDate = d;
        } else {
          doc[field] = String(req.body[field]).trim();
        }
      }
    }

    await doc.save();
    return res.status(200).json({ metadata: toMetadataDTO(doc) });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  getMetadataById,
  listMetadata,
  updateMetadata,
};

