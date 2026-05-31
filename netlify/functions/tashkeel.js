'use strict';

/**
 * Netlify serverless function for Arabic tashkeel.
 *
 * Priority order (first key found wins):
 *  1. Google Gemini API  — FREE, set GOOGLE_AI_API_KEY in Netlify env vars
 *                          Get a free key at: https://aistudio.google.com
 *  2. Anthropic Claude   — set ANTHROPIC_API_KEY (has a free trial)
 *  3. Mishkal web API    — free fallback, unreliable
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

const TASHKEEL_PROMPT =
  'أنت متخصص في اللغة العربية. مهمتك الوحيدة هي إضافة التشكيل الكامل والصحيح للنص العربي. ' +
  'أعد النص المُشكَّل فقط، دون أي تعليق أو مقدمة أو خاتمة.';

// ─── Google Gemini (free) ─────────────────────────────────────────────────────

async function tashkeelChunkGemini(chunk, apiKey) {
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: TASHKEEL_PROMPT }] },
      contents: [{ parts: [{ text: `أضف التشكيل لهذا النص:\n\n${chunk}` }] }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 2048 },
    }),
    signal: AbortSignal.timeout(25000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => res.statusText);
    throw new Error(`Gemini ${res.status}: ${body}`);
  }

  const data = await res.json();
  const result = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!result?.trim()) throw new Error('Empty Gemini response');
  return result.trim();
}

async function tashkeelWithGemini(text, apiKey) {
  const chunks = splitIntoChunks(text);
  const results = await Promise.all(chunks.map((c) => tashkeelChunkGemini(c, apiKey)));
  return results.join('\n');
}

// ─── Anthropic Claude (fallback) ──────────────────────────────────────────────

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
      system: TASHKEEL_PROMPT,
      messages: [{ role: 'user', content: `أضف التشكيل لهذا النص:\n\n${chunk}` }],
    }),
    signal: AbortSignal.timeout(25000),
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

// ─── Mishkal web API (last resort) ───────────────────────────────────────────

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
  throw new Error('Mishkal endpoints unavailable');
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

  // 1 — Google Gemini (free)
  const geminiKey = process.env.GOOGLE_AI_API_KEY;
  if (geminiKey) {
    try {
      const result = await tashkeelWithGemini(text, geminiKey);
      return { statusCode: 200, headers, body: JSON.stringify({ result }) };
    } catch (e) {
      console.warn('[tashkeel] Gemini failed:', e.message);
    }
  }

  // 2 — Anthropic Claude
  const claudeKey = process.env.ANTHROPIC_API_KEY;
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
        error:
          'تعذّر التشكيل. أضف مفتاح GOOGLE_AI_API_KEY مجاناً من aistudio.google.com في إعدادات Netlify.',
      }),
    };
  }
};
