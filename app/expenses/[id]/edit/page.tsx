import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { getExpenseById, getCategories } from '@/lib/db/queries';
import Nav from '@/components/nav';
import EditExpenseForm from './edit-expense-form';

export default async function EditExpensePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/login');

  const { id } = await params;

  const [expense, categories] = await Promise.all([
    getExpenseById(session.user.id, id),
    getCategories(session.user.id),
  ]);

  if (!expense) notFound();

  return (
    <div className="min-h-screen bg-gray-50">
      <Nav />
      <main className="mx-auto max-w-lg px-4 py-8">
        <h1 className="mb-6 text-2xl font-semibold text-gray-900">Edit Expense</h1>
        <EditExpenseForm expense={expense} categories={categories} />
      </main>
    </div>
  );
}
