const mongoose = require('mongoose');
const Course = require('../models/Course');
const Enrollment = require('../models/Enrollment');

// Strings only: stops objects like { "$gt": "" } and numbers from reaching a query
const isId = (value) => typeof value === 'string' && mongoose.isValidObjectId(value);

// Course details (plus the author's name) attached to every enrollment we return
const COURSE_POPULATE = {
  path: 'courseId',
  select: 'title description category thumbnailUrl published authorId',
  populate: { path: 'authorId', select: 'name' },
};

// POST /api/enrollments   body: { courseId }
exports.enroll = async (req, res, next) => {
  try {
    const { courseId } = req.body || {};
    if (!isId(courseId)) {
      return res.status(400).json({ message: 'A valid courseId is required', code: 'INVALID_ID' });
    }

    // Only published courses can be joined. Drafts look the same as missing courses (404).
    const course = await Course.findById(courseId);
    if (!course || !course.published) {
      return res.status(404).json({ message: 'Course not found' });
    }

    // userId always comes from the verified token, never from the body
    const enrollment = await Enrollment.create({ userId: req.user._id, courseId: course._id });
    await enrollment.populate(COURSE_POPULATE);

    return res.status(201).json({ enrollment });
  } catch (err) {
    // The unique { userId, courseId } index rejected a second enrollment
    if (err.code === 11000) {
      return res.status(409).json({ message: 'You are already enrolled in this course' });
    }
    return next(err);
  }
};

// GET /api/enrollments/mine
exports.getMyEnrollments = async (req, res, next) => {
  try {
    const enrollments = await Enrollment.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .populate(COURSE_POPULATE);

    // Defensive: skip any enrollment whose course no longer exists
    return res.json({ enrollments: enrollments.filter((e) => e.courseId) });
  } catch (err) {
    return next(err);
  }
};

// PATCH /api/enrollments/:id/progress   body: { lessonId }
// Runs after protect, router.param (id format) and checkOwnership (404, then 403).
// PATCH changes only what was sent: here, one lesson id added to completedLessons.
exports.addProgress = async (req, res, next) => {
  try {
    const { lessonId } = req.body || {};
    if (!isId(lessonId)) {
      return res.status(400).json({ message: 'A valid lessonId is required', code: 'INVALID_ID' });
    }

    // $addToSet adds the id only if it is not already there, so repeating a request is safe.
    // TODO (when the Lesson model exists): confirm the lesson belongs to enrollment.courseId.
    const enrollment = await Enrollment.findByIdAndUpdate(
      req.resource._id,
      { $addToSet: { completedLessons: lessonId } },
      { new: true }
    ).populate(COURSE_POPULATE);

    if (!enrollment) {
      return res.status(404).json({ message: 'Enrollment not found' }); // removed between the check and the update
    }

    return res.json({ enrollment });
  } catch (err) {
    return next(err);
  }
};

// DELETE /api/enrollments/:id   (unenroll)
exports.deleteEnrollment = async (req, res, next) => {
  try {
    await req.resource.deleteOne();
    return res.json({ message: 'Unenrolled successfully', id: req.resource._id.toString() });
  } catch (err) {
    return next(err);
  }
};
