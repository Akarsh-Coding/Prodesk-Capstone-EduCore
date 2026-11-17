const { asyncHandler } = require('../utils/asyncHandler');
const { generateQuiz } = require('../services/quizService');

// POST /api/ai/suggest   body: { courseId }
// By now: protect has verified the JWT, validate(suggestQuizSchema) has checked courseId, and
// checkOwnership has loaded the course (404 if missing) and confirmed the caller is its author (403).
// Only the course's title, description and category are sent to the model: nothing from the request
// body, so a client cannot steer the prompt. Nothing is saved: the quiz exists only in this response.
exports.suggestQuiz = asyncHandler(async (req, res) => {
  const { title, description, category } = req.resource;
  const quiz = await generateQuiz({ title, description, category });
  return res.json({ quiz });
});
