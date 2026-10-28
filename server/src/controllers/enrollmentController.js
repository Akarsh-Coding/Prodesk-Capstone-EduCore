const mongoose = require('mongoose');
const Course = require('../models/Course');
const Enrollment = require('../models/Enrollment');
const { asyncHandler } = require('../utils/asyncHandler');
const { ApiError } = require('../utils/ApiError');

// Strings only: stops objects like { "$gt": "" } and numbers from reaching a query
const isId = (value) => typeof value === 'string' && mongoose.isValidObjectId(value);

// Course details (plus the author's name) attached to every enrollment we return
const COURSE_POPULATE = {
  path: 'courseId',
  select: 'title description category thumbnailUrl published authorId',
  populate: { path: 'authorId', select: 'name' },
};

// POST /api/enrollments   body: { courseId }
exports.enroll = asyncHandler(async (req, res) => {
  const { courseId } = req.body || {};
  if (!isId(courseId)) {
    throw ApiError.badRequest('A valid courseId is required', { code: 'INVALID_ID' });
  }

  // Only published courses can be joined. Drafts look the same as missing courses (404).
  const course = await Course.findById(courseId);
  if (!course || !course.published) throw ApiError.notFound('Course not found');

  // userId always comes from the verified token, never from the body.
  // A second enrollment hits the unique { userId, courseId } index (Mongo error 11000),
  // which the central error handler turns into a 409.
  const enrollment = await Enrollment.create({ userId: req.user._id, courseId: course._id });
  await enrollment.populate(COURSE_POPULATE);

  return res.status(201).json({ enrollment });
});

// GET /api/enrollments/mine
exports.getMyEnrollments = asyncHandler(async (req, res) => {
  const enrollments = await Enrollment.find({ userId: req.user._id })
    .sort({ createdAt: -1 })
    .populate(COURSE_POPULATE);

  // Defensive: skip any enrollment whose course no longer exists
  return res.json({ enrollments: enrollments.filter((e) => e.courseId) });
});

// PATCH /api/enrollments/:id/progress   body: { lessonId }
// Runs after protect, router.param (id format) and checkOwnership (404, then 403).
// PATCH changes only what was sent: here, one lesson id added to completedLessons.
exports.addProgress = asyncHandler(async (req, res) => {
  const { lessonId } = req.body || {};
  if (!isId(lessonId)) {
    throw ApiError.badRequest('A valid lessonId is required', { code: 'INVALID_ID' });
  }

  // $addToSet adds the id only if it is not already there, so repeating a request is safe.
  // TODO (when the Lesson model exists): confirm the lesson belongs to enrollment.courseId.
  const enrollment = await Enrollment.findByIdAndUpdate(
    req.resource._id,
    { $addToSet: { completedLessons: lessonId } },
    { new: true }
  ).populate(COURSE_POPULATE);

  if (!enrollment) throw ApiError.notFound('Enrollment not found'); // removed between the check and the update

  return res.json({ enrollment });
});

// DELETE /api/enrollments/:id   (unenroll)
exports.deleteEnrollment = asyncHandler(async (req, res) => {
  await req.resource.deleteOne();
  return res.json({ message: 'Unenrolled successfully', id: req.resource._id.toString() });
});
