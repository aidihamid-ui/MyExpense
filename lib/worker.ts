import path from 'path';
import { claimNextOcrJob, markOcrJobDone, markOcrJobFailed } from '@/lib/db/queries';
import { PaddleOcrProvider } from '@/lib/ocr/paddle';
import { parseReceiptText } from '@/lib/ocr/parser';

const ocr = new PaddleOcrProvider();
const POLL_INTERVAL_MS = 5_000;

/**
 * On Windows (bare-metal worker + Docker OCR), convert the stored Windows path
 * to the Linux path the Docker container sees via its volume mount.
 * e.g. C:\Users\...\var\receipts\x\y.jpg → /c/Users/.../var/receipts/x/y.jpg
 * No-op on Linux (production Docker worker).
 */
function toOcrPath(imagePath: string): string {
  if (process.platform !== 'win32') return imagePath;
  const abs = path.resolve(imagePath);
  return abs.replace(/^([A-Za-z]):/, (_, d: string) => '/' + d.toLowerCase()).replace(/\\/g, '/');
}

async function tick() {
  const job = await claimNextOcrJob();
  if (!job) return;

  console.log(`[worker] job ${job.id} claimed`);
  try {
    const result = await ocr.extractFromImage(toOcrPath(job.imagePath));
    const parsed = parseReceiptText(result.text);
    const extractedDataJson = JSON.stringify(parsed);
    await markOcrJobDone(job.id, job.receiptId, result.text, extractedDataJson);
    console.log(`[worker] job ${job.id} done`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await markOcrJobFailed(job.id, job.receiptId, message, job.attempts);
    console.log(`[worker] job ${job.id} failed: ${message}`);
  }
}

const interval = setInterval(() => {
  tick().catch((err) => console.error('[worker] tick error:', err));
}, POLL_INTERVAL_MS);

function shutdown() {
  clearInterval(interval);
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

console.log('[worker] started, polling every 5s');
