const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [60, 'Name must be at most 60 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true, // creates a unique index; duplicates fail with Mongo error code 11000
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email address'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      // Validation runs BEFORE the pre-save hook, so these limits apply to the plain-text password
      minlength: [8, 'Password must be at least 8 characters'],
      maxlength: [72, 'Password must be at most 72 characters'], // bcrypt ignores anything past 72 bytes
      select: false, // never returned by queries unless asked for with .select('+password')
    },
    role: {
      type: String,
      enum: {
        values: ['student', 'instructor'],
        message: '{VALUE} is not a valid role',
      },
      default: 'student',
    },
    // Set to 'pro' ONLY by the payment verification route, after Stripe confirms a paid session.
    // register/login never read it from the request body.
    plan: {
      type: String,
      enum: {
        values: ['free', 'pro'],
        message: '{VALUE} is not a valid plan',
      },
      default: 'free',
    },
  },
  {
    timestamps: true,
    toJSON: {
      // Safety net: even a freshly created document (which still holds the hash in memory)
      // will not leak the password if a route does res.json(user)
      transform(doc, ret) {
        delete ret.password;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Hash the password before saving, but only when it was set or changed
userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Compare a plain-text candidate against the stored hash.
// The user must be loaded with .select('+password'), because the field is hidden by default.
userSchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.password) {
    throw new Error('Password not loaded. Query the user with .select("+password") first.');
  }
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
