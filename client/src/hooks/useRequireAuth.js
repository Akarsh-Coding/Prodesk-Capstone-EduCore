'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiGet } from '@/lib/api';
import { getSession, saveSession, clearSession } from '@/lib/auth';

// Route guard for client pages. Protected content must only render when status === 'authenticated'.
//   checking       -> nothing sensitive is shown (first render on server and client is always this)
//   authenticated  -> token is unexpired AND the server accepted it; `user` comes from the server
//   error          -> network/server problem; the token is kept so the user can retry
export function useRequireAuth() {
  const router = useRouter();
  const [state, setState] = useState({ status: 'checking', user: null, error: '' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      // 1. Local gate: no token, garbage token, or expired token -> clear it and leave
      const session = getSession();
      if (!session) {
        clearSession();
        router.replace('/login');
        return;
      }

      // 2. Server gate: the protected endpoint decides whether the token is really valid
      try {
        const data = await apiGet('/api/auth/me', session.token);
        if (cancelled) return;
        saveSession({ token: session.token, user: data.user }); // refresh the cached profile
        setState({ status: 'authenticated', user: data.user, error: '' });
      } catch (err) {
        if (cancelled) return;
        if (err.status === 401) {
          clearSession();
          router.replace('/login');
          return;
        }
        // Not an auth failure (server down, offline): do NOT log the user out
        setState({ status: 'error', user: null, error: err.message });
      }
    }

    check();
    return () => {
      cancelled = true;
    };
  }, [router, attempt]);

  const retry = () => {
    setState({ status: 'checking', user: null, error: '' });
    setAttempt((n) => n + 1);
  };

  const logout = () => {
    clearSession();
    router.replace('/login');
  };

  return { ...state, retry, logout };
}
