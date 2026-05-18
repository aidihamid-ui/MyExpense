/**
 * All user-data queries live here. This is the multi-tenancy audit boundary.
 * Every exported function that returns user data MUST filter by userId.
 * First parameter is always userId: string.
 */

import { db } from '@/lib/db';
import { categories, expenses } from '@/lib/db/schema';
import { and, desc, eq } from 'drizzle-orm';

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
  }: { page?: number; limit?: number; sortBy?: string } = {}
) {
  const offset = (page - 1) * limit;
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
      createdAt: expenses.createdAt,
      updatedAt: expenses.updatedAt,
    })
    .from(expenses)
    .leftJoin(categories, eq(expenses.categoryId, categories.id))
    .where(eq(expenses.userId, userId))
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
