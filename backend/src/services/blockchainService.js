const { ethers } = require("ethers");
const abi = require("../contracts/DocumentIntegrity.abi.json");

function isConfigured() {
  return isWriteConfigured();
}

function isReadConfigured() {
  return Boolean(
    process.env.ETH_RPC_URL &&
      process.env.DOC_INTEGRITY_CONTRACT_ADDRESS &&
      process.env.DOC_INTEGRITY_CONTRACT_ADDRESS !== "0x0000000000000000000000000000000000000000"
  );
}

function isWriteConfigured() {
  return Boolean(
    process.env.ETH_RPC_URL &&
      process.env.ETH_PRIVATE_KEY &&
      process.env.DOC_INTEGRITY_CONTRACT_ADDRESS &&
      process.env.DOC_INTEGRITY_CONTRACT_ADDRESS !== "0x0000000000000000000000000000000000000000"
  );
}

function getProvider() {
  return new ethers.JsonRpcProvider(process.env.ETH_RPC_URL);
}

async function assertExpectedChain(provider) {
  if (!process.env.ETH_CHAIN_ID) return;
  const network = await provider.getNetwork();
  if (network.chainId !== BigInt(process.env.ETH_CHAIN_ID)) {
    const error = new Error(`Connected blockchain chain ID ${network.chainId} does not match configured ETH_CHAIN_ID`);
    error.statusCode = 503;
    throw error;
  }
}

function getSigner(provider) {
  return new ethers.Wallet(process.env.ETH_PRIVATE_KEY, provider);
}

function getContract(signerOrProvider) {
  return new ethers.Contract(process.env.DOC_INTEGRITY_CONTRACT_ADDRESS, abi, signerOrProvider);
}

function serializeEthersError(err) {
  return {
    message: err?.shortMessage || err?.message || "Blockchain error",
    code: err?.code,
    reason: err?.reason,
    action: err?.action,
    data: err?.data,
  };
}

function normalizeHashInput(hash) {
  const hex = String(hash || "").trim();
  if (!hex) return "";
  if (hex.startsWith("0x")) return hex.toLowerCase();
  return `0x${hex.toLowerCase()}`;
}

function validateSha256Hex(hashHex) {
  const h = String(hashHex || "").trim();
  const normalized = h.startsWith("0x") ? h.slice(2) : h;
  const ok = /^[0-9a-fA-F]{64}$/.test(normalized);
  return ok;
}

async function submitDocumentHashToBlockchain(payload) {
  const documentId = String(payload.documentId);
  const sha256HashHex = normalizeHashInput(payload.sha256HashHex || payload.sha256Hash);
  if (!isWriteConfigured()) {
    const err = new Error(
      "Blockchain write is not configured (missing ETH_RPC_URL / ETH_PRIVATE_KEY / DOC_INTEGRITY_CONTRACT_ADDRESS)."
    );
    err.statusCode = 503;
    throw err;
  }

  if (!validateSha256Hex(sha256HashHex)) {
    const e = new Error("Invalid SHA-256 hex format (expected 64 hex chars)");
    e.statusCode = 400;
    throw e;
  }

  // Perform write and throw on failure so callers can handle retries/logging.
  const provider = getProvider();
  const signer = getSigner(provider);
  const contract = getContract(signer);

  try {
    await assertExpectedChain(provider);
    const normalizedHash = normalizeHashInput(sha256HashHex);
    const tx = await contract.storeDocumentHash(documentId, normalizedHash);
    // Wait for confirmation (with default provider behavior)
    const receipt = await tx.wait();

    if (receipt?.status !== 1) {
      const e = new Error("Blockchain transaction reverted");
      e.statusCode = 502;
      e.transactionId = tx.hash;
      throw e;
    }
    const chainRecord = await contract.getDocumentHash(documentId);

    return {
      transactionId: tx.hash,
      confirmed: true,
      blockNumber: receipt.blockNumber,
      timestamp: Number(chainRecord.timestamp),
    };
  } catch (err) {
    const e = new Error(err?.shortMessage || err?.message || "Failed to store hash on-chain");
    e.statusCode = err?.statusCode || 502;
    e.details = serializeEthersError(err);
    if (err?.transactionId) e.transactionId = err.transactionId;
    throw e;
  }
}


async function storeDocumentHashOnChain({ documentId, sha256HashHex }) {
  if (!isWriteConfigured()) {
    const err = new Error(
      "Blockchain write is not configured (missing ETH_RPC_URL / ETH_PRIVATE_KEY / DOC_INTEGRITY_CONTRACT_ADDRESS)."
    );
    err.statusCode = 503;
    throw err;
  }


  try {
    const provider = getProvider();
    await assertExpectedChain(provider);
    const signer = getSigner(provider);
    const contract = getContract(signer);

    const normalizedHash = normalizeHashInput(sha256HashHex);
    const tx = await contract.storeDocumentHash(String(documentId), normalizedHash);
    const receipt = await tx.wait();

    if (receipt?.status !== 1) {
      const e = new Error("Blockchain transaction reverted");
      e.statusCode = 502;
      e.transactionId = tx.hash;
      throw e;
    }
    const chainRecord = await contract.getDocumentHash(String(documentId));

    return {
      transactionId: tx.hash,
      confirmed: true,
      blockNumber: receipt.blockNumber,
      timestamp: Number(chainRecord.timestamp),
    };
  } catch (err) {
    const e = new Error(err?.shortMessage || err?.message || "Failed to store hash on-chain");
    e.statusCode = err?.statusCode || 502;
    e.details = serializeEthersError(err);
    if (err?.transactionId) e.transactionId = err.transactionId;
    throw e;
  }
}

async function getDocumentHashFromChain({ documentId }) {
  if (!isReadConfigured()) {
    const err = new Error(
      "Blockchain read is not configured (missing ETH_RPC_URL / DOC_INTEGRITY_CONTRACT_ADDRESS)."
    );
    err.statusCode = 503;
    throw err;
  }



  try {
    const provider = getProvider();
    await assertExpectedChain(provider);
    const contract = getContract(provider);

    const result = await contract.getDocumentHash(String(documentId));
    // result may be a struct { sha256Hash: bytes32, timestamp: uint256 }
    let sha256HashHex = "";
    if (result && result.sha256Hash) {
      try {
        sha256HashHex = ethers.hexlify(result.sha256Hash).replace(/^0x/, "").toLowerCase();
        if (!/^[0-9a-f]{64}$/.test(sha256HashHex)) {
          // malformed on-chain data
          sha256HashHex = "";
        }
      } catch (hexErr) {
        sha256HashHex = "";
      }
    }
    const timestamp = result?.timestamp != null ? Number(result.timestamp) : null;

    return {
      documentId: String(documentId),
      sha256HashHex,
      timestamp,
    };
  } catch (err) {
    const e = new Error(err?.shortMessage || err?.message || "Failed to retrieve hash from blockchain");
    e.statusCode = err?.statusCode || 502;
    e.details = serializeEthersError(err);
    throw e;
  }
}

module.exports = {
  submitDocumentHashToBlockchain,
  storeDocumentHashOnChain,
  getDocumentHashFromChain,
  isConfigured,
  isReadConfigured,
  isWriteConfigured,
};

