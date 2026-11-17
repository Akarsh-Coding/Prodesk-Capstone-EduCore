const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const { ApiError } = require('../utils/ApiError');

// ---------------------------------------------------------------------------------------------
// Rate limiting. Counters live in memory: they reset when the server restarts and are not shared
// between several server instances (Render's free plan runs one instance, so that is fine; for more
// instances you would add a shared store such as Redis).
//
// The limits are read once, when the server starts. The defaults are the production values.
// For a demo, lower them in server/.env (see .env.example) and restart; remove the lines afterwards:
//   RATE_LIMIT_AUTH_MAX    login failures / registrations allowed per IP per window   (default 20)
//   RATE_LIMIT_AI_MAX      AI quiz requests allowed per user per window               (default 5)
//   RATE_LIMIT_WINDOW_MS   the window, in milliseconds                                (default 15 minutes)
// ---------------------------------------------------------------------------------------------

const positiveInt = (name, fallback) => {
  const value = Number.parseInt(process.env[name], 10);
  return Number.isInteger(value) && value > 0 ? value : fallback;
};

const WINDOW_MS = positiveInt('RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000);
const AUTH_MAX = positiveInt('RATE_LIMIT_AUTH_MAX', 20);
const AI_MAX = positiveInt('RATE_LIMIT_AI_MAX', 5);

// A blocked request is handed to the central error handler, so it gets the same
// { success: false, message } shape as every other error. The library has already set the
// RateLimit-* headers and Retry-After by the time this runs.
const tooManyRequests = (req, res, next) => next(new ApiError(429, 'Too many requests, please try again later'));

const shared = {
  windowMs: WINDOW_MS,
  standardHeaders: 'draft-6', // RateLimit-Limit, RateLimit-Remaining, RateLimit-Reset (+ Retry-After when blocked)
  legacyHeaders: false, // no X-RateLimit-* duplicates
  handler: tooManyRequests,
};

// POST /api/auth/login: counted per client IP. skipSuccessfulRequests means only FAILED logins use up
// the budget, so a real user logging in normally is never locked out, while password guessing is stopped.
exports.loginLimiter = rateLimit({ ...shared, limit: AUTH_MAX, skipSuccessfulRequests: true });

// POST /api/auth/register: every attempt counts, successful or not, which slows down mass account creation.
// It has its own counter, separate from the login one.
exports.registerLimiter = rateLimit({ ...shared, limit: AUTH_MAX });

// POST /api/ai/suggest: the strictest limit, because every call costs money.
// Keyed by the logged-in user (so changing IP does not help, and users sharing an office IP do not
// share a budget). The limiter is mounted AFTER protect so req.user exists; the IP is only a fallback.
// ipKeyGenerator also groups IPv6 addresses, so a client cannot dodge the limit by rotating addresses.
exports.aiLimiter = rateLimit({
  ...shared,
  limit: AI_MAX,
  keyGenerator: (req) => (req.user ? `user:${req.user.id}` : ipKeyGenerator(req.ip)),
});

exports.limits = { WINDOW_MS, AUTH_MAX, AI_MAX };
