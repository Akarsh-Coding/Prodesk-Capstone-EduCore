'use client';

// Renders `children(user)` only after the route guard (useRequireAuth) has confirmed the session.
// Until then nothing sensitive is shown: just a loading line, or the error with a retry option.
export default function AuthGate({ auth, children }) {
  const { status, user, error, retry, logout } = auth;

  if (status === 'checking') {
    return <p className="p-6">Checking session...</p>;
  }

  if (status === 'error') {
    return (
      <main className="max-w-3xl mx-auto p-6">
        <p role="alert" className="text-red-600">
          {error}
        </p>
        <div className="mt-4 flex gap-4">
          <button onClick={retry} className="border px-4 py-2 rounded">
            Try again
          </button>
          <button onClick={logout} className="border px-4 py-2 rounded">
            Log out
          </button>
        </div>
      </main>
    );
  }

  return children(user);
}
