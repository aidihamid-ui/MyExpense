import { db } from '@/lib/db';
import { categories } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

const DEFAULT_CATEGORIES = [
  'Makan',
  'Barang Dapur',
  'Transport',
  'Bil Rumah',
  'Rumah',
  'Hiburan',
  'Kesihatan',
  'Jalan-Jalan',
  'Pinjaman',
  'Insurans & Takaful',
  'Shopping',
  'Gajet & Elektronik',
  'Kecantikan',
  'Pelajaran',
  'Hadiah & Sumbangan',
  'Lain-Lain',
] as const;

/**
 * Seeds the 16 default categories for a user.
 * Safe to call multiple times — only inserts missing categories.
 */
export async function seedDefaultCategories(userId: string): Promise<void> {
  const existing = await db
    .select({ name: categories.name })
    .from(categories)
    .where(eq(categories.userId, userId));

  const existingNames = new Set(existing.map((c) => c.name));

  const toInsert = DEFAULT_CATEGORIES.filter(
    (name) => !existingNames.has(name)
  ).map((name) => ({ userId, name }));

  if (toInsert.length > 0) {
    await db.insert(categories).values(toInsert);
  }
}
