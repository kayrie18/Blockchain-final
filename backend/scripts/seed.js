require("dotenv").config();
const mongoose = require("mongoose");
const { User, ROLES } = require("../src/models/User");

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/chainverify";

async function seed() {
  console.log("---- Database Seeding script Started ----");
  try {
    console.log(`Connecting to MongoDB at: ${MONGODB_URI}`);
    await mongoose.connect(MONGODB_URI);
    console.log("Status: Connected.");

    // Clean up existing defaults just in case we are re-running
    await User.deleteMany({ email: { $in: ["admin@chainverify.com", "verifier@chainverify.com"] } });
    console.log("Status: Old seed remnants cleared.");

    const admin = new User({
      name: "System Admin",
      email: "admin@chainverify.com",
      role: ROLES.Admin,
      organization: "ChainVerify Foundation",
      isVerifierApproved: true,
    });
    admin.password = "admin123";
    await admin.save();
    console.log(`Status: Created Main Admin account (admin@chainverify.com)`);

    const verifier = new User({
      name: "Global Verifier",
      email: "verifier@chainverify.com",
      role: ROLES.Verifier,
      organization: "World Health Org",
      isVerifierApproved: true, // Specifically setting to true to bypass sandbox logic
    });
    verifier.password = "verifier123";
    await verifier.save();
    console.log(`Status: Created Sandbox Verifier account (verifier@chainverify.com)`);

    console.log("---- Success ----");
    console.log("You may now log in with the following sets of credentials:");
    console.log("  [Admin]    email: admin@chainverify.com       | password: admin123");
    console.log("  [Verifier] email: verifier@chainverify.com    | password: verifier123");
    console.log("-----------------");

  } catch (err) {
    console.error("Fatal Error during seeding:");
    console.error(err);
  } finally {
    await mongoose.disconnect();
    console.log("Status: Disconnected.");
    process.exit(0);
  }
}

seed();
