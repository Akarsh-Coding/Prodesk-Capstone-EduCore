const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const authRoutes = require('./routes/authRoutes');
const courseRoutes = require('./routes/courseRoutes');
const enrollmentRoutes = require('./routes/enrollmentRoutes');
const paymentRoutes = require('./routes/paymentRoutes');

const app = express();

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

// Unknown routes
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// Central error handler (the 4-argument signature is required by Express)
app.use((err, req, res, next) => {
  const status = err.status || 500;
  console.error(err);
  res.status(status).json({
    message: status === 500 ? 'Internal server error' : err.message,
  });
});

module.exports = app;
