const express = require('express');
const {
  createCourse,
  getCourses,
  getMyCourses,
  getCourseById,
  updateCourse,
  deleteCourse,
} = require('../controllers/courseController');
const Course = require('../models/Course');
const { protect } = require('../middleware/authMiddleware');
const { validateObjectIdParam } = require('../middleware/validateObjectId');
const { checkOwnership } = require('../middleware/ownership');

const router = express.Router();

// Every route in this file requires a valid JWT. Authentication runs before :id validation.
router.use(protect);

// Runs automatically for every route below that contains :id
router.param('id', validateObjectIdParam);

// Loads the course, 404 if missing, 403 if the logged-in user is not its author
const ownsCourse = checkOwnership(Course, { label: 'course' });

router.post('/', createCourse);
router.get('/', getCourses);
router.get('/mine', getMyCourses); // must stay ABOVE /:id, or "mine" would be treated as an id
router.get('/:id', getCourseById);
router.put('/:id', ownsCourse, updateCourse);
router.delete('/:id', ownsCourse, deleteCourse);

module.exports = router;
