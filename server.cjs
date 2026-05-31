'use strict';

const express = require('express');
const { spawn } = require('child_process');
const path = require('path');

const app = express();
const PORT = process.env.API_PORT || 3001;

// Try multiple Python commands in order (handles Windows PATH quirks)
const PYTHON_CANDIDATES = process.platform === 'win32'
  ? ['py', 'python', 'python3']
  : ['python3', 'python'];

const TASHKEEL_SCRIPT = path.join(__dirname, 'tashkeel.py');

// Max characters per mishkal call — large texts are split into chunks
const CHUNK_CHARS = 1500;

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// CORS for Vite dev server
app.use((_, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  next();
});

app.options('/api/tashkeel', (_, res) => res.sendStatus(204));

app.get('/api/health', (_, res) =>
  res.json({ status: 'ok', python: PYTHON_CANDIDATES[0] }),
);

app.post('/api/tashkeel', async (req, res) => {
  const text = (req.body.text ?? '').trim();
  if (!text) return res.status(400).json({ error: 'النص فارغ' });

  // Primary: Python + mishkal, chunked for large documents
  try {
    const result = await tashkeelWithPython(text);
    return res.json({ result });
  } catch (pyErr) {
    console.warn('[tashkeel] Python failed:', pyErr.message);
  }

  // Fallback: Mishkal web service (called from Node — no CORS issue)
  try {
    const result = await tashkeelWithWebAPI(text);
    return res.json({ result });
  } catch (apiErr) {
    console.warn('[tashkeel] Web API failed:', apiErr.message);
    return res.status(503).json({
      error:
        'تعذّر الاتصال بخدمة التشكيل.\n' +
        'تأكد من تثبيت Python و mishkal:\n' +
        '  py -m pip install mishkal',
    });
  }
});

// ─── Chunking ────────────────────────────────────────────────────────────────

/**
 * Split text into paragraph-respecting chunks of at most CHUNK_CHARS characters.
 * Mishkal struggles with very long inputs in a single call.
 */
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

// ─── Python subprocess ────────────────────────────────────────────────────────

/**
 * Tashkeel the full text by processing each chunk sequentially.
 * Finds the first working Python command and reuses it for all chunks.
 */
async function tashkeelWithPython(text) {
  const chunks = splitIntoChunks(text);
  let workingCmd = null;
  const results = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];

    if (workingCmd) {
      // Already know which cmd works — use it directly
      results.push(await spawnPython(workingCmd, chunk));
      continue;
    }

    // Try each candidate until one succeeds
    let lastErr = new Error('No Python candidate worked');
    for (const cmd of PYTHON_CANDIDATES) {
      try {
        const result = await spawnPython(cmd, chunk);
        workingCmd = cmd;
        results.push(result);
        break;
      } catch (e) {
        lastErr = e;
      }
    }

    if (!workingCmd) throw lastErr;
  }

  return results.join('\n');
}

function spawnPython(cmd, text) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, [TASHKEEL_SCRIPT], { timeout: 60000 });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (d) => (stdout += d.toString('utf8')));
    proc.stderr.on('data', (d) => (stderr += d.toString('utf8')));

    proc.on('error', reject);

    proc.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(stderr.trim() || `Python exited with code ${code}`));
      }
      try {
        const parsed = JSON.parse(stdout.trim());
        if (parsed.error) return reject(new Error(parsed.error));
        resolve(parsed.result);
      } catch {
        reject(new Error(`Invalid Python output: ${stdout.slice(0, 200)}`));
      }
    });

    proc.stdin.write(text, 'utf8');
    proc.stdin.end();
  });
}

// ─── Web API fallback ─────────────────────────────────────────────────────────

async function tashkeelWithWebAPI(text) {
  const endpoints = [
    'http://mishkal.tahadz.com/mishkal/api/',
    'http://mishkal.tahadz.com/mishkal/',
  ];

  const body = new URLSearchParams({
    text,
    short: '0',
    longvowels: '1',
    nunation: '1',
    shadda: '1',
  });

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
    } catch {
      continue;
    }
  }

  throw new Error('All Mishkal web endpoints returned no usable result');
}

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`✓  Tashkeel API  →  http://localhost:${PORT}/api/tashkeel`);
  console.log(`   Python try    →  ${PYTHON_CANDIDATES.join(' | ')}`);
  console.log(`   Chunk size    →  ${CHUNK_CHARS} chars`);
  console.log(`   Script        →  ${TASHKEEL_SCRIPT}`);
});
