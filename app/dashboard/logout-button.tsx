'use client';

import { useRouter } from 'next/navigation';
import { authClient } from '@/lib/auth/client';

export default function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    await authClient.signOut();
    router.push('/login');
  }

  return (
    <button
      onClick={handleLogout}
      className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
    >
      Sign out
    </button>
  );
}
