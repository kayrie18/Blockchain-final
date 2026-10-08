const { AuditLog } = require('../models/AuditLog');
const { Document } = require('../models/Document');

function csvEscape(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/[\r\n,;"]/.test(str)) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function toUnixSeconds(d) {
  if (!d) return '';
  const dt = d instanceof Date ? d : new Date(d);
  const t = dt.getTime();
  if (!Number.isFinite(t)) return '';
  return Math.floor(t / 1000);
}

async function exportLedgerCsv(req, res, next) {
  try {
    const parsedLimit = Number(req.query?.limit);
    const parsedPage = Number(req.query?.page);

    const limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.min(parsedLimit, 5000) : 1000;
    const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
    const skip = (page - 1) * limit;

    const filter = {};
    // Isolation: non-admin sees only their logs
    if (req.auth.role !== 'Admin') {
      filter.userId = req.auth.userId;
    }

    if (req.query?.type) {
      filter.type = String(req.query.type);
    }

    const [logs, total] = await Promise.all([
      AuditLog.find(filter)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      AuditLog.countDocuments(filter).exec(),
    ]);

    // Map audit logs into export rows.
    // Optimize by batching Document lookups to avoid per-row queries.

    const documentIds = Array.from(
      new Set(
        logs
          .map((l) => (l.metadata?.documentId ? String(l.metadata.documentId) : null))
          .filter(Boolean)
      )
    );

    const documentsById = new Map();
    if (documentIds.length) {
      const documentFilter = { _id: { $in: documentIds } };
      if (req.auth.role === "Issuer" || req.auth.role === "User") {
        documentFilter.uploadedBy = req.auth.userId;
      } else if (req.auth.role === "Verifier") {
        documentFilter.issuingOrganization = req.user?.organization;
      }
      const docs = await Document.find(documentFilter)
        .select('title sha256Hash blockchain uploadDate expiryDate status isRevoked rejectionReason')
        .lean()
        .exec();
      for (const d of docs) {
        documentsById.set(String(d._id), d);
      }
    }

    const rows = [];
    for (const l of logs) {
      const meta = l.metadata || {};
      const documentId = meta.documentId ? String(meta.documentId) : null;
      const transactionId = meta.transactionId
        ? String(meta.transactionId)
        : meta.blockchain?.transactionId
          ? String(meta.blockchain.transactionId)
          : null;

      const document = documentId ? documentsById.get(documentId) || null : null;

      const status =
        document?.status ||
        (meta.status ? String(meta.status) : l.type);

      const blockchain = document?.blockchain || meta.blockchain || {};

      rows.push({
        timestamp: l.timestamp ? new Date(l.timestamp).toISOString() : '',
        unixTimestamp: l.timestamp ? toUnixSeconds(l.timestamp) : '',
        userId: l.userId ? String(l.userId) : '',
        userName: l.userName || 'System',
        action: l.action || '',
        details: l.details || '',
        type: l.type || '',
        actionType: l.actionType || '',
        documentId: documentId || '',
        documentTitle: document?.title || meta.title || '',
        sha256Hash: document?.sha256Hash || meta.sha256Hash || meta.hash || '',
        transactionId: transactionId || blockchain.transactionId || meta.transactionId || '',
        blockNumber: blockchain.blockNumber ?? '',
        blockchainTimestamp: blockchain.timestamp ?? '',
        verificationStatus: status || '',
        isRevoked: document?.isRevoked ? true : (meta.isRevoked ? true : false),
      });
    }


    const headers = [
      'timestamp',
      'unixTimestamp',
      'userId',
      'userName',
      'action',
      'details',
      'type',
      'actionType',
      'documentId',
      'documentTitle',
      'sha256Hash',
      'transactionId',
      'blockNumber',
      'blockchainTimestamp',
      'verificationStatus',
      'isRevoked',
    ];

    const csv = [headers.join(',')]
      .concat(
        rows.map((r) =>
          headers
            .map((h) => csvEscape(r[h]))
            .join(',')
        )
      )
      .join('\n');

    const safeType = req.query?.type ? String(req.query.type).toLowerCase().replace(/[^a-z0-9_-]/g, '') : 'all';
    const filename = `ledger-audit-export_${safeType}_page${page}_limit${limit}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('X-Total', String(total));

    return res.status(200).send(csv);
  } catch (err) {
    return next(err);
  }
}

module.exports = { exportLedgerCsv };

