'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { createExpenseAction, type CreateExpenseState } from '@/lib/actions/expenses';

type Category = { id: string; name: string };

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card' },
  { value: 'ewallet', label: 'E-Wallet' },
  { value: 'other', label: 'Other' },
] as const;

const today = new Date().toISOString().split('T')[0];

export default function ExpenseForm({ categories }: { categories: Category[] }) {
  const [state, formAction, pending] = useActionState<CreateExpenseState, FormData>(
    createExpenseAction,
    null,
  );

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6">
      {state?.message && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
          {state.message}
        </div>
      )}

      <form action={formAction} className="flex flex-col gap-5">
        {/* Amount */}
        <div>
          <label htmlFor="amount" className="mb-1 block text-sm font-medium text-gray-700">
            Amount (RM) <span className="text-red-500">*</span>
          </label>
          <input
            id="amount"
            name="amount"
            type="number"
            step="0.01"
            min="0.01"
            placeholder="0.00"
            required
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
          />
          {state?.errors?.amount && (
            <p className="mt-1 text-xs text-red-500">{state.errors.amount[0]}</p>
          )}
        </div>

        {/* Category */}
        <div>
          <label htmlFor="categoryId" className="mb-1 block text-sm font-medium text-gray-700">
            Category
          </label>
          <select
            id="categoryId"
            name="categoryId"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
          >
            <option value="">— None —</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
          {state?.errors?.categoryId && (
            <p className="mt-1 text-xs text-red-500">{state.errors.categoryId[0]}</p>
          )}
        </div>

        {/* Date */}
        <div>
          <label htmlFor="date" className="mb-1 block text-sm font-medium text-gray-700">
            Date <span className="text-red-500">*</span>
          </label>
          <input
            id="date"
            name="date"
            type="date"
            defaultValue={today}
            required
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
          />
          {state?.errors?.date && (
            <p className="mt-1 text-xs text-red-500">{state.errors.date[0]}</p>
          )}
        </div>

        {/* Payment Method */}
        <div>
          <label
            htmlFor="paymentMethod"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            Payment Method <span className="text-red-500">*</span>
          </label>
          <select
            id="paymentMethod"
            name="paymentMethod"
            required
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
          >
            {PAYMENT_METHODS.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          {state?.errors?.paymentMethod && (
            <p className="mt-1 text-xs text-red-500">{state.errors.paymentMethod[0]}</p>
          )}
        </div>

        {/* Note */}
        <div>
          <label htmlFor="note" className="mb-1 block text-sm font-medium text-gray-700">
            Note
          </label>
          <textarea
            id="note"
            name="note"
            rows={3}
            maxLength={500}
            placeholder="Optional note..."
            className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
          />
          {state?.errors?.note && (
            <p className="mt-1 text-xs text-red-500">{state.errors.note[0]}</p>
          )}
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={pending}
            className="flex-1 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
          >
            {pending ? 'Saving...' : 'Save expense'}
          </button>
          <Link
            href="/expenses"
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
