const { ApiError } = require('../utils/ApiError');

// One entry per field: when several rules fail for the same field (an empty title is both "required"
// and "too short") only the first, most relevant message is reported.
function toErrors(issues) {
  const seen = new Set();
  const errors = [];
  for (const issue of issues) {
    const field = issue.path.length > 0 ? issue.path.map(String).join('.') : 'body';
    if (seen.has(field)) continue;
    seen.add(field);
    errors.push({ field, message: issue.message });
  }
  return errors;
}

// Reusable body validation:   router.post('/', validate(createCourseSchema), createCourse)
//
//   failure -> 400 { success: false, message: "Validation failed", errors: [{ field, message }] }
//   success -> req.body is REPLACED by the parsed data: trimmed, normalized, defaults applied, and
//              every key the schema does not list removed. Controllers only ever see clean data.
exports.validate = (schema) => (req, res, next) => {
  // Express 5 leaves req.body undefined when the request carried no body
  const result = schema.safeParse(req.body === undefined ? {} : req.body);

  if (!result.success) return next(ApiError.validation(toErrors(result.error.issues)));

  req.body = result.data;
  return next();
};
