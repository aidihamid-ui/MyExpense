'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { authClient } from '@/lib/auth/client';

const links = [
  { href: '/dashboard', label: 'Ringkasan' },
  { href: '/expenses', label: 'Belanja' },
  { href: '/settings', label: 'Tetapan' },
];

export default function Nav() {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    await authClient.signOut();
    router.push('/login');
  }

  return (
    <nav className="border-b bg-white shadow-sm">
      <div className="mx-auto max-w-5xl px-4">
        {/* Top row: brand (+ desktop links inline) + sign out */}
        <div className="flex items-center py-2">
          <span className="text-base font-bold text-primary tracking-tight">KasiKira</span>
          {/* Desktop only: separator + nav links inline */}
          <div className="hidden sm:flex items-center gap-3 ml-3">
            <Separator orientation="vertical" className="h-5" />
            <div className="flex gap-1">
              {links.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  className={`flex min-h-[44px] items-center rounded-lg px-3 text-sm font-medium transition-colors ${
                    pathname.startsWith(href)
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  {label}
                </Link>
              ))}
            </div>
          </div>
          <div className="ml-auto">
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              Log keluar
            </Button>
          </div>
        </div>
        {/* Mobile only: nav links as full-width tab strip */}
        <div className="flex border-t sm:hidden">
          {links.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`flex flex-1 items-center justify-center min-h-[44px] text-sm font-medium transition-colors ${
                pathname.startsWith(href)
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              {label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
