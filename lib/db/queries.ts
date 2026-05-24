/**
 * All user-data queries live here. This is the multi-tenancy audit boundary.
 * Every exported function that returns user data MUST filter by userId.
 * First parameter is always userId: string.
 */

import { db } from '@/lib/db';
import { categories, expenses, ocrJobs, receipts } from '@/lib/db/schema';
import { and, count, desc, eq, gte, ilike, lt, lte, sql, sum } from 'drizzle-orm';

// ── Categories ──────────────────────────────────────────────────────────────

export async function getCategories(userId: string) {
  return db
    .select()
    .from(categories)
    .where(eq(categories.userId, userId));
}

// ── Expenses ────────────────────────────────────────────────────────────────

export async function getExpenses(
  userId: string,
  {
    page = 1,
    limit = 20,
    sortBy: _sortBy = 'date', // only date-desc supported; param reserved for Phase 3+
    search = '',
  }: { page?: number; limit?: number; sortBy?: string; search?: string } = {}
) {
  const offset = (page - 1) * limit;
  const searchFilter = search ? ilike(expenses.note, `%${search}%`) : undefined;

  return db
    .select({
      id: expenses.id,
      userId: expenses.userId,
      categoryId: expenses.categoryId,
      categoryName: categories.name,
      amount: expenses.amount,
      date: expenses.date,
      note: expenses.note,
      paymentMethod: expenses.paymentMethod,
      receiptId: expenses.receiptId,
      createdAt: expenses.createdAt,
      updatedAt: expenses.updatedAt,
    })
    .from(expenses)
    .leftJoin(categories, eq(expenses.categoryId, categories.id))
    .where(and(eq(expenses.userId, userId), searchFilter))
    .orderBy(desc(expenses.date))
    .limit(limit)
    .offset(offset);
}

export async function getExpenseById(userId: string, expenseId: string) {
  const [row] = await db
    .select({
      id: expenses.id,
      userId: expenses.userId,
      categoryId: expenses.categoryId,
      categoryName: categories.name,
      amount: expenses.amount,
      date: expenses.date,
      note: expenses.note,
      paymentMethod: expenses.paymentMethod,
      createdAt: expenses.createdAt,
      updatedAt: expenses.updatedAt,
    })
    .from(expenses)
    .leftJoin(categories, eq(expenses.categoryId, categories.id))
    .where(and(eq(expenses.id, expenseId), eq(expenses.userId, userId)));

  return row ?? null;
}

export async function createExpense(
  userId: string,
  data: {
    categoryId?: string | null;
    amount: string;
    date: string;
    note?: string | null;
    paymentMethod: string;
    receiptId?: string | null;
  }
) {
  const [created] = await db
    .insert(expenses)
    .values({ userId, ...data })
    .returning();
  return created;
}

export async function updateExpense(
  userId: string,
  expenseId: string,
  data: {
    categoryId?: string | null;
    amount?: string;
    date?: string;
    note?: string | null;
    paymentMethod?: string;
  }
) {
  const existing = await getExpenseById(userId, expenseId);
  if (!existing) {
    throw new Error('Expense not found or access denied');
  }
  const [updated] = await db
    .update(expenses)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(expenses.id, expenseId), eq(expenses.userId, userId)))
    .returning();
  return updated;
}

export async function deleteExpense(userId: string, expenseId: string) {
  const existing = await getExpenseById(userId, expenseId);
  if (!existing) {
    throw new Error('Expense not found or access denied');
  }
  await db
    .delete(expenses)
    .where(and(eq(expenses.id, expenseId), eq(expenses.userId, userId)));
}

// ── Dashboard ────────────────────────────────────────────────────────────────

/**
 * Returns current-month total, last-month total, and rolling 30-day total.
 * All calendar boundaries are computed in Malaysia local time (UTC+8).
 * `now` must be passed by the caller — never derive current time inside a query.
 */
export async function getDashboardSummary(userId: string, now: Date) {
  const MYT_OFFSET_MS = 8 * 60 * 60 * 1000;
  const nowMYT = new Date(now.getTime() + MYT_OFFSET_MS);

  const year = nowMYT.getUTCFullYear();
  const month = nowMYT.getUTCMonth(); // 0-indexed
  const pad = (n: number) => String(n).padStart(2, '0');

  // Current month: [currentMonthStart, nextMonthStart)
  const currentMonthStart = `${year}-${pad(month + 1)}-01`;
  const nextYear = month === 11 ? year + 1 : year;
  const nextMonthNum = month === 11 ? 0 : month + 1;
  const nextMonthStart = `${nextYear}-${pad(nextMonthNum + 1)}-01`;

  // Last month: [lastMonthStart, currentMonthStart)
  const lastMonthYear = month === 0 ? year - 1 : year;
  const lastMonthNum = month === 0 ? 11 : month - 1;
  const lastMonthStart = `${lastMonthYear}-${pad(lastMonthNum + 1)}-01`;

  // Last 30 days: [30 days ago in MYT, today in MYT]
  const thirtyDaysAgoMYT = new Date(nowMYT.getTime() - 30 * 24 * 60 * 60 * 1000);
  const last30DaysStart = `${thirtyDaysAgoMYT.getUTCFullYear()}-${pad(thirtyDaysAgoMYT.getUTCMonth() + 1)}-${pad(thirtyDaysAgoMYT.getUTCDate())}`;
  const todayStr = `${year}-${pad(month + 1)}-${pad(nowMYT.getUTCDate())}`;

  const [currentMonth, lastMonth, last30Days] = await Promise.all([
    db
      .select({ total: sum(expenses.amount) })
      .from(expenses)
      .where(
        and(
          eq(expenses.userId, userId),
          gte(expenses.date, currentMonthStart),
          lt(expenses.date, nextMonthStart)
        )
      ),
    db
      .select({ total: sum(expenses.amount) })
      .from(expenses)
      .where(
        and(
          eq(expenses.userId, userId),
          gte(expenses.date, lastMonthStart),
          lt(expenses.date, currentMonthStart)
        )
      ),
    db
      .select({ total: sum(expenses.amount) })
      .from(expenses)
      .where(
        and(
          eq(expenses.userId, userId),
          gte(expenses.date, last30DaysStart),
          lte(expenses.date, todayStr)
        )
      ),
  ]);

  return {
    currentMonthTotal: Number(currentMonth[0]?.total ?? 0),
    lastMonthTotal: Number(lastMonth[0]?.total ?? 0),
    last30DaysTotal: Number(last30Days[0]?.total ?? 0),
  };
}

/**
 * Category totals and counts for a given date range.
 * Only categories with at least one expense in the range are returned.
 * Uncategorized expenses are grouped under categoryId='uncategorized'.
 * Ordered by total descending.
 */
export async function getCategoryBreakdown(userId: string, from: Date, to: Date) {
  const fromStr = from.toISOString().split('T')[0];
  const toStr = to.toISOString().split('T')[0];

  const rows = await db
    .select({
      categoryId: categories.id,
      categoryName: categories.name,
      total: sum(expenses.amount),
      count: count(),
    })
    .from(expenses)
    .leftJoin(categories, eq(expenses.categoryId, categories.id))
    .where(
      and(
        eq(expenses.userId, userId),
        gte(expenses.date, fromStr),
        lte(expenses.date, toStr)
      )
    )
    .groupBy(categories.id, categories.name)
    .orderBy(desc(sum(expenses.amount)));

  return rows.map((row) => ({
    categoryId: row.categoryId ?? 'uncategorized',
    categoryName: row.categoryName ?? 'Uncategorized',
    total: Number(row.total ?? 0),
    count: Number(row.count),
  }));
}

/**
 * Aggregate total and count for a filtered date range.
 * Pass categoryId to narrow to a single category; omit for all categories.
 */
export async function getFilteredExpenseSummary(
  userId: string,
  from: Date,
  to: Date,
  categoryId?: string
) {
  const fromStr = from.toISOString().split('T')[0];
  const toStr = to.toISOString().split('T')[0];

  const [result] = await db
    .select({ total: sum(expenses.amount), count: count() })
    .from(expenses)
    .where(
      and(
        eq(expenses.userId, userId),
        gte(expenses.date, fromStr),
        lte(expenses.date, toStr),
        categoryId ? eq(expenses.categoryId, categoryId) : undefined
      )
    );

  return {
    total: Number(result?.total ?? 0),
    count: Number(result?.count ?? 0),
  };
}

// getUserCategories re-uses getCategories (per-user, ADR-010 compliant)
export const getUserCategories = getCategories;

// ── Receipts ─────────────────────────────────────────────────────────────────

export async function createReceipt(
  userId: string,
  data: {
    imagePath: string;
    originalName: string;
    mimeType: string;
    sizeBytes: number;
  }
) {
  const [created] = await db
    .insert(receipts)
    .values({ userId, ...data, status: 'pending' })
    .returning();
  return created;
}

export async function getReceiptById(userId: string, receiptId: string) {
  const [row] = await db
    .select()
    .from(receipts)
    .where(and(eq(receipts.id, receiptId), eq(receipts.userId, userId)));
  return row ?? null;
}

/** Returns receipt status, OCR text, and parsed data for the review UI. */
export async function getReceiptStatus(userId: string, receiptId: string) {
  const [row] = await db
    .select({
      status: receipts.status,
      extractedDataJson: receipts.extractedDataJson,
      rawOcrText: receipts.rawOcrText,
    })
    .from(receipts)
    .where(and(eq(receipts.id, receiptId), eq(receipts.userId, userId)));
  return row ?? null;
}

// ── OCR Worker Queries ────────────────────────────────────────────────────────
// These are system queries (no userId filter) — they operate on the job queue,
// not on user-owned data directly.

/** Creates a pending OCR job for a receipt. Caller must verify receipt ownership first. */
export async function createOcrJob(receiptId: string) {
  const [job] = await db
    .insert(ocrJobs)
    .values({ receiptId, status: 'pending', attempts: 0, scheduledFor: new Date() })
    .returning();
  return job;
}

/**
 * Atomically claims one pending OCR job where scheduledFor <= now() and
 * attempts < 3. Sets status to 'processing'. Returns the job row and the
 * receipt's imagePath, or null if no job is available.
 * Uses FOR UPDATE SKIP LOCKED so concurrent workers never claim the same job.
 */
export async function claimNextOcrJob() {
  const [job] = await db
    .update(ocrJobs)
    .set({ status: 'processing' })
    .where(
      sql`id = (
        SELECT id FROM ocr_jobs
        WHERE status = 'pending'
          AND "scheduledFor" <= NOW()
          AND attempts < 3
        ORDER BY "scheduledFor"
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      )`
    )
    .returning();

  if (!job) return null;

  const [receipt] = await db
    .select({ imagePath: receipts.imagePath })
    .from(receipts)
    .where(eq(receipts.id, job.receiptId));

  if (!receipt) return null;

  return { ...job, imagePath: receipt.imagePath };
}

/** Sets the job to done and writes OCR text, extracted JSON, and status to the receipt row. */
export async function markOcrJobDone(
  jobId: string,
  receiptId: string,
  ocrText: string,
  extractedDataJson: string,
) {
  await Promise.all([
    db.update(ocrJobs).set({ status: 'done' }).where(eq(ocrJobs.id, jobId)),
    db
      .update(receipts)
      .set({ rawOcrText: ocrText, extractedDataJson, status: 'completed' })
      .where(eq(receipts.id, receiptId)),
  ]);
}

/**
 * Marks the job failed. If attempts >= 2 (i.e. this is the 3rd and final
 * attempt — claim query only allows attempts < 3, so max passed-in value is 2),
 * the job and receipt are permanently failed. Otherwise, the job is rescheduled
 * (status=pending) with a 30-second backoff and attempts incremented.
 */
export async function markOcrJobFailed(
  jobId: string,
  receiptId: string,
  error: string,
  attempts: number
) {
  if (attempts >= 2) {
    await Promise.all([
      db
        .update(ocrJobs)
        .set({ status: 'failed', lastError: error })
        .where(eq(ocrJobs.id, jobId)),
      db.update(receipts).set({ status: 'failed' }).where(eq(receipts.id, receiptId)),
    ]);
  } else {
    const scheduledFor = new Date(Date.now() + 30_000);
    await db
      .update(ocrJobs)
      .set({ status: 'pending', attempts: attempts + 1, scheduledFor, lastError: error })
      .where(eq(ocrJobs.id, jobId));
  }
}
