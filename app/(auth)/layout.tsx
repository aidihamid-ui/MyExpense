import Link from 'next/link';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 py-12">
      <div className="mb-8 text-center">
        <span className="text-2xl font-bold text-primary tracking-tight">KasiKira</span>
        <p className="mt-1 text-sm text-muted-foreground">Track your spending, simply.</p>
      </div>
      <div className="w-full max-w-sm">{children}</div>
      <p className="mt-8 text-xs text-muted-foreground text-center">
        Your data is private and never shared.{' '}
        <Link href="/privacy" className="hover:underline">
          Privacy Policy
        </Link>
      </p>
    </main>
  );
}
