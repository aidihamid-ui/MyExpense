import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import Nav from '@/components/nav';
import ChangePasswordForm from './change-password-form';
import DeleteAccountSection from './delete-account';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export default async function SettingsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/login');

  return (
    <div className="min-h-screen bg-slate-50">
      <Nav />
      <main className="mx-auto max-w-2xl space-y-6 px-4 py-8">
        <h1 className="text-2xl font-semibold">Settings</h1>

        {/* Account info */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Account</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Signed in as</p>
            <p className="font-medium">{session.user.email}</p>
          </CardContent>
        </Card>

        {/* Change password */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Change password</CardTitle>
            <CardDescription>Update your login password.</CardDescription>
          </CardHeader>
          <CardContent>
            <ChangePasswordForm />
          </CardContent>
        </Card>

        {/* Danger zone */}
        <Card className="shadow-sm border-destructive/30">
          <CardHeader>
            <CardTitle className="text-destructive">Danger zone</CardTitle>
            <CardDescription>
              These actions are irreversible. Proceed with caution.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DeleteAccountSection />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
