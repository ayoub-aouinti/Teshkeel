'use strict';

/**
 * Netlify serverless function — replaces the local Express server in production.
 * Calls the Mishkal web API server-side (no CORS restriction).
 * Local dev still uses server.cjs + Python mishkal for higher quality.
 */

const MISHKAL_ENDPOINTS = [
  'http://mishkal.tahadz.com/mishkal/api/',
  'http://mishkal.tahadz.com/mishkal/',
];

const CHUNK_CHARS = 1500;

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

// ─── Mishkal web API call ─────────────────────────────────────────────────────

async function tashkeelChunk(text) {
  const body = new URLSearchParams({
    text,
    short: '0',
    longvowels: '1',
    nunation: '1',
    shadda: '1',
  });

  for (const url of MISHKAL_ENDPOINTS) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
        signal: AbortSignal.timeout(8000),
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

  throw new Error('All Mishkal endpoints failed');
}

// ─── Handler ──────────────────────────────────────────────────────────────────

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  const params = new URLSearchParams(event.body ?? '');
  const text = (params.get('text') ?? '').trim();

  if (!text) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'النص فارغ' }) };
  }

  try {
    const chunks = splitIntoChunks(text);
    // Process chunks in parallel (Netlify Functions are async-capable)
    const results = await Promise.all(chunks.map(tashkeelChunk));
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ result: results.join('\n') }),
    };
  } catch (err) {
    return {
      statusCode: 503,
      headers,
      body: JSON.stringify({ error: 'تعذّر الاتصال بخدمة التشكيل' }),
    };
  }
};
