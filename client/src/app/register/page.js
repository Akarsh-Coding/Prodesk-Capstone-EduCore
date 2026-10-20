'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiPost } from '@/lib/api';
import { saveSession } from '@/lib/auth';

const inputClass = 'block w-full border border-gray-400 rounded px-2 py-1 bg-white text-black';
const errorClass = 'text-red-600 text-sm mt-1';

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'student' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  // Controlled inputs: always build a new object, never mutate the old state
  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return; // ignore double submits

    setLoading(true);
    setError('');
    setFieldErrors({});

    try {
      const data = await apiPost('/api/auth/register', form);
      if (!saveSession(data)) {
        throw new Error('Account created, but your browser blocked storage. Try logging in again.');
      }
      router.push('/dashboard');
      // loading stays true until the page changes, so the button cannot be clicked twice
    } catch (err) {
      setError(err.message);
      setFieldErrors(err.fieldErrors || {});
      setLoading(false);
    }
  };

  return (
    <main className="max-w-sm mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-4">Create your account</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="name">Full name</label>
          <input
            id="name"
            name="name"
            type="text"
            value={form.name}
            onChange={handleChange}
            required
            disabled={loading}
            autoComplete="name"
            className={inputClass}
          />
          {fieldErrors.name && <p className={errorClass}>{fieldErrors.name}</p>}
        </div>

        <div>
          <label htmlFor="email">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            value={form.email}
            onChange={handleChange}
            required
            disabled={loading}
            autoComplete="email"
            className={inputClass}
          />
          {fieldErrors.email && <p className={errorClass}>{fieldErrors.email}</p>}
        </div>

        <div>
          <label htmlFor="password">Password (at least 8 characters)</label>
          <input
            id="password"
            name="password"
            type="password"
            value={form.password}
            onChange={handleChange}
            required
            minLength={8}
            disabled={loading}
            autoComplete="new-password"
            className={inputClass}
          />
          {fieldErrors.password && <p className={errorClass}>{fieldErrors.password}</p>}
        </div>

        <div>
          <label htmlFor="role">I want to</label>
          <select
            id="role"
            name="role"
            value={form.role}
            onChange={handleChange}
            disabled={loading}
            className={inputClass}
          >
            <option value="student">Learn (Student)</option>
            <option value="instructor">Teach (Instructor)</option>
          </select>
          {fieldErrors.role && <p className={errorClass}>{fieldErrors.role}</p>}
        </div>

        {error && (
          <p role="alert" className="text-red-600">
            {error}
          </p>
        )}

        <button type="submit" disabled={loading} className="border px-4 py-2 rounded disabled:opacity-50">
          {loading ? 'Creating account...' : 'Create account'}
        </button>
      </form>

      <p className="mt-4">
        Already have an account?{' '}
        <Link href="/login" className="underline">
          Log in
        </Link>
      </p>
    </main>
  );
}
