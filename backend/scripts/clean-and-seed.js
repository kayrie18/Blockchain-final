require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const { User } = require("../src/models/User");
const { Document } = require("../src/models/Document");
const { AuditLog } = require("../src/models/AuditLog");

async function cleanAndSeed() {
  try {
    const mongoUri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/bbdivs";
    await mongoose.connect(mongoUri);
    console.log("Connected to MongoDB for cleanup.");

    // Drop all collections safely
    console.log("Wiping collections...");
    await User.deleteMany({});
    await Document.deleteMany({});
    await AuditLog.deleteMany({});
    console.log("Database collections wiped successfully.");

    // Seed the secure admin user
    console.log("Seeding admin account...");
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash("123admin", salt);

    const admin = new User({
      name: "System Administrator",
      email: "admin@chainverify.com",
      passwordHash,
      role: "Admin",
      isVerifierApproved: true,
    });

    await admin.save();
    console.log("✅ Admin account seeded successfully.");
    console.log("Email: admin@chainverify.com");
    console.log("Password: 123admin");

    console.log("Clean and seed completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("Error during clean and seed:", error);
    process.exit(1);
  }
}

cleanAndSeed();
