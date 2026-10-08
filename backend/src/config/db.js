const mongoose = require("mongoose");

async function connectToDatabase(mongoUri) {
  if (!mongoUri) {
    const err = new Error("MONGODB_URI is required");
    err.statusCode = 500;
    throw err;
  }

  mongoose.set("strictQuery", true);

  await mongoose.connect(mongoUri, {
    autoIndex: process.env.NODE_ENV !== "production",
  });
}

module.exports = { connectToDatabase };

