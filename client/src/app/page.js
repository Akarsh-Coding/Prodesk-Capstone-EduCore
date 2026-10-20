'use client';

import { useRequireAuth } from '@/hooks/useRequireAuth';

export default function DashboardPage() {
  const { status, user, error, retry, logout } = useRequireAuth();

  // Until the server has confirmed the token, no dashboard content is rendered at all
  if (status === 'checking') {
    return <p className="p-6">Checking session...</p>;
  }

  if (status === 'error') {
    return (
      <main className="max-w-xl mx-auto p-6">
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

  return (
    <main className="max-w-xl mx-auto p-6">
      <h1 className="text-2xl font-semibold">Welcome, {user.name}</h1>
      <p className="mt-2">
        Signed in as {user.email} ({user.role})
      </p>
      <button onClick={logout} className="mt-6 border px-4 py-2 rounded">
        Log out
      </button>
    </main>
  );
}
