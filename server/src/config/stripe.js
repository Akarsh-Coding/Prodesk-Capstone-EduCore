const Stripe = require('stripe');
const { ApiError } = require('../utils/ApiError');

// A configuration problem (missing or unsafe key). The real reason goes to the server log;
// the client only gets a generic 503, so nothing about our setup leaks.
const configError = (message) => {
  console.error('[payments] configuration problem:', message);
  return new ApiError(503, 'Payments are not available right now', { code: 'PAYMENTS_NOT_CONFIGURED' });
};

let client = null;
let clientKey = null;

// Returns a Stripe client built from STRIPE_SECRET_KEY. The key never leaves the server.
// TEST MODE ONLY: anything that is not a test key (sk_test_ / rk_test_) is refused.
function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw configError('STRIPE_SECRET_KEY is not set');
  if (!/^(sk|rk)_test_/.test(key)) {
    throw configError('STRIPE_SECRET_KEY is not a test-mode key. Only sk_test_... keys are allowed.');
  }
  if (!client || clientKey !== key) {
    client = new Stripe(key);
    clientKey = key;
  }
  return client;
}

module.exports = { getStripe, configError };
