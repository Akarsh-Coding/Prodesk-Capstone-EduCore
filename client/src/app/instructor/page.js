'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useOptimisticRemove } from '@/hooks/useOptimisticRemove';
import { coursesApi } from '@/lib/services';
import AuthGate from '@/components/AuthGate';
import Nav from '@/components/Nav';
import Modal from '@/components/Modal';
import ConfirmDialog from '@/components/ConfirmDialog';
import CourseForm, { courseToFormValues } from '@/components/CourseForm';

const courseLabel = (course) => course.title;

export default function InstructorPage() {
  const auth = useRequireAuth();
  const { status } = auth;

  const [courses, setCourses] = useState([]);
  const [listStatus, setListStatus] = useState('loading'); // loading | ready | error
  const [listError, setListError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [editing, setEditing] = useState(null); // the course being edited, or null
  const [pendingDelete, setPendingDelete] = useState(null); // the course awaiting confirmation, or null

  const {
    remove: removeCourse,
    error: deleteError,
    clearError: clearDeleteError,
  } = useOptimisticRemove(courses, setCourses, { action: 'delete', getLabel: courseLabel });

  // READ: load "my courses" once the session is confirmed
  useEffect(() => {
    if (status !== 'authenticated') return;
    let cancelled = false;

    async function load() {
      try {
        const data = await coursesApi.mine();
        if (cancelled) return;
        setCourses(data.courses);
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

  // CREATE: POST, then add the returned course to state (no refetch)
  const handleCreate = async (values) => {
    const data = await coursesApi.create(values);
    setCourses((prev) => [data.course, ...prev]);
    setListStatus('ready');
  };

  // UPDATE: PUT, then replace that one item in state
  const handleUpdate = async (values) => {
    console.log('editing course:', editing); // catches an undefined course / id
    const data = await coursesApi.update(editing?._id, values);
    setCourses((prev) => prev.map((c) => (c._id === data.course._id ? data.course : c)));
    setEditing(null);
  };

  const closeEditor = useCallback(() => setEditing(null), []);
  const cancelDelete = useCallback(() => setPendingDelete(null), []);

  // DELETE: the confirm dialog closes at once, the course leaves the list at once,
  // and the request runs in the background (rolled back if it fails)
  const confirmDelete = () => {
    const course = pendingDelete;
    setPendingDelete(null);
    if (!course) return;
    removeCourse(course._id, () => coursesApi.remove(course._id));
  };

  return (
    <AuthGate auth={auth}>
      {(user) => (
        <main className="max-w-3xl mx-auto p-6">
          <Nav user={user} onLogout={auth.logout} />

          {user.role !== 'instructor' ? (
            <div>
              <h1 className="text-2xl font-semibold mb-2">My Courses</h1>
              <p>Only instructor accounts can create and manage courses.</p>
              <Link href="/courses" className="underline">
                Browse the course catalog
              </Link>
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-semibold mb-6">My Courses</h1>

              <section className="mb-10">
                <h2 className="text-lg font-semibold mb-3">Create a new course</h2>
                <CourseForm
                  submitLabel="Create course"
                  submittingLabel="Creating..."
                  resetOnSuccess
                  onSubmit={handleCreate}
                />
              </section>

              <section>
                <h2 className="text-lg font-semibold mb-3">Your courses</h2>

                {deleteError && (
                  <div role="alert" className="mb-3 flex items-start justify-between gap-4 rounded border border-red-600 p-3 text-red-600">
                    <span>{deleteError}</span>
                    <button onClick={clearDeleteError} className="underline">
                      Dismiss
                    </button>
                  </div>
                )}

                {listStatus === 'loading' && <p>Loading your courses...</p>}

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
                  <p>No courses yet. Use the form above to create your first course.</p>
                )}

                {listStatus === 'ready' && courses.length > 0 && (
                  <ul className="space-y-3">
                    {courses.map((course) => (
                      <li key={course._id} className="flex justify-between gap-4 rounded border p-4">
                        <div>
                          <h3 className="font-semibold">{course.title}</h3>
                          <p className="text-sm">
                            {course.category} | {course.published ? 'Published' : 'Draft'}
                          </p>
                          <p className="mt-1">{course.description}</p>
                        </div>
                        <div className="flex h-fit gap-2">
                          <button onClick={() => setEditing(course)} className="border px-3 py-1 rounded">
                            Edit
                          </button>
                          <button
                            onClick={() => setPendingDelete(course)}
                            className="rounded border border-red-600 px-3 py-1 text-red-600"
                          >
                            Delete
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {editing && (
                <Modal title="Edit course" onClose={closeEditor}>
                  <CourseForm
                    key={editing._id}
                    initialValues={courseToFormValues(editing)}
                    submitLabel="Save changes"
                    submittingLabel="Saving..."
                    onSubmit={handleUpdate}
                    onCancel={closeEditor}
                  />
                </Modal>
              )}

              {pendingDelete && (
                <ConfirmDialog
                  title="Delete course?"
                  message={`"${pendingDelete.title}" and any student enrollments in it will be permanently deleted. This cannot be undone.`}
                  confirmLabel="Delete course"
                  onConfirm={confirmDelete}
                  onCancel={cancelDelete}
                />
              )}
            </>
          )}
        </main>
      )}
    </AuthGate>
  );
}
