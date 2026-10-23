import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Retrieves the active JWT Secret key.
 * Warns in development or throws in production if missing.
 */
export function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('FATAL: JWT_SECRET must be configured in environment variables for production.');
    }
    return 'super_secret_jwt_key_development_default_change_me';
  }
  return secret;
}

/**
 * Retrieves the token expiration duration string (e.g. '7d', '24h').
 */
export function getJwtExpiresIn() {
  return process.env.JWT_EXPIRES_IN || '7d';
}

/**
 * Sign a payload into a cryptographically secured JWT token.
 * 
 * @param {Object} payload - User identification claims (e.g., { id, email, name })
 * @param {Object} [options] - Optional jsonwebtoken sign options
 * @returns {string} Signed JWT string
 */
export function signToken(payload, options = {}) {
  const secret = getJwtSecret();
  const expiresIn = options.expiresIn || getJwtExpiresIn();

  return jwt.sign(payload, secret, {
    algorithm: 'HS256',
    ...options,
    expiresIn
  });
}

/**
 * Verify and decode an incoming JWT token string.
 *
 * @param {string} token - The raw JWT token string
 * @returns {Object} The decoded payload
 * @throws {jwt.JsonWebTokenError | jwt.TokenExpiredError | jwt.NotBeforeError}
 */
export function verifyToken(token) {
  const secret = getJwtSecret();
  return jwt.verify(token, secret, {
    algorithms: ['HS256']
  });
}

export default {
  getJwtSecret,
  getJwtExpiresIn,
  signToken,
  verifyToken
};
