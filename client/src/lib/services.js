import { api } from '@/lib/api';

// Every request that puts an id in the URL or body goes through here:
//   1. the id is logged, so an `undefined` shows up in the browser console right away
//   2. if the id is missing, the request is NOT sent (it fails with a readable message instead)
function requireId(label, id) {
  console.log(`[api] ${label} id:`, id);
  if (!id || id === 'undefined' || id === 'null') {
    throw new Error(`Missing ${label} ID, so the request was not sent.`);
  }
}

// Only the editable fields are sent. (The server also ignores anything else, including authorId.)
function pickCourseFields(values) {
  return {
    title: values.title,
    description: values.description,
    category: values.category,
    thumbnailUrl: values.thumbnailUrl,
    published: Boolean(values.published),
  };
}

export const coursesApi = {
  list: () => api.get('/api/courses'), // published courses (student catalog)
  mine: () => api.get('/api/courses/mine'), // the logged-in user's own courses, drafts included
  create: (values) => api.post('/api/courses', pickCourseFields(values)),
  // PUT replaces all editable fields, so the form must always send the full set
  update: async (id, values) => {
    requireId('course', id);
    return api.put(`/api/courses/${id}`, pickCourseFields(values));
  },
};

export const enrollmentsApi = {
  mine: () => api.get('/api/enrollments/mine'),
  enroll: async (courseId) => {
    requireId('course', courseId);
    return api.post('/api/enrollments', { courseId });
  },
};
