// Explicit allow-list of fields: the password hash can never end up in a response.
// Shared by the auth and payment controllers so every endpoint returns the same user shape.
exports.toUserResponse = (user) => ({
  id: user._id.toString(),
  name: user.name,
  email: user.email,
  role: user.role,
  plan: user.plan || 'free',
});
