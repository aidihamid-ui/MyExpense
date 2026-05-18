'use server';

import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createExpenseSchema } from '@/lib/validators/expense';
import { createExpense } from '@/lib/db/queries';

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

  const raw = {
    amount: parseFloat(formData.get('amount') as string),
    categoryId: (formData.get('categoryId') as string) || null,
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
