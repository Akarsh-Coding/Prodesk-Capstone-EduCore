// An error we throw on purpose. The central error handler turns it into the standard response:
//   { success: false, message, errors?, code? }
//
//   throw ApiError.notFound('Course not found');
//   throw ApiError.validation({ title: 'Title is required' });
//   throw new ApiError(402, 'Payment has not been completed', { code: 'NOT_PAID', meta: { paymentStatus } });
class ApiError extends Error {
  constructor(statusCode, message, { errors, code, meta } = {}) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.errors = errors; // per-field messages, for 400 validation failures
    this.code = code; // stable machine-readable code the client can switch on (for example INVALID_ID)
    this.meta = meta; // extra fields to include in the response body
  }

  static badRequest(message = 'Bad request', options) {
    return new ApiError(400, message, options);
  }

  static validation(errors) {
    return new ApiError(400, 'Validation failed', { errors });
  }

  static unauthorized(message = 'Not authorized', options) {
    return new ApiError(401, message, options);
  }

  static forbidden(message = 'Forbidden', options) {
    return new ApiError(403, message, options);
  }

  static notFound(message = 'Not found', options) {
    return new ApiError(404, message, options);
  }

  static conflict(message = 'Conflict', options) {
    return new ApiError(409, message, options);
  }
}

module.exports = { ApiError };
