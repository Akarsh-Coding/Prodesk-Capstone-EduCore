const express = require('express');
const {
  enroll,
  getMyEnrollments,
  addProgress,
  deleteEnrollment,
} = require('../controllers/enrollmentController');
const Enrollment = require('../models/Enrollment');
const { protect } = require('../middleware/authMiddleware');
const { objectIdParam } = require('../middleware/validateObjectId');
const { checkOwnership } = require('../middleware/ownership');

const router = express.Router();

// Every route in this file requires a valid JWT. Authentication runs before :id validation.
router.use(protect);

// Runs automatically for every route below that contains :id
router.param('id', objectIdParam('enrollment'));

// Loads the enrollment, 404 if missing, 403 if its userId is not the logged-in user
const ownsEnrollment = checkOwnership(Enrollment, { label: 'enrollment', ownerField: 'userId' });

router.post('/', enroll);
router.get('/mine', getMyEnrollments);
router.patch('/:id/progress', ownsEnrollment, addProgress);
router.delete('/:id', ownsEnrollment, deleteEnrollment);

module.exports = router;
