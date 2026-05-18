import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import Nav from '@/components/nav';
import LogoutButton from './logout-button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Nav />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <h1 className="mb-6 text-2xl font-semibold">Dashboard</h1>

        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>This month</CardTitle>
              <CardDescription>Total spending</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-primary">—</p>
              <p className="mt-1 text-xs text-muted-foreground">Coming in Phase 3</p>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Last month</CardTitle>
              <CardDescription>For comparison</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">—</p>
              <p className="mt-1 text-xs text-muted-foreground">Coming in Phase 3</p>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Account</CardTitle>
              <CardDescription>{session.user.email}</CardDescription>
            </CardHeader>
            <CardContent>
              <LogoutButton />
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
