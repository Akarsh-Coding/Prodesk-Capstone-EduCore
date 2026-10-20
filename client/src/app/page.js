import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="max-w-sm mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-4">EduCore</h1>
      <p className="mb-4">Learning management system.</p>
      <div className="flex gap-4">
        <Link href="/login" className="underline">
          Log in
        </Link>
        <Link href="/register" className="underline">
          Register
        </Link>
      </div>
    </main>
  );
}
