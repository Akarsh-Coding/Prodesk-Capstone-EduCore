'use client';

import Link from 'next/link';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import AuthGate from '@/components/AuthGate';
import Nav from '@/components/Nav';

export default function DashboardPage() {
  const auth = useRequireAuth();

  return (
    <AuthGate auth={auth}>
      {(user) => (
        <main className="max-w-3xl mx-auto p-6">
          <Nav user={user} onLogout={auth.logout} />
          <h1 className="text-2xl font-semibold">Welcome, {user.name}</h1>
          <p className="mt-2">
            Signed in as {user.email} ({user.role})
          </p>

          <div className="mt-6 flex flex-wrap gap-4">
            <Link href="/courses" className="border px-4 py-2 rounded">
              Browse the course catalog
            </Link>
            {user.role === 'instructor' && (
              <Link href="/instructor" className="border px-4 py-2 rounded">
                Manage my courses
              </Link>
            )}
          </div>
        </main>
      )}
    </AuthGate>
  );
}
