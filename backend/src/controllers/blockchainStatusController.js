const { getBlockchainStatus } = require('../services/blockchainStatusService');

async function getStatus(req, res, next) {
  try {
    const status = await getBlockchainStatus();
    return res.status(200).json(status);
  } catch (err) {
    return next(err);
  }
}

module.exports = { getStatus };

