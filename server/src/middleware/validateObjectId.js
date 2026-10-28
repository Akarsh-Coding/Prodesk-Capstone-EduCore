const mongoose = require('mongoose');
const { ApiError } = require('../utils/ApiError');

// Used with router.param('id', objectIdParam('course')): Express runs it for EVERY route that has
// an :id segment, so a bad value ("undefined", "123", ...) is rejected with a 400 before it can
// reach Mongoose. (If one ever slipped through, the central handler maps CastError to 400 as well.)
exports.objectIdParam = (label = 'resource') => (req, res, next, id) => {
  if (!mongoose.isValidObjectId(id)) {
    return next(ApiError.badRequest(`Invalid ${label} ID`, { code: 'INVALID_ID' }));
  }
  return next();
};

// Kept so courseRoutes.js does not need to change
exports.validateObjectIdParam = exports.objectIdParam('course');
