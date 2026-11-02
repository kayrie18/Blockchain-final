const crypto = require("crypto");

/**
 * Generate a digital signature of the document hash using the server's private key.
 * This proves that the document was verified and issued by THIS system.
 */
function signHash(hash) {
  // SIGNING_PRIVATE_KEY is validated at startup in server.js
  const privateKey = process.env.SIGNING_PRIVATE_KEY;
  if (!privateKey) {
    // Fallback in local dev: use JWT_SECRET if provided. This avoids hard startup failure
    // while still ensuring signatures are deterministic for testing.
    if (process.env.JWT_SECRET) {
      console.warn("SIGNING_PRIVATE_KEY not set; falling back to JWT_SECRET for local signing (not recommended for production)");
      return crypto.createHmac("sha512", process.env.JWT_SECRET).update(hash).digest("hex");
    }
    throw new Error("SIGNING_PRIVATE_KEY not configured");
  }
  
  // Use HMAC-SHA512 as cryptographic signature
  return crypto
    .createHmac("sha512", privateKey)
    .update(hash)
    .digest("hex");
}

/**
 * Verify if a signature matches a hash.
 */
function verifySignature(hash, signature) {
  try {
    if (!hash || !signature || typeof signature !== 'string') {
      return false;
    }
    const expected = signHash(hash);
    // Validate signature is valid hex before conversion
    if (!/^[a-f0-9]*$/i.test(signature) || !/^[a-f0-9]*$/i.test(expected)) {
      return false;
    }
    const signatureBuffer = Buffer.from(signature, "hex");
    const expectedBuffer = Buffer.from(expected, "hex");
    if (signatureBuffer.length !== expectedBuffer.length) {
      return false;
    }
    return crypto.timingSafeEqual(signatureBuffer, expectedBuffer);
  } catch (err) {
    console.error("Signature verification error:", err.message);
    return false;
  }
}

module.exports = { signHash, verifySignature };
