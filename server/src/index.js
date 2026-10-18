require('dotenv').config(); // must run before ./app is required, because app.js reads process.env

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

const PORT = process.env.PORT || 5000;

(async () => {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
    console.log(`CORS allowed origins: ${app.locals.allowedOrigins.join(', ')}`);
  });
})();
