#!/usr/bin/env node
/**
 * ds-watch.js — Watch DeepSeek task activity in real-time via SSE.
 *
 * Run in a spare terminal:
 *   DEEPSEEK_RUNTIME_TOKEN=mytoken node scripts/ds-watch.js
 *
 * Start deepseek serve with a stable token so this always works:
 *   deepseek serve --http --port 7878 --auth-token mytoken
 */

const PORT  = process.env.DEEPSEEK_PORT  || '7878';
const TOKEN = process.env.DEEPSEEK_RUNTIME_TOKEN;
const BASE  = `http://127.0.0.1:${PORT}`;

if (!TOKEN) {
  console.error('Error: DEEPSEEK_RUNTIME_TOKEN is not set.');
  console.error('  Start serve with:  deepseek serve --http --port 7878 --auth-token mytoken');
  console.error('  Run watcher with:  DEEPSEEK_RUNTIME_TOKEN=mytoken node scripts/ds-watch.js');
  process.exit(1);
}

const HEADERS = { Authorization: `Bearer ${TOKEN}` };

async function get(path) {
  const res = await fetch(`${BASE}${path}`, { headers: HEADERS });
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}`);
  return res.json();
}

async function streamThread(threadId) {
  const res = await fetch(`${BASE}/v1/threads/${threadId}/events?since_seq=0`, {
    headers: HEADERS,
  });

  const reader  = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buf += decoder.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop(); // keep the incomplete trailing line

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      let ev;
      try { ev = JSON.parse(line.slice(6)); } catch { continue; }

      switch (ev.event) {
        case 'item.started': {
          const kind = ev.payload?.item?.kind ?? '';
          if (kind === 'agent_reasoning') process.stdout.write('\n  [thinking] ');
          else if (kind === 'agent_message') process.stdout.write('\n  [response] ');
          break;
        }
        case 'item.delta': {
          if (ev.payload?.delta) process.stdout.write(ev.payload.delta);
          break;
        }
        case 'item.completed': {
          const kind = ev.payload?.item?.kind ?? '';
          if (kind === 'agent_reasoning' || kind === 'agent_message') {
            process.stdout.write('\n');
          }
          break;
        }
        case 'turn.completed':
          process.stdout.write('\n');
          reader.cancel();
          return;
      }
    }
  }
}

async function main() {
  // Verify server is up
  try {
    const health = await fetch(`${BASE}/health`);
    const body   = await health.json();
    if (body.status !== 'ok') throw new Error('unhealthy');
  } catch {
    console.error(`Cannot reach deepseek serve at ${BASE}. Is it running?`);
    process.exit(1);
  }

  console.log(`Connected to DeepSeek serve at ${BASE}`);
  console.log('Waiting for tasks... (Ctrl+C to stop)\n');

  const seen = new Set();

  // Seed: mark all already-finished tasks so we don't replay them
  try {
    const { tasks } = await get('/v1/tasks');
    for (const t of tasks) {
      if (!['queued', 'running'].includes(t.status)) seen.add(t.id);
    }
  } catch { /* ignore */ }

  while (true) {
    try {
      const { tasks } = await get('/v1/tasks');

      for (const task of tasks) {
        if (seen.has(task.id)) continue;
        if (!['queued', 'running'].includes(task.status)) {
          seen.add(task.id);
          continue;
        }

        seen.add(task.id);
        const promptText = (task.prompt_summary ?? task.prompt ?? '').slice(0, 42);
        const bar = '─'.repeat(52);
        console.log(`\n┌${bar}┐`);
        console.log(`│ Task  : ${task.id.padEnd(42)} │`);
        console.log(`│ Prompt: ${promptText.padEnd(42)} │`);
        console.log(`└${bar}┘`);

        // thread_id is in the list; if missing wait briefly and fetch detail
        let threadId = task.thread_id ?? null;
        if (!threadId) {
          await new Promise(r => setTimeout(r, 400));
          const detail = await get(`/v1/tasks/${task.id}`);
          threadId = detail.thread_id ?? null;
        }

        if (threadId) {
          await streamThread(threadId);
          console.log(`\n  [done]\n`);
        }
      }
    } catch (err) {
      // Serve may be briefly unavailable — just retry
      process.stderr.write(`\r[retrying: ${err.message}]`);
    }

    await new Promise(r => setTimeout(r, 1000));
  }
}

main().catch(err => { console.error(err); process.exit(1); });
