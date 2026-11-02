const path = require("path");
const fs = require("fs");

function getStorageDriver() {
  const raw = String(process.env.DOCUMENT_STORAGE_DRIVER || "local").toLowerCase();
  if (raw === "cloud" || raw === "ipfs" || raw === "local") return raw;
  return "local";
}

function ensureDirIfNeeded(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function getLocalUploadDir() {
  const folder = process.env.UPLOAD_DIR || "uploads";
  const absolute = path.resolve(process.cwd(), folder);
  ensureDirIfNeeded(absolute);
  return absolute;
}

async function persistUploadedFile(file) {
  const driver = getStorageDriver();

  // Multer already saved the file locally. For cloud/IPFS this service is the extension point.
  if (driver === "cloud") {
    return {
      storageProvider: "cloud",
      storagePath: file.path,
      ipfsCid: null,
      statusNote: "Stored locally. Replace with cloud adapter integration.",
    };
  }

  if (driver === "ipfs") {
    return {
      storageProvider: "ipfs",
      storagePath: file.path,
      ipfsCid: null,
      statusNote: "Stored locally. Replace with IPFS pinning integration.",
    };
  }

  return {
    storageProvider: "local",
    storagePath: file.path,
    ipfsCid: null,
    statusNote: "Stored in local uploads directory.",
  };
}

module.exports = { getStorageDriver, getLocalUploadDir, persistUploadedFile };

