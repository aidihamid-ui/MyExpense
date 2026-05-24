import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import Nav from '@/components/nav';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  getDashboardSummary,
  getCategoryBreakdown,
  getFilteredExpenseSummary,
  getCategories,
} from '@/lib/db/queries';
import FilterBar from './filter-bar';

// Malaysia UTC+8 offset in milliseconds
const MYT_OFFSET_MS = 8 * 60 * 60 * 1000;

/** Compute current-month default date range in Malaysia local time. */
function getMalaysiaMonthDefaults(now: Date): { from: string; to: string } {
  const nowMYT = new Date(now.getTime() + MYT_OFFSET_MS);
  const year = nowMYT.getUTCFullYear();
  const month = nowMYT.getUTCMonth(); // 0-indexed
  const pad = (n: number) => String(n).padStart(2, '0');

  const from = `${year}-${pad(month + 1)}-01`;

  // Last day of current month in MYT: day 0 of next month
  const lastDay = new Date(Date.UTC(year, month + 1, 0));
  const to = `${lastDay.getUTCFullYear()}-${pad(lastDay.getUTCMonth() + 1)}-${pad(lastDay.getUTCDate())}`;

  return { from, to };
}

const paramSchema = z.object({
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  categoryId: z.string().uuid().optional(),
});

function formatRM(amount: number): string {
  return `RM ${amount.toLocaleString('en-MY', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/login');

  const now = new Date();
  const { from: defaultFrom, to: defaultTo } = getMalaysiaMonthDefaults(now);

  // Validate URL params with Zod — invalid values fall back to defaults silently
  const rawParams = await searchParams;
  const parsed = paramSchema.safeParse({
    from: typeof rawParams.from === 'string' ? rawParams.from : undefined,
    to: typeof rawParams.to === 'string' ? rawParams.to : undefined,
    categoryId: typeof rawParams.categoryId === 'string' ? rawParams.categoryId : undefined,
  });
  const validParams = parsed.success ? parsed.data : {};

  const fromStr = validParams.from ?? defaultFrom;
  const toStr = validParams.to ?? defaultTo;
  const categoryId = validParams.categoryId;

  // Calendar-date Date objects (UTC midnight == the calendar date)
  const fromDate = new Date(fromStr);
  const toDate = new Date(toStr);

  const userId = session.user.id;

  const [summary, breakdown, filtered, userCategories] = await Promise.all([
    getDashboardSummary(userId, now),
    getCategoryBreakdown(userId, fromDate, toDate),
    getFilteredExpenseSummary(userId, fromDate, toDate, categoryId),
    getCategories(userId),
  ]);

  // When a category filter is applied, narrow the breakdown to that category
  const displayBreakdown = categoryId
    ? breakdown.filter((b) => b.categoryId === categoryId)
    : breakdown;

  return (
    <div className="min-h-screen bg-slate-50">
      <Nav />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <h1 className="mb-6 text-2xl font-semibold">Dashboard</h1>

        {/* Row 1 — Metric cards */}
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>This Month</CardTitle>
              <CardDescription>Current calendar month (MYT)</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-primary">
                {formatRM(summary.currentMonthTotal)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Last month: {formatRM(summary.lastMonthTotal)}
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Last 30 Days</CardTitle>
              <CardDescription>Rolling 30-day window (MYT)</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-primary">
                {formatRM(summary.last30DaysTotal)}
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Filtered Total</CardTitle>
              <CardDescription>
                {fromStr} → {toStr}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-primary">{formatRM(filtered.total)}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {filtered.count} transaction{filtered.count !== 1 ? 's' : ''}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Row 2 — Filter bar */}
        <div className="mb-6">
          <FilterBar
            initialFrom={fromStr}
            initialTo={toStr}
            initialCategoryId={categoryId ?? ''}
            categories={userCategories}
            defaultFrom={defaultFrom}
            defaultTo={defaultTo}
          />
        </div>

        {/* Row 3 — Category breakdown table */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Category Breakdown</CardTitle>
            <CardDescription>
              {fromStr} → {toStr}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {displayBreakdown.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No expenses in this period
              </p>
            ) : (
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Transactions</TableHead>
                    <TableHead className="text-right">% of Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayBreakdown.map((row) => (
                    <TableRow key={row.categoryId}>
                      <TableCell>{row.categoryName}</TableCell>
                      <TableCell className="text-right">{formatRM(row.total)}</TableCell>
                      <TableCell className="text-right">{row.count}</TableCell>
                      <TableCell className="text-right">
                        {filtered.total > 0
                          ? `${((row.total / filtered.total) * 100).toFixed(1)}%`
                          : '0.0%'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
