require("@nomicfoundation/hardhat-toolbox");

/** @type import('hardhat/config').HardhatUserConfig */
const config = {
  solidity: "0.8.28",
  disableTelemetry: true,
  networks: {
    hardhat: {
      // Local network configuration
    },
    localhost: {
      url: "http://127.0.0.1:8545"
    }
  }
};

module.exports = config;
