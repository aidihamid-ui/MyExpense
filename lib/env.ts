import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.url(),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.url(),
  STORAGE_PATH: z.string().default('./var/receipts'),
  OCR_PROVIDER: z.enum(['paddle', 'claude', 'openai']).default('paddle'),
  OCR_SECRET: z.string().optional(),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

export const env = envSchema.parse(process.env);
