const Course = require('../models/Course');
const Enrollment = require('../models/Enrollment');
const { asyncHandler } = require('../utils/asyncHandler');
const { ApiError } = require('../utils/ApiError');

const isNonEmptyString = (value) => typeof value === 'string' && value.trim().length > 0;

function isHttpUrl(value) {
  try {
    const { protocol } = new URL(value);
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}

// Returns an object of field -> message (empty when the input is valid)
function validateCourseInput(body) {
  const { title, description, category, thumbnailUrl, published } = body || {};
  const errors = {};

  if (!isNonEmptyString(title)) {
    errors.title = 'Title is required';
  } else if (title.trim().length < 3 || title.trim().length > 120) {
    errors.title = 'Title must be between 3 and 120 characters';
  }

  if (!isNonEmptyString(description)) {
    errors.description = 'Description is required';
  } else if (description.trim().length > 2000) {
    errors.description = 'Description must be at most 2000 characters';
  }

  if (!isNonEmptyString(category)) {
    errors.category = 'Category is required';
  } else if (category.trim().length > 50) {
    errors.category = 'Category must be at most 50 characters';
  }

  // Optional, but if present it must be a real http(s) URL
  if (thumbnailUrl !== undefined && thumbnailUrl !== null && thumbnailUrl !== '') {
    if (typeof thumbnailUrl !== 'string' || !isHttpUrl(thumbnailUrl.trim())) {
      errors.thumbnailUrl = 'Thumbnail URL must be a valid http or https URL';
    }
  }

  if (published !== undefined && typeof published !== 'boolean') {
    errors.published = 'Published must be true or false';
  }

  return errors;
}

// course.authorId is populated here, so the id lives at authorId._id
const isOwner = (course, user) =>
  Boolean(course.authorId && course.authorId._id.equals(user._id));

// POST /api/courses
exports.createCourse = asyncHandler(async (req, res) => {
  const errors = validateCourseInput(req.body);
  if (Object.keys(errors).length > 0) throw ApiError.validation(errors);

  // Only these fields are read from the body. Any authorId (or other extra field) the client
  // sends is ignored: the owner always comes from the verified token.
  const { title, description, category, thumbnailUrl, published } = req.body;

  const course = await Course.create({
    title: title.trim(),
    description: description.trim(),
    category: category.trim(),
    thumbnailUrl: thumbnailUrl && thumbnailUrl.trim() ? thumbnailUrl.trim() : null,
    published: published === true,
    authorId: req.user._id,
  });

  await course.populate('authorId', 'name');
  return res.status(201).json({ course });
});

// GET /api/courses  (published courses only)
exports.getCourses = asyncHandler(async (req, res) => {
  const courses = await Course.find({ published: true })
    .sort({ createdAt: -1 })
    .populate('authorId', 'name');
  return res.json({ courses });
});

// GET /api/courses/mine  (the logged-in user's courses, drafts included)
exports.getMyCourses = asyncHandler(async (req, res) => {
  const courses = await Course.find({ authorId: req.user._id })
    .sort({ createdAt: -1 })
    .populate('authorId', 'name');
  return res.json({ courses });
});

// GET /api/courses/:id  (the id was already validated by router.param)
exports.getCourseById = asyncHandler(async (req, res) => {
  const course = await Course.findById(req.params.id).populate('authorId', 'name');

  // A draft is only visible to its author; everyone else gets the same 404 as a missing course
  if (!course || (!course.published && !isOwner(course, req.user))) {
    throw ApiError.notFound('Course not found');
  }

  return res.json({ course });
});

// PUT /api/courses/:id
// Runs after protect, router.param (id format) and checkOwnership (404, then 403), so by the
// time we get here req.resource is a course the logged-in user owns.
//
// PUT vs PATCH: PUT REPLACES the editable payload. Every editable field is rewritten from the
// request, and optional fields that are left out reset to their defaults (thumbnailUrl -> null,
// published -> false). PATCH would change ONLY the fields that were sent and leave the rest alone.
exports.updateCourse = asyncHandler(async (req, res) => {
  const errors = validateCourseInput(req.body);
  if (Object.keys(errors).length > 0) throw ApiError.validation(errors);

  // Explicit whitelist: authorId (or any other field) in the body can never reach the database
  const { title, description, category, thumbnailUrl, published } = req.body;
  const updates = {
    title: title.trim(),
    description: description.trim(),
    category: category.trim(),
    thumbnailUrl: thumbnailUrl && thumbnailUrl.trim() ? thumbnailUrl.trim() : null,
    published: published === true,
  };

  const course = await Course.findByIdAndUpdate(req.resource._id, updates, {
    new: true, // return the updated document, not the old one
    runValidators: true, // apply the schema rules to the update as well
  }).populate('authorId', 'name');

  if (!course) throw ApiError.notFound('Course not found'); // deleted between the check and the update

  return res.json({ course });
});

// DELETE /api/courses/:id  (hard delete: the document is destroyed, as the sprint requires)
exports.deleteCourse = asyncHandler(async (req, res) => {
  await req.resource.deleteOne();
  // No orphans: students' enrollments in this course are removed with it
  await Enrollment.deleteMany({ courseId: req.resource._id });
  return res.json({ message: 'Course deleted', id: req.resource._id.toString() });
});
