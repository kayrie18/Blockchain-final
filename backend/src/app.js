const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const path = require("path");
const fs = require("fs");

const { getLocalUploadDir } = require("./services/storageService");
const { requestTimingMiddleware, getPerformanceSnapshot } = require("./utils/performance");

const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const documentRoutes = require("./routes/documentRoutes");
const blockchainRoutes = require("./routes/blockchainRoutes");
const metadataRoutes = require("./routes/metadataRoutes");
const searchRoutes = require("./routes/searchRoutes");
const verificationRoutes = require("./routes/verificationRoutes");
const qrRoutes = require("./routes/qrRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const managementRoutes = require("./routes/managementRoutes");
const exportRoutes = require("./routes/exportRoutes");
const blockchainStatusRoutes = require("./routes/blockchainStatusRoutes");
const certificateRoutes = require("./routes/certificateRoutes");
const adminEmailRoutes = require("./routes/adminEmailRoutes");
const blockchainEventsRoutes = require("./routes/blockchainEventsRoutes");
const aiRoutes = require("./routes/aiRoutes");





function createApp() {
  const app = express();

  app.use(helmet());
  const allowedOrigins = new Set(
    String(process.env.CORS_ORIGINS || process.env.FRONTEND_BASE_URL || "")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean)
  );
  app.use(cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (allowedOrigins.has(origin)) return callback(null, true);
      if (process.env.NODE_ENV !== "production") {
        try {
          const parsed = new URL(origin);
          if (["localhost", "127.0.0.1"].includes(parsed.hostname)) return callback(null, true);
        } catch {}
      }
      const error = new Error("Origin is not allowed by CORS");
      error.statusCode = 403;
      return callback(error);
    },
  }));
  app.use(express.json({ limit: "1mb" }));
  app.use(morgan("dev"));
  app.use(requestTimingMiddleware);

  const frontendDistPath = path.resolve(__dirname, '../..', 'frontend', 'dist');
  const hasFrontendDist = fs.existsSync(frontendDistPath);

  if (hasFrontendDist) {
    app.use(express.static(frontendDistPath, { extensions: ['html'] }));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
        return next();
      }
      return res.sendFile(path.join(frontendDistPath, 'index.html'));
    });
  } else {
    app.get('/', (_req, res) => {
      res.status(200).type('text/plain').send('ChainVerify API is running. Use the frontend UI or /api/* endpoints.');
    });
  }

  // Serve static files from the uploads directory
  app.use('/uploads', express.static(getLocalUploadDir()));

  app.get('/health', (_req, res) => {
    res.status(200).json({ ok: true });
  });

  app.get("/api/health", (_req, res) => {
    res.status(200).json({ ok: true });
  });

  app.get("/api/health/performance", (_req, res) => {
    res.status(200).json({
      ok: true,
      performance: getPerformanceSnapshot(),
    });
  });

  app.use("/api/auth", authRoutes);
  app.use("/api/users", userRoutes);
  app.use("/api/documents", documentRoutes);
  app.use("/api/blockchain", blockchainRoutes);
  app.use("/api/metadata", metadataRoutes);
  app.use("/api/search", searchRoutes);
  app.use("/api/verification", verificationRoutes);
  app.use("/api/qr", qrRoutes);
  app.use("/api/dashboard", dashboardRoutes);
  app.use("/api/management", managementRoutes);
  app.use("/api/export", exportRoutes);
  app.use("/api/certificates", certificateRoutes);
  app.use("/api/admin/email", adminEmailRoutes);
  app.use("/api/ai", aiRoutes);

  app.use("/api/blockchain", blockchainStatusRoutes);
  app.use("/api/blockchain", blockchainEventsRoutes);
  // Mount remaining blockchain routes under the same /api/blockchain base.
  // This keeps blockchain status and event endpoints available.








  app.use((err, req, res, next) => {
    const status = err.statusCode || 500;
    const message = process.env.NODE_ENV === "production" && status >= 500
      ? "Internal Server Error"
      : err.message || "Internal Server Error";
    res.status(status).json({
      error: {
        message,
        ...(process.env.NODE_ENV === "production" ? {} : { stack: err.stack }),
      },
    });
  });

  return app;
}

module.exports = { createApp };
