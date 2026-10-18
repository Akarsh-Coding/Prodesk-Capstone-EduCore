const dns = require('node:dns');
const mongoose = require('mongoose');

dns.setServers(['8.8.8.8', '8.8.4.4']);

async function connectDB() {
  mongoose.connection.on('error', (err) => {
    console.error('MongoDB error:', err.message);
  });
  mongoose.connection.on('disconnected', () => {
    console.warn('MongoDB disconnected');
  });

  try {
    const { connection } = await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 10000, // fail fast instead of hanging if Atlas is unreachable
    });
    // Never log MONGO_URI itself: it contains the database password
    console.log(`MongoDB connected: ${connection.host} / database "${connection.name}"`);
  } catch (err) {
    console.error('MongoDB connection failed:', err.message);
    process.exit(1);
  }
}

module.exports = connectDB;
