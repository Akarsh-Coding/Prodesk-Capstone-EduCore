const express = require('express');
const {
  createCourse,
  getCourses,
  getMyCourses,
  getCourseById,
} = require('../controllers/courseController');
const { protect } = require('../middleware/authMiddleware');
const { validateObjectIdParam } = require('../middleware/validateObjectId');

const router = express.Router();

// Every route in this file requires a valid JWT. Authentication runs before :id validation.
router.use(protect);

// Runs automatically for every route below that contains :id
router.param('id', validateObjectIdParam);

router.post('/', createCourse);
router.get('/', getCourses);
router.get('/mine', getMyCourses); // must stay ABOVE /:id, or "mine" would be treated as an id
router.get('/:id', getCourseById);

module.exports = router;
