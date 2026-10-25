const Stripe = require('stripe');

// A configuration problem (missing or unsafe key), as opposed to a Stripe API error
const configError = (message) => Object.assign(new Error(message), { isConfigError: true });

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
