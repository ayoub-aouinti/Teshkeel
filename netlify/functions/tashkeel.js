'use strict';

/**
 * Netlify serverless function for Arabic tashkeel.
 * Priority: Google Gemini (free) → Anthropic Claude → Mishkal web API
 * Set GOOGLE_AI_API_KEY in Netlify env vars (free from aistudio.google.com)
 */

const CHUNK_CHARS = 2000;

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

// ─── Google Gemini ────────────────────────────────────────────────────────────

const GEMINI_MODELS = ['gemini-2.0-flash', 'gemini-2.0-flash-lite'];

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function tashkeelChunkGemini(chunk, apiKey) {
  const prompt =
    'أنت متخصص في اللغة العربية. أضف التشكيل الكامل والصحيح للنص التالي. ' +
    'أعد النص المُشكَّل فقط بدون أي تعليق أو مقدمة:\n\n' + chunk;

  for (const model of GEMINI_MODELS) {
    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    // Retry up to 3 times on rate-limit (429)
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.1, maxOutputTokens: 2048 },
          }),
          signal: AbortSignal.timeout(20000),
        });

        if (res.status === 429) {
          const wait = attempt * 2000;
          console.warn(`[gemini] ${model} rate-limited, retrying in ${wait}ms (attempt ${attempt})`);
          await sleep(wait);
          continue;
        }

        if (!res.ok) {
          console.warn(`[gemini] ${model} → ${res.status}, trying next model`);
          break; // try next model, not next retry
        }

        const data = await res.json();
        const result = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (result?.trim()) {
          console.log(`[gemini] success with ${model}`);
          return result.trim();
        }
      } catch (e) {
        console.warn(`[gemini] ${model} attempt ${attempt} threw: ${e.message}`);
      }
    }
  }
  throw new Error('All Gemini models failed');
}

// Sequential processing to respect free-tier rate limits (15 RPM)
async function tashkeelWithGemini(text, apiKey) {
  const chunks = splitIntoChunks(text);
  const results = [];
  for (let i = 0; i < chunks.length; i++) {
    if (i > 0) await sleep(1500); // 1.5s gap between chunks → ~40 RPM max
    results.push(await tashkeelChunkGemini(chunks[i], apiKey));
  }
  return results.join('\n');
}

// ─── Anthropic Claude ─────────────────────────────────────────────────────────

async function tashkeelChunkClaude(chunk, apiKey) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      messages: [{
        role: 'user',
        content:
          'أضف التشكيل الكامل للنص التالي. أعد النص المُشكَّل فقط بدون أي تعليق:\n\n' + chunk,
      }],
    }),
    signal: AbortSignal.timeout(20000),
  });

  if (!res.ok) throw new Error(`Claude ${res.status}`);
  const data = await res.json();
  const result = data.content?.[0]?.text;
  if (!result?.trim()) throw new Error('Empty Claude response');
  return result.trim();
}

async function tashkeelWithClaude(text, apiKey) {
  const chunks = splitIntoChunks(text);
  const results = await Promise.all(chunks.map((c) => tashkeelChunkClaude(c, apiKey)));
  return results.join('\n');
}

// ─── Mishkal web API ──────────────────────────────────────────────────────────

async function tashkeelWithMishkal(text) {
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
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) continue;
      const ct = res.headers.get('content-type') ?? '';
      if (ct.includes('application/json')) {
        const data = await res.json();
        const r = data.result ?? data.vocalized ?? data.text;
        if (typeof r === 'string' && r) return r;
      } else {
        const html = await res.text();
        const stripped = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        if (stripped.length > 10) return stripped;
      }
    } catch { continue; }
  }
  throw new Error('Mishkal unavailable');
}

// ─── Handler ──────────────────────────────────────────────────────────────────

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers };
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  const params = new URLSearchParams(event.body ?? '');
  const text = (params.get('text') ?? '').trim();
  if (!text) return { statusCode: 400, headers, body: JSON.stringify({ error: 'النص فارغ' }) };

  const geminiKey = process.env.GOOGLE_AI_API_KEY;
  const claudeKey = process.env.ANTHROPIC_API_KEY;

  console.log(`[tashkeel] keys present → gemini:${!!geminiKey} claude:${!!claudeKey}`);

  // 1 — Google Gemini (free)
  if (geminiKey) {
    try {
      const result = await tashkeelWithGemini(text, geminiKey);
      return { statusCode: 200, headers, body: JSON.stringify({ result }) };
    } catch (e) {
      console.warn('[tashkeel] Gemini failed:', e.message);
    }
  } else {
    console.warn('[tashkeel] GOOGLE_AI_API_KEY not set');
  }

  // 2 — Anthropic Claude
  if (claudeKey) {
    try {
      const result = await tashkeelWithClaude(text, claudeKey);
      return { statusCode: 200, headers, body: JSON.stringify({ result }) };
    } catch (e) {
      console.warn('[tashkeel] Claude failed:', e.message);
    }
  }

  // 3 — Mishkal web API
  try {
    const result = await tashkeelWithMishkal(text);
    return { statusCode: 200, headers, body: JSON.stringify({ result }) };
  } catch {
    return {
      statusCode: 503,
      headers,
      body: JSON.stringify({
        error: 'تعذّر التشكيل. يرجى التحقق من سجلات Netlify Functions لمزيد من التفاصيل.',
      }),
    };
  }
};
