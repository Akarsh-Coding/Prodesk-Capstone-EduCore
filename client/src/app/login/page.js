'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiPost } from '@/lib/api';
import { saveSession } from '@/lib/auth';

const inputClass = 'block w-full border border-gray-400 rounded px-2 py-1 bg-white text-black';

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;

    setLoading(true);
    setError('');

    try {
      const data = await apiPost('/api/auth/login', form);
      if (!saveSession(data)) {
        throw new Error('Your browser blocked storage, so the login could not be saved.');
      }
      router.push('/dashboard');
    } catch (err) {
      setError(err.message); // for example "Invalid credentials"
      setLoading(false);
    }
  };

  return (
    <main className="max-w-sm mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-4">Log in</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
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
        </div>

        <div>
          <label htmlFor="password">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            value={form.password}
            onChange={handleChange}
            required
            disabled={loading}
            autoComplete="current-password"
            className={inputClass}
          />
        </div>

        {error && (
          <p role="alert" className="text-red-600">
            {error}
          </p>
        )}

        <button type="submit" disabled={loading} className="border px-4 py-2 rounded disabled:opacity-50">
          {loading ? 'Logging in...' : 'Log in'}
        </button>
      </form>

      <p className="mt-4">
        New here?{' '}
        <Link href="/register" className="underline">
          Create an account
        </Link>
      </p>
    </main>
  );
}
