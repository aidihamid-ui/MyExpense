import { claimNextOcrJob, markOcrJobDone, markOcrJobFailed } from '@/lib/db/queries';
import { PaddleOcrProvider } from '@/lib/ocr/paddle';

const ocr = new PaddleOcrProvider();
const POLL_INTERVAL_MS = 5_000;

async function tick() {
  const job = await claimNextOcrJob();
  if (!job) return;

  console.log(`[worker] job ${job.id} claimed`);
  try {
    const result = await ocr.extractFromImage(job.imagePath);
    await markOcrJobDone(job.id, job.receiptId, result.text);
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
