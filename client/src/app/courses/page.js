'use client';

import { useEffect, useState } from 'react';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { coursesApi, enrollmentsApi } from '@/lib/services';
import AuthGate from '@/components/AuthGate';
import Nav from '@/components/Nav';

export default function CatalogPage() {
  const auth = useRequireAuth();
  const { status } = auth;

  const [courses, setCourses] = useState([]);
  const [enrolledIds, setEnrolledIds] = useState([]); // ids of courses the user is enrolled in
  const [listStatus, setListStatus] = useState('loading'); // loading | ready | error
  const [listError, setListError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [pendingId, setPendingId] = useState(null); // course currently being enrolled in
  const [rowErrors, setRowErrors] = useState({}); // courseId -> error message

  // READ: published courses plus my enrollments (so enrolled courses can show "Enrolled")
  useEffect(() => {
    if (status !== 'authenticated') return;
    let cancelled = false;

    async function load() {
      try {
        const [courseData, enrollmentData] = await Promise.all([coursesApi.list(), enrollmentsApi.mine()]);
        if (cancelled) return;
        setCourses(courseData.courses);
        setEnrolledIds(enrollmentData.enrollments.map((e) => e.courseId._id));
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

  // CREATE an enrollment (POST /api/enrollments)
  const handleEnroll = async (courseId) => {
    if (pendingId) return;
    setPendingId(courseId);
    setRowErrors((prev) => ({ ...prev, [courseId]: '' }));

    try {
      await enrollmentsApi.enroll(courseId);
      setEnrolledIds((prev) => (prev.includes(courseId) ? prev : [...prev, courseId]));
    } catch (err) {
      if (err.status === 409) {
        // The server says we are already enrolled: show it as enrolled
        setEnrolledIds((prev) => (prev.includes(courseId) ? prev : [...prev, courseId]));
      } else {
        setRowErrors((prev) => ({ ...prev, [courseId]: err.message }));
      }
    } finally {
      setPendingId(null);
    }
  };

  return (
    <AuthGate auth={auth}>
      {(user) => (
        <main className="max-w-3xl mx-auto p-6">
          <Nav user={user} onLogout={auth.logout} />
          <h1 className="text-2xl font-semibold mb-6">Course catalog</h1>

          {listStatus === 'loading' && <p>Loading courses...</p>}

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

          {listStatus === 'ready' && courses.length === 0 && (
            <p>No courses are published yet. Check back soon.</p>
          )}

          {listStatus === 'ready' && courses.length > 0 && (
            <ul className="space-y-3">
              {courses.map((course) => {
                const isOwn = course.authorId?._id === user.id;
                const isEnrolled = enrolledIds.includes(course._id);
                const isPending = pendingId === course._id;

                return (
                  <li key={course._id} className="flex justify-between gap-4 rounded border p-4">
                    <div>
                      <h3 className="font-semibold">{course.title}</h3>
                      <p className="text-sm">
                        {course.category} | by {course.authorId?.name || 'Unknown'}
                      </p>
                      <p className="mt-1">{course.description}</p>
                      {rowErrors[course._id] && (
                        <p role="alert" className="mt-2 text-sm text-red-600">
                          {rowErrors[course._id]}
                        </p>
                      )}
                    </div>

                    {isOwn ? (
                      <span className="h-fit text-sm">Your course</span>
                    ) : (
                      <button
                        onClick={() => handleEnroll(course._id)}
                        disabled={isEnrolled || isPending}
                        className="h-fit border px-3 py-1 rounded disabled:opacity-50"
                      >
                        {isEnrolled ? 'Enrolled' : isPending ? 'Enrolling...' : 'Enroll'}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </main>
      )}
    </AuthGate>
  );
}
