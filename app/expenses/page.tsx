import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getExpenses } from '@/lib/db/queries';
import Nav from '@/components/nav';
import DeleteExpenseButton from '@/components/delete-expense-button';

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Cash',
  card: 'Card',
  ewallet: 'E-Wallet',
  other: 'Other',
};

const PAGE_SIZE = 20;

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect('/login');
  }

  const sp = await searchParams;
  const pageStr = typeof sp.page === 'string' ? sp.page : '1';
  const page = Math.max(1, parseInt(pageStr, 10) || 1);

  const rows = await getExpenses(session.user.id, { page, limit: PAGE_SIZE + 1 });
  const hasNext = rows.length > PAGE_SIZE;
  const expenses = rows.slice(0, PAGE_SIZE);

  return (
    <div className="min-h-screen bg-gray-50">
      <Nav />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-900">Expenses</h1>
          <Link
            href="/expenses/new"
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
          >
            Add expense
          </Link>
        </div>

        {expenses.length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white p-12 text-center">
            <p className="mb-4 text-gray-500">No expenses yet.</p>
            <Link
              href="/expenses/new"
              className="text-sm font-medium text-gray-900 underline"
            >
              Add your first expense
            </Link>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-hidden rounded-xl border border-gray-200 bg-white sm:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50 text-left">
                    <th className="px-4 py-3 font-medium text-gray-500">Date</th>
                    <th className="px-4 py-3 font-medium text-gray-500">Category</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-500">Amount (RM)</th>
                    <th className="px-4 py-3 font-medium text-gray-500">Payment</th>
                    <th className="px-4 py-3 font-medium text-gray-500">Note</th>
                    <th className="px-4 py-3 font-medium text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((expense) => (
                    <tr
                      key={expense.id}
                      className="border-b border-gray-50 last:border-0"
                    >
                      <td className="px-4 py-3 text-gray-700">{expense.date}</td>
                      <td className="px-4 py-3 text-gray-700">
                        {expense.categoryName ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900">
                        {Number(expense.amount).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {PAYMENT_LABELS[expense.paymentMethod] ?? expense.paymentMethod}
                      </td>
                      <td className="px-4 py-3 text-gray-400">{expense.note ?? '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Link
                            href={`/expenses/${expense.id}/edit`}
                            className="text-xs font-medium text-gray-500 hover:text-gray-900"
                          >
                            Edit
                          </Link>
                          <DeleteExpenseButton expenseId={expense.id} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile card list */}
            <div className="flex flex-col gap-3 sm:hidden">
              {expenses.map((expense) => (
                <div
                  key={expense.id}
                  className="rounded-xl border border-gray-200 bg-white p-4"
                >
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-xs text-gray-400">{expense.date}</span>
                    <span className="font-semibold text-gray-900">
                      RM {Number(expense.amount).toFixed(2)}
                    </span>
                  </div>
                  <div className="text-sm text-gray-700">
                    {expense.categoryName ?? '—'}
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
                    <span>
                      {PAYMENT_LABELS[expense.paymentMethod] ?? expense.paymentMethod}
                    </span>
                    {expense.note && (
                      <span className="text-gray-400">· {expense.note}</span>
                    )}
                  </div>
                  <div className="mt-3 flex items-center gap-4 border-t border-gray-50 pt-3">
                    <Link
                      href={`/expenses/${expense.id}/edit`}
                      className="text-xs font-medium text-gray-500 hover:text-gray-900"
                    >
                      Edit
                    </Link>
                    <DeleteExpenseButton expenseId={expense.id} />
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {(page > 1 || hasNext) && (
              <div className="mt-6 flex items-center justify-between">
                {page > 1 ? (
                  <Link
                    href={`/expenses?page=${page - 1}`}
                    className="text-sm font-medium text-gray-700 hover:text-gray-900"
                  >
                    ← Previous
                  </Link>
                ) : (
                  <span />
                )}
                <span className="text-sm text-gray-500">Page {page}</span>
                {hasNext ? (
                  <Link
                    href={`/expenses?page=${page + 1}`}
                    className="text-sm font-medium text-gray-700 hover:text-gray-900"
                  >
                    Next →
                  </Link>
                ) : (
                  <span />
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
