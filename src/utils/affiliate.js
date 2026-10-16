const crypto = require('crypto');

function generateAffiliateCode() {
  return crypto.randomBytes(5).toString('hex').toUpperCase();
}

module.exports = { generateAffiliateCode };
