const crypto = require("crypto");

function normalizeSha256(hash) {
  return String(hash || "").trim().toLowerCase();
}

function isSha256Hex(hash) {
  return /^[a-f0-9]{64}$/.test(normalizeSha256(hash));
}

function compareHashesSecure(a, b) {
  const hashA = normalizeSha256(a);
  const hashB = normalizeSha256(b);
  if (!isSha256Hex(hashA) || !isSha256Hex(hashB)) return false;

  const bufferA = Buffer.from(hashA, "hex");
  const bufferB = Buffer.from(hashB, "hex");
  if (bufferA.length !== bufferB.length) return false;

  return crypto.timingSafeEqual(bufferA, bufferB);
}

module.exports = { normalizeSha256, isSha256Hex, compareHashesSecure };

