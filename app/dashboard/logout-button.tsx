'use client';

import { useRouter } from 'next/navigation';
import { authClient } from '@/lib/auth/client';
import { Button } from '@/components/ui/button';

export default function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    await authClient.signOut();
    router.push('/login');
  }

  return (
    <Button
      variant="outline"
      onClick={handleLogout}
      className="h-11 w-full"
    >
      Sign out
    </Button>
  );
}
