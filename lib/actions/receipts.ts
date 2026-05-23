'use server';

import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { createReceipt, createOcrJob, getReceiptById, getReceiptStatus } from '@/lib/db/queries';
import { env } from '@/lib/env';
import { z } from 'zod';
import path from 'path';
import fs from 'fs/promises';
import { randomUUID } from 'crypto';
import sharp from 'sharp';

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
] as const;

type AllowedMime = (typeof ALLOWED_MIME_TYPES)[number];

// Magic-byte validators — read first 16 bytes
const MAGIC: Record<AllowedMime, (b: Buffer) => boolean> = {
  'image/jpeg': (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  'image/png': (b) =>
    b[0] === 0x89 &&
    b[1] === 0x50 &&
    b[2] === 0x4e &&
    b[3] === 0x47 &&
    b[4] === 0x0d &&
    b[5] === 0x0a &&
    b[6] === 0x1a &&
    b[7] === 0x0a,
  'image/webp': (b) =>
    b[0] === 0x52 &&
    b[1] === 0x49 &&
    b[2] === 0x46 &&
    b[3] === 0x46 &&
    b[8] === 0x57 &&
    b[9] === 0x45 &&
    b[10] === 0x42 &&
    b[11] === 0x50,
  'application/pdf': (b) =>
    b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46,
};

const EXT: Record<AllowedMime, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

export type UploadReceiptResult =
  | { ok: true; data: { receiptId: string } }
  | { ok: false; error: { code: string; message: string } };

export async function uploadReceiptAction(
  formData: FormData,
): Promise<UploadReceiptResult> {
  // 1. Session check
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return { ok: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated.' } };
  }
  const userId = session.user.id;

  // 2. File presence
  const file = formData.get('receipt');
  if (!(file instanceof File)) {
    return { ok: false, error: { code: 'NO_FILE', message: 'No file provided.' } };
  }

  // 3. Size check (5 MB max)
  if (file.size > MAX_BYTES) {
    return {
      ok: false,
      error: { code: 'FILE_TOO_LARGE', message: 'File must be 5 MB or smaller.' },
    };
  }

  // 4. MIME whitelist
  const mimeType = file.type as AllowedMime;
  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    return {
      ok: false,
      error: {
        code: 'INVALID_MIME',
        message: 'Only JPEG, PNG, WebP, and PDF files are accepted.',
      },
    };
  }

  // 5. Magic-bytes check (don't trust the declared MIME alone)
  const arrayBuffer = await file.arrayBuffer();
  const buf = Buffer.from(arrayBuffer);
  if (!MAGIC[mimeType](buf.subarray(0, 16))) {
    return {
      ok: false,
      error: {
        code: 'MAGIC_MISMATCH',
        message: 'File content does not match declared file type.',
      },
    };
  }

  // 6. EXIF strip — images only; PDFs pass through unchanged.
  // sharp strips all metadata by default when .withMetadata() is NOT called.
  let finalBuf: Buffer;
  if (mimeType !== 'application/pdf') {
    try {
      finalBuf = await sharp(buf).toBuffer();
    } catch {
      return {
        ok: false,
        error: { code: 'PROCESS_ERROR', message: 'Failed to process image.' },
      };
    }
  } else {
    finalBuf = buf;
  }

  // 7. UUID filename
  const ext = EXT[mimeType];
  const filename = `${randomUUID()}.${ext}`;

  // 8–10. mkdir -p, write file
  const userDir = path.join(env.STORAGE_PATH, userId);
  const filePath = path.join(userDir, filename);

  try {
    await fs.mkdir(userDir, { recursive: true });
    await fs.writeFile(filePath, finalBuf);
  } catch {
    return {
      ok: false,
      error: { code: 'WRITE_ERROR', message: 'Failed to save file.' },
    };
  }

  // 11. Insert receipts row
  try {
    const receipt = await createReceipt(userId, {
      imagePath: filePath,
      originalName: file.name,
      mimeType,
      sizeBytes: file.size,
    });
    return { ok: true, data: { receiptId: receipt.id } };
  } catch {
    // Clean up the written file so we don't leave orphans
    await fs.unlink(filePath).catch(() => {});
    return {
      ok: false,
      error: { code: 'DB_ERROR', message: 'Failed to save receipt record.' },
    };
  }
}

// ── OCR Job ────────────────────────────────────────────────────────────────────

const createOcrJobSchema = z.object({ receiptId: z.string().uuid() });

export type CreateOcrJobResult =
  | { ok: true; data: { jobId: string } }
  | { ok: false; error: { code: string; message: string } };

export async function createOcrJobAction(receiptId: string): Promise<CreateOcrJobResult> {
  // 1. Validate input
  const parsed = createOcrJobSchema.safeParse({ receiptId });
  if (!parsed.success) {
    return { ok: false, error: { code: 'INVALID_INPUT', message: 'Invalid receipt ID.' } };
  }

  // 2. Session check
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return { ok: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated.' } };
  }
  const userId = session.user.id;

  // 3. Verify receipt ownership — returns null if wrong user or doesn't exist
  const receipt = await getReceiptById(userId, receiptId);
  if (!receipt) {
    return { ok: false, error: { code: 'NOT_FOUND', message: 'Receipt not found.' } };
  }

  // 4. Create OCR job
  const job = await createOcrJob(receiptId);
  return { ok: true, data: { jobId: job.id } };
}

// --- Receipt Status Polling ---

const checkReceiptStatusSchema = z.object({ receiptId: z.string().uuid() });

export type CheckReceiptStatusResult =
  | { ok: true; data: { status: string; extractedDataJson: string | null; rawOcrText: string | null } }
  | { ok: false; error: { code: string; message: string } };

export async function checkReceiptStatusAction(
  receiptId: string,
): Promise<CheckReceiptStatusResult> {
  // 1. Validate input
  const parsed = checkReceiptStatusSchema.safeParse({ receiptId });
  if (!parsed.success) {
    return { ok: false, error: { code: 'INVALID_INPUT', message: 'Invalid receipt ID.' } };
  }

  // 2. Session check
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return { ok: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated.' } };
  }

  // 3. Fetch status (filters by userId internally)
  const row = await getReceiptStatus(session.user.id, receiptId);
  if (!row) {
    return { ok: false, error: { code: 'NOT_FOUND', message: 'Receipt not found.' } };
  }

  return { ok: true, data: row };
}

