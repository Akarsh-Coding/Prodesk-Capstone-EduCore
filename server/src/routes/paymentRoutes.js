const express = require('express');
const { createCheckoutSession, verifyPayment } = require('../controllers/paymentController');
const { protect } = require('../middleware/authMiddleware');
const { validate } = require('../middleware/validate');
const { createCheckoutSessionSchema } = require('../validation/schemas');

const router = express.Router();

// Both routes need a logged-in user: the payment is tied to req.user
router.use(protect);

router.post('/create-checkout-session', validate(createCheckoutSessionSchema), createCheckoutSession);
router.get('/verify', verifyPayment);

module.exports = router;
