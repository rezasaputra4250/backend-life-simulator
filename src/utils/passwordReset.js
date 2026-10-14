const crypto = require('crypto');

function createResetToken() {
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashResetToken(token);

  return {
    token,
    tokenHash,
  };
}

function hashResetToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

module.exports = {
  createResetToken,
  hashResetToken,
};
