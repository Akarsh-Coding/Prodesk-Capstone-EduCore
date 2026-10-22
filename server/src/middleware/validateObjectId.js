const mongoose = require('mongoose');

// Used with router.param('id', objectIdParam('course')): Express runs it for EVERY route that has
// an :id segment, so a bad value ("undefined", "123", ...) can never reach Mongoose and cause
// a "Cast to ObjectId failed" error. New :id routes added later are covered automatically.
exports.objectIdParam = (label = 'resource') => (req, res, next, id) => {
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ message: `Invalid ${label} ID`, code: 'INVALID_ID' });
  }
  return next();
};

// Kept so courseRoutes.js does not need to change
exports.validateObjectIdParam = exports.objectIdParam('course');
