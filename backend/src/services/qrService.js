const QRCode = require("qrcode");

function getVerifyBaseUrl() {
  return process.env.QR_VERIFY_BASE_URL || "";
}

function buildVerificationUrl(documentId) {
  const base = getVerifyBaseUrl();
  const url = new URL(base);
  url.searchParams.set("documentId", String(documentId));
  return url.toString();
}

function parseScanData(scanData) {
  const raw = String(scanData || "").trim();
  if (!raw) return { documentId: null };

  // If data looks like URL, try to parse documentId query param.
  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    try {
      const url = new URL(raw);
      const documentId = url.searchParams.get("documentId");
      return { documentId: documentId ? String(documentId).trim() : null };
    } catch (_err) {
      return { documentId: null };
    }
  }

  // Fallback: treat as raw document ID.
  return { documentId: raw };
}

async function generateQrCodeDataUrl(text) {
  return QRCode.toDataURL(text, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 280,
  });
}

module.exports = {
  buildVerificationUrl,
  parseScanData,
  generateQrCodeDataUrl,
};

