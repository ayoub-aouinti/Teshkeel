'use strict';

/**
 * Netlify serverless function for Arabic tashkeel.
 *
 * Priority:
 *  1. Groq API  — FREE, fast, reliable. Get key at https://console.groq.com
 *                 Set GROQ_API_KEY in Netlify env vars.
 *  2. Google Gemini — FREE but project-level quota can be restrictive.
 *                     Set GOOGLE_AI_API_KEY in Netlify env vars.
 *  3. Mishkal web API — no key, unreliable fallback.
 */

const CHUNK_CHARS = 2000;

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

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

const SYSTEM_PROMPT =
  'أنت متخصص في اللغة العربية. مهمتك الوحيدة هي إضافة التشكيل الكامل والصحيح للنص العربي. ' +
  'أعد النص المُشكَّل فقط، دون أي تعليق أو مقدمة أو خاتمة.';

// ─── Groq (primary free option) ───────────────────────────────────────────────

const GROQ_MODELS = [
  'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant',
  'mixtral-8x7b-32768',
];

async function tashkeelChunkGroq(chunk, apiKey) {
  for (const model of GROQ_MODELS) {
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: `أضف التشكيل لهذا النص:\n\n${chunk}` },
          ],
          max_tokens: 2048,
          temperature: 0.1,
        }),
        signal: AbortSignal.timeout(20000),
      });

      if (!res.ok) {
        console.warn(`[groq] ${model} → ${res.status}`);
        continue;
      }

      const data = await res.json();
      const result = data.choices?.[0]?.message?.content;
      if (result?.trim()) {
        console.log(`[groq] success with ${model}`);
        return result.trim();
      }
    } catch (e) {
      console.warn(`[groq] ${model} threw: ${e.message}`);
    }
  }
  throw new Error('All Groq models failed');
}

async function tashkeelWithGroq(text, apiKey) {
  const chunks = splitIntoChunks(text);
  const results = [];
  for (let i = 0; i < chunks.length; i++) {
    if (i > 0) await sleep(800);
    results.push(await tashkeelChunkGroq(chunks[i], apiKey));
  }
  return results.join('\n');
}

// ─── Gemini (secondary free option) ──────────────────────────────────────────

async function tashkeelChunkGemini(chunk, apiKey) {
  const models = ['gemini-2.0-flash', 'gemini-2.0-flash-lite'];
  for (const model of models) {
    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: `${SYSTEM_PROMPT}\n\nالنص:\n${chunk}` }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 2048 },
        }),
        signal: AbortSignal.timeout(20000),
      });
      if (!res.ok) { console.warn(`[gemini] ${model} → ${res.status}`); continue; }
      const data = await res.json();
      const result = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (result?.trim()) return result.trim();
    } catch (e) {
      console.warn(`[gemini] ${model} threw: ${e.message}`);
    }
  }
  throw new Error('All Gemini models failed');
}

async function tashkeelWithGemini(text, apiKey) {
  const chunks = splitIntoChunks(text);
  const results = [];
  for (let i = 0; i < chunks.length; i++) {
    if (i > 0) await sleep(2000);
    results.push(await tashkeelChunkGemini(chunks[i], apiKey));
  }
  return results.join('\n');
}

// ─── Mishkal web API (last resort) ───────────────────────────────────────────

async function tashkeelWithMishkal(text) {
  const body = new URLSearchParams({ text, short: '0', longvowels: '1', nunation: '1', shadda: '1' });
  for (const url of ['http://mishkal.tahadz.com/mishkal/api/', 'http://mishkal.tahadz.com/mishkal/']) {
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

  const groqKey   = process.env.GROQ_API_KEY;
  const geminiKey = process.env.GOOGLE_AI_API_KEY;

  console.log(`[tashkeel] groq:${!!groqKey} gemini:${!!geminiKey}`);

  if (groqKey) {
    try {
      return { statusCode: 200, headers, body: JSON.stringify({ result: await tashkeelWithGroq(text, groqKey) }) };
    } catch (e) { console.warn('[tashkeel] Groq failed:', e.message); }
  }

  if (geminiKey) {
    try {
      return { statusCode: 200, headers, body: JSON.stringify({ result: await tashkeelWithGemini(text, geminiKey) }) };
    } catch (e) { console.warn('[tashkeel] Gemini failed:', e.message); }
  }

  try {
    return { statusCode: 200, headers, body: JSON.stringify({ result: await tashkeelWithMishkal(text) }) };
  } catch {
    return {
      statusCode: 503,
      headers,
      body: JSON.stringify({
        error: 'تعذّر التشكيل. أضف مفتاح GROQ_API_KEY مجاناً من console.groq.com في إعدادات Netlify.',
      }),
    };
  }
};
