'use client';

import Link from 'next/link';

export default function Nav({ user, onLogout }) {
  return (
    <nav className="flex flex-wrap items-center gap-4 border-b pb-3 mb-6">
      <Link href="/dashboard" className="font-semibold">
        EduCore
      </Link>
      <Link href="/courses" className="underline">
        Course catalog
      </Link>
      {user.role === 'instructor' && (
        <Link href="/instructor" className="underline">
          My courses
        </Link>
      )}
      <span className="ml-auto text-sm">
        {user.name} ({user.role})
        {user.plan === 'pro' && <strong className="ml-2 rounded border px-1">PRO</strong>}
      </span>
      <button onClick={onLogout} className="border px-3 py-1 rounded">
        Log out
      </button>
    </nav>
  );
}
