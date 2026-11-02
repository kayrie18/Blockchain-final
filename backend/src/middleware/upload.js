const path = require("path");
const multer = require("multer");
const { getLocalUploadDir } = require("../services/storageService");

// ── Allowed MIME types ─────────────────────────────────────────────────────
const ALLOWED_MIMES = new Set([
  // PDF
  "application/pdf",
  // Images
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  // Word / Office
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  // Excel
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  // PowerPoint (.ppt + .pptx)
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  // Text / plain
  "text/plain",
  "text/csv",
  // Generic binary (catch-all for renamed files)
  "application/octet-stream",
]);

// ── Allowed file extensions (backup guard when MIME spoofed) ───────────────
const MIME_BY_EXT = {
  ".pdf": new Set(["application/pdf", "application/octet-stream"]),
  ".jpg": new Set(["image/jpeg", "application/octet-stream"]),
  ".jpeg": new Set(["image/jpeg", "application/octet-stream"]),
  ".png": new Set(["image/png", "application/octet-stream"]),
  ".gif": new Set(["image/gif", "application/octet-stream"]),
  ".webp": new Set(["image/webp", "application/octet-stream"]),
  ".doc": new Set(["application/msword", "application/octet-stream"]),
  ".docx": new Set(["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/zip", "application/octet-stream"]),
  ".xls": new Set(["application/vnd.ms-excel", "application/octet-stream"]),
  ".xlsx": new Set(["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/zip", "application/octet-stream"]),
  ".ppt": new Set(["application/vnd.ms-powerpoint", "application/octet-stream"]),
  ".pptx": new Set(["application/vnd.openxmlformats-officedocument.presentationml.presentation", "application/zip", "application/octet-stream"]),
  ".txt": new Set(["text/plain", "application/octet-stream"]),
  ".csv": new Set(["text/csv", "text/plain", "application/octet-stream"]),
};

const ALLOWED_EXTS = new Set(Object.keys(MIME_BY_EXT));

function fileFilter(_req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ALLOWED_EXTS.has(ext) && MIME_BY_EXT[ext].has(file.mimetype)) {
    return cb(null, true);
  }
  const err = new Error(
    `File type not allowed. Accepted: PDF, images, Word, Excel, PowerPoint, plain text. Got: ${file.mimetype}`
  );
  err.statusCode = 415;
  return cb(err, false);
}

// ── Disk storage ───────────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, getLocalUploadDir());
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext).replace(/\s+/g, "_");
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${base}-${unique}${ext}`);
  },
});

// ── Multer instance ────────────────────────────────────────────────────────
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 20 * 1024 * 1024, // 20 MB
    files: 1,
  },
});

module.exports = { upload };
