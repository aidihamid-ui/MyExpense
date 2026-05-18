export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 py-12">
      <div className="mb-8 text-center">
        <span className="text-2xl font-bold text-primary tracking-tight">MyExpense</span>
        <p className="mt-1 text-sm text-muted-foreground">Track your spending, simply.</p>
      </div>
      <div className="w-full max-w-sm">{children}</div>
    </main>
  );
}
