const crypto = require("crypto");
const nodemailer = require("nodemailer");

const EMAIL_FROM = process.env.SMTP_FROM || process.env.EMAIL_FROM || "ChainVerify <no-reply@chainverify.com>";
const EMAIL_REPLY_TO = process.env.EMAIL_REPLY_TO || "support@chainverify.com";
const FRONTEND_BASE_URL = process.env.FRONTEND_BASE_URL || "";
const EMAIL_VERIFICATION_BASE_URL = process.env.EMAIL_VERIFICATION_BASE_URL || (FRONTEND_BASE_URL ? `${FRONTEND_BASE_URL}/verify-email` : "");
const PASSWORD_RESET_BASE_URL = process.env.PASSWORD_RESET_BASE_URL || (FRONTEND_BASE_URL ? `${FRONTEND_BASE_URL}/reset-password` : "");
const DEBUG_EMAIL_FORWARD_TO = process.env.DEBUG_EMAIL_FORWARD_TO || null;

function getSmtpConfig() {
  return {
    host: process.env.SMTP_HOST || "",
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    user: process.env.SMTP_USER || "",
    password: process.env.SMTP_PASSWORD || "",
    rejectUnauthorized: process.env.SMTP_REJECT_UNAUTHORIZED !== "false",
    connectionTimeout: Number(process.env.SMTP_CONNECTION_TIMEOUT || 10000),
  };
}

function isSmtpConfigured() {
  const { host, user, password } = getSmtpConfig();
  return Boolean(host && user && password);
}

let transporter = null;

async function ensureTransporter() {
  if (transporter) return transporter;

  const smtp = getSmtpConfig();
  if (isSmtpConfigured()) {
    transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth: {
        user: smtp.user,
        pass: smtp.password,
      },
      tls: {
        rejectUnauthorized: smtp.rejectUnauthorized,
      },
      pool: true,
      maxConnections: 3,
      maxMessages: 100,
      connectionTimeout: smtp.connectionTimeout,
    });
    return transporter;
  }

  if (process.env.EMAIL_USE_ETHEREAL === "true") {
    try {
      const { transporter: etherealTransporter, account } = await createEtherealTransporter();
      transporter = etherealTransporter;
      console.warn("Using Ethereal test account for SMTP delivery:", account.user);
      return transporter;
    } catch (err) {
      console.error("Failed to initialize Ethereal test transport:", err.message || err);
    }
  }

  console.warn("SMTP delivery is not configured. Email notifications will be logged in preview mode only.");
  return null;
}

async function createEtherealTransporter() {
  const account = await nodemailer.createTestAccount();
  const t = nodemailer.createTransport({
    host: account.smtp.host,
    port: account.smtp.port,
    secure: account.smtp.secure,
    auth: { user: account.user, pass: account.pass },
  });
  return { transporter: t, account };
}

const { EmailDelivery } = require("../models/EmailDelivery");

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function generateToken() {
  return crypto.randomBytes(24).toString("hex");
}

function renderEmailHtml({ subject, preheader, bodyHtml, ctaUrl, ctaText, footerText }) {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${subject}</title>
  </head>
  <body style="margin:0;padding:0;font-family:Inter,system-ui,Arial,sans-serif;background:#f4f7fb;color:#1f2937;">
    <table cellpadding="0" cellspacing="0" width="100%" style="background:#f4f7fb;padding:32px 16px;">
      <tr>
        <td align="center">
          <table cellpadding="0" cellspacing="0" width="100%" style="max-width:620px;background:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 24px 60px rgba(15,23,42,.12);">
            <tr>
              <td style="background:#0f172a;padding:24px 28px;text-align:center;color:#ffffff;">
                <h1 style="margin:0;font-size:24px;letter-spacing:.02em;font-weight:900;text-transform:uppercase;">ChainVerify</h1>
                <p style="margin:8px 0 0;color:#cbd5e1;font-size:14px;">Enterprise document integrity platform</p>
              </td>
            </tr>
            <tr>
              <td style="padding:32px 32px 24px;">
                <p style="margin:0 0 16px;color:#334155;font-size:16px;line-height:1.7;">${preheader}</p>
                <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:18px;padding:24px;">
                  ${bodyHtml}
                </div>
                ${ctaUrl ? `
                <p style="margin:24px 0 0;text-align:center;">
                  <a href="${ctaUrl}" style="display:inline-block;padding:14px 28px;border-radius:12px;background:#0f172a;color:#ffffff;text-decoration:none;font-weight:700;">${ctaText || "Continue"}</a>
                </p>
                ` : ""}
              </td>
            </tr>
            <tr>
              <td style="padding:24px 32px 32px;border-top:1px solid #e2e8f0;color:#64748b;font-size:12px;line-height:1.6;">
                <p style="margin:0 0 6px;">${footerText || 'If you did not request this, please ignore this email or contact support.'}</p>
                <p style="margin:0;color:#94a3b8;">ChainVerify · Trusted blockchain verification for enterprise assets.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function renderEmailText({ bodyText, ctaUrl }) {
  return `${bodyText}

${ctaUrl ? `Open link: ${ctaUrl}
` : ""}

ChainVerify`;
}

async function sendMail({
  to,
  subject,
  html,
  text,
  deliveryMetadata,
  deliveryId,
  storeContent = true,
  forwardToDebug = true,
}) {
  if (!to) {
    throw new Error("Email recipient is required");
  }
  const mail = {
    from: EMAIL_FROM,
    to: forwardToDebug && process.env.NODE_ENV !== "production" ? (DEBUG_EMAIL_FORWARD_TO || to) : to,
    replyTo: EMAIL_REPLY_TO,
    subject,
    text: text || "",
    html,
  };
  // Persist delivery attempt record (pending)
  const delivery = deliveryId
    ? await EmailDelivery.findById(deliveryId).exec()
    : await EmailDelivery.create({
      to,
      subject,
      ...(storeContent ? { html, text } : {}),
      metadata: deliveryMetadata || {},
      status: "pending",
    });
  if (!delivery) {
    const error = new Error("Email delivery record was not found");
    error.statusCode = 404;
    throw error;
  }

  const activeTransporter = await ensureTransporter();
  if (!activeTransporter) {
    const error = new Error("Email delivery is not configured. Configure SMTP_HOST, SMTP_USER, and SMTP_PASSWORD.");
    error.statusCode = 503;
    await EmailDelivery.findByIdAndUpdate(delivery._id, {
      $push: { attempts: { at: new Date(), errorMessage: error.message, info: {} } },
      status: "failed",
      lastAttemptAt: new Date(),
    }).exec();
    throw error;
  }

  // Try sending with retries and exponential backoff
  const maxAttempts = Number(process.env.EMAIL_MAX_RETRIES || 3);
  let attempt = 0;
  let lastError = null;

  async function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  while (attempt < maxAttempts) {
    attempt += 1;
    try {
      const information = await activeTransporter.sendMail(mail);
      if (!information.accepted?.includes(mail.to) || information.rejected?.includes(mail.to)) {
        throw new Error("SMTP server did not accept the recipient address");
      }
      // If using Ethereal, capture preview URL
      const previewUrl = nodemailer.getTestMessageUrl ? nodemailer.getTestMessageUrl(information) : null;
      // Mark delivery as sent
      await EmailDelivery.findByIdAndUpdate(delivery._id, {
        $push: { attempts: { at: new Date(), errorMessage: null, info: { accepted: information.accepted, rejected: information.rejected, previewUrl } } },
        status: "sent",
        messageId: information.messageId || null,
        lastAttemptAt: new Date(),
      }).exec();
      return { accepted: information.accepted, rejected: information.rejected, messageId: information.messageId };
    } catch (err) {
      lastError = err;
      console.error(`Email delivery attempt ${attempt} failed:`, err.message || err.toString());
      await EmailDelivery.findByIdAndUpdate(delivery._id, {
        $push: { attempts: { at: new Date(), errorMessage: err.message || String(err), info: {} } },
        status: attempt >= maxAttempts ? "failed" : "pending",
        lastAttemptAt: new Date(),
      }).exec();

      if (attempt >= maxAttempts) break;
      const backoffMs = Math.min(1000 * 2 ** attempt, 30000);
      await sleep(backoffMs);
    }
  }

  // All attempts failed
  throw lastError;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);
}

async function sendSha256HashEmail({ to, documentId, documentTitle, sha256Hash, verificationUrl, message }) {
  if (!isSmtpConfigured()) {
    const error = new Error("Email delivery is not configured. Configure SMTP_HOST, SMTP_USER, and SMTP_PASSWORD.");
    error.statusCode = 503;
    throw error;
  }

  const subject = `ChainVerify SHA-256 hash: ${String(documentTitle).slice(0, 100)}`;
  const safeTitle = escapeHtml(documentTitle);
  const safeHash = escapeHtml(sha256Hash);
  const safeMessage = escapeHtml(message || "").replace(/\r?\n/g, "<br>");
  const verificationInstructions = verificationUrl
    ? `Verify this hash in ChainVerify: ${verificationUrl}`
    : "Open ChainVerify and search the complete SHA-256 hash in the public verification registry.";
  const html = renderEmailHtml({
    subject,
    preheader: "A document SHA-256 integrity hash was shared with you.",
    bodyHtml: `<p><strong>Document:</strong> ${safeTitle}</p>
      <p><strong>SHA-256:</strong><br><code style="word-break:break-all">${safeHash}</code></p>
      <p>${escapeHtml(verificationInstructions)}</p>
      ${safeMessage ? `<p><strong>Message from sender:</strong><br>${safeMessage}</p>` : ""}`,
    ctaUrl: verificationUrl,
    ctaText: "Verify Hash",
  });
  const text = `ChainVerify Document Hash\n\nDocument: ${documentTitle}\n\nSHA-256: ${sha256Hash}\n\n${verificationInstructions}${message ? `\n\nMessage from sender:\n${message}` : ""}\n\nChainVerify`;

  return sendMail({
    to,
    subject,
    html,
    text,
    deliveryMetadata: { type: "hash_share", documentId: String(documentId) },
    storeContent: false,
    forwardToDebug: false,
  });
}

async function processPendingDeliveries(limit = 20) {
  const activeTransporter = await ensureTransporter();
  if (!activeTransporter) return { processed: 0, reason: "email-disabled" };
  const pending = await EmailDelivery.find({
    status: "pending",
    "metadata.type": { $ne: "hash_share" },
  }).sort({ createdAt: 1 }).limit(limit).exec();
  let processed = 0;
  for (const d of pending) {
    try {
      await sendMail({
        to: d.to,
        subject: d.subject,
        html: d.html,
        text: d.text,
        deliveryId: d._id,
      });
      processed += 1;
    } catch (err) {
      // sendMail already logs attempts
      processed += 1;
    }
  }
  return { processed };
}

async function sendVerificationEmail(user, token) {
  if (!EMAIL_VERIFICATION_BASE_URL) {
    console.warn("EMAIL_VERIFICATION_BASE_URL not configured, skipping email verification");
    return null;
  }
  const verifyUrl = `${EMAIL_VERIFICATION_BASE_URL}/${token}`;
  const subject = "Verify Your ChainVerify Account";
  const bodyHtml = `
    <p style="margin:0 0 16px;">Hi ${user.name},</p>
    <p style="margin:0 0 16px;">Thank you for joining ChainVerify. Confirm your email address to unlock secure dashboard access, document upload approvals, and blockchain-backed verification services.</p>
    <p style="margin:0 0 16px;color:#334155;font-size:14px;line-height:1.7;"><strong>Verify your account:</strong></p>
    <p style="margin:0 0 16px;color:#0f172a;word-break:break-word;">${verifyUrl}</p>
  `;
  const html = renderEmailHtml({ subject, preheader: "Verify your ChainVerify account.", bodyHtml, ctaUrl: verifyUrl, ctaText: "Verify Email" });
  const text = renderEmailText({ bodyText: `Hi ${user.name},

Thank you for joining ChainVerify. Confirm your email address using the link below:

${verifyUrl}
`, ctaUrl: verifyUrl });
  return sendMail({ to: user.email, subject, html, text });
}

async function sendPasswordResetEmail(user, token) {
  if (!PASSWORD_RESET_BASE_URL) {
    console.warn("PASSWORD_RESET_BASE_URL not configured, skipping password reset email");
    return null;
  }
  const resetUrl = `${PASSWORD_RESET_BASE_URL}?token=${token}`;
  const subject = "Reset Your ChainVerify Password";
  const bodyHtml = `
    <p style="margin:0 0 16px;">Hi ${user.name},</p>
    <p style="margin:0 0 16px;">We received a request to reset your ChainVerify password. Use the secure link below to choose a new password. This link expires in one hour.</p>
    <p style="margin:0 0 16px;color:#0f172a;word-break:break-word;">${resetUrl}</p>
  `;
  const html = renderEmailHtml({ subject, preheader: "Reset your ChainVerify password.", bodyHtml, ctaUrl: resetUrl, ctaText: "Reset Password" });
  const text = renderEmailText({ bodyText: `Hi ${user.name},

We received a request to reset your ChainVerify password. Use the link below:

${resetUrl}

If you did not request this, please ignore this email.`, ctaUrl: resetUrl });
  return sendMail({ to: user.email, subject, html, text });
}

async function sendPasswordChangeNotification(user) {
  const subject = "Your ChainVerify Password Was Updated";
  const bodyHtml = `
    <p style="margin:0 0 16px;">Hi ${user.name},</p>
    <p style="margin:0 0 16px;">This is a confirmation that your ChainVerify password was successfully updated. If you did not make this change, please contact support immediately.</p>
  `;
  const html = renderEmailHtml({ subject, preheader: "Your password was updated.", bodyHtml, footerText: "If you did not authorize this, please contact support immediately." });
  const text = renderEmailText({ bodyText: `Hi ${user.name},

Your ChainVerify password was successfully updated.

If you did not make this change, please contact support immediately.` });
  return sendMail({ to: user.email, subject, html, text });
}

async function sendDocumentUploadNotification(user, document) {
  if (!FRONTEND_BASE_URL) {
    console.warn("FRONTEND_BASE_URL not configured, skipping document upload notification");
    return null;
  }
  const docStatus = document.status === "verified" ? "Verified and Anchored" : "Received and Pending Verification";
  const docUrl = `${FRONTEND_BASE_URL}/documents/${document._id}`;
  const subject = `Document Received — ${document.title}`;
  const bodyHtml = `
    <p style="margin:0 0 16px;">Hi ${user.name},</p>
    <p style="margin:0 0 16px;">Your document <strong>${document.title}</strong> has been successfully uploaded to ChainVerify.</p>
    <p style="margin:0 0 16px;">Status: <strong>${docStatus}</strong></p>
    <p style="margin:0 0 16px;">Document ID: <code style="color:#0f172a;word-break:break-word;">${document._id}</code></p>
  `;
  const html = renderEmailHtml({ subject, preheader: "Your document upload is received.", bodyHtml, ctaUrl: docUrl, ctaText: "View Document Status" });
  const text = renderEmailText({ bodyText: `Hi ${user.name},

Your document ${document.title} has been successfully uploaded to ChainVerify.

Status: ${docStatus}
Document ID: ${document._id}

View details: ${docUrl}` });
  return sendMail({ to: user.email, subject, html, text });
}

async function sendDocumentApprovalNotification(user, document) {
  if (!FRONTEND_BASE_URL) {
    console.warn("FRONTEND_BASE_URL not configured, skipping document approval notification");
    return null;
  }
  const docUrl = `${FRONTEND_BASE_URL}/documents/${document._id}`;
  const subject = `Document Approved — ${document.title}`;
  const bodyHtml = `
    <p style="margin:0 0 16px;">Hi ${user.name},</p>
    <p style="margin:0 0 16px;">Your pending document <strong>${document.title}</strong> has been approved and anchored on the blockchain.</p>
    <p style="margin:0 0 16px;">Transaction ID: <strong>${document.blockchain?.transactionId || "Pending"}</strong></p>
  `;
  const html = renderEmailHtml({ subject, preheader: "Your document was approved.", bodyHtml, ctaUrl: docUrl, ctaText: "Review Document" });
  const text = renderEmailText({ bodyText: `Hi ${user.name},

Your pending document ${document.title} has been approved and anchored on the blockchain.

Transaction ID: ${document.blockchain?.transactionId || "Pending"}

View details: ${docUrl}` });
  return sendMail({ to: user.email, subject, html, text });
}

async function sendDocumentRejectionNotification(user, document) {
  if (!FRONTEND_BASE_URL) {
    console.warn("FRONTEND_BASE_URL not configured, skipping document rejection notification");
    return null;
  }
  const docUrl = `${FRONTEND_BASE_URL}/documents/${document._id}`;
  const subject = `Document Rejected — ${document.title}`;
  const bodyHtml = `
    <p style="margin:0 0 16px;">Hi ${user.name},</p>
    <p style="margin:0 0 16px;">Your document <strong>${document.title}</strong> was reviewed and has been rejected.</p>
    <p style="margin:0 0 16px;">Reason: <strong>${document.rejectionReason || "Not provided"}</strong></p>
  `;
  const html = renderEmailHtml({ subject, preheader: "A document was rejected.", bodyHtml, ctaUrl: docUrl, ctaText: "Review Document Status" });
  const text = renderEmailText({ bodyText: `Hi ${user.name},

Your document ${document.title} was reviewed and rejected.

Reason: ${document.rejectionReason || "Not provided"}

Review status: ${docUrl}` });
  return sendMail({ to: user.email, subject, html, text });
}

module.exports = {
  emailEnabled: isSmtpConfigured() || process.env.EMAIL_USE_ETHEREAL === "true",
  isSmtpConfigured,
  generateToken,
  hashToken,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendPasswordChangeNotification,
  sendDocumentUploadNotification,
  sendDocumentApprovalNotification,
  sendDocumentRejectionNotification,
  sendSha256HashEmail,
  processPendingDeliveries,
};
