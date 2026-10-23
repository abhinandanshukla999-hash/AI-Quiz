import { verifyToken } from '../config/jwt.js';

/**
 * Express middleware to protect private API routes and verify JWT tokens.
 * Extracts the Bearer token from Authorization header, verifies signature,
 * and attaches the decoded user identity to req.user.
 */
export function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Missing Bearer token in Authorization header.'
      });
    }

    const token = authHeader.split(' ')[1];
    if (!token || token.trim() === '') {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Empty token provided.'
      });
    }

    const decoded = verifyToken(token);
    req.user = {
      id: decoded.id,
      email: decoded.email,
      name: decoded.name
    };

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        code: 'TOKEN_EXPIRED',
        message: 'Session expired. Please log in again.'
      });
    }

    return res.status(401).json({
      success: false,
      code: 'TOKEN_INVALID',
      message: 'Invalid or malformed authorization token.'
    });
  }
}

export default authMiddleware;
