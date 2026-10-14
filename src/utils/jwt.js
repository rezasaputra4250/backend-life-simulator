const jwt = require('jsonwebtoken');
const env = require('../config/env');

function signAuthToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
    },
    env.jwt.secret,
    {
      expiresIn: env.jwt.expiresIn,
    }
  );
}

module.exports = {
  signAuthToken,
};
