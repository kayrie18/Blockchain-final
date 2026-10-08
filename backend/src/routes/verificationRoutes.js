const express = require("express");
const { verifyByDocumentId, verifyByFile } = require("../controllers/verificationController");
const { upload } = require("../middleware/upload");

const router = express.Router();

router.get("/hash/:documentId", verifyByDocumentId);
router.post("/file", upload.single("document"), verifyByFile);

module.exports = router;
