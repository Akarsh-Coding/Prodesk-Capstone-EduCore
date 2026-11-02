const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { toUserResponse } = require('../utils/userResponse');
const { asyncHandler } = require('../utils/asyncHandler');
const { ApiError } = require('../utils/ApiError');

// Compared against when the email is unknown, so "no such user" takes about as long
// as "wrong password" and the response time doesn't reveal which emails exist.
const DUMMY_HASH = bcrypt.hashSync('timing-equalizer-password', 10);

const signToken = (user) =>
  jwt.sign({ id: user._id.toString(), role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

// POST /api/auth/register
// By the time this runs, validate(registerSchema) has already checked the body and REPLACED it with
// clean data: name trimmed, email trimmed and lowercased, password length checked, role limited to
// student/instructor, and every unknown key (plan, _id, isAdmin...) removed.
// A duplicate email (Mongo error 11000 from the unique index) becomes a 409 in the central error handler.
exports.register = asyncHandler(async (req, res) => {
  const { name, email, password, role } = req.body;

  const user = await User.create({
    name,
    email,
    password, // hashed by the model's pre-save hook
    role, // undefined when the client left it out: the model then defaults to "student"
  });

  return res.status(201).json({ token: signToken(user), user: toUserResponse(user) });
});

// POST /api/auth/login
// validate(loginSchema) guarantees email and password are non-empty STRINGS (so an object such as
// { "$gt": "" } can never reach the query), and email is already trimmed and lowercased.
exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email }).select('+password');

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
