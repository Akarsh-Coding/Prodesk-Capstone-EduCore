const { z } = require('zod');

// ---------------------------------------------------------------------------------------------
// Request-body schemas, applied with validate(schema) in the route files.
//
// UNKNOWN KEYS ARE STRIPPED (the default for z.object). A client that sends authorId, userId,
// plan, _id, isAdmin... gets those keys removed before the controller ever runs, so they can never
// reach Mongoose. (Use z.strictObject instead if you would rather answer 400 for an extra key.)
// ---------------------------------------------------------------------------------------------

const body = (shape) => z.object(shape, { error: 'Request body must be a JSON object' });

// A string field with a message for "missing" and another for "wrong type" (a number, an object, null...)
const text = (label) =>
  z.string({
    error: (issue) => (issue.input === undefined ? `${label} is required` : `${label} must be text`),
  });

// A MongoDB ObjectId as a string: exactly 24 hex characters
const OBJECT_ID = /^[0-9a-fA-F]{24}$/;
const objectId = (label) =>
  z.string({ error: `A valid ${label} is required` }).regex(OBJECT_ID, `A valid ${label} is required`);

function isHttpUrl(value) {
  try {
    const { protocol } = new URL(value);
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}

// ----------------------------------------------------------------------------------------- auth

const NAME_RANGE = 'Name must be between 2 and 60 characters';
const PASSWORD_TOO_LONG = 'Password is too long (72 bytes at most)';

const registerSchema = body({
  name: text('Name').trim().min(1, 'Name is required').min(2, NAME_RANGE).max(60, NAME_RANGE),
  email: text('Email')
    .trim()
    .toLowerCase()
    .min(1, 'Email is required')
    .max(254, 'Email must be at most 254 characters')
    .email('Please enter a valid email address'),
  // Not trimmed: spaces are legitimate password characters.
  // bcrypt only reads the first 72 BYTES, so the limit is measured in bytes (an emoji is 4 bytes).
  password: text('Password')
    .min(1, 'Password is required')
    .min(8, 'Password must be at least 8 characters')
    .refine((value) => Buffer.byteLength(value, 'utf8') <= 72, PASSWORD_TOO_LONG),
  // Optional (the model defaults to "student"). Any other value, such as "admin", is rejected.
  role: z.enum(['student', 'instructor'], { error: 'Role must be student or instructor' }).optional(),
});

// Login is deliberately lenient: no format or length rules, so the API never hints at the password
// policy and a wrong login is always the generic 401. It only guarantees two non-empty STRINGS,
// which also blocks query-operator injection such as { "email": { "$gt": "" } }.
const loginSchema = body({
  email: text('Email').trim().toLowerCase().min(1, 'Email is required').max(254, 'Email is too long'),
  password: text('Password').min(1, 'Password is required').max(128, 'Password is too long'),
});

// ---------------------------------------------------------------------------------------- course

const TITLE_RANGE = 'Title must be between 3 and 120 characters';
const THUMBNAIL_INVALID = 'Thumbnail URL must be a valid http or https URL';

// Used for BOTH create and update: PUT replaces the whole editable payload, so both need the same fields.
// Output is normalized: thumbnailUrl is a URL string or null, published is always a boolean.
const courseSchema = body({
  title: text('Title').trim().min(1, 'Title is required').min(3, TITLE_RANGE).max(120, TITLE_RANGE),
  description: text('Description')
    .trim()
    .min(1, 'Description is required')
    .max(2000, 'Description must be at most 2000 characters'),
  category: text('Category').trim().min(1, 'Category is required').max(50, 'Category must be at most 50 characters'),
  thumbnailUrl: z
    .string({ error: THUMBNAIL_INVALID })
    .trim()
    .max(500, 'Thumbnail URL must be at most 500 characters')
    .refine((value) => value === '' || isHttpUrl(value), THUMBNAIL_INVALID)
    .nullish() // may be left out or null
    .transform((value) => value || null) // an empty string means "no thumbnail"
    .default(null),
  published: z.boolean({ error: 'Published must be true or false' }).default(false),
});

// ------------------------------------------------------------------------------- enrollment + pay

const createEnrollmentSchema = body({ courseId: objectId('courseId') });
const progressUpdateSchema = body({ lessonId: objectId('lessonId') });

// Starting a checkout takes no input: the user comes from the JWT and the price is fixed on the server.
// Validating an empty schema still strips anything a client tries to send (for example { plan: "pro" }).
const createCheckoutSessionSchema = body({});

module.exports = {
  registerSchema,
  loginSchema,
  createCourseSchema: courseSchema,
  updateCourseSchema: courseSchema,
  createEnrollmentSchema,
  progressUpdateSchema,
  createCheckoutSessionSchema,
};
