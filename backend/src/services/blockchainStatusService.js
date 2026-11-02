const { ethers } = require('ethers');
const abi = require('../contracts/DocumentIntegrity.abi.json');

function getProvider() {
  if (!process.env.ETH_RPC_URL) return null;
  return new ethers.JsonRpcProvider(process.env.ETH_RPC_URL);
}

async function getBlockchainStatus() {
  const provider = getProvider();
  const contractAddress = process.env.DOC_INTEGRITY_CONTRACT_ADDRESS;

  const configured = {
    ethRpcUrlConfigured: Boolean(process.env.ETH_RPC_URL),
    contractAddressConfigured: Boolean(contractAddress && contractAddress !== '0x0000000000000000000000000000000000000000'),
    hasPrivateKeyConfigured: Boolean(process.env.ETH_PRIVATE_KEY),
  };

  if (!provider || !configured.ethRpcUrlConfigured) {
    return {
      ok: false,
      configured,
      error: 'ETH_RPC_URL not configured',
      isReadConfigured: false,
      isWriteConfigured: false,
    };
  }

  const isReadConfigured = Boolean(
    process.env.ETH_RPC_URL &&
      process.env.DOC_INTEGRITY_CONTRACT_ADDRESS &&
      process.env.DOC_INTEGRITY_CONTRACT_ADDRESS !== '0x0000000000000000000000000000000000000000'
  );

  const isWriteConfigured = Boolean(
    process.env.ETH_RPC_URL &&
      process.env.ETH_PRIVATE_KEY &&
      process.env.DOC_INTEGRITY_CONTRACT_ADDRESS &&
      process.env.DOC_INTEGRITY_CONTRACT_ADDRESS !== '0x0000000000000000000000000000000000000000'
  );

  const result = {
    ok: true,
    configured,
    isReadConfigured,
    isWriteConfigured,
    chainId: null,
    latestBlock: null,
    contractAddress: contractAddress || null,
    contractCodePresent: null,
    latestBlockTs: null,
  };

  try {
    const chainId = await provider.getNetwork();
    result.chainId = chainId?.chainId ?? null;
    if (process.env.ETH_CHAIN_ID && chainId.chainId !== BigInt(process.env.ETH_CHAIN_ID)) {
      return { ...result, ok: false, error: "Connected blockchain chain ID does not match ETH_CHAIN_ID" };
    }

    const block = await provider.getBlock('latest');
    result.latestBlock = block?.number ?? null;
    result.latestBlockTs = block?.timestamp ?? null;

    if (contractAddress && contractAddress !== '0x0000000000000000000000000000000000000000') {
      const code = await provider.getCode(contractAddress);
      result.contractCodePresent = Boolean(code && code !== '0x');
      if (!result.contractCodePresent) {
        return { ...result, ok: false, error: "No contract code found at DOC_INTEGRITY_CONTRACT_ADDRESS" };
      }
    }

    return result;
  } catch (err) {
    return {
      ...result,
      ok: false,
      error: err?.shortMessage || err?.message || 'Failed to query blockchain status',
    };
  }
}

module.exports = { getBlockchainStatus };

