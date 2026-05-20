'use client';

import { useActionState, useState, useTransition } from 'react';
import Link from 'next/link';
import { createExpenseAction, type CreateExpenseState } from '@/lib/actions/expenses';
import { uploadReceiptAction } from '@/lib/actions/receipts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type Category = { id: string; name: string };

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card' },
  { value: 'ewallet', label: 'E-Wallet' },
  { value: 'other', label: 'Other' },
] as const;

const today = new Date().toISOString().split('T')[0];

export default function ExpenseForm({ categories }: { categories: Category[] }) {
  const [state, dispatch] = useActionState<CreateExpenseState, FormData>(
    createExpenseAction,
    null,
  );
  const [isPending, startTransition] = useTransition();
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'done' | 'error'>(
    'idle',
  );
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [pendingReceiptId, setPendingReceiptId] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);

    const fileInput = form.elements.namedItem('receiptFile') as HTMLInputElement | null;
    const file = fileInput?.files?.[0];

    let receiptId = pendingReceiptId;

    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setUploadStatus('error');
        setUploadError('File must be 5 MB or smaller.');
        return;
      }

      setUploadStatus('uploading');
      setUploadError(null);

      let result: Awaited<ReturnType<typeof uploadReceiptAction>>;
      try {
        const uploadData = new FormData();
        uploadData.set('receipt', file);
        result = await uploadReceiptAction(uploadData);
      } catch {
        setUploadStatus('error');
        setUploadError('Upload failed. Please try again.');
        return;
      }

      if (!result.ok) {
        setUploadStatus('error');
        setUploadError(result.error.message);
        return;
      }

      setUploadStatus('done');
      receiptId = result.data.receiptId;
      setPendingReceiptId(receiptId);
    }

    if (receiptId) {
      formData.set('receiptId', receiptId);
    }

    startTransition(() => {
      dispatch(formData);
    });
  }

  const submitting = isPending || uploadStatus === 'uploading';

  return (
    <div className="rounded-xl border bg-white p-6 shadow-sm">
      {state?.message && (
        <div className="mb-4 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {state.message}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {/* Amount */}
        <div>
          <label htmlFor="amount" className="mb-1.5 block text-sm font-medium">
            Amount (RM) <span className="text-destructive">*</span>
          </label>
          <Input
            id="amount"
            name="amount"
            type="number"
            step="0.01"
            min="0.01"
            placeholder="0.00"
            required
            className="h-11"
          />
          {state?.errors?.amount && (
            <p className="mt-1 text-xs text-destructive">{state.errors.amount[0]}</p>
          )}
        </div>

        {/* Category */}
        <div>
          <label htmlFor="categoryId" className="mb-1.5 block text-sm font-medium">
            Category
          </label>
          <Select name="categoryId" defaultValue="none">
            <SelectTrigger id="categoryId" className="h-11 w-full">
              <SelectValue placeholder="— None —" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— None —</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {state?.errors?.categoryId && (
            <p className="mt-1 text-xs text-destructive">{state.errors.categoryId[0]}</p>
          )}
        </div>

        {/* Date */}
        <div>
          <label htmlFor="date" className="mb-1.5 block text-sm font-medium">
            Date <span className="text-destructive">*</span>
          </label>
          <Input
            id="date"
            name="date"
            type="date"
            defaultValue={today}
            required
            className="h-11"
          />
          {state?.errors?.date && (
            <p className="mt-1 text-xs text-destructive">{state.errors.date[0]}</p>
          )}
        </div>

        {/* Payment Method */}
        <div>
          <label htmlFor="paymentMethod" className="mb-1.5 block text-sm font-medium">
            Payment Method <span className="text-destructive">*</span>
          </label>
          <Select name="paymentMethod" defaultValue="cash" required>
            <SelectTrigger id="paymentMethod" className="h-11 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAYMENT_METHODS.map(({ value, label }) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {state?.errors?.paymentMethod && (
            <p className="mt-1 text-xs text-destructive">{state.errors.paymentMethod[0]}</p>
          )}
        </div>

        {/* Note */}
        <div>
          <label htmlFor="note" className="mb-1.5 block text-sm font-medium">
            Note
          </label>
          <Textarea
            id="note"
            name="note"
            rows={3}
            maxLength={500}
            placeholder="Optional note..."
            className="resize-none"
          />
          {state?.errors?.note && (
            <p className="mt-1 text-xs text-destructive">{state.errors.note[0]}</p>
          )}
        </div>

        {/* Receipt upload */}
        <div>
          <label htmlFor="receiptFile" className="mb-1.5 block text-sm font-medium">
            Receipt <span className="text-muted-foreground text-xs font-normal">(optional)</span>
          </label>
          <Input
            id="receiptFile"
            name="receiptFile"
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            className="h-11 cursor-pointer file:mr-3 file:cursor-pointer file:rounded file:border-0 file:bg-muted file:px-3 file:py-1 file:text-sm"
          />
          {uploadStatus === 'uploading' && (
            <p className="mt-1 text-xs text-muted-foreground">Uploading receipt…</p>
          )}
          {uploadStatus === 'done' && (
            <p className="mt-1 text-xs text-green-600">Receipt uploaded.</p>
          )}
          {uploadStatus === 'error' && (
            <p className="mt-1 text-xs text-destructive">{uploadError}</p>
          )}
        </div>

        <div className="flex gap-3 pt-1">
          <Button type="submit" disabled={submitting} className="h-11 flex-1">
            {uploadStatus === 'uploading'
              ? 'Uploading receipt…'
              : isPending
                ? 'Saving…'
                : 'Save expense'}
          </Button>
          <Button variant="outline" asChild className="h-11">
            <Link href="/expenses">Cancel</Link>
          </Button>
        </div>
      </form>
    </div>
  );
}
