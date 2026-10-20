'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSession, clearSession } from '@/lib/auth';

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);

  // localStorage only exists in the browser, so it is read inside useEffect.
  // The first render (server and client) is always the "Loading" text, which avoids hydration errors.
  useEffect(() => {
    const session = getSession();
    if (!session) {
      clearSession(); // drops an expired or malformed token
      router.replace('/login');
      return;
    }
    setUser(session.user);
  }, [router]);

  const handleLogout = () => {
    clearSession();
    router.replace('/login');
  };

  if (!user) {
    return <p className="p-6">Loading...</p>;
  }

  return (
    <main className="max-w-xl mx-auto p-6">
      <h1 className="text-2xl font-semibold">Welcome, {user.name}</h1>
      <p className="mt-2">
        Signed in as {user.email} ({user.role})
      </p>
      <button onClick={handleLogout} className="mt-6 border px-4 py-2 rounded">
        Log out
      </button>
    </main>
  );
}
