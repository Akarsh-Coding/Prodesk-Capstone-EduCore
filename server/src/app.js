const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const authRoutes = require('./routes/authRoutes');
const courseRoutes = require('./routes/courseRoutes');
const enrollmentRoutes = require('./routes/enrollmentRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const aiRoutes = require('./routes/aiRoutes');
const { loginLimiter, registerLimiter } = require('./middleware/rateLimiters');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();

// Render (like most hosts) puts ONE reverse proxy in front of the app. Trusting exactly one hop makes
// req.ip the real client address (taken from X-Forwarded-For), which the rate limiters use as their key.
// Without this, every user would appear to come from the proxy's IP and share one budget.
// Do not use `true` here: that would let a client forge its own IP.
app.set('trust proxy', 1);

// Browser origins allowed to call this API:
//   CLIENT_URL   one origin or several, comma-separated (e.g. http://localhost:3000,https://educore.vercel.app)
//   FRONTEND_URL the deployed site (also used for the Stripe redirects), so setting it is enough on its own
// Trailing slashes are stripped because browsers send origins without one.
const configuredOrigins = [process.env.CLIENT_URL, process.env.FRONTEND_URL].filter(Boolean).join(',');
const allowedOrigins = [
  ...new Set(
    (configuredOrigins || 'http://localhost:3000')
      .split(',')
      .map((origin) => origin.trim().replace(/\/+$/, ''))
      .filter(Boolean)
  ),
];

app.locals.allowedOrigins = allowedOrigins;

app.use(cors({ origin: allowedOrigins }));
// Rate limits for the credential endpoints, mounted before the routes they protect and before the body
// parser (a blocked request is rejected without parsing its body). They come AFTER cors so that a 429
// still carries the CORS headers and the browser can read it. /api/auth/me is deliberately NOT limited
// like this: the client's route guard calls it on every protected page load.
app.use('/api/auth/login', loginLimiter);
app.use('/api/auth/register', registerLimiter);

app.use(express.json());

// Confirms the server is up and shows whether Atlas is connected
app.get('/api/health', (req, res) => {
  const dbConnected = mongoose.connection.readyState === 1;
  res.json({
    status: 'ok',
    db: dbConnected ? 'connected' : 'disconnected',
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/enrollments', enrollmentRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/ai', aiRoutes);

// Unknown routes, then the global error handler. Both must stay LAST, after every route.
app.use(notFound);
app.use(errorHandler);

module.exports = app;
