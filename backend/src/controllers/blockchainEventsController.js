const { Document } = require('../models/Document');

async function getBlockchainEvents(req, res, next) {
  try {
    const { status } = req.query || {};
    if (status && !["confirmed", "pending"].includes(String(status).toLowerCase())) {
      return res.status(400).json({ error: { message: "status must be confirmed or pending" } });
    }

    // For now, provide ledger transaction state from our persisted Document registry.
    // This keeps UI operational even if chain RPC event scanning is not configured.
    // Later we can augment with on-chain event logs.
    const filter = {};
    if (req.auth.role === "Issuer" || req.auth.role === "User") {
      filter.uploadedBy = req.auth.userId;
    } else if (req.auth.role === "Verifier") {
      filter.issuingOrganization = req.user?.organization;
    }
    if (status) {
      const s = String(status).toLowerCase();
      if (s === 'confirmed') filter['blockchain.confirmed'] = true;
      if (s === 'pending') filter.status = 'pending';
    }

    const docs = await Document.find(filter, {
      title: 1,
      ownerName: 1,
      issuingOrganization: 1,
      documentType: 1,
      sha256Hash: 1,
      blockchain: 1,
      status: 1,
      isRevoked: 1,
      expiryDate: 1,
      createdAt: 1,
    })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    const mapped = docs.map((d) => ({
      documentId: String(d._id),
      title: d.title,
      ownerName: d.ownerName,
      issuingOrganization: d.issuingOrganization,
      documentType: d.documentType,
      sha256Hash: d.sha256Hash,
      status: d.status,
      isRevoked: d.isRevoked,
      expiryDate: d.expiryDate,
      blockchain: d.blockchain || null,
    }));

    return res.status(200).json({ items: mapped, total: mapped.length });
  } catch (err) {
    return next(err);
  }
}

module.exports = { getBlockchainEvents };

