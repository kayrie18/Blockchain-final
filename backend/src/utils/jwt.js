const jwt = require("jsonwebtoken");

function signAuthToken({ userId, role }) {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    const err = new Error("JWT_SECRET is required");
    err.statusCode = 500;
    throw err;
  }

  const expiresIn = process.env.JWT_EXPIRES_IN || "7d";
  return jwt.sign({ sub: userId, role }, secret, { expiresIn });
}

function verifyAuthToken(token) {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    const err = new Error("JWT_SECRET is required");
    err.statusCode = 500;
    throw err;
  }

  return jwt.verify(token, secret);
}

module.exports = { signAuthToken, verifyAuthToken };

