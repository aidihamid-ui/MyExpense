'use server';

import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createExpenseSchema } from '@/lib/validators/expense';
import { createExpense, updateExpense, deleteExpense } from '@/lib/db/queries';

export type CreateExpenseState = {
  errors?: {
    amount?: string[];
    categoryId?: string[];
    date?: string[];
    note?: string[];
    paymentMethod?: string[];
  };
  message?: string;
} | null;

export async function createExpenseAction(
  _prevState: CreateExpenseState,
  formData: FormData,
): Promise<CreateExpenseState> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect('/login');
  }

  const rawCategoryId = formData.get('categoryId') as string;
  const raw = {
    amount: parseFloat(formData.get('amount') as string),
    categoryId: !rawCategoryId || rawCategoryId === 'none' ? null : rawCategoryId,
    date: formData.get('date') as string,
    note: (formData.get('note') as string) || undefined,
    paymentMethod: formData.get('paymentMethod') as string,
  };

  const result = createExpenseSchema.safeParse(raw);
  if (!result.success) {
    return { errors: result.error.flatten().fieldErrors };
  }

  try {
    await createExpense(session.user.id, {
      categoryId: result.data.categoryId,
      amount: result.data.amount.toFixed(2),
      date: result.data.date,
      note: result.data.note,
      paymentMethod: result.data.paymentMethod,
    });
  } catch {
    return { message: 'Something went wrong. Please try again.' };
  }

  redirect('/expenses');
}

// ── Update ───────────────────────────────────────────────────────────────────

export async function updateExpenseAction(
  _prevState: CreateExpenseState,
  formData: FormData,
): Promise<CreateExpenseState> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/login');

  const expenseId = formData.get('expenseId') as string;
  if (!expenseId) return { message: 'Invalid request.' };

  const rawCategoryId = formData.get('categoryId') as string;
  const raw = {
    amount: parseFloat(formData.get('amount') as string),
    categoryId: !rawCategoryId || rawCategoryId === 'none' ? null : rawCategoryId,
    date: formData.get('date') as string,
    note: (formData.get('note') as string) || undefined,
    paymentMethod: formData.get('paymentMethod') as string,
  };

  const result = createExpenseSchema.safeParse(raw);
  if (!result.success) {
    return { errors: result.error.flatten().fieldErrors };
  }

  try {
    await updateExpense(session.user.id, expenseId, {
      categoryId: result.data.categoryId,
      amount: result.data.amount.toFixed(2),
      date: result.data.date,
      note: result.data.note,
      paymentMethod: result.data.paymentMethod,
    });
  } catch (err) {
    if (err instanceof Error && err.message === 'Expense not found or access denied') {
      notFound();
    }
    return { message: 'Something went wrong. Please try again.' };
  }

  redirect('/expenses');
}

// ── Delete ───────────────────────────────────────────────────────────────────

export async function deleteExpenseAction(expenseId: string): Promise<{ error?: string }> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { error: 'Unauthorized' };

  try {
    await deleteExpense(session.user.id, expenseId);
  } catch (err) {
    if (err instanceof Error && err.message === 'Expense not found or access denied') {
      notFound();
    }
    return { error: 'Something went wrong. Please try again.' };
  }

  revalidatePath('/expenses');
  return {};
}
