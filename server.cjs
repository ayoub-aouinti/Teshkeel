'use strict';

const express = require('express');
const { spawn } = require('child_process');
const path = require('path');

const app = express();
const PORT = process.env.API_PORT || 3001;

const PYTHON_CANDIDATES = process.platform === 'win32'
  ? ['py', 'python', 'python3']
  : ['python3', 'python'];

const WORKER_SCRIPT = path.join(__dirname, 'tashkeel_worker.py');
const POOL_SIZE = 3;    // parallel Python workers
const CHUNK_CHARS = 1500; // chars per chunk sent to one worker call

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use((_, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  next();
});
app.options('/api/tashkeel', (_, res) => res.sendStatus(204));
app.get('/api/health', (_, res) => res.json({ status: 'ok' }));

// ─── PythonWorker ─────────────────────────────────────────────────────────────

class PythonWorker {
  constructor(cmd, script) {
    this.cmd = cmd;
    this.script = script;
    this.proc = null;
    this.ready = false;
    this.pending = new Map(); // id → { resolve, reject }
    this.nextId = 0;
    this.buf = '';
  }

  start() {
    return new Promise((resolve, reject) => {
      this.proc = spawn(this.cmd, [this.script], {
        env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' },
      });
      const timer = setTimeout(
        () => reject(new Error(`Worker startup timeout (${this.cmd})`)),
        60000,
      );

      this.proc.stdout.on('data', (data) => {
        this.buf += data.toString('utf8');
        let nl;
        while ((nl = this.buf.indexOf('\n')) !== -1) {
          const line = this.buf.slice(0, nl).trim();
          this.buf = this.buf.slice(nl + 1);
          if (!line) continue;
          try {
            const msg = JSON.parse(line);
            if (msg.ready) {
              clearTimeout(timer);
              this.ready = true;
              resolve(this);
              continue;
            }
            if (msg.startup_error) {
              clearTimeout(timer);
              reject(new Error(msg.startup_error));
              continue;
            }
            const p = this.pending.get(msg.id);
            if (p) {
              this.pending.delete(msg.id);
              msg.error ? p.reject(new Error(msg.error)) : p.resolve(msg.result ?? '');
            }
          } catch { /* malformed line — ignore */ }
        }
      });

      this.proc.stderr.on('data', (d) =>
        console.warn(`[worker:${this.cmd}] stderr: ${d.toString().trim()}`),
      );
      this.proc.on('error', (e) => { clearTimeout(timer); reject(e); });
      this.proc.on('close', () => {
        this.ready = false;
        for (const [, p] of this.pending) p.reject(new Error('Worker process exited'));
        this.pending.clear();
      });
    });
  }

  send(text) {
    if (!this.ready) return Promise.reject(new Error('Worker not ready'));
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.proc.stdin.write(JSON.stringify({ id, text }) + '\n', 'utf8');
    });
  }

  kill() { try { this.proc?.kill(); } catch { /* ignore */ } }
}

// ─── Worker pool ──────────────────────────────────────────────────────────────

let workers = null;   // PythonWorker[]
let poolReady = null; // Promise<PythonWorker[]>

async function initPool() {
  for (const cmd of PYTHON_CANDIDATES) {
    try {
      const started = await Promise.all(
        Array.from({ length: POOL_SIZE }, () => {
          const w = new PythonWorker(cmd, WORKER_SCRIPT);
          return w.start();
        }),
      );
      console.log(`[tashkeel] Pool of ${POOL_SIZE} workers ready (${cmd})`);
      return started;
    } catch (e) {
      console.warn(`[tashkeel] Pool init failed with "${cmd}": ${e.message}`);
    }
  }
  throw new Error('Could not start Python worker pool with any candidate');
}

function getPool() {
  if (workers) return Promise.resolve(workers);
  if (!poolReady) {
    poolReady = initPool()
      .then((w) => { workers = w; return w; })
      .catch((e) => { poolReady = null; throw e; });
  }
  return poolReady;
}

// ─── Chunking ─────────────────────────────────────────────────────────────────

function splitIntoChunks(text) {
  const paragraphs = text.split('\n');
  const chunks = [];
  let current = [];
  let size = 0;

  for (const para of paragraphs) {
    if (size + para.length > CHUNK_CHARS && current.length > 0) {
      chunks.push(current.join('\n'));
      current = [para];
      size = para.length;
    } else {
      current.push(para);
      size += para.length + 1;
    }
  }
  if (current.length > 0) chunks.push(current.join('\n'));
  return chunks.length > 0 ? chunks : [text];
}

// ─── Tashkeel with pool ───────────────────────────────────────────────────────

async function tashkeelWithPool(text) {
  const pool = await getPool();
  const chunks = splitIntoChunks(text);

  // Distribute chunks across workers in round-robin, process each worker's
  // queue sequentially, all workers run in parallel.
  const byWorker = pool.map(() => /** @type {{idx:number,chunk:string}[]} */([]));
  chunks.forEach((chunk, i) => byWorker[i % pool.length].push({ idx: i, chunk }));

  const allResults = await Promise.all(
    byWorker.map(async (tasks, wi) => {
      const results = [];
      for (const { idx, chunk } of tasks) {
        const result = await pool[wi].send(chunk);
        results.push({ idx, result });
      }
      return results;
    }),
  );

  // Reconstruct original order
  return allResults
    .flat()
    .sort((a, b) => a.idx - b.idx)
    .map((r) => r.result)
    .join('\n');
}

// ─── Web API fallback ─────────────────────────────────────────────────────────

async function tashkeelWithWebAPI(text) {
  const endpoints = [
    'http://mishkal.tahadz.com/mishkal/api/',
    'http://mishkal.tahadz.com/mishkal/',
  ];
  const body = new URLSearchParams({ text, short: '0', longvowels: '1', nunation: '1', shadda: '1' });

  for (const url of endpoints) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
        signal: AbortSignal.timeout(20000),
      });
      if (!res.ok) continue;
      const ct = res.headers.get('content-type') ?? '';
      if (ct.includes('application/json')) {
        const data = await res.json();
        const result = data.result ?? data.vocalized ?? data.text;
        if (typeof result === 'string' && result) return result;
      } else {
        const html = await res.text();
        const stripped = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        if (stripped.length > 10) return stripped;
      }
    } catch { continue; }
  }
  throw new Error('All web endpoints failed');
}

// ─── Route ────────────────────────────────────────────────────────────────────

app.post('/api/tashkeel', async (req, res) => {
  const text = (req.body.text ?? '').trim();
  if (!text) return res.status(400).json({ error: 'النص فارغ' });

  try {
    const result = await tashkeelWithPool(text);
    return res.json({ result });
  } catch (pyErr) {
    console.warn('[tashkeel] Pool error:', pyErr.message);
  }

  try {
    const result = await tashkeelWithWebAPI(text);
    return res.json({ result });
  } catch {
    return res.status(503).json({
      error:
        'تعذّر الاتصال بخدمة التشكيل.\n' +
        'تأكد من تثبيت Python و mishkal:\n' +
        '  py -m pip install mishkal',
    });
  }
});

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`✓  Tashkeel API  →  http://localhost:${PORT}/api/tashkeel`);
  console.log(`   Pool size     →  ${POOL_SIZE} workers  |  Chunk: ${CHUNK_CHARS} chars`);
  // Warm up the pool immediately so first request is fast
  getPool().catch((e) => console.error('[tashkeel] Pool warm-up failed:', e.message));
});
