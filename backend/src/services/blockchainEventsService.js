const abi = require('../contracts/DocumentIntegrity.abi.json');
const { ethers } = require('ethers');

function getProvider() {
  if (!process.env.ETH_RPC_URL) return null;
  return new ethers.JsonRpcProvider(process.env.ETH_RPC_URL, process.env.ETH_CHAIN_ID ? Number(process.env.ETH_CHAIN_ID) : undefined);
}

function getBlockchainContract() {
  const provider = getProvider();
  if (!provider) return null;
  const addr = process.env.DOC_INTEGRITY_CONTRACT_ADDRESS;
  if (!addr || addr === '0x0000000000000000000000000000000000000000') return null;
  return new ethers.Contract(addr, abi, provider);
}

module.exports = { getBlockchainContract };

