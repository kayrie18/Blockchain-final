const hre = require("hardhat");

async function main() {
  console.log("Deploying DocumentIntegrity contract...");

  // Get the contract factory
  const DocumentIntegrity = await hre.ethers.getContractFactory("DocumentIntegrity");

  // Deploy the contract
  const contract = await DocumentIntegrity.deploy();

  // Wait for deployment to complete
  await contract.waitForDeployment();
  
  const contractAddress = await contract.getAddress();

  console.log("✅ DocumentIntegrity deployed to:", contractAddress);

  // Save contract details for backend configuration
  console.log("\n📋 Add these to your backend .env file:");
  console.log("DOC_INTEGRITY_CONTRACT_ADDRESS=" + contractAddress);
  console.log("ETH_RPC_URL=http://127.0.0.1:8545 (when running 'npx hardhat node')");
  console.log("ETH_CHAIN_ID=31337");

  // Get signer info
  const [deployer] = await hre.ethers.getSigners();
  console.log("\n👤 Deployer Account:", deployer.address);
  console.log("Set ETH_PRIVATE_KEY from a secure local secret store. Never reuse development keys in production.");

  return contractAddress;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
