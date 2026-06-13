import Link from 'next/link';

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-8 shadow-sm text-center">
        <h1 className="mb-2 text-2xl font-semibold text-gray-900">
          KasiKira
        </h1>
        <p className="mb-8 text-sm text-gray-500">Jom kira, baru tahu.</p>
        <div className="flex flex-col gap-3">
          <Link
            href="/login"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Sign in
          </Link>
          <Link
            href="/signup"
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Create account
          </Link>
        </div>
      </div>
    </main>
  );
}
