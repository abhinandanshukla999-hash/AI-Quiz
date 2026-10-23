import rateLimit from 'express-rate-limit';

/**
 * Strict Rate Limiter for AI Quiz Generation to protect Gemini API quota and credits.
 * Max 10 quiz generations per hour per authenticated user (or IP if unauthenticated).
 */
export const quizGenerationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour window
  max: 10, // Limit each user to 10 requests per windowMs
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  keyGenerator: (req) => {
    // Group by user ID if logged in, fallback to client IP
    return req.user?.id ? `user_${req.user.id}` : req.ip;
  },
  message: {
    success: false,
    message: 'Quiz generation limit reached (maximum 10 quizzes per hour). Please try again later.'
  }
});

/**
 * General API rate limiter to protect against spam / DoS
 */
export const generalApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // 200 requests per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests from this IP. Please try again after a few minutes.'
  }
});

/**
 * Auth rate limiter to protect login/register against brute-force
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 30 : 100, // Higher limit in development for testing
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many authentication attempts. Please try again in 15 minutes.'
  }
});
