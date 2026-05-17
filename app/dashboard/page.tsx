import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import LogoutButton from './logout-button';

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    redirect('/login');
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-50 p-8">
      <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="mb-2 text-2xl font-semibold text-gray-900">
          Dashboard
        </h1>
        <p className="mb-6 text-sm text-gray-500">
          Signed in as{' '}
          <span className="font-medium text-gray-700">
            {session.user.email}
          </span>
        </p>
        <p className="mb-6 text-sm text-gray-400">
          Expense features coming in Phase 2.
        </p>
        <LogoutButton />
      </div>
    </main>
  );
}
