import { z } from 'zod';

const PAYMENT_METHODS = ['cash', 'card', 'ewallet', 'other'] as const;

export const createExpenseSchema = z.object({
  amount: z
    .number()
    .positive('Amount must be positive')
    .refine(
      (n) => parseFloat(n.toFixed(2)) === n,
      'Amount may have at most 2 decimal places'
    ),
  categoryId: z.uuid().nullable().optional(),
  date: z.iso.date(),
  note: z.string().max(500, 'Note may not exceed 500 characters').optional(),
  paymentMethod: z.enum(PAYMENT_METHODS),
});

export const updateExpenseSchema = createExpenseSchema.partial().refine(
  (data) => Object.values(data).some((v) => v !== undefined),
  { message: 'At least one field must be provided' }
);

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>;
