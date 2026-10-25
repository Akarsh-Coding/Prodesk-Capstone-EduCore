'use client';

import Link from 'next/link';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import AuthGate from '@/components/AuthGate';
import Nav from '@/components/Nav';

export default function PaymentCancelPage() {
  const auth = useRequireAuth(); // same protection as /dashboard

  return (
    <AuthGate auth={auth}>
      {(user) => (
        <main className="max-w-3xl mx-auto p-6">
          <Nav user={user} onLogout={auth.logout} />
          <h1 className="text-2xl font-semibold mb-4">Checkout canceled</h1>
          <p>You left the payment page before completing it, so no payment was made.</p>
          <Link href="/dashboard" className="mt-4 inline-block border px-4 py-2 rounded">
            Back to dashboard
          </Link>
        </main>
      )}
    </AuthGate>
  );
}
