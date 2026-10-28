const { asyncHandler } = require('../utils/asyncHandler');
const { ApiError } = require('../utils/ApiError');

// Reusable ownership guard for any resource that stores its owner's user id.
//
//   const ownsCourse = checkOwnership(Course, { label: 'course' });
//   router.put('/:id', ownsCourse, updateCourse);
//
// Order of checks (this order matters):
//   1. 404 if no document has this id
//   2. 403 if the document exists but belongs to someone else
// On success the loaded document is available as req.resource, so the controller does not
// need to query it a second time.
//
// Requirements: run it AFTER `protect` (it needs req.user). The route's :id is normally validated
// first by router.param; if a bad id ever got here, Mongoose's CastError becomes a 400.
exports.checkOwnership = (Model, { label = 'resource', ownerField = 'authorId' } = {}) => {
  const Label = label.charAt(0).toUpperCase() + label.slice(1);

  return asyncHandler(async (req, res, next) => {
    if (!req.user) {
      throw ApiError.unauthorized('Not authorized: no user on request', { code: 'NO_USER' });
    }

    const doc = await Model.findById(req.params.id);
    if (!doc) {
      throw ApiError.notFound(`${Label} not found`);
    }

    // Compare the stored owner against the id from the verified JWT, never against the request body
    const ownerId = doc[ownerField];
    if (!ownerId || ownerId.toString() !== req.user.id) {
      throw ApiError.forbidden(`Not authorized to modify this ${label}`, { code: 'FORBIDDEN' });
    }

    req.resource = doc;
    return next();
  });
};
