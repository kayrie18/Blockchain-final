const dotenv = require("dotenv");
dotenv.config();

const { createApp } = require("./app");
const { connectToDatabase } = require("./config/db");
const { User, ROLES } = require("./models/User");

/**
 * Validate required environment variables at startup.
 * Production deployment will fail immediately if critical config is missing.
 */
function validateEnvironment() {
  const required = [
    'MONGODB_URI',
    'JWT_SECRET',
  ];

  const missing = required.filter(key => !process.env[key]);
  if (missing.length > 0) {
    console.error(`FATAL: Missing required environment variables: ${missing.join(', ')}`);
    process.exit(1);
  }

  // Optional but recommended secrets. Allow startup in development if these are missing,
  // but log clear warnings so operators can configure them for production.
  const optional = ['SIGNING_PRIVATE_KEY', 'STORAGE_ENCRYPTION_KEY'];
  const optionalMissing = optional.filter(key => !process.env[key]);
  if (optionalMissing.length > 0) {
    console.warn(`WARNING: Optional environment variables not set: ${optionalMissing.join(', ')}. ` +
      `Functionality relying on these (signing/encryption) will be limited.`);
  }
}

async function seedAdmin() {
  try {
    const adminEmail = process.env.INITIAL_ADMIN_EMAIL;
    const adminPassword = process.env.INITIAL_ADMIN_PASSWORD;

    if (!adminEmail || !adminPassword) {
      console.log("Admin seeding skipped: INITIAL_ADMIN_EMAIL or INITIAL_ADMIN_PASSWORD not set.");
      return;
    }

    let admin = await User.findOne({ email: adminEmail });
    if (!admin) {
      console.log(`Seeding initial admin account: ${adminEmail}`);
      admin = new User({
        name: "System Administrator",
        email: adminEmail,
        role: ROLES.Admin
      });
      admin.password = adminPassword;
      await admin.save();
    }
  } catch (err) {
    console.error("Failed to seed admin:", err);
  }
}

async function start() {
  // Validate all critical env vars before attempting startup
  validateEnvironment();

  const port = process.env.PORT || 5000;

  await connectToDatabase(process.env.MONGODB_URI);
  await seedAdmin();

  const app = createApp();
  app.listen(port, () => {
    // Keep startup log minimal and useful.
    console.log(`API listening on port ${port}`);
  });
}

start().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});

