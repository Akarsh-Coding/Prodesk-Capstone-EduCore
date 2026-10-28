const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { toUserResponse } = require('../utils/userResponse');
const { asyncHandler } = require('../utils/asyncHandler');
const { ApiError } = require('../utils/ApiError');

const EMAIL_REGEX = /^\S+@\S+\.\S+$/;
const ROLES = ['student', 'instructor'];

// Compared against when the email is unknown, so "no such user" takes about as long
// as "wrong password" and the response time doesn't reveal which emails exist.
const DUMMY_HASH = bcrypt.hashSync('timing-equalizer-password', 10);

const isString = (value) => typeof value === 'string';

const signToken = (user) =>
  jwt.sign({ id: user._id.toString(), role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

// POST /api/auth/register
// Errors are thrown, not returned: validation problems become a 400 here, and a duplicate email
// (Mongo error 11000 from the unique index) is turned into a 409 by the central error handler.
exports.register = asyncHandler(async (req, res) => {
  // req.body is undefined in Express 5 when the request has no parsed JSON body
  const { name, email, password, role } = req.body || {};
  const errors = {};

  if (!isString(name) || !name.trim()) {
    errors.name = 'Name is required';
  } else if (name.trim().length < 2 || name.trim().length > 60) {
    errors.name = 'Name must be between 2 and 60 characters';
  }

  if (!isString(email) || !email.trim()) {
    errors.email = 'Email is required';
  } else if (!EMAIL_REGEX.test(email.trim())) {
    errors.email = 'Please enter a valid email address';
  }

  if (!isString(password) || !password) {
    errors.password = 'Password is required';
  } else if (password.length < 8) {
    errors.password = 'Password must be at least 8 characters';
  } else if (password.length > 72) {
    errors.password = 'Password must be at most 72 characters';
  }

  // Role is optional (defaults to student) but can only ever be student or instructor
  if (role !== undefined && !ROLES.includes(role)) {
    errors.role = 'Role must be student or instructor';
  }

  if (Object.keys(errors).length > 0) throw ApiError.validation(errors);

  // Only these four fields are passed on; anything else in the body is ignored
  const user = await User.create({
    name: name.trim(),
    email: email.trim().toLowerCase(),
    password, // hashed by the model's pre-save hook
    role,
  });

  return res.status(201).json({ token: signToken(user), user: toUserResponse(user) });
});

// POST /api/auth/login
exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body || {};

  // Type check matters: an object like { "$gt": "" } as email would otherwise reach the query
  if (!isString(email) || !email.trim() || !isString(password) || !password) {
    throw ApiError.badRequest('Email and password are required');
  }

  const user = await User.findOne({ email: email.trim().toLowerCase() }).select('+password');

  const passwordMatches = user
    ? await user.comparePassword(password)
    : await bcrypt.compare(password, DUMMY_HASH);

  // Same response whether the email or the password was wrong
  if (!user || !passwordMatches) throw ApiError.unauthorized('Invalid credentials');

  return res.json({ token: signToken(user), user: toUserResponse(user) });
});

// GET /api/auth/me  (protected: req.user is set by the protect middleware)
exports.getMe = (req, res) => {
  return res.json({
    user: { ...toUserResponse(req.user), createdAt: req.user.createdAt },
  });
};
