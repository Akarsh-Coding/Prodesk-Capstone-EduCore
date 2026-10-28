const { getStripe, configError } = require('../config/stripe');
const User = require('../models/User');
const { toUserResponse } = require('../utils/userResponse');
const { asyncHandler } = require('../utils/asyncHandler');
const { ApiError } = require('../utils/ApiError');

const PRO_PRICE_CENTS = 999; // test amount: $9.99 (Stripe amounts are in the smallest currency unit)
const SESSION_ID_PATTERN = /^cs_test_[A-Za-z0-9]+$/; // Checkout Session ids in test mode

const frontendUrl = () => (process.env.FRONTEND_URL || '').replace(/\/+$/, '');

// POST /api/payments/create-checkout-session
// Creates a hosted Stripe Checkout page and returns ONLY its URL. The secret key never leaves the server.
// A missing or unsafe configuration throws a 503 (see config/stripe.js); a Stripe API failure becomes a generic 500.
exports.createCheckoutSession = asyncHandler(async (req, res) => {
  if (req.user.plan === 'pro') {
    throw ApiError.conflict('You already have EduCore Pro', { code: 'ALREADY_PRO' });
  }

  const baseUrl = frontendUrl();
  if (!baseUrl) throw configError('FRONTEND_URL is not set');
  const stripe = getStripe();

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: PRO_PRICE_CENTS,
          product_data: { name: 'EduCore Pro' },
        },
      },
    ],
    // Ties the payment to the logged-in user. Taken from the verified JWT, never from the request.
    client_reference_id: req.user.id,
    metadata: { plan: 'pro' },
    // {CHECKOUT_SESSION_ID} is a literal placeholder that Stripe fills in when it redirects
    success_url: `${baseUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/payment/cancel`,
  });

  return res.json({ url: session.url });
});

// GET /api/payments/verify?session_id=cs_test_...
// The success page calls this. Stripe is asked directly, so typing the success URL by hand
// (or reusing someone else's session id) never upgrades an account.
exports.verifyPayment = asyncHandler(async (req, res) => {
  const sessionId = req.query.session_id;
  if (typeof sessionId !== 'string' || !SESSION_ID_PATTERN.test(sessionId)) {
    throw ApiError.badRequest('A valid session_id is required', { code: 'INVALID_SESSION_ID' });
  }

  const stripe = getStripe();

  let session;
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId);
  } catch (err) {
    if (err.code === 'resource_missing' || err.statusCode === 404) {
      throw ApiError.notFound('Checkout session not found');
    }
    throw err; // any other Stripe problem becomes a generic 500 in the central handler (details only in the log)
  }

  // 1. The payment must belong to the logged-in user (checked first, so nothing else is revealed)
  if (session.client_reference_id !== req.user.id) {
    throw ApiError.forbidden('This payment does not belong to your account', { code: 'FORBIDDEN' });
  }

  // 2. It must be a Pro purchase created by our own checkout route
  if (session.mode !== 'payment' || !session.metadata || session.metadata.plan !== 'pro') {
    throw ApiError.badRequest('This checkout session is not an EduCore Pro purchase');
  }

  // 3. Stripe must say it was actually paid
  if (session.payment_status !== 'paid') {
    throw new ApiError(402, 'Payment has not been completed', {
      code: 'NOT_PAID',
      meta: { paymentStatus: session.payment_status },
    });
  }

  // Safe to repeat: refreshing the success page just sets the same value again
  const user = await User.findByIdAndUpdate(req.user._id, { plan: 'pro' }, { new: true, runValidators: true });
  if (!user) throw ApiError.notFound('User not found');

  return res.json({ user: toUserResponse(user) });
});
