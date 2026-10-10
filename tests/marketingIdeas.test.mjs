import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatDateTimeBR,
  formatDateBR,
  insertIdea,
  updateIdea,
  duplicateIdea,
  convertIdeaToCampaign,
  archiveIdea,
  approveIdea,
  fetchWhiteboardLayout,
  saveWhiteboardLayout,
  linkIdeaCampaign,
  unlinkIdeaCampaign,
} from '../src/services/marketingIdeasService.js';
import { supabase } from '../src/lib/supabase.js';
import { createClient } from '@supabase/supabase-js';

// ─── 1. Formatação de Datas em Fuso America/Sao_Paulo ─────────────────────────

test('formatDateBR formata corretamente datas YYYY-MM-DD', () => {
  assert.equal(formatDateBR('2026-10-15'), '15/10/2026');
  assert.equal(formatDateBR('2026-05-01'), '01/05/2026');
  assert.equal(formatDateBR(''), '—');
  assert.equal(formatDateBR(null), '—');
});

test('formatDateTimeBR formata timestamps ISO para pt-BR', () => {
  const formatted = formatDateTimeBR('2026-10-15T14:30:00Z');
  assert.match(formatted, /15\/10\/2026/);
  assert.equal(formatDateTimeBR(''), '—');
  assert.equal(formatDateTimeBR(null), '—');
});

// ─── 2. Validações de Criação e Limite de Caracteres ──────────────────────────

test('insertIdea rejeita título vazio ou contendo apenas espaços', async () => {
  const res1 = await insertIdea({ titulo: '' });
  assert.ok(res1.error);
  assert.match(res1.error.message, /título da ideia é obrigatório/i);

  const res2 = await insertIdea({ titulo: '    ' });
  assert.ok(res2.error);
  assert.match(res2.error.message, /título da ideia é obrigatório/i);
});

test('insertIdea rejeita título com mais de 120 caracteres', async () => {
  const longo = 'A'.repeat(121);
  const res = await insertIdea({ titulo: longo });
  assert.ok(res.error);
  assert.match(res.error.message, /não pode exceder 120 caracteres/i);
});

// ─── 3. Validação de Transição de Etapas ───────────────────────────────────────

test('updateIdea: passagem para "agendada" exige responsável, data, objetivo e ao menos um canal', async () => {
  // Mock supabase para testar validação em updateIdea
  const originalFrom = supabase.from;
  try {
    supabase.from = () => ({
      select() {
        return {
          eq() {
            return {
              single: async () => ({
                data: {
                  id: 'ideia-1',
                  titulo: 'Live de Teste',
                  etapa: 'ideia',
                  aprovado: true,
                  responsavel_id: null,
                  responsavel_nome: '',
                  data_prevista: null,
                  objetivo: '',
                  canais_divulgacao: [],
                  versao: 1,
                },
                error: null,
              }),
            };
          },
        };
      },
    });

    // Tentativa 1: sem nada preenchido
    const resIncompleto = await updateIdea('ideia-1', { etapa: 'agendada' }, null, 1);
    assert.ok(resIncompleto.error);
    assert.match(resIncompleto.error.message, /Para agendar a ideia, preencha/i);
    assert.match(resIncompleto.error.message, /Responsável/i);
    assert.match(resIncompleto.error.message, /Data prevista/i);
    assert.match(resIncompleto.error.message, /Objetivo/i);
    assert.match(resIncompleto.error.message, /canal de divulgação/i);
  } finally {
    supabase.from = originalFrom;
  }
});

test('updateIdea: passagem para "agendada" sem aprovação prévia é bloqueada', async () => {
  const originalFrom = supabase.from;
  try {
    supabase.from = () => ({
      select() {
        return {
          eq() {
            return {
              single: async () => ({
                data: {
                  id: 'ideia-1',
                  titulo: 'Live Botox',
                  etapa: 'ideia',
                  aprovado: false, // Não aprovada
                  responsavel_nome: 'Evelyn',
                  data_prevista: '2026-10-15T19:00:00Z',
                  objetivo: 'Dúvidas Botox',
                  canais_divulgacao: ['Instagram'],
                  versao: 1,
                },
                error: null,
              }),
            };
          },
        };
      },
    });

    const res = await updateIdea('ideia-1', { etapa: 'agendada' }, null, 1);
    assert.ok(res.error);
    assert.match(res.error.message, /deve ser aprovada primeiro/i);
  } finally {
    supabase.from = originalFrom;
  }
});

test('updateIdea: passagem para "executada" exige data_real', async () => {
  const originalFrom = supabase.from;
  try {
    supabase.from = () => ({
      select() {
        return {
          eq() {
            return {
              single: async () => ({
                data: {
                  id: 'ideia-1',
                  titulo: 'Live de Teste',
                  etapa: 'agendada',
                  aprovado: true,
                  responsavel_nome: 'Evelyn',
                  data_prevista: '2026-10-15T19:00:00Z',
                  objetivo: 'Captação de dúvidas',
                  canais_divulgacao: ['Instagram orgânico'],
                  data_real: null,
                  versao: 1,
                },
                error: null,
              }),
            };
          },
        };
      },
    });

    const res = await updateIdea('ideia-1', { etapa: 'executada' }, null, 1);
    assert.ok(res.error);
    assert.match(res.error.message, /informe a data real da execução/i);
  } finally {
    supabase.from = originalFrom;
  }
});

// ─── 4. Detecção de Conflito de Concorrência (Versão) ─────────────────────────

test('updateIdea detecta conflito de concorrência quando versão do servidor é diferente', async () => {
  const originalFrom = supabase.from;
  try {
    supabase.from = () => ({
      select() {
        return {
          eq() {
            return {
              single: async () => ({
                data: {
                  id: 'ideia-1',
                  titulo: 'Versão no Servidor',
                  versao: 3, // servidor está na versão 3
                },
                error: null,
              }),
            };
          },
        };
      },
    });

    // Cliente envia edição baseada na versão 1
    const res = await updateIdea('ideia-1', { titulo: 'Edição Concorrente' }, null, 1);
    assert.ok(res.conflict);
    assert.match(res.error.message, /modificado por outro usuário/i);
  } finally {
    supabase.from = originalFrom;
  }
});

// ─── 5. Semântica de Duplicação ───────────────────────────────────────────────

test('duplicateIdea cria cópia com status ideia, sem vínculo de campanha e com tarefas não concluídas', async () => {
  const originalFrom = supabase.from;
  let insertedIdea = null;
  let insertedTasks = null;

  try {
    supabase.from = (table) => {
      if (table === 'marketing_ideas') {
        return {
          select() {
            return {
              eq() {
                return {
                  single: async () => ({
                    data: {
                      id: 'orig-1',
                      titulo: 'Live Botox Original',
                      descricao: 'Descrição original',
                      formato: 'Live',
                      etapa: 'executada',
                      campanha_id: 999,
                      data_real: '2026-10-10T19:00:00Z',
                      aprendizado: 'Aprendizado antigo que não deve ser clonado',
                      versao: 5,
                    },
                    error: null,
                  }),
                };
              },
            };
          },
          insert(rows) {
            insertedIdea = rows[0];
            return {
              select() {
                return {
                  single: async () => ({
                    data: { id: 'copia-uuid', ...insertedIdea },
                    error: null,
                  }),
                };
              },
            };
          },
        };
      }
      if (table === 'marketing_idea_tasks') {
        return {
          select() {
            return {
              eq() {
                return {
                  order() {
                    return {
                      order: async () => ({
                        data: [
                          { id: 't1', titulo: 'Convidar participantes', concluida: true, ordem: 0 },
                          { id: 't2', titulo: 'Preparar arte', concluida: true, ordem: 1 },
                        ],
                      }),
                    };
                  },
                };
              },
            };
          },
          insert: async (rows) => {
            insertedTasks = rows;
            return { error: null };
          },
        };
      }
      if (table === 'marketing_idea_events') {
        return {
          select() {
            return {
              eq() {
                return {
                  order: async () => ({ data: [] }),
                };
              },
            };
          },
          insert: async () => ({ error: null }),
        };
      }
      return { select: () => ({ eq: () => ({ order: async () => ({ data: [] }) }) }) };
    };

    const res = await duplicateIdea('orig-1', { id: 'user-1' });
    assert.equal(res.error, null);
    assert.ok(insertedIdea);
    assert.equal(insertedIdea.titulo, 'Live Botox Original (Cópia)');
    assert.equal(insertedIdea.etapa, 'ideia');
    assert.equal(insertedIdea.campanha_id, null, 'Vínculo com campanha deve ser limpo');
    assert.equal(insertedIdea.data_real, null, 'Data real deve ser limpa');
    assert.equal(insertedIdea.aprendizado, '', 'Resultados de execução não devem ser clonados');
    assert.equal(insertedIdea.versao, 1);

    assert.ok(insertedTasks);
    assert.equal(insertedTasks.length, 2);
    assert.equal(insertedTasks[0].concluida, false, 'Tarefas duplicadas começam não concluídas');
    assert.equal(insertedTasks[1].concluida, false);
  } finally {
    supabase.from = originalFrom;
  }
});

// ─── 6. Conversão Transacional em Rascunho de Campanha ─────────────────────────

test('convertIdeaToCampaign: idempotência sob chamadas repetidas ou simultâneas', async () => {
  const originalRpc = supabase.rpc;
  try {
    // Simula resposta da RPC quando a ideia já foi convertida previamente
    supabase.rpc = async (fnName, params) => {
      assert.equal(fnName, 'fn_convert_ideia_to_rascunho');
      assert.equal(params.p_ideia_id, 'ideia-123');
      return {
        data: {
          ok: true,
          idempotente: true,
          campanha_id: 42,
          campanha_nome: 'Campanha Existente',
        },
        error: null,
      };
    };

    const res = await convertIdeaToCampaign({
      ideiaId: 'ideia-123',
      nome: 'Nova Tentativa',
      canal: 'Instagram',
    });

    assert.equal(res.ok, true);
    assert.equal(res.idempotente, true);
    assert.equal(res.campanhaId, 42);
    assert.equal(res.campanhaNome, 'Campanha Existente');
  } finally {
    supabase.rpc = originalRpc;
  }
});

test('convertIdeaToCampaign: reporta erro claro se a migração incremental não foi aplicada', async () => {
  const originalRpc = supabase.rpc;
  try {
    supabase.rpc = async () => ({
      data: null,
      error: { code: '42883', message: 'function fn_convert_ideia_to_rascunho does not exist' },
    });

    const res = await convertIdeaToCampaign({
      ideiaId: 'ideia-123',
      nome: 'Campanha Teste',
    });

    assert.equal(res.ok, false);
    assert.match(res.error.message, /marketing_ideas_migration_v2\.sql/i);
  } finally {
    supabase.rpc = originalRpc;
  }
});

// ─── 7. Tratamento de Erros e Rejeições na Lousa (PAIEMAE_CORRECOES_LOUSA.md) ──

test('fetchWhiteboardLayout: propaga erro real (ex: permissão 42501) e NÃO retorna vazio com error: null', async () => {
  const originalFrom = supabase.from;
  try {
    supabase.from = () => ({
      select() {
        return {
          eq() {
            return {
              maybeSingle: async () => ({
                data: null,
                error: { code: '42501', message: 'permission denied for table marketing_whiteboards' },
              }),
            };
          },
        };
      },
    });

    const res = await fetchWhiteboardLayout('default');
    assert.equal(res.data, null);
    assert.ok(res.error, 'Erro deve ser propagado e não mascarado como lousa vazia');
    assert.match(res.error.message, /permission denied/i);
    assert.equal(res.structureMissing, false);
  } finally {
    supabase.from = originalFrom;
  }
});

test('fetchWhiteboardLayout: reconhece tabela inexistente (42P01) como structureMissing', async () => {
  const originalFrom = supabase.from;
  try {
    supabase.from = () => ({
      select() {
        return {
          eq() {
            return {
              maybeSingle: async () => ({
                data: null,
                error: { code: '42P01', message: 'relation "marketing_whiteboards" does not exist' },
              }),
            };
          },
        };
      },
    });

    const res = await fetchWhiteboardLayout('default');
    assert.equal(res.data, null);
    assert.equal(res.structureMissing, true);
    assert.ok(res.error);
    assert.match(res.error.message, /ainda não existe/i);
  } finally {
    supabase.from = originalFrom;
  }
});

test('saveWhiteboardLayout: propaga conflito de concorrência retornado pela RPC', async () => {
  const originalRpc = supabase.rpc;
  try {
    supabase.rpc = async (fnName, params) => {
      assert.equal(fnName, 'fn_save_marketing_whiteboard');
      assert.equal(params.p_versao_esperada, 1);
      return {
        data: {
          ok: false,
          conflict: true,
          error: 'A lousa foi alterada por outro usuário.',
          versao_servidor: 2,
          layout_servidor: { nodes: [], edges: [] },
        },
        error: null,
      };
    };

    const res = await saveWhiteboardLayout({
      contexto: 'default',
      layout: { nodes: [], edges: [] },
      versaoEsperada: 1,
    });

    assert.equal(res.ok, false);
    assert.equal(res.conflict, true);
    assert.equal(res.versaoServidor, 2);
    assert.match(res.error.message, /alterada por outro usuário/i);
  } finally {
    supabase.rpc = originalRpc;
  }
});

test('saveWhiteboardLayout: falha da RPC NÃO faz fallback para gravação direta sem versão', async () => {
  const originalRpc = supabase.rpc;
  try {
    supabase.rpc = async () => ({
      data: null,
      error: { message: 'function fn_save_marketing_whiteboard does not exist' },
    });

    const res = await saveWhiteboardLayout({
      contexto: 'default',
      layout: { nodes: [], edges: [] },
      versaoEsperada: 1,
    });

    assert.equal(res.ok, false);
    assert.ok(res.error);
    assert.match(res.error.message, /fn_save_marketing_whiteboard|Erro ao salvar/i);
  } finally {
    supabase.rpc = originalRpc;
  }
});

test('archiveIdea: falha na RPC propaga erro e não confirma falso sucesso', async () => {
  const originalRpc = supabase.rpc;
  try {
    supabase.rpc = async () => ({
      data: null,
      error: { message: 'permission denied for function fn_arquivar_ideia' },
    });

    const res = await archiveIdea('ideia-123', true);
    assert.equal(res.ok, false);
    assert.ok(res.error);
    assert.match(res.error.message, /permission denied/i);
  } finally {
    supabase.rpc = originalRpc;
  }
});

test('linkIdeaCampaign: falha na RPC propaga erro sem bypass direto', async () => {
  const originalRpc = supabase.rpc;
  try {
    supabase.rpc = async () => ({
      data: null,
      error: { message: 'permission denied for function fn_vincular_ideia_campanha' },
    });

    const res = await linkIdeaCampaign('ideia-1', 999);
    assert.equal(res.ok, false);
    assert.ok(res.error);
    assert.match(res.error.message, /permission denied/i);
  } finally {
    supabase.rpc = originalRpc;
  }
});

test('insertIdea: cria ideia com formato padrão "Não definido" e versão 1', async () => {
  const originalFrom = supabase.from;
  let insertPayload = null;
  try {
    supabase.from = (table) => {
      if (table === 'marketing_ideas') {
        return {
          insert(rows) {
            insertPayload = rows[0];
            return {
              select() {
                return {
                  single: async () => ({
                    data: { id: 'uuid-1', ...insertPayload },
                    error: null,
                  }),
                };
              },
            };
          },
        };
      }
      return { insert: () => ({ catch: () => {} }) };
    };

    const res = await insertIdea({ titulo: 'Nova Ideia Só Com Título' });
    assert.equal(res.error, null);
    assert.ok(insertPayload);
    assert.equal(insertPayload.titulo, 'Nova Ideia Só Com Título');
    assert.equal(insertPayload.formato, 'Não definido');
    assert.equal(insertPayload.etapa, 'ideia');
    assert.equal(insertPayload.versao, 1);
    assert.equal(insertPayload.arquivada, false);
  } finally {
    supabase.from = originalFrom;
  }
});

// ─── 8. Testes das 3 Correções Específicas Solicitadas ─────────────────────────

test('updateIdea: detecta atomicamente colisão de edição simultânea via condição de versão', async () => {
  const originalFrom = supabase.from;
  try {
    // Simula que a query de update com .eq("versao", 1) retornou null (outra sessão acabou de salvar versão 2)
    supabase.from = () => ({
      select() {
        return {
          eq() {
            return {
              single: async () => ({
                data: { id: 'ideia-concorrente', titulo: 'Original', versao: 1, etapa: 'ideia' },
                error: null,
              }),
              maybeSingle: async () => ({
                data: { id: 'ideia-concorrente', titulo: 'Original', versao: 2, etapa: 'ideia' },
                error: null,
              }),
            };
          },
        };
      },
      update() {
        return {
          eq() {
            return {
              eq() {
                return {
                  select() {
                    return {
                      // 0 linhas atualizadas porque a versão já avançou no banco
                      maybeSingle: async () => ({ data: null, error: null }),
                    };
                  },
                };
              },
            };
          },
        };
      },
    });

    const res = await updateIdea('ideia-concorrente', { titulo: 'Novo Título' }, null, 1);
    assert.equal(res.data, null);
    assert.equal(res.conflict, true);
    assert.match(res.error.message, /modificado por outro usuário/i);
  } finally {
    supabase.from = originalFrom;
  }
});

test('fetchWhiteboardLayout: retorna versão 0 quando lousa ainda não existe no banco', async () => {
  const originalFrom = supabase.from;
  try {
    supabase.from = () => ({
      select() {
        return {
          eq() {
            return {
              // Lousa não existe no banco
              maybeSingle: async () => ({ data: null, error: null }),
            };
          },
        };
      },
    });

    const res = await fetchWhiteboardLayout('default');
    assert.equal(res.error, null);
    assert.deepEqual(res.data, { nodes: [], edges: [] });
    assert.equal(res.versao, 0, 'Lousa inexistente deve retornar versao 0 para controle estrito de primeira gravação');
  } finally {
    supabase.from = originalFrom;
  }
});

test('Filtros da lousa: setas entre post-its NUNCA são ocultadas por filtros de ideias', () => {
  // Lógica pura de verificação do cálculo de edges na presença de filtros
  const allIdeaIds = new Set(['ideia-1', 'ideia-2']);
  const visibleIdeaIds = new Set(['ideia-1']); // ideia-2 está filtrada/oculta

  const edges = [
    { id: 'e1', source: 'note-1', target: 'note-2' },           // entre dois post-its
    { id: 'e2', source: 'ideia-1', target: 'note-1' },          // entre ideia visível e post-it
    { id: 'e3', source: 'ideia-2', target: 'note-1' },          // entre ideia OCULTA e post-it
    { id: 'e4', source: 'ideia-1', target: 'ideia-2' },         // entre ideia visível e ideia OCULTA
  ];

  const processed = edges.map(e => {
    const sourceIsHiddenIdea = visibleIdeaIds ? (allIdeaIds.has(e.source) && !visibleIdeaIds.has(e.source)) : false;
    const targetIsHiddenIdea = visibleIdeaIds ? (allIdeaIds.has(e.target) && !visibleIdeaIds.has(e.target)) : false;
    const isHidden = sourceIsHiddenIdea || targetIsHiddenIdea;
    return { ...e, hidden: isHidden };
  });

  // e1: seta entre post-its NÃO pode ser oculta
  assert.equal(processed.find(e => e.id === 'e1').hidden, false);
  // e2: seta entre ideia visível e post-it NÃO pode ser oculta
  assert.equal(processed.find(e => e.id === 'e2').hidden, false);
  // e3: seta conectada a ideia oculta DEVE ser oculta
  assert.equal(processed.find(e => e.id === 'e3').hidden, true);
  // e4: seta conectada a ideia oculta DEVE ser oculta
  assert.equal(processed.find(e => e.id === 'e4').hidden, true);
});

test('saveWhiteboardLayout: primeira gravação com versão esperada 0 passa parâmetro correto para a RPC', async () => {
  const originalRpc = supabase.rpc;
  try {
    let capturedParams = null;
    supabase.rpc = async (fnName, params) => {
      capturedParams = { fnName, params };
      return { data: { ok: true, versao: 1 }, error: null };
    };

    const res = await saveWhiteboardLayout({
      contexto: 'default',
      layout: { nodes: [{ id: 'note-1' }], edges: [] },
      versaoEsperada: 0,
      author: { id: 'user-1', name: 'Tester' },
    });

    assert.equal(res.ok, true);
    assert.equal(res.versao, 1);
    assert.equal(capturedParams.fnName, 'fn_save_marketing_whiteboard');
    assert.equal(capturedParams.params.p_versao_esperada, 0);
  } finally {
    supabase.rpc = originalRpc;
  }
});

test('saveWhiteboardLayout: colisão na primeira gravação (outra sessão já criou a lousa) propaga conflito', async () => {
  const originalRpc = supabase.rpc;
  try {
    supabase.rpc = async () => ({
      data: {
        ok: false,
        conflict: true,
        error: 'A lousa foi alterada por outro usuário. Recarregue para mesclar as alterações.',
        versao_servidor: 1,
        layout_servidor: { nodes: [{ id: 'note-outro' }], edges: [] },
      },
      error: null,
    });

    const res = await saveWhiteboardLayout({
      contexto: 'default',
      layout: { nodes: [{ id: 'note-1' }], edges: [] },
      versaoEsperada: 0,
    });

    assert.equal(res.ok, false);
    assert.equal(res.conflict, true);
    assert.equal(res.versaoServidor, 1);
    assert.match(res.error.message, /outro usuário/i);
  } finally {
    supabase.rpc = originalRpc;
  }
});

// ─── 9. Testes com o SDK Real do Supabase e Fetch Simulado (sem Promises falsas) ──

function createSimulatedRealSdk(handler = {}) {
  return createClient('https://mock-test.supabase.co', 'mock-anon-key', {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: async (url, options = {}) => {
        const urlStr = url.toString();
        const method = options.method || 'GET';
        let body = null;
        if (options.body) {
          try {
            body = JSON.parse(options.body);
          } catch {
            body = options.body;
          }
        }

        const accept = options.headers?.get ? options.headers.get('accept') : options.headers?.['Accept'] || options.headers?.['accept'];
        const isSingle = !!(accept && accept.includes('vnd.pgrst.object+json'));
        const formatData = (item) => isSingle ? item : (Array.isArray(item) ? item : [item]);

        if (handler.onFetch) {
          const custom = await handler.onFetch({ url: urlStr, method, body, headers: options.headers });
          if (custom) return custom;
        }

        if (urlStr.includes('/rest/v1/marketing_ideas')) {
          if (method === 'POST') {
            const row = Array.isArray(body) ? body[0] : body;
            const resItem = { id: 'mock-idea-1', ...row, versao: 1 };
            return new Response(JSON.stringify(formatData(resItem)), {
              status: 201,
              headers: { 'Content-Type': 'application/json', 'Content-Range': '0-0/1' },
            });
          }
          if (method === 'PATCH') {
            const row = Array.isArray(body) ? body[0] : body;
            const resItem = { id: 'mock-idea-1', ...row, versao: 2 };
            return new Response(JSON.stringify(formatData(resItem)), {
              status: 200,
              headers: { 'Content-Type': 'application/json', 'Content-Range': '0-0/1' },
            });
          }
          if (method === 'GET') {
            const resItem = {
              id: 'mock-idea-1',
              titulo: 'Ideia Base',
              etapa: 'ideia',
              versao: 1,
              tags: [],
              formato: 'Post',
              criado_por: 'user-1',
            };
            return new Response(JSON.stringify(formatData(resItem)), {
              status: 200,
              headers: { 'Content-Type': 'application/json', 'Content-Range': '0-0/1' },
            });
          }
        }

        if (urlStr.includes('/rest/v1/marketing_idea_events')) {
          if (method === 'POST') {
            return new Response(JSON.stringify(formatData({ id: 'mock-event-1' })), {
              status: 201,
              headers: { 'Content-Type': 'application/json', 'Content-Range': '0-0/1' },
            });
          }
        }

        if (urlStr.includes('/rest/v1/marketing_idea_tasks')) {
          if (method === 'POST') {
            return new Response(JSON.stringify(formatData({ id: 'mock-task-1' })), {
              status: 201,
              headers: { 'Content-Type': 'application/json', 'Content-Range': '0-0/1' },
            });
          }
          if (method === 'GET') {
            return new Response(JSON.stringify([{ id: 'mock-task-1', titulo: 'Tarefa A', ordem: 0 }]), {
              status: 200,
              headers: { 'Content-Type': 'application/json', 'Content-Range': '0-0/1' },
            });
          }
        }

        return new Response(JSON.stringify([]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      },
    },
  });
}

test('SDK Real: insertIdea executa com PostgrestQueryBuilder real (sem .catch) e registra criação', async () => {
  const realClient = createSimulatedRealSdk();
  const origFrom = supabase.from;
  try {
    supabase.from = realClient.from.bind(realClient);

    const res = await insertIdea({ titulo: 'Nova Ideia Real SDK' }, { id: 'usr-1', name: 'Tester' });
    assert.equal(res.error, null);
    assert.ok(res.data);
    assert.equal(res.data.titulo, 'Nova Ideia Real SDK');
  } finally {
    supabase.from = origFrom;
  }
});

test('SDK Real: insertIdea preserva dados principais caso gravação de eventos falhe no banco (sem duplicatas)', async () => {
  // Simula que a tabela marketing_idea_events falhou (ex: 500 no postgrest ou permissão)
  const realClient = createSimulatedRealSdk({
    onFetch: async ({ url, method }) => {
      if (url.includes('/rest/v1/marketing_idea_events') && method === 'POST') {
        return new Response(JSON.stringify({ message: 'relation marketing_idea_events does not exist' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return null;
    },
  });

  const origFrom = supabase.from;
  try {
    supabase.from = realClient.from.bind(realClient);

    const res = await insertIdea({ titulo: 'Ideia com Falha de Evento' });
    // O registro principal deve ser preservado para não induzir clique repetido
    assert.equal(res.error, null);
    assert.ok(res.data);
    assert.equal(res.data.titulo, 'Ideia com Falha de Evento');
  } finally {
    supabase.from = origFrom;
  }
});

test('SDK Real: updateIdea executa com PostgrestQueryBuilder real (sem .catch) e atualiza campos', async () => {
  const realClient = createSimulatedRealSdk();
  const origFrom = supabase.from;
  try {
    supabase.from = realClient.from.bind(realClient);

    const res = await updateIdea('mock-idea-1', { titulo: 'Título Atualizado' }, { id: 'usr-1' }, 1);
    assert.equal(res.error, null);
    assert.ok(res.data);
    assert.equal(res.data.titulo, 'Título Atualizado');
    assert.equal(res.data.versao, 2);
  } finally {
    supabase.from = origFrom;
  }
});

test('SDK Real: updateIdea preserva atualização caso histórico falhe (não lança exceção nem quebra versão)', async () => {
  const realClient = createSimulatedRealSdk({
    onFetch: async ({ url, method }) => {
      if (url.includes('/rest/v1/marketing_idea_events') && method === 'POST') {
        return new Response(JSON.stringify({ message: 'error writing events' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return null;
    },
  });

  const origFrom = supabase.from;
  try {
    supabase.from = realClient.from.bind(realClient);

    const res = await updateIdea('mock-idea-1', { titulo: 'Atualização Segura' }, null, 1);
    assert.equal(res.error, null);
    assert.ok(res.data);
    assert.equal(res.data.titulo, 'Atualização Segura');
  } finally {
    supabase.from = origFrom;
  }
});

test('SDK Real: duplicateIdea clona tarefas e registra evento com PostgrestQueryBuilder real (sem .catch)', async () => {
  const realClient = createSimulatedRealSdk();
  const origFrom = supabase.from;
  try {
    supabase.from = realClient.from.bind(realClient);

    const res = await duplicateIdea('mock-idea-1', { id: 'usr-1', name: 'Clonador' });
    assert.equal(res.error, null);
    assert.ok(res.data);
    assert.match(res.data.titulo, /Cópia/);
  } finally {
    supabase.from = origFrom;
  }
});

test('SDK Real: unlinkIdeaCampaign remove vínculo e registra evento com PostgrestQueryBuilder real (sem .catch)', async () => {
  const realClient = createSimulatedRealSdk();
  const origFrom = supabase.from;
  try {
    supabase.from = realClient.from.bind(realClient);

    const res = await unlinkIdeaCampaign('mock-idea-1', 'camp-uuid-old', { id: 'usr-1' });
    assert.equal(res.ok, true);
    assert.equal(res.error, undefined);
  } finally {
    supabase.from = origFrom;
  }
});

test('SDK Real: approveIdea (fallback) executa com PostgrestQueryBuilder real (sem .catch)', async () => {
  const realClient = createSimulatedRealSdk();
  const origFrom = supabase.from;
  const origRpc = supabase.rpc;
  try {
    supabase.from = realClient.from.bind(realClient);
    // Simula que a RPC fn_aprovar_ideia não existe para testar o fallback direto
    supabase.rpc = async () => ({
      data: null,
      error: { code: 'PGRST202', message: 'Could not find the function fn_aprovar_ideia' },
    });

    const res = await approveIdea('mock-idea-1', true, 'Aprovado para produção', { id: 'usr-1', name: 'Aprovador' });
    assert.equal(res.ok, true);
    assert.equal(res.data?.aprovado, true);
  } finally {
    supabase.from = origFrom;
    supabase.rpc = origRpc;
  }
});




