require('dotenv').config(); // must run before ./app is required, because app.js reads process.env

// Safety nets for anything that escapes the request handlers (route errors are already caught
// by asyncHandler and the central error handler). A stray rejected promise is logged and the server
// keeps running; after an uncaught exception the process state is unknown, so it exits and the
// host (Render) restarts it.
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err);
  process.exit(1);
});

const app = require('./app');
const connectDB = require('./config/db');

// Fail loudly at startup if a secret is missing (catches Render env var mistakes early)
const REQUIRED_ENV = ['MONGO_URI', 'JWT_SECRET'];
const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
if (missing.length > 0) {
  console.error(`Missing required environment variables: ${missing.join(', ')}`);
  process.exit(1);
}
if (process.env.JWT_SECRET.length < 32) {
  console.warn('JWT_SECRET is shorter than 32 characters. Use a long random string.');
}

// Payments are optional: the server still starts without Stripe, and the payment routes answer 503
if (!process.env.STRIPE_SECRET_KEY) {
  console.warn('STRIPE_SECRET_KEY is not set: /api/payments routes will return 503.');
} else if (!/^(sk|rk)_test_/.test(process.env.STRIPE_SECRET_KEY)) {
  console.warn('STRIPE_SECRET_KEY is not a test key (sk_test_...): payments are refused.');
}
if (!process.env.FRONTEND_URL) {
  console.warn('FRONTEND_URL is not set: checkout sessions cannot be created.');
}

const PORT = process.env.PORT || 5000;

(async () => {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
    console.log(`CORS allowed origins: ${app.locals.allowedOrigins.join(', ')}`);
  });
})();
