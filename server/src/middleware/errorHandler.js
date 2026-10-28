const { ApiError } = require('../utils/ApiError');

// Friendly messages for the duplicate-key errors this app can produce, keyed by the indexed fields.
// Anything else falls back to a generic "already exists" message.
const DUPLICATE_MESSAGES = {
  email: 'An account with this email already exists',
  'courseId,userId': 'You are already enrolled in this course',
};

function duplicateMessage(err) {
  const fields = Object.keys(err.keyPattern || err.keyValue || {}).sort();
  if (DUPLICATE_MESSAGES[fields.join(',')]) return DUPLICATE_MESSAGES[fields.join(',')];
  return fields.length ? `A record with this ${fields.join(' and ')} already exists` : 'This record already exists';
}

// Turns ANY error into { status, message, errors?, code?, meta? }
function normalizeError(err) {
  // 0. Not even an object (someone threw null or a string): treat it as an unknown failure
  if (err === null || typeof err !== 'object') {
    return { status: 500, message: 'Internal server error' };
  }

  // 1. Errors we threw on purpose
  if (err instanceof ApiError) {
    return { status: err.statusCode, message: err.message, errors: err.errors, code: err.code, meta: err.meta };
  }

  // 2. Mongoose: a value could not be cast to the schema type (the classic "Cast to ObjectId failed")
  if (err.name === 'CastError') {
    if (err.kind === 'ObjectId') return { status: 400, message: 'Invalid ID format', code: 'INVALID_ID' };
    return { status: 400, message: `Invalid value for "${err.path}"` };
  }

  // 3. Mongoose: schema validation failed. Return the per-field messages.
  if (err.name === 'ValidationError' && err.errors) {
    const errors = {};
    for (const [field, fieldError] of Object.entries(err.errors)) {
      // A nested cast error's own message echoes the bad value and type names, so keep it generic
      errors[field] = fieldError.name === 'CastError' ? 'Invalid value' : fieldError.message;
    }
    return { status: 400, message: 'Validation failed', errors };
  }

  // 4. MongoDB: duplicate key (unique index)
  if (err.code === 11000) {
    return { status: 409, message: duplicateMessage(err), code: 'DUPLICATE' };
  }

  // 5. jsonwebtoken (TokenExpiredError extends JsonWebTokenError, so it is checked first)
  if (err.name === 'TokenExpiredError') {
    return { status: 401, message: 'Token expired, please log in again', code: 'TOKEN_EXPIRED' };
  }
  if (err.name === 'JsonWebTokenError' || err.name === 'NotBeforeError') {
    return { status: 401, message: 'Invalid token', code: 'INVALID_TOKEN' };
  }

  // 6. express.json(): the request body is not valid JSON
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return { status: 400, message: 'Malformed JSON in request body', code: 'INVALID_JSON' };
  }

  // 7. Other client errors raised by Express/body-parser (body too large, wrong content type, ...)
  if (Number.isInteger(err.status) && err.status >= 400 && err.status < 500 && err.expose) {
    const messages = { 413: 'Request body is too large', 415: 'Unsupported content type' };
    return { status: err.status, message: messages[err.status] || err.message };
  }

  // 8. Anything else (a bug, a database outage, a Stripe API failure...) is a 500 with a generic message.
  //    The real error is only written to the server log, never to the response.
  return { status: 500, message: 'Internal server error' };
}

// Catch-all for unknown routes. Mounted after every real route.
exports.notFound = (req, res, next) => next(ApiError.notFound('Route not found'));

// Global error handler. Mounted LAST (the 4-argument signature is what marks it as an error handler).
// eslint-disable-next-line no-unused-vars
exports.errorHandler = (err, req, res, next) => {
  if (res.headersSent) return next(err); // too late to send JSON: let Express close the connection

  const { status, message, errors, code, meta } = normalizeError(err);

  // Server-side problems (5xx) are logged. Client mistakes (4xx) are not worth logging.
  // An ApiError is an anticipated condition (for example "payments not configured"): one short line.
  // Anything else is unexpected, so it is logged with its full stack.
  if (status >= 500) {
    const what = err instanceof ApiError ? `${err.code || 'ApiError'}: ${err.message}` : err;
    console.error(`[error] ${req.method} ${req.originalUrl}`, what);
  }

  const body = { ...(meta || {}), success: false, message };
  if (errors) body.errors = errors;
  if (code) body.code = code;

  // Stack traces are NEVER sent to the client unless NODE_ENV is explicitly "development".
  // (An unset NODE_ENV counts as production, so a forgotten variable cannot leak a stack.)
  if (status >= 500 && process.env.NODE_ENV === 'development' && err && err.stack) body.stack = err.stack;

  return res.status(status).json(body);
};
