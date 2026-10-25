'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { paymentsApi } from '@/lib/services';
import { updateStoredUser } from '@/lib/auth';
import AuthGate from '@/components/AuthGate';
import Nav from '@/components/Nav';

function PaymentSuccess() {
  const auth = useRequireAuth(); // same protection as /dashboard: no valid session means /login
  const { status } = auth;

  // Stripe redirects here with ?session_id=cs_test_... (the {CHECKOUT_SESSION_ID} placeholder)
  const sessionId = useSearchParams().get('session_id');

  const [result, setResult] = useState({ status: 'verifying', error: '', user: null }); // verifying | success | error
  const [attempt, setAttempt] = useState(0);

  // Ask the server to verify the payment with Stripe. Nothing is trusted from the URL alone.
  useEffect(() => {
    if (status !== 'authenticated' || !sessionId) return;
    let cancelled = false;

    async function verify() {
      try {
        const data = await paymentsApi.verify(sessionId);
        if (cancelled) return;
        updateStoredUser(data.user); // keep the cached user in sync (plan is now "pro")
        setResult({ status: 'success', error: '', user: data.user });
      } catch (err) {
        if (cancelled) return;
        setResult({ status: 'error', error: err.message, user: null });
      }
    }

    verify();
    return () => {
      cancelled = true;
    };
  }, [status, sessionId, attempt]);

  const retry = () => {
    setResult({ status: 'verifying', error: '', user: null });
    setAttempt((n) => n + 1);
  };

  return (
    <AuthGate auth={auth}>
      {(user) => (
        <main className="max-w-3xl mx-auto p-6">
          <Nav user={result.user || user} onLogout={auth.logout} />
          <h1 className="text-2xl font-semibold mb-4">Payment</h1>

          {!sessionId && (
            <div>
              <p role="alert" className="text-red-600">
                No payment session was found in this link, so there is nothing to verify.
              </p>
              <Link href="/dashboard" className="mt-4 inline-block underline">
                Back to dashboard
              </Link>
            </div>
          )}

          {sessionId && result.status === 'verifying' && (
            <p>Verifying your payment with Stripe. Please do not close this page...</p>
          )}

          {sessionId && result.status === 'success' && (
            <div>
              <p role="status" className="text-lg">
                Payment confirmed. You are now on EduCore Pro.
              </p>
              <Link href="/dashboard" className="mt-4 inline-block border px-4 py-2 rounded">
                Go to dashboard
              </Link>
            </div>
          )}

          {sessionId && result.status === 'error' && (
            <div>
              <p role="alert" className="text-red-600">
                We could not verify your payment: {result.error}
              </p>
              <div className="mt-4 flex gap-4">
                <button onClick={retry} className="border px-4 py-2 rounded">
                  Try again
                </button>
                <Link href="/dashboard" className="border px-4 py-2 rounded">
                  Back to dashboard
                </Link>
              </div>
            </div>
          )}
        </main>
      )}
    </AuthGate>
  );
}

// useSearchParams() needs a Suspense boundary, otherwise the production build fails
export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={<p className="p-6">Loading...</p>}>
      <PaymentSuccess />
    </Suspense>
  );
}
