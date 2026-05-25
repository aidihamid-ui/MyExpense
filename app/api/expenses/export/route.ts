import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getAllExpensesForExport } from '@/lib/db/queries';

function csvEscape(value: string | null | undefined): string {
  const str = value ?? '';
  return `"${str.replace(/"/g, '""')}"`;
}

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect('/login');
  }

  const rows = await getAllExpensesForExport(session.user.id);

  const PAYMENT_LABELS: Record<string, string> = {
    cash: 'Cash',
    card: 'Card',
    ewallet: 'E-Wallet',
    other: 'Other',
  };

  const csvRows = [
    ['Date', 'Amount', 'Category', 'Note', 'Payment Method'].map(csvEscape).join(','),
    ...rows.map((row) =>
      [
        csvEscape(row.date),
        csvEscape(Number(row.amount).toFixed(2)),
        csvEscape(row.categoryName ?? ''),
        csvEscape(row.note ?? ''),
        csvEscape(PAYMENT_LABELS[row.paymentMethod] ?? row.paymentMethod),
      ].join(',')
    ),
  ];

  const csv = csvRows.join('\r\n');
  const today = new Date().toISOString().slice(0, 10);
  const filename = `myexpense-${today}.csv`;

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
