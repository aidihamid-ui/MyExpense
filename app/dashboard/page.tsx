import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import Nav from '@/components/nav';
import LogoutButton from './logout-button';

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Nav />
      <main className="flex flex-col items-center gap-4 p-8">
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
          <LogoutButton />
        </div>
      </main>
    </div>
  );
}
