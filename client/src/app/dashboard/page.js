'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useOptimisticRemove } from '@/hooks/useOptimisticRemove';
import { enrollmentsApi } from '@/lib/services';
import AuthGate from '@/components/AuthGate';
import Nav from '@/components/Nav';
import ConfirmDialog from '@/components/ConfirmDialog';

const enrollmentLabel = (enrollment) => enrollment.courseId?.title || 'this course';

export default function DashboardPage() {
  const auth = useRequireAuth();
  const { status } = auth;

  const [enrollments, setEnrollments] = useState([]);
  const [listStatus, setListStatus] = useState('loading'); // loading | ready | error
  const [listError, setListError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [pendingUnenroll, setPendingUnenroll] = useState(null); // the enrollment awaiting confirmation

  const {
    remove: removeEnrollment,
    error: unenrollError,
    clearError: clearUnenrollError,
  } = useOptimisticRemove(enrollments, setEnrollments, { action: 'unenroll from', getLabel: enrollmentLabel });

  // READ: my enrollments, once the session is confirmed
  useEffect(() => {
    if (status !== 'authenticated') return;
    let cancelled = false;

    async function load() {
      try {
        const data = await enrollmentsApi.mine();
        if (cancelled) return;
        setEnrollments(data.enrollments);
        setListStatus('ready');
      } catch (err) {
        if (cancelled) return;
        setListError(err.message);
        setListStatus('error');
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [status, attempt]);

  const retryList = () => {
    setListStatus('loading');
    setListError('');
    setAttempt((n) => n + 1);
  };

  const cancelUnenroll = useCallback(() => setPendingUnenroll(null), []);

  // UNENROLL: the dialog closes and the enrollment leaves the list at once;
  // the DELETE runs in the background (rolled back if it fails)
  const confirmUnenroll = () => {
    const enrollment = pendingUnenroll;
    setPendingUnenroll(null);
    if (!enrollment) return;
    removeEnrollment(enrollment._id, () => enrollmentsApi.remove(enrollment._id));
  };

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

          <section className="mt-10">
            <h2 className="text-lg font-semibold mb-3">My enrollments</h2>

            {unenrollError && (
              <div role="alert" className="mb-3 flex items-start justify-between gap-4 rounded border border-red-600 p-3 text-red-600">
                <span>{unenrollError}</span>
                <button onClick={clearUnenrollError} className="underline">
                  Dismiss
                </button>
              </div>
            )}

            {listStatus === 'loading' && <p>Loading your enrollments...</p>}

            {listStatus === 'error' && (
              <div>
                <p role="alert" className="text-red-600">
                  {listError}
                </p>
                <button onClick={retryList} className="mt-2 border px-4 py-2 rounded">
                  Try again
                </button>
              </div>
            )}

            {listStatus === 'ready' && enrollments.length === 0 && (
              <p>
                You are not enrolled in any courses yet.{' '}
                <Link href="/courses" className="underline">
                  Find a course in the catalog
                </Link>
                .
              </p>
            )}

            {listStatus === 'ready' && enrollments.length > 0 && (
              <ul className="space-y-3">
                {enrollments.map((enrollment) => (
                  <li key={enrollment._id} className="flex justify-between gap-4 rounded border p-4">
                    <div>
                      <h3 className="font-semibold">{enrollment.courseId?.title}</h3>
                      <p className="text-sm">
                        {enrollment.courseId?.category} | by {enrollment.courseId?.authorId?.name || 'Unknown'}
                      </p>
                      <p className="mt-1 text-sm">
                        Enrolled on {new Date(enrollment.enrolledAt).toLocaleDateString()}
                      </p>
                    </div>
                    <button
                      onClick={() => setPendingUnenroll(enrollment)}
                      className="h-fit rounded border border-red-600 px-3 py-1 text-red-600"
                    >
                      Unenroll
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {pendingUnenroll && (
            <ConfirmDialog
              title="Unenroll from this course?"
              message={`You will be removed from "${enrollmentLabel(pendingUnenroll)}". You can enroll again later from the catalog.`}
              confirmLabel="Unenroll"
              onConfirm={confirmUnenroll}
              onCancel={cancelUnenroll}
            />
          )}
        </main>
      )}
    </AuthGate>
  );
}
