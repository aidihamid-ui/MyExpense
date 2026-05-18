import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getExpenses } from '@/lib/db/queries';
import Nav from '@/components/nav';
import DeleteExpenseButton from '@/components/delete-expense-button';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

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
    <div className="min-h-screen bg-slate-50">
      <Nav />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Expenses</h1>
          <Button asChild className="h-11 px-5">
            <Link href="/expenses/new">Add expense</Link>
          </Button>
        </div>

        {expenses.length === 0 ? (
          <Card className="shadow-sm">
            <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
              <p className="text-muted-foreground">No expenses yet.</p>
              <Button asChild variant="outline" className="h-11">
                <Link href="/expenses/new">Add your first expense</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Desktop table */}
            <Card className="hidden shadow-sm sm:block">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="px-4">Date</TableHead>
                    <TableHead className="px-4">Category</TableHead>
                    <TableHead className="px-4 text-right">Amount (RM)</TableHead>
                    <TableHead className="px-4">Payment</TableHead>
                    <TableHead className="px-4">Note</TableHead>
                    <TableHead className="px-4">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expenses.map((expense) => (
                    <TableRow key={expense.id}>
                      <TableCell className="px-4 py-3 text-muted-foreground">
                        {expense.date}
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        {expense.categoryName ? (
                          <Badge variant="secondary">{expense.categoryName}</Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-right font-semibold">
                        {Number(expense.amount).toFixed(2)}
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <Badge variant="outline">
                          {PAYMENT_LABELS[expense.paymentMethod] ?? expense.paymentMethod}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-4 py-3 text-muted-foreground">
                        {expense.note ?? '—'}
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <Button asChild variant="ghost" size="sm" className="h-9 px-2">
                            <Link href={`/expenses/${expense.id}/edit`}>Edit</Link>
                          </Button>
                          <DeleteExpenseButton expenseId={expense.id} />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>

            {/* Mobile card list */}
            <div className="flex flex-col gap-3 sm:hidden">
              {expenses.map((expense) => (
                <Card key={expense.id} className="shadow-sm">
                  <CardContent className="p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">{expense.date}</span>
                      <span className="text-base font-semibold">
                        RM {Number(expense.amount).toFixed(2)}
                      </span>
                    </div>
                    <div className="mb-2 flex flex-wrap gap-1.5">
                      {expense.categoryName && (
                        <Badge variant="secondary">{expense.categoryName}</Badge>
                      )}
                      <Badge variant="outline">
                        {PAYMENT_LABELS[expense.paymentMethod] ?? expense.paymentMethod}
                      </Badge>
                    </div>
                    {expense.note && (
                      <p className="mb-2 text-sm text-muted-foreground">{expense.note}</p>
                    )}
                    <div className="flex items-center gap-2 border-t pt-3">
                      <Button asChild variant="ghost" size="sm" className="h-9 px-3">
                        <Link href={`/expenses/${expense.id}/edit`}>Edit</Link>
                      </Button>
                      <DeleteExpenseButton expenseId={expense.id} />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Pagination */}
            {(page > 1 || hasNext) && (
              <div className="mt-6 flex items-center justify-between">
                {page > 1 ? (
                  <Button asChild variant="outline" className="h-11">
                    <Link href={`/expenses?page=${page - 1}`}>← Previous</Link>
                  </Button>
                ) : (
                  <span />
                )}
                <span className="text-sm text-muted-foreground">Page {page}</span>
                {hasNext ? (
                  <Button asChild variant="outline" className="h-11">
                    <Link href={`/expenses?page=${page + 1}`}>Next →</Link>
                  </Button>
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
