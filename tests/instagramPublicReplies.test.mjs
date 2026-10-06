import test from 'node:test';
import assert from 'node:assert/strict';
import { processCommentEvent } from '../api/instagram.js';

const rule = {
  id: 'rule-public', palavra_chave: 'REY4H', resposta_privada: 'Olá {{usuario}} 💜',
  status: 'ativo', encaminhar_crm: false, responder_comentario: true,
  resposta_publica: 'Prontinho {{usuario}}! Te enviei no Direct 💜',
};

function mockDb(selectedRule = rule) {
  const interactions = new Map();
  const checkpoints = [];
  return {
    interactions, checkpoints,
    from(table) {
      if (table === 'instagram_rules') return {
        select() { return { eq() { return { async maybeSingle() { return { data: selectedRule }; } }; } }; },
      };
      assert.equal(table, 'instagram_interactions', 'Sem escrita no CRM durante estes testes');
      return {
        async insert([row]) {
          if (interactions.has(row.comment_id)) return { error: { code: '23505' } };
          interactions.set(row.comment_id, row);
          return { error: null };
        },
        update(values) {
          return { eq(_key, commentId) { return { select() { return { async single() {
            const row = { ...interactions.get(commentId), ...structuredClone(values) };
            interactions.set(commentId, row);
            checkpoints.push(structuredClone(row));
            return { data: row, error: null };
          } }; } }; } };
        },
      };
    },
  };
}

function response(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, async json() { return body; } };
}

async function withMeta(fakeFetch, run) {
  const originalFetch = globalThis.fetch;
  const names = ['META_ACCESS_TOKEN', 'META_PAGE_ID', 'INSTAGRAM_ACCOUNT_ID'];
  const before = Object.fromEntries(names.map(name => [name, process.env[name]]));
  process.env.META_ACCESS_TOKEN = 'page-token-test';
  process.env.META_PAGE_ID = 'page-123';
  process.env.INSTAGRAM_ACCOUNT_ID = 'ig-456';
  globalThis.fetch = fakeFetch;
  try { await run(); }
  finally {
    globalThis.fetch = originalFetch;
    for (const name of names) {
      if (before[name] === undefined) delete process.env[name];
      else process.env[name] = before[name];
    }
  }
}

const event = { commentId: 'comment-1', mediaId: 'media-1', userId: 'user-789', username: 'maria', text: 'REY4H' };

test('confirma e grava a DM antes de responder publicamente; evento concorrente não repete envios', async () => {
  const db = mockDb();
  const calls = [];
  await withMeta(async (url, options) => {
    calls.push(url);
    assert.equal(options.headers.Authorization, 'Bearer page-token-test');
    if (url.endsWith('/messages')) {
      assert.match(url, /\/page-123\/messages$/);
      assert.deepEqual(JSON.parse(options.body), { recipient: { comment_id: event.commentId }, message: { text: 'Olá @maria 💜' } });
      return response({ message_id: 'dm-1' });
    }
    assert.match(url, /\/comment-1\/replies$/);
    assert.deepEqual(JSON.parse(options.body), { message: 'Prontinho @maria! Te enviei no Direct 💜' });
    assert.equal(db.interactions.get(event.commentId).resposta_enviada, true);
    assert.equal(db.interactions.get(event.commentId).metadata.dm_message_id, 'dm-1');
    assert.equal(db.interactions.get(event.commentId).metadata.public_reply.status, 'processando');
    return response({ id: 'public-1' });
  }, async () => {
    const results = await Promise.all([processCommentEvent(db, event), processCommentEvent(db, event)]);
    assert.equal(results.filter(result => result.duplicate).length, 1);
    assert.equal(calls.length, 2);
    const saved = db.interactions.get(event.commentId);
    assert.equal(saved.status, 'sucesso');
    assert.equal(saved.metadata.public_reply.id, 'public-1');
    assert.equal(saved.metadata.public_reply.sent, true);
    assert.ok(saved.metadata.public_reply.sent_at);
  });
});

test('falha na DM impede a resposta pública', async () => {
  const db = mockDb();
  let calls = 0;
  await withMeta(async (url) => {
    calls++;
    assert.match(url, /\/page-123\/messages$/);
    return response({ error: { code: 3, message: 'Capability error' } }, 400);
  }, async () => {
    const result = await processCommentEvent(db, event);
    assert.equal(calls, 1);
    assert.equal(result.response_sent, false);
    assert.equal(result.public_reply.status, 'nao_enviada');
    assert.equal(result.public_reply.sent, false);
  });
});

test('falha pública preserva o sucesso da DM e não dispara uma nova DM', async () => {
  const db = mockDb();
  let calls = 0;
  await withMeta(async (url) => {
    calls++;
    return url.endsWith('/messages') ? response({ message_id: 'dm-ok' })
      : response({ error: { code: 200, message: 'Comment permission denied', fbtrace_id: 'trace-1' } }, 400);
  }, async () => {
    const result = await processCommentEvent(db, event);
    assert.equal(result.ok, true);
    assert.equal(result.status, 'sucesso');
    assert.equal(result.response_sent, true);
    assert.equal(result.public_reply.status, 'falha');
    assert.equal(result.public_reply.diagnostic.fbtrace_id, 'trace-1');
    assert.equal(db.interactions.get(event.commentId).resposta_enviada, true);
    assert.equal((await processCommentEvent(db, event)).duplicate, true);
    assert.equal(calls, 2);
  });
});

test('erro de rede deixa envio público incerto, sem repetir os efeitos externos', async () => {
  const db = mockDb();
  let calls = 0;
  await withMeta(async (url) => {
    calls++;
    if (url.endsWith('/messages')) return response({ message_id: 'dm-ok' });
    throw new TypeError('connection lost');
  }, async () => {
    const result = await processCommentEvent(db, event);
    assert.equal(result.public_reply.status, 'incerto');
    assert.equal(result.response_sent, true);
    await processCommentEvent(db, event);
    assert.equal(calls, 2);
  });
});

test('simulação mostra texto público e emojis sem chamar Meta nem escrever no banco', async () => {
  await withMeta(async () => assert.fail('Simulação não pode chamar a Meta'), async () => {
    const result = await processCommentEvent(null, { ...event, commentId: 'public-sim', isTestSimulation: true, rule });
    assert.equal(result.public_reply.status, 'simulado');
    assert.equal(result.public_reply.text, 'Prontinho @maria! Te enviei no Direct 💜');
    assert.equal(result.public_reply.sent, false);
    assert.equal(result.crm_persisted, false);
    assert.equal(result.meta_api_sent, false);
  });
});

test('resposta HTTP 200 sem ID não é apresentada como comentário publicado', async () => {
  await withMeta(async (url) => url.endsWith('/messages')
    ? response({ message_id: 'dm-ok' }) : response({ success: true }), async () => {
    const result = await processCommentEvent(mockDb(), event);
    assert.equal(result.response_sent, true);
    assert.equal(result.public_reply.status, 'incerto');
    assert.equal(result.public_reply.sent, false);
  });
});

test('regras antigas sem a opção pública continuam enviando somente a DM', async () => {
  const { responder_comentario: _enabled, resposta_publica: _message, ...legacy } = rule;
  const db = mockDb(legacy);
  let calls = 0;
  await withMeta(async (url) => {
    calls++;
    assert.match(url, /\/page-123\/messages$/);
    return response({ message_id: 'legacy-dm' });
  }, async () => {
    const result = await processCommentEvent(db, event);
    assert.equal(result.public_reply.status, 'desativado');
    assert.equal(calls, 1);
  });
});

test('regra pausada, palavra ausente e comentário próprio não acionam envios', async () => {
  await withMeta(async () => assert.fail('Evento ignorado não pode chamar a Meta'), async () => {
    assert.equal((await processCommentEvent(mockDb({ ...rule, status: 'pausado' }), event)).status, 'pausado');
    assert.equal((await processCommentEvent(mockDb(), { ...event, text: 'Parabéns!' })).status, 'ignorado');
    const own = await processCommentEvent(null, { ...event, userId: 'ig-456' });
    assert.equal(own.status, 'ignorado');
  });
});
