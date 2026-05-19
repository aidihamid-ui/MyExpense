import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { getReceiptById } from '@/lib/db/queries';
import { env } from '@/lib/env';
import path from 'path';
import fs from 'fs/promises';
import { type NextRequest, NextResponse } from 'next/server';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // 1. Session check
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const { id } = await params;

  // 2. Fetch receipt (already filters by userId — multi-tenancy boundary)
  const receipt = await getReceiptById(session.user.id, id);

  // 3. Not found
  if (!receipt) {
    return new NextResponse('Not found', { status: 404 });
  }

  // 4. Ownership check — belt-and-suspenders; getReceiptById already filters by userId
  if (receipt.userId !== session.user.id) {
    return new NextResponse('Not found', { status: 404 });
  }

  // 5. Path traversal guard: resolved path must be inside STORAGE_PATH
  const resolvedPath = path.resolve(receipt.imagePath);
  const resolvedStorage = path.resolve(env.STORAGE_PATH);
  if (!resolvedPath.startsWith(resolvedStorage + path.sep)) {
    return new NextResponse('Not found', { status: 404 });
  }

  // 6. Stream file
  let blob: Blob;
  try {
    const raw = await fs.readFile(resolvedPath);
    blob = new Blob([raw], { type: receipt.mimeType });
  } catch {
    return new NextResponse('Not found', { status: 404 });
  }

  // 7. Return with correct Content-Type and no caching
  return new NextResponse(blob, {
    status: 200,
    headers: {
      'Cache-Control': 'private, no-store',
    },
  });
}
