const express = require('express');
const { createCheckoutSession, verifyPayment } = require('../controllers/paymentController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

// Both routes need a logged-in user: the payment is tied to req.user
router.use(protect);

router.post('/create-checkout-session', createCheckoutSession);
router.get('/verify', verifyPayment);

module.exports = router;
