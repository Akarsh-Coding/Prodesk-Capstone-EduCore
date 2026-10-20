const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Every auth failure uses the same shape: a readable message plus a stable code the client can switch on
const unauthorized = (res, code, message) =>
  res.status(401).json({ message: `Not authorized: ${message}`, code });

exports.protect = async (req, res, next) => {
  // 1. Header present?
  const header = req.headers.authorization;
  if (!header) {
    return unauthorized(res, 'NO_TOKEN', 'no token provided');
  }

  // 2. Header shaped like "Bearer <token>"?
  const parts = header.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer' || !parts[1]) {
    return unauthorized(res, 'MALFORMED_HEADER', 'malformed Authorization header, expected "Bearer <token>"');
  }

  // 3. Token genuine and not expired?
  let decoded;
  try {
    decoded = jwt.verify(parts[1], process.env.JWT_SECRET, { algorithms: ['HS256'] });
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return unauthorized(res, 'TOKEN_EXPIRED', 'token expired, please log in again');
    }
    if (err.message === 'jwt malformed') {
      return unauthorized(res, 'MALFORMED_TOKEN', 'malformed token');
    }
    return unauthorized(res, 'INVALID_TOKEN', 'invalid token'); // bad signature, tampered payload, etc.
  }

  // 4. User still exists? (password is excluded: the field is select:false, and we say so explicitly)
  try {
    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      return unauthorized(res, 'USER_NOT_FOUND', 'user no longer exists');
    }
    req.user = user;
    return next();
  } catch (err) {
    if (err.name === 'CastError') {
      return unauthorized(res, 'INVALID_TOKEN', 'invalid token');
    }
    return next(err); // real server problem (for example the database is down): 500
  }
};
