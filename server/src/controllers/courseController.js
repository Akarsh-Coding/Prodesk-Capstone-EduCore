const Course = require('../models/Course');
const Enrollment = require('../models/Enrollment');
const { asyncHandler } = require('../utils/asyncHandler');
const { ApiError } = require('../utils/ApiError');

// course.authorId is populated here, so the id lives at authorId._id
const isOwner = (course, user) =>
  Boolean(course.authorId && course.authorId._id.equals(user._id));

// POST /api/courses
// validate(createCourseSchema) already checked and cleaned the body (trimmed text, thumbnailUrl is a
// URL or null, published is a boolean) and removed every unknown key.
exports.createCourse = asyncHandler(async (req, res) => {
  // Still an explicit whitelist, as a second line of defense: authorId always comes from the
  // verified token, never from the body.
  const { title, description, category, thumbnailUrl, published } = req.body;

  const course = await Course.create({
    title,
    description,
    category,
    thumbnailUrl,
    published,
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
// Runs after protect, router.param (id format), checkOwnership (404, then 403) and
// validate(updateCourseSchema), so by the time we get here req.resource is a course the logged-in
// user owns and req.body is clean.
//
// PUT vs PATCH: PUT REPLACES the editable payload. Every editable field is rewritten from the
// request, and optional fields that are left out reset to their defaults (thumbnailUrl -> null,
// published -> false: the schema applies those defaults). PATCH would change ONLY the fields that
// were sent and leave the rest alone.
exports.updateCourse = asyncHandler(async (req, res) => {
  // Explicit whitelist: authorId (or any other field) can never reach the database
  const { title, description, category, thumbnailUrl, published } = req.body;
  const updates = { title, description, category, thumbnailUrl, published };

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
