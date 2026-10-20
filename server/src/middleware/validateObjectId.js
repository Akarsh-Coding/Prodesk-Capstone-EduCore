const mongoose = require('mongoose');

// Used with router.param('id', validateObjectIdParam): Express runs it for EVERY route that has
// an :id segment, so a bad value ("undefined", "123", ...) can never reach Mongoose and cause
// a "Cast to ObjectId failed" error. New :id routes added later are covered automatically.
exports.validateObjectIdParam = (req, res, next, id) => {
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ message: 'Invalid course ID', code: 'INVALID_ID' });
  }
  return next();
};
