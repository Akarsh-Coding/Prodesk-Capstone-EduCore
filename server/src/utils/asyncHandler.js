// Wraps an async route handler or middleware so a rejected promise (or a thrown error) is passed to
// next(err) and ends up in the central error handler, instead of becoming an unhandled rejection.
//
//   exports.getCourse = asyncHandler(async (req, res) => { ... });
//
// Express 5 does this itself, but the wrapper makes it explicit, works on Express 4 as well, and
// means no controller needs its own try/catch.
exports.asyncHandler = (fn) => (req, res, next) =>
  // next(undefined) would mean "no error" and silently continue, so an empty rejection gets a real Error
  Promise.resolve(fn(req, res, next)).catch((err) => next(err || new Error('Request failed with an empty error')));
