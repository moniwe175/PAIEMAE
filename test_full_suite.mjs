// Testes locais: nenhum acesso à Meta ou ao Supabase real.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import instagramHandler, { processCommentEvent } from './api/instagram.js';
import webhookHandler from './api/instagram-webhook.js';

function mockDb(rule, claimError = null) {
  const interactions = new Map();
  return {
    interactions,
    from(table) {
      if (table === 'instagram_interactions') return {
        async insert([row]) {
          if (claimError) return { error: claimError };
          if (interactions.has(row.comment_id)) return { error: { code: '23505', message: 'duplicate' } };
          interactions.set(row.comment_id, row);
          return { error: null };
        },
        update(item) {
          return { eq(_column, id) {
            return { select() { return { async single() {
              const row = { ...interactions.get(id), ...item };
              interactions.set(id, row);
              return { data: row, error: null };
            } }; } };
          } };
        },
      };
      if (table === 'instagram_rules') return {
        select() { return { eq() { return { async maybeSingle() { return { data: rule, error: null }; } }; } }; },
      };
      throw Error(`Tabela não simulada: ${table}`);
    },
  };
}
function res() {
  return { statusCode: 200, headers: {}, status(code) { this.statusCode = code; return this; },
    setHeader(key, value) { this.headers[key] = value; return this; },
    json(value) { this.body = value; return this; }, send(value) { this.body = value; return this; } };
}

const rule = { id: 'rule-1', palavra_chave: 'QUERO', resposta_privada: 'Olá {{usuario}}',
  status: 'ativo', encaminhar_crm: false };
const simulated = await processCommentEvent(null, { commentId: 'sim-1', mediaId: 'post-1',
  username: 'maria', text: 'Eu QUERO', isTestSimulation: true, rule });
assert.equal(simulated.is_simulation, true);
assert.equal(simulated.meta_api_sent, false);
assert.equal(simulated.crm_persisted, false);
assert.equal(simulated.response_text, 'Olá @maria');
const noMatch = await processCommentEvent(null, { commentId: 'sim-2', mediaId: 'post-1',
  username: 'maria', text: 'NÃOQUERO', isTestSimulation: true, rule });
assert.equal(noMatch.status, 'ignorado');

process.env.META_ACCESS_TOKEN = 'token-de-teste';
process.env.INSTAGRAM_ACCOUNT_ID = 'ig-account';
process.env.META_PAGE_ID = '1640332469521785';
let sent = 0;
const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, options) => {
  assert.equal(options.headers.Authorization, 'Bearer token-de-teste');
  assert.match(url, /\/1640332469521785\/messages$/, 'URL deve conter o META_PAGE_ID');
  sent++;
  return { ok: true, async json() { return { message_id: 'message-1' }; } };
};
try {
  const db = mockDb(rule);
  const event = { commentId: 'comment-1', mediaId: 'post-1', username: 'maria', text: 'QUERO' };
  const results = await Promise.all([processCommentEvent(db, event), processCommentEvent(db, event)]);
  assert.equal(sent, 1, 'Somente um envio sob concorrência');
  assert.equal(results.filter(r => r.duplicate).length, 1);
  assert.equal(db.interactions.get('comment-1').status, 'sucesso');

  // Teste de falha: garante que uma falha gera SOMENTE 1 chamada (sem fallback)
  let failCalls = 0;
  globalThis.fetch = async (url) => {
    assert.match(url, /\/1640332469521785\/messages$/, 'URL na falha deve conter o META_PAGE_ID');
    failCalls++;
    return {
      ok: false,
      status: 400,
      async json() { return { error: { code: 3, message: 'Capability error' } }; },
    };
  };
  const failEvent = { commentId: 'comment-fail-1', mediaId: 'post-1', username: 'maria', text: 'QUERO' };
  const failResult = await processCommentEvent(db, failEvent);
  assert.equal(failCalls, 1, 'Uma tentativa com falha deve gerar somente uma chamada de envio (sem retentativas ou fallbacks)');
  assert.equal(failResult.status, 'falha');

  const missingDb = mockDb(rule, { code: 'PGRST205', message: 'missing table' });
  await assert.rejects(processCommentEvent(missingDb, { ...event, commentId: 'missing-1' }), /reservar/);
} finally { globalThis.fetch = originalFetch; }

process.env.META_VERIFY_TOKEN = 'verify-test';
process.env.META_APP_SECRET = 'secret-test';
process.env.SUPABASE_SERVICE_KEY = 'fake-service-key';
process.env.SUPABASE_URL = 'https://example.invalid';
const unauthorized = res();
await instagramHandler({ method: 'POST', url: '/api/instagram?action=rules', headers: {}, body: {} }, unauthorized);
assert.equal(unauthorized.statusCode, 401);
const handshake = res();
await webhookHandler({ method: 'GET', url: '/api/instagram-webhook?hub.mode=subscribe&hub.verify_token=verify-test&hub.challenge=abc' }, handshake);
assert.equal(handshake.statusCode, 200);
assert.equal(handshake.body, 'abc');
const raw = Buffer.from(JSON.stringify({ object: 'instagram', entry: [] }));
const invalid = res();
await webhookHandler({ method: 'POST', url: '/api/instagram-webhook', headers: { 'x-hub-signature-256': 'sha256=bad' }, rawBody: raw }, invalid);
assert.equal(invalid.statusCode, 401);
const expected = `sha256=${crypto.createHmac('sha256', 'secret-test').update(raw).digest('hex')}`;
const accepted = res();
await webhookHandler({ method: 'POST', url: '/api/instagram-webhook',
  headers: { 'x-hub-signature-256': expected }, rawBody: raw }, accepted);
assert.equal(accepted.statusCode, 200);
assert.equal(accepted.body.processed, 0);
console.log('OK: simulação, palavra inteira, reserva concorrente, falha fechada, login, handshake e assinatura.');
