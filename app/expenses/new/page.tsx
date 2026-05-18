import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getCategories } from '@/lib/db/queries';
import Nav from '@/components/nav';
import ExpenseForm from './expense-form';

export default async function NewExpensePage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect('/login');
  }

  const categories = await getCategories(session.user.id);

  return (
    <div className="min-h-screen bg-gray-50">
      <Nav />
      <main className="mx-auto max-w-lg px-4 py-8">
        <h1 className="mb-6 text-2xl font-semibold text-gray-900">Add Expense</h1>
        <ExpenseForm categories={categories} />
      </main>
    </div>
  );
}
