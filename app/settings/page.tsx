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
        <h1 className="text-2xl font-semibold">Tetapan</h1>

        {/* Account info */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Akaun</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Log masuk sebagai</p>
            <p className="font-medium">{session.user.email}</p>
          </CardContent>
        </Card>

        {/* Change password */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Tukar password</CardTitle>
            <CardDescription>Kemas kini password login.</CardDescription>
          </CardHeader>
          <CardContent>
            <ChangePasswordForm />
          </CardContent>
        </Card>

        {/* Danger zone */}
        <Card className="shadow-sm border-destructive/30">
          <CardHeader>
            <CardTitle className="text-destructive">Zon Bahaya</CardTitle>
            <CardDescription>
              Tindakan kekal tak boleh patah balik. Hati-hati.
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