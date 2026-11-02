const crypto = require("crypto");

const ALGORITHM = "aes-256-cbc";

/**
 * Retrieve a cryptographically secure 32-byte key derived from the environment config.
 * STORAGE_ENCRYPTION_KEY is validated at startup in server.js
 */
function getEncryptionKey() {
  const secret = process.env.STORAGE_ENCRYPTION_KEY || process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("STORAGE_ENCRYPTION_KEY or JWT_SECRET not configured");
  }
  return crypto.createHash("sha256").update(secret).digest();
}

/**
 * Encrypts a binary buffer using AES-256-CBC. Prepend a 16-byte initialization vector (IV).
 * @param {Buffer} buffer - Plaintext buffer
 * @returns {Buffer} Encrypted buffer
 */
function encrypt(buffer) {
  const iv = crypto.randomBytes(16);
  const key = getEncryptionKey();
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
  return Buffer.concat([iv, encrypted]);
}

/**
 * Decrypts a binary buffer prepended with a 16-byte IV.
 * @param {Buffer} buffer - Encrypted buffer with IV
 * @returns {Buffer} Decrypted plaintext buffer
 */
function decrypt(buffer) {
  if (buffer.length < 17) {
    throw new Error("Invalid or corrupted encrypted data.");
  }
  const iv = buffer.subarray(0, 16);
  const encrypted = buffer.subarray(16);
  const key = getEncryptionKey();
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]);
}

module.exports = { encrypt, decrypt };
