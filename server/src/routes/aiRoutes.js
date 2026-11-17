const express = require('express');
const { suggestQuiz } = require('../controllers/aiController');
const Course = require('../models/Course');
const { protect } = require('../middleware/authMiddleware');
const { validate } = require('../middleware/validate');
const { checkOwnership } = require('../middleware/ownership');
const { suggestQuizSchema } = require('../validation/schemas');
const { aiLimiter } = require('../middleware/rateLimiters');

const router = express.Router();

// Every route here needs a logged-in user
router.use(protect);

// The strict AI limit, keyed by user. It sits after protect (so req.user exists) and before everything
// else, so a user over the limit is stopped before any validation, database read or AI call.
router.use(aiLimiter);

// The course id arrives in the BODY (not the URL), so the ownership check reads it from there.
// This runs after validate(), which guarantees courseId is a 24-character hex string.
const ownsCourse = checkOwnership(Course, {
  label: 'course',
  getId: (req) => req.body.courseId,
  forbiddenMessage: 'Only the author of a course can generate a quiz for it',
});

// Order: 401 (protect) -> 400 (body) -> 404 (no such course) -> 403 (not your course) -> AI call
router.post('/suggest', validate(suggestQuizSchema), ownsCourse, suggestQuiz);

module.exports = router;
