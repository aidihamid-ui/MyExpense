'use client';

import { useEffect, useState, useRef, useCallback, useActionState } from 'react';
import { createExpenseAction, type CreateExpenseState } from '@/lib/actions/expenses';
import { checkReceiptStatusAction } from '@/lib/actions/receipts';
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

type OcrData = { total: number | null; date: string | null; merchant: string | null };
type PageStatus = 'loading' | 'pending' | 'processing' | 'completed' | 'failed';

// ── ReviewClient ──────────────────────────────────────────────────────────────

export default function ReviewClient({
  receiptId,
  categories,
  ocrFailed,
}: {
  receiptId: string;
  categories: Category[];
  ocrFailed: boolean;
}) {
  const [pageStatus, setPageStatus] = useState<PageStatus>(
    ocrFailed ? 'failed' : 'loading',
  );
  const [ocrData, setOcrData] = useState<OcrData | null>(null);
  const [rawOcrText, setRawOcrText] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const poll = useCallback(async () => {
    const result = await checkReceiptStatusAction(receiptId);
    if (!result.ok) {
      setErrorMessage(result.error.message);
      setPageStatus('failed');
      return;
    }

    const { status, extractedDataJson, rawOcrText: raw } = result.data;

    if (status === 'completed') {
      setPageStatus('completed');
      if (extractedDataJson) {
        try {
          setOcrData(JSON.parse(extractedDataJson));
        } catch {
          setOcrData(null);
        }
      }
      setRawOcrText(raw);
    } else if (status === 'pending' || status === 'processing') {
      setPageStatus(status);
    } else {
      setPageStatus('failed');
    }
  }, [receiptId]);

  // Start polling (initial poll via setTimeout to avoid sync setState in effect)
  useEffect(() => {
    if (ocrFailed) return;

    const initialTimer = setTimeout(() => {
      poll();
    }, 0);

    pollIntervalRef.current = setInterval(poll, 3000);
    elapsedTimerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);

    return () => {
      clearTimeout(initialTimer);
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
    };
  }, [ocrFailed, poll]);

  // Stop polling when status is final
  useEffect(() => {
    if (pageStatus === 'completed' || pageStatus === 'failed') {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      if (elapsedTimerRef.current) {
        clearInterval(elapsedTimerRef.current);
        elapsedTimerRef.current = null;
      }
    }
  }, [pageStatus]);

  // ── Render sub-views ───────────────────────────────────────────────────────

  if (pageStatus === 'loading') {
    return <LoadingView />;
  }

  if (pageStatus === 'pending' || pageStatus === 'processing') {
    return <PendingView status={pageStatus} elapsed={elapsed} />;
  }

  if (pageStatus === 'failed') {
    return (
      <FailedView
        receiptId={receiptId}
        categories={categories}
        warning={
          ocrFailed
            ? 'OCR could not be started for this receipt. You can still enter the details manually.'
            : errorMessage
              ? `OCR failed: ${errorMessage}`
              : 'OCR failed to read this receipt. You can still enter the details manually.'
        }
      />
    );
  }

  if (pageStatus === 'completed') {
    return (
      <CompletedView
        receiptId={receiptId}
        categories={categories}
        ocrData={ocrData}
        rawOcrText={rawOcrText}
      />
    );
  }

  // Fallback
  return <LoadingView />;
}

// ── LoadingView ───────────────────────────────────────────────────────────────

function LoadingView() {
  return (
    <div className="rounded-xl border bg-white p-8 text-center shadow-sm">
      <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      <p className="text-sm text-muted-foreground">Checking receipt status…</p>
    </div>
  );
}

// ── PendingView ───────────────────────────────────────────────────────────────

function PendingView({
  status,
  elapsed,
}: {
  status: 'pending' | 'processing';
  elapsed: number;
}) {
  return (
    <div className="rounded-xl border bg-white p-8 text-center shadow-sm">
      <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      <h2 className="mb-1 text-base font-semibold">
        {status === 'pending' ? 'Analysing your receipt…' : 'Processing receipt…'}
      </h2>
      <p className="text-sm text-muted-foreground">
        {elapsed < 10
          ? 'This usually takes 5–10 seconds.'
          : `Still working… (${elapsed}s elapsed)`}
      </p>
    </div>
  );
}

// ── CompletedView ─────────────────────────────────────────────────────────────

function CompletedView({
  receiptId,
  categories,
  ocrData,
  rawOcrText,
}: {
  receiptId: string;
  categories: Category[];
  ocrData: OcrData | null;
  rawOcrText: string | null;
}) {
  return (
    <div className="space-y-4">
      {/* Success banner */}
      <div className="rounded-xl border border-green-200 bg-green-50 p-4 shadow-sm">
        <p className="text-sm font-medium text-green-800">
          Receipt analysed! Review the details below and confirm.
        </p>
      </div>

      {/* Prefilled expense form */}
      <ExpenseForm
        receiptId={receiptId}
        categories={categories}
        defaultAmount={ocrData?.total != null ? ocrData.total.toFixed(2) : undefined}
        defaultDate={ocrData?.date ?? undefined}
        defaultNote={ocrData?.merchant ?? undefined}
        submitLabel="Confirm expense"
      />

      {/* Raw OCR text (collapsible) */}
      {rawOcrText && (
        <details className="rounded-xl border bg-white p-4 shadow-sm">
          <summary className="cursor-pointer text-sm font-medium text-muted-foreground">
            View raw OCR text
          </summary>
          <pre className="mt-3 max-h-48 overflow-auto rounded-lg bg-slate-50 p-3 text-xs whitespace-pre-wrap break-words">
            {rawOcrText}
          </pre>
        </details>
      )}
    </div>
  );
}

// ── FailedView ────────────────────────────────────────────────────────────────

function FailedView({
  receiptId,
  categories,
  warning,
}: {
  receiptId: string;
  categories: Category[];
  warning: string;
}) {
  return (
    <div className="space-y-4">
      {/* Warning banner */}
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
        <p className="text-sm font-medium text-amber-800">{warning}</p>
      </div>

      {/* Blank expense form */}
      <ExpenseForm
        receiptId={receiptId}
        categories={categories}
        submitLabel="Save expense"
      />
    </div>
  );
}

// ── ExpenseForm (shared by CompletedView and FailedView) ──────────────────────

function ExpenseForm({
  receiptId,
  categories,
  defaultAmount,
  defaultDate,
  defaultNote,
  submitLabel,
}: {
  receiptId: string;
  categories: Category[];
  defaultAmount?: string;
  defaultDate?: string;
  defaultNote?: string;
  submitLabel: string;
}) {
  const [state, dispatch] = useActionState<CreateExpenseState, FormData>(
    createExpenseAction,
    null,
  );

  return (
    <div className="rounded-xl border bg-white p-6 shadow-sm">
      {state?.message && (
        <div className="mb-4 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {state.message}
        </div>
      )}

      <form action={dispatch} className="flex flex-col gap-5">
        {/* receiptId — hidden */}
        <input type="hidden" name="receiptId" value={receiptId} />

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
            defaultValue={defaultAmount}
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
            required
            className="h-11"
            defaultValue={defaultDate ?? today}
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
            defaultValue={defaultNote}
          />
          {state?.errors?.note && (
            <p className="mt-1 text-xs text-destructive">{state.errors.note[0]}</p>
          )}
        </div>

        <div className="flex gap-3 pt-1">
          <Button type="submit" className="h-11 flex-1">
            {submitLabel}
          </Button>
        </div>
      </form>
    </div>
  );
}
