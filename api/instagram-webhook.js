/* global process, Buffer */
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { processCommentEvent } from './instagram.js';

function verifySignature(raw, header, secret) {
  if (!secret || !header || !/^sha256=[0-9a-f]{64}$/i.test(header)) return false;
  const received = Buffer.from(header.slice(7), 'hex');
  const expected = crypto.createHmac('sha256', secret).update(raw).digest();
  return received.length === expected.length && crypto.timingSafeEqual(received, expected);
}

async function readRawBody(req) {
  // Vite dev preserva os bytes; a função Node da Vercel fornece o stream.
  if (Buffer.isBuffer(req.rawBody)) return req.rawBody;
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  const query = req.query || Object.fromEntries(new URL(req.url, 'http://localhost').searchParams);
  if (req.method === 'GET') {
    const expected = process.env.META_VERIFY_TOKEN;
    if (!expected) return res.status(503).json({ error: 'META_VERIFY_TOKEN não configurado.' });
    if (query['hub.mode'] !== 'subscribe' || query['hub.verify_token'] !== expected) {
      return res.status(403).json({ error: 'Verificação inválida.' });
    }
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.status(200).send(query['hub.challenge'] || '');
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' });
  if (!process.env.META_APP_SECRET || !process.env.SUPABASE_SERVICE_KEY || !process.env.INSTAGRAM_ACCOUNT_ID) {
    return res.status(503).json({ error: 'Webhook aguardando configuração do backend.' });
  }

  let raw;
  try { raw = await readRawBody(req); } catch { return res.status(400).json({ error: 'Corpo inválido.' }); }
  if (!verifySignature(raw, req.headers?.['x-hub-signature-256'], process.env.META_APP_SECRET)) {
    return res.status(401).json({ error: 'Assinatura Meta inválida.' });
  }

  let payload;
  try { payload = JSON.parse(raw.toString('utf8')); }
  catch { return res.status(400).json({ error: 'JSON inválido.' }); }
  if (payload.object !== 'instagram') return res.status(200).json({ ok: true, processed: 0 });

  const db = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
  let processed = 0;
  try {
    for (const entry of payload.entry || []) {
      if (String(entry.id) !== String(process.env.INSTAGRAM_ACCOUNT_ID)) continue;
      for (const change of entry.changes || []) {
        if (change.field !== 'comments') continue;
        const v = change.value || {};
        // A Meta informa o ID da mídia em value.media.id, e não em entry.id.
        if (!v.id || !v.media?.id || !v.text || String(v.from?.id) === String(entry.id)) continue;
        await processCommentEvent(db, {
          commentId: String(v.id), mediaId: String(v.media.id),
          username: v.from?.username || '', text: v.text,
        });
        processed++;
      }
    }
    return res.status(200).json({ ok: true, processed });
  } catch (err) {
    console.error('[Instagram webhook] Falha ao processar evento:', err.message);
    return res.status(503).json({ ok: false, error: 'Falha no processamento; confira o histórico.' });
  }
}
