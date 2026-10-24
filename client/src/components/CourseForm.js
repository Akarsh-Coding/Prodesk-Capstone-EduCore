'use client';

import { useId, useState } from 'react';

const inputClass = 'block w-full border border-gray-400 rounded px-2 py-1 bg-white text-black';
const errorClass = 'text-red-600 text-sm mt-1';

export const EMPTY_COURSE = { title: '', description: '', category: '', thumbnailUrl: '', published: false };

// Turns a course from the API into form values (null thumbnail becomes an empty string)
export function courseToFormValues(course) {
  return {
    title: course.title || '',
    description: course.description || '',
    category: course.category || '',
    thumbnailUrl: course.thumbnailUrl || '',
    published: Boolean(course.published),
  };
}

// Used for both "create" and "edit". `onSubmit(values)` must return a promise and throw on failure.
export default function CourseForm({
  initialValues = EMPTY_COURSE,
  submitLabel = 'Save',
  submittingLabel = 'Saving...',
  resetOnSuccess = false,
  onSubmit,
  onCancel,
}) {
  const formId = useId();
  const [values, setValues] = useState(initialValues);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [notice, setNotice] = useState('');

  // Controlled inputs: always build a new object, never mutate the old state
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setValues((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    setNotice('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return; // ignore double submits

    setSubmitting(true);
    setError('');
    setFieldErrors({});
    setNotice('');

    try {
      await onSubmit(values);
      if (resetOnSuccess) {
        setValues(initialValues);
        setNotice('Course created.');
      }
    } catch (err) {
      setError(err.message);
      setFieldErrors(err.fieldErrors || {});
    } finally {
      setSubmitting(false);
    }
  };

  const id = (name) => `${formId}-${name}`;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor={id('title')}>Title</label>
        <input
          id={id('title')}
          name="title"
          type="text"
          value={values.title}
          onChange={handleChange}
          required
          disabled={submitting}
          className={inputClass}
        />
        {fieldErrors.title && <p className={errorClass}>{fieldErrors.title}</p>}
      </div>

      <div>
        <label htmlFor={id('description')}>Description</label>
        <textarea
          id={id('description')}
          name="description"
          rows={4}
          value={values.description}
          onChange={handleChange}
          required
          maxLength={2000}
          disabled={submitting}
          className={inputClass}
        />
        {fieldErrors.description && <p className={errorClass}>{fieldErrors.description}</p>}
      </div>

      <div>
        <label htmlFor={id('category')}>Category</label>
        <input
          id={id('category')}
          name="category"
          type="text"
          value={values.category}
          onChange={handleChange}
          required
          disabled={submitting}
          className={inputClass}
        />
        {fieldErrors.category && <p className={errorClass}>{fieldErrors.category}</p>}
      </div>

      <div>
        <label htmlFor={id('thumbnailUrl')}>Thumbnail URL (optional)</label>
        <input
          id={id('thumbnailUrl')}
          name="thumbnailUrl"
          type="url"
          value={values.thumbnailUrl}
          onChange={handleChange}
          disabled={submitting}
          className={inputClass}
        />
        {fieldErrors.thumbnailUrl && <p className={errorClass}>{fieldErrors.thumbnailUrl}</p>}
      </div>

      <div>
        <label className="flex items-center gap-2">
          <input
            name="published"
            type="checkbox"
            checked={values.published}
            onChange={handleChange}
            disabled={submitting}
          />
          Published (visible in the student catalog)
        </label>
        {fieldErrors.published && <p className={errorClass}>{fieldErrors.published}</p>}
      </div>

      {error && (
        <p role="alert" className="text-red-600">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}

      <div className="flex gap-3">
        <button type="submit" disabled={submitting} className="border px-4 py-2 rounded disabled:opacity-50">
          {submitting ? submittingLabel : submitLabel}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} disabled={submitting} className="border px-4 py-2 rounded">
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
