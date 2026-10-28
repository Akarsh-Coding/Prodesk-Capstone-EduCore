const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { asyncHandler } = require('../utils/asyncHandler');
const { ApiError } = require('../utils/ApiError');

// Every auth failure is a 401 with a readable message plus a stable code the client can switch on
const unauthorized = (code, message) => ApiError.unauthorized(`Not authorized: ${message}`, { code });

exports.protect = asyncHandler(async (req, res, next) => {
  // 1. Header present?
  const header = req.headers.authorization;
  if (!header) {
    throw unauthorized('NO_TOKEN', 'no token provided');
  }

  // 2. Header shaped like "Bearer <token>"?
  const parts = header.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer' || !parts[1]) {
    throw unauthorized('MALFORMED_HEADER', 'malformed Authorization header, expected "Bearer <token>"');
  }

  // 3. Token genuine and not expired? Each case keeps its own code.
  let decoded;
  try {
    decoded = jwt.verify(parts[1], process.env.JWT_SECRET, { algorithms: ['HS256'] });
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw unauthorized('TOKEN_EXPIRED', 'token expired, please log in again');
    }
    if (err.message === 'jwt malformed') {
      throw unauthorized('MALFORMED_TOKEN', 'malformed token');
    }
    throw unauthorized('INVALID_TOKEN', 'invalid token'); // bad signature, tampered payload, etc.
  }

  // 4. User still exists? (password is excluded: the field is select:false, and we say so explicitly)
  let user;
  try {
    user = await User.findById(decoded.id).select('-password');
  } catch (err) {
    // A signed token whose id is not a valid ObjectId is still just an invalid token here (401, not 400)
    if (err.name === 'CastError') throw unauthorized('INVALID_TOKEN', 'invalid token');
    throw err; // a real server problem (for example the database is down): handled as a 500
  }
  if (!user) {
    throw unauthorized('USER_NOT_FOUND', 'user no longer exists');
  }

  req.user = user;
  return next();
});
