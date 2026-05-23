import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { getReceiptById, getCategories } from '@/lib/db/queries';
import Nav from '@/components/nav';
import ReviewClient from './review-client';

export default async function ReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ warning?: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/login');

  const { id } = await params;
  const sp = await searchParams;

  const [receipt, categories] = await Promise.all([
    getReceiptById(session.user.id, id),
    getCategories(session.user.id),
  ]);

  if (!receipt) notFound();

  const ocrFailed = sp.warning === 'ocr_failed';

  return (
    <div className="min-h-screen bg-slate-50">
      <Nav />
      <main className="mx-auto max-w-lg px-4 py-8">
        <h1 className="mb-6 text-2xl font-semibold">Review Receipt</h1>
        <ReviewClient
          receiptId={id}
          categories={categories}
          ocrFailed={ocrFailed}
        />
      </main>
    </div>
  );
}
