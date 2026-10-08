const { afterEach, test } = require("node:test");
const assert = require("node:assert/strict");

const { analyzeDocumentText, supportsDocumentText, validateAnalysis } = require("../src/services/aiAnalysisService");
const { sendSha256HashEmail } = require("../src/services/emailService");

const environmentKeys = ["AI_MODEL", "AI_API_KEY", "AI_PROVIDER", "SMTP_HOST", "SMTP_USER", "SMTP_PASSWORD"];
const previousEnvironment = Object.fromEntries(environmentKeys.map((key) => [key, process.env[key]]));

afterEach(() => {
  for (const key of environmentKeys) {
    if (previousEnvironment[key] === undefined) delete process.env[key];
    else process.env[key] = previousEnvironment[key];
  }
});

test("AI analysis rejects unconfigured providers instead of fabricating a result", async () => {
  process.env.AI_MODEL = "";
  process.env.AI_API_KEY = "";
  await assert.rejects(
    analyzeDocumentText({ text: "sample", documentType: "letter" }),
    (error) => error.statusCode === 503 && /AI analysis unavailable/.test(error.message)
  );
});

test("AI analysis accepts only text and CSV document types", () => {
  assert.equal(supportsDocumentText({ mimeType: "text/plain", originalFileName: "file.txt" }), true);
  assert.equal(supportsDocumentText({ mimeType: "application/pdf", originalFileName: "file.pdf" }), false);
});

test("AI result validation rejects authenticity-shaped or malformed output", () => {
  assert.throws(() => validateAnalysis({
    riskLevel: "AUTHENTIC",
    confidence: 0.99,
    findings: [],
    recommendation: "Accept this document",
  }));
  assert.deepEqual(validateAnalysis({
    riskLevel: "LOW",
    confidence: 0.8,
    findings: ["No structural anomaly observed"],
    recommendation: "Continue normal verification.",
  }).riskLevel, "LOW");
});

test("hash email fails clearly when SMTP is not configured", async () => {
  process.env.SMTP_HOST = "";
  process.env.SMTP_USER = "";
  process.env.SMTP_PASSWORD = "";
  await assert.rejects(
    sendSha256HashEmail({
      to: "recipient@example.test",
      documentId: "0123456789abcdef01234567",
      documentTitle: "Test",
      sha256Hash: "a".repeat(64),
      verificationUrl: "https://chainverify.invalid/?verify=test",
    }),
    (error) => error.statusCode === 503 && /not configured/.test(error.message)
  );
});