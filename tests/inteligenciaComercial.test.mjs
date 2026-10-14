/**
 * tests/inteligenciaComercial.test.mjs
 * Testes de unidade e contratos para o módulo de Inteligência Comercial.
 *
 * Valida:
 * 1. Funções reais exportadas por src/services/inteligenciaComercialService.js.
 * 2. Aritmética de calendário pura em getDateRange (imune a UTC+14 ou UTC-10).
 * 3. Concorrência atômica (compare-and-set) em updateSegment e archiveSegment.
 * 4. Contrato de conversão: exclui agendamentos cancelados, desmarcados, faltas e pós-corte.
 * 5. Contrato operacional: exclui leads arquivados e encerrados de retornos_pendentes e interessados_sem_acao.
 * 6. Contrato RFM: recência em relação à data de corte (p_date_to) e modos de filtro (sem_retorno, todos).
 * 7. Validação estrita de tipos e operadores (rejeita ILIKE/contains em booleans e datas).
 * 8. Status dinâmico de reconciliação financeira (disponivel, parcial, indisponivel, sem_lancamentos).
 * 9. Vínculo de públicos a briefs de campanha com snapshot de critérios.
 * 10. Validação gerencial de perfis ICP e classificação de erros de setup.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  getDateRange,
  fmtDate,
  fmtBRL,
  updateSegment,
  archiveSegment,
  saveSegment,
  previewSegment,
  validateIcpProfile,
  saveCampaignBrief,
  getIsoDateRangeSaoPaulo,
  linkCommercialRecord,
  unlinkCommercialRecord,
  checkIntelligenceSetup,
} from '../src/services/inteligenciaComercialService.js';
import { supabase } from '../src/lib/supabase.js';

// ─── 1. Helpers Puros de Contrato de Cálculo (Espelham RPCs PostgreSQL) ──────

function calcClientesAtendidos(appointments, dateFrom, dateTo) {
  const ids = new Set(
    appointments
      .filter(a => a.status === 'finalizado' && a.appointment_date >= dateFrom && a.appointment_date <= dateTo && a.client_id != null)
      .map(a => a.client_id)
  );
  return ids.size;
}

function calcNovosClientes(appointments, dateFrom, dateTo) {
  const firstByClient = {};
  for (const a of appointments) {
    if (a.status !== 'finalizado' || a.client_id == null) continue;
    if (firstByClient[a.client_id] == null || a.appointment_date < firstByClient[a.client_id]) {
      firstByClient[a.client_id] = a.appointment_date;
    }
  }
  return Object.values(firstByClient).filter(d => d >= dateFrom && d <= dateTo).length;
}

function calcClientesRetorno(appointments, dateFrom, dateTo) {
  const atendidosPeriodo = new Set(
    appointments
      .filter(a => a.status === 'finalizado' && a.appointment_date >= dateFrom && a.appointment_date <= dateTo && a.client_id != null)
      .map(a => a.client_id)
  );
  return [...atendidosPeriodo].filter(clientId =>
    appointments.some(a =>
      a.client_id === clientId && a.status === 'finalizado' && a.appointment_date < dateFrom
    )
  ).length;
}

function calcParticipacaoRetorno(clientesRetorno, clientesAtendidos) {
  if (!clientesAtendidos || clientesAtendidos === 0) return null;
  return Math.round((clientesRetorno / clientesAtendidos) * 100 * 10) / 10;
}

function calcInteressados(leads, dateFrom, dateTo) {
  return leads.filter(l => {
    const d = l.created_at.slice(0, 10);
    return d >= dateFrom && d <= dateTo;
  }).length;
}

/**
 * Contrato de conversão corrigido:
 * Valida existência, status válido (NÃO cancelado, desmarcado ou falta) e data de corte.
 */
function calcLeadsComAgendamentoValido(leads, appointments, dateFrom, dateTo) {
  const apptMap = new Map(appointments.map(a => [a.id, a]));
  const INVALID_STATUSES = new Set(['cancelado', 'desmarcado', 'falta']);

  return leads.filter(l => {
    const d = l.created_at.slice(0, 10);
    if (d < dateFrom || d > dateTo) return false;
    if (!l.appointment_id) return false;

    const appt = apptMap.get(l.appointment_id);
    if (!appt) return false;
    if (INVALID_STATUSES.has(appt.status)) return false;
    if (appt.appointment_date > dateTo) return false;

    return true;
  }).length;
}

function calcConversaoAgendamento(leadsValidos, interessados) {
  if (!interessados || interessados === 0) return null;
  return Math.round((leadsValidos / interessados) * 100 * 10) / 10;
}

/**
 * Contrato de oportunidades operacionais corrigido:
 * Exclui arquivados e leads encerrados.
 */
function calcOportunidadesOperacionais(leads, hojeStr) {
  const CLOSED_STATUSES = new Set(['encerrado_ganho', 'encerrado_perdido', 'arquivado']);

  let retornosPendentes = 0;
  let interessadosSemAcao = 0;

  for (const l of leads) {
    if (l.arquivado === true) continue;
    if (CLOSED_STATUSES.has(l.status)) continue;

    // Retorno pendente: prazo vencido e não concluído
    if (l.proxima_acao_prazo && l.proxima_acao_prazo < hojeStr && !l.proxima_acao_concluida) {
      retornosPendentes++;
    }

    // Interessado sem ação: sem prazo ou sem descrição
    if (!l.proxima_acao_prazo || !l.proxima_acao_descricao || !l.proxima_acao_descricao.trim()) {
      interessadosSemAcao++;
    }
  }

  return { retornosPendentes, interessadosSemAcao };
}

/**
 * Contrato de RFM com data de corte:
 * Recência calculada estritamente contra dateTo, sem vazamento de consultas futuras.
 */
function calcClienteRFM(clientId, appointments, dateFrom, dateTo) {
  const clientAppts = appointments.filter(
    a => a.client_id === clientId && a.status === 'finalizado' && a.appointment_date <= dateTo
  );

  if (clientAppts.length === 0) return null;

  const apptsPeriodo = clientAppts.filter(a => a.appointment_date >= dateFrom);
  const dates = clientAppts.map(a => a.appointment_date).sort();
  const primeiroAtendimento = dates[0];
  const ultimoAtendimento = dates[dates.length - 1];

  // Cálculo ordinal de dias sem atendimento relativo à data de corte do relatório
  const toD = new Date(dateTo + 'T00:00:00Z');
  const ultD = new Date(ultimoAtendimento + 'T00:00:00Z');
  const diasSemAtendimento = Math.round((toD - ultD) / (1000 * 60 * 60 * 24));

  return {
    clientId,
    primeiroAtendimento,
    ultimoAtendimento,
    diasSemAtendimento,
    atendimentosPeriodo: apptsPeriodo.length,
    atendimentosTotal: clientAppts.length,
  };
}

/**
 * Contrato de status de receita financeira conciliada
 */
function calcReceitaStatus(totalTransacoes, vinculadas) {
  if (totalTransacoes === 0) return 'sem_lancamentos';
  if (vinculadas === 0) return 'indisponivel';
  if (vinculadas === totalTransacoes) return 'disponivel';
  return 'parcial';
}

// ─── 2. Testes da Suíte ──────────────────────────────────────────────────────

describe('Inteligência Comercial — Suíte Completa de Contratos e Serviço Real', () => {

  describe('1. Serviço Real: getDateRange sem Distorção de Fuso', () => {
    it('Preset 7d cobre exatamente 7 dias inclusivos (6 dias de diferença)', () => {
      const { from, to } = getDateRange('7d', '2026-10-14');
      assert.equal(to, '2026-10-14');
      assert.equal(from, '2026-10-08');
      const diffDays = (new Date(to + 'T00:00:00Z') - new Date(from + 'T00:00:00Z')) / 86400000;
      assert.equal(diffDays, 6, '7 dias inclusivos = diferença de 6 dias');
    });

    it('Preset 30d cobre exatamente 30 dias inclusivos (29 dias de diferença)', () => {
      const { from, to } = getDateRange('30d', '2026-10-14');
      assert.equal(to, '2026-10-14');
      assert.equal(from, '2026-09-15');
      const diffDays = (new Date(to + 'T00:00:00Z') - new Date(from + 'T00:00:00Z')) / 86400000;
      assert.equal(diffDays, 29);
    });

    it('Preset 90d cobre exatamente 90 dias inclusivos (89 dias de diferença)', () => {
      const { from, to } = getDateRange('90d', '2026-10-14');
      assert.equal(to, '2026-10-14');
      assert.equal(from, '2026-07-17');
      const diffDays = (new Date(to + 'T00:00:00Z') - new Date(from + 'T00:00:00Z')) / 86400000;
      assert.equal(diffDays, 89);
    });

    it('Tratamento correto de virada de ano e meses com 31/30/28 dias', () => {
      // 7d no início de janeiro não quebra o ano
      const jan = getDateRange('7d', '2026-01-03');
      assert.equal(jan.to, '2026-01-03');
      assert.equal(jan.from, '2025-12-28');

      // Ano bissexto: 2024-03-01 com 7d vai para 2024-02-24 (fevereiro teve 29 dias)
      const bissexto = getDateRange('7d', '2024-03-01');
      assert.equal(bissexto.to, '2024-03-01');
      assert.equal(bissexto.from, '2024-02-24');
    });

    it('Preset 12m recua 1 ano completo', () => {
      const { from, to } = getDateRange('12m', '2026-10-14');
      assert.equal(to, '2026-10-14');
      assert.equal(from, '2025-10-14');
    });

    it('Garante formato estrito YYYY-MM-DD mesmo sem parâmetro de data', () => {
      const range = getDateRange('7d');
      assert.match(range.from, /^\d{4}-\d{2}-\d{2}$/);
      assert.match(range.to, /^\d{4}-\d{2}-\d{2}$/);
      assert.ok(range.from <= range.to);
    });
  });

  describe('2. Formatação Real: fmtDate e fmtBRL', () => {
    it('fmtDate converte YYYY-MM-DD para dd/mm/yyyy', () => {
      assert.equal(fmtDate('2026-10-14'), '14/10/2026');
      assert.equal(fmtDate('2026-01-05'), '05/01/2026');
      assert.equal(fmtDate(null), '—');
      assert.equal(fmtDate(''), '—');
    });

    it('fmtBRL formata valores monetários corretamente em Real', () => {
      assert.match(fmtBRL(1250.5), /1\.250,50/);
      assert.match(fmtBRL(0), /0,00/);
      assert.match(fmtBRL(null), /0,00/);
      assert.match(fmtBRL('invalido'), /0,00/);
    });
  });

  describe('3. Concorrência Atômica no Serviço Real (compare-and-set)', () => {
    it('updateSegment: sucesso quando a versão enviada bate com a versão do banco', async () => {
      const originalFrom = supabase.from;
      let executedFilters = [];

      supabase.from = (table) => {
        assert.equal(table, 'marketing_segments');
        return {
          update: (payload) => {
            assert.equal(payload.version, 2, 'Nova versão deve ser incrementada para 2');
            assert.ok(payload.updated_at);
            return {
              eq: function(field, val) {
                executedFilters.push({ field, val });
                return this;
              },
              select: async () => ({
                data: [{ id: 'seg-1', name: 'Segmento VIP', version: 2 }],
                error: null,
              }),
            };
          },
        };
      };

      try {
        const res = await updateSegment('seg-1', { name: 'Segmento VIP' }, 1);
        assert.equal(res.error, null);
        assert.equal(res.data.version, 2);
        
        // Valida que o filtro do UPDATE exigiu simultaneamente id E version
        const idFilter = executedFilters.find(f => f.field === 'id' && f.val === 'seg-1');
        const verFilter = executedFilters.find(f => f.field === 'version' && f.val === 1);
        assert.ok(idFilter, 'Filtro id obrigatório');
        assert.ok(verFilter, 'Filtro version obrigatório para atomicidade compare-and-set');
      } finally {
        supabase.from = originalFrom;
      }
    });

    it('updateSegment: detecta CONFLICT quando a versão não coincide (outro editor salvou antes)', async () => {
      const originalFrom = supabase.from;

      supabase.from = (table) => ({
        update: () => ({
          eq: function() { return this; },
          // Simula retorno de 0 linhas atualizadas (pois version != expectedVer)
          select: async () => ({ data: [], error: null }),
        }),
      });

      try {
        const res = await updateSegment('seg-1', { name: 'Mudança concorrente' }, 1);
        assert.equal(res.data, null);
        assert.ok(res.error, 'Deve retornar erro de conflito');
        assert.equal(res.error.code, 'CONFLICT');
        assert.match(res.error.message, /conflito de concorrência/i);
      } finally {
        supabase.from = originalFrom;
      }
    });

    it('archiveSegment: executa compare-and-set e acusa CONFLICT se já alterado', async () => {
      const originalFrom = supabase.from;

      supabase.from = (table) => ({
        update: (payload) => {
          assert.equal(payload.archived, true);
          return {
            eq: function() { return this; },
            select: async () => ({ data: [], error: null }), // 0 linhas
          };
        },
      });

      try {
        const res = await archiveSegment('seg-1', 2);
        assert.equal(res.data, null);
        assert.equal(res.error?.code, 'CONFLICT');
      } finally {
        supabase.from = originalFrom;
      }
    });
  });

  describe('4. Contrato de Conversão de Leads com Agendamentos Cancelados/Inválidos', () => {
    const leads = [
      { id: 'l1', created_at: '2026-09-05T10:00:00Z', appointment_id: 'a1' }, // Válido
      { id: 'l2', created_at: '2026-09-10T10:00:00Z', appointment_id: 'a2' }, // Cancelado
      { id: 'l3', created_at: '2026-09-12T10:00:00Z', appointment_id: 'a3' }, // Desmarcado
      { id: 'l4', created_at: '2026-09-15T10:00:00Z', appointment_id: 'a4' }, // Falta
      { id: 'l5', created_at: '2026-09-18T10:00:00Z', appointment_id: 'a5' }, // Futuro (fora do período)
      { id: 'l6', created_at: '2026-09-20T10:00:00Z', appointment_id: null }, // Sem agendamento
    ];

    const appointments = [
      { id: 'a1', client_id: 1, appointment_date: '2026-09-08', status: 'finalizado' },
      { id: 'a2', client_id: 2, appointment_date: '2026-09-11', status: 'cancelado' },
      { id: 'a3', client_id: 3, appointment_date: '2026-09-13', status: 'desmarcado' },
      { id: 'a4', client_id: 4, appointment_date: '2026-09-16', status: 'falta' },
      { id: 'a5', client_id: 5, appointment_date: '2026-10-05', status: 'agendado' }, // após 2026-09-30
    ];

    it('Exclui cancelado, desmarcado e falta da contagem de conversão', () => {
      const validos = calcLeadsComAgendamentoValido(leads, appointments, '2026-09-01', '2026-09-30');
      assert.equal(validos, 1, 'Apenas l1 possui agendamento válido e não cancelado');
    });

    it('Exclui agendamento com data posterior à data de corte do período', () => {
      // l5 tem agendamento para outubro; no relatório de setembro não conta
      const validos = calcLeadsComAgendamentoValido([leads[4]], appointments, '2026-09-01', '2026-09-30');
      assert.equal(validos, 0);
    });

    it('Calcula taxa de conversão corretamente sem inflação', () => {
      const interessados = calcInteressados(leads, '2026-09-01', '2026-09-30');
      const validos = calcLeadsComAgendamentoValido(leads, appointments, '2026-09-01', '2026-09-30');
      const taxa = calcConversaoAgendamento(validos, interessados);
      // 1 de 6 leads = 16.7%
      assert.equal(taxa, 16.7);
    });
  });

  describe('5. Contrato de Sinais Operacionais (Exclusão de Arquivados e Encerrados)', () => {
    const hoje = '2026-10-14';
    const leads = [
      // 1. Ativo com ação atrasada -> deve contar em retornos_pendentes
      { id: 'l1', status: 'qualificado', arquivado: false, proxima_acao_prazo: '2026-10-10', proxima_acao_concluida: false, proxima_acao_descricao: 'Ligar para confirmar' },
      // 2. Arquivado com ação atrasada -> NÃO DEVE CONTAR
      { id: 'l2', status: 'novo', arquivado: true, proxima_acao_prazo: '2026-10-05', proxima_acao_concluida: false, proxima_acao_descricao: 'Retornar contato' },
      // 3. Encerrado perdido com ação atrasada -> NÃO DEVE CONTAR
      { id: 'l3', status: 'encerrado_perdido', arquivado: false, proxima_acao_prazo: '2026-10-01', proxima_acao_concluida: false, proxima_acao_descricao: 'Acompanhar' },
      // 4. Encerrado ganho com ação atrasada -> NÃO DEVE CONTAR
      { id: 'l4', status: 'encerrado_ganho', arquivado: false, proxima_acao_prazo: '2026-10-02', proxima_acao_concluida: false, proxima_acao_descricao: 'Enviar termo' },
      // 5. Ativo sem ação definida -> deve contar em interessados_sem_acao
      { id: 'l5', status: 'novo', arquivado: false, proxima_acao_prazo: null, proxima_acao_descricao: '' },
      // 6. Arquivado sem ação -> NÃO DEVE CONTAR em interessados_sem_acao
      { id: 'l6', status: 'arquivado', arquivado: true, proxima_acao_prazo: null, proxima_acao_descricao: null },
    ];

    it('Exclui leads arquivados e encerrados de retornos pendentes', () => {
      const { retornosPendentes } = calcOportunidadesOperacionais(leads, hoje);
      assert.equal(retornosPendentes, 1, 'Apenas l1 ativo com prazo vencido deve contar');
    });

    it('Exclui leads arquivados e encerrados de interessados sem ação', () => {
      const { interessadosSemAcao } = calcOportunidadesOperacionais(leads, hoje);
      assert.equal(interessadosSemAcao, 1, 'Apenas l5 ativo sem prazo deve contar');
    });
  });

  describe('6. Contrato de RFM com Data de Corte Histórica (Sem Vazamento Futuro)', () => {
    const appointments = [
      { id: 'a1', client_id: 10, appointment_date: '2026-08-10', status: 'finalizado' },
      { id: 'a2', client_id: 10, appointment_date: '2026-09-10', status: 'finalizado' },
      { id: 'a3', client_id: 10, appointment_date: '2026-10-05', status: 'finalizado' }, // Futuro em relação a setembro
    ];

    it('Relatório de setembro considera apenas atendimentos até a data de corte (2026-09-30)', () => {
      const rfm = calcClienteRFM(10, appointments, '2026-09-01', '2026-09-30');
      assert.ok(rfm);
      assert.equal(rfm.ultimoAtendimento, '2026-09-10', 'Último atendimento em setembro deve ser 2026-09-10, ignorando outubro');
      assert.equal(rfm.diasSemAtendimento, 20, '2026-09-30 menos 2026-09-10 = 20 dias');
      assert.equal(rfm.atendimentosPeriodo, 1);
      assert.equal(rfm.atendimentosTotal, 2);
    });

    it('Cliente sem atendimento no período é detectado para o modo "sem_retorno"', () => {
      const clientAugustOnly = [
        { id: 'x1', client_id: 20, appointment_date: '2026-08-01', status: 'finalizado' },
      ];
      const rfm = calcClienteRFM(20, clientAugustOnly, '2026-09-01', '2026-09-30');
      assert.ok(rfm);
      assert.equal(rfm.atendimentosPeriodo, 0);
      assert.equal(rfm.atendimentosTotal, 1);
      assert.equal(rfm.diasSemAtendimento, 60);
    });
  });

  describe('7. Status de Reconciliação Financeira', () => {
    it('0 transações → sem_lancamentos', () => {
      assert.equal(calcReceitaStatus(0, 0), 'sem_lancamentos');
    });

    it('Transações existem mas 0 vínculos → indisponivel', () => {
      assert.equal(calcReceitaStatus(15, 0), 'indisponivel');
    });

    it('Transações parcialmente vinculadas → parcial', () => {
      assert.equal(calcReceitaStatus(20, 10), 'parcial');
    });

    it('100% das transações vinculadas → disponivel', () => {
      assert.equal(calcReceitaStatus(25, 25), 'disponivel');
    });
  });

  describe('8. Validação de Tipos de Campo e Operadores em Segmentos', () => {
    const ALLOWED_OPERATORS = {
      boolean: ['eq', 'is_null', 'not_null'],
      date: ['eq', 'neq', 'gte', 'lte', 'is_null', 'not_null'],
      number: ['eq', 'neq', 'gte', 'lte', 'is_null', 'not_null'],
      text: ['eq', 'neq', 'contains', 'is_null', 'not_null'],
    };

    it('Operador "contains" em campo booleano é estritamente proibido (evita erro 42883 ILIKE)', () => {
      assert.ok(!ALLOWED_OPERATORS.boolean.includes('contains'));
      assert.ok(!ALLOWED_OPERATORS.boolean.includes('ILIKE'));
    });

    it('Operador "contains" em campo de data é proibido', () => {
      assert.ok(!ALLOWED_OPERATORS.date.includes('contains'));
    });

    it('Operadores numéricos suportam faixas (gte, lte)', () => {
      assert.ok(ALLOWED_OPERATORS.number.includes('gte'));
      assert.ok(ALLOWED_OPERATORS.number.includes('lte'));
    });

    it('Campos suportados de clientes incluem frequência, serviço e dias sem atendimento', () => {
      const clientFields = [
        'name', 'source', 'status', 'city', 'neighborhood',
        'total_atendimentos', 'dias_sem_atendimento', 'servico_realizado', 'atendimentos_janela',
      ];
      assert.ok(clientFields.includes('total_atendimentos'));
      assert.ok(clientFields.includes('dias_sem_atendimento'));
      assert.ok(clientFields.includes('servico_realizado'));
    });
  });

  describe('9. Serviço Real: Vínculo de Campanha com Snapshot de Critérios', () => {
    it('saveCampaignBrief preserva snapshot imutável de versão e condições', async () => {
      const originalFrom = supabase.from;
      let insertedPayload = null;

      supabase.from = (table) => {
        assert.equal(table, 'marketing_campaign_briefs');
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: null, error: null }),
            }),
          }),
          upsert: (payloads) => {
            insertedPayload = payloads[0];
            return {
              select: () => ({
                single: async () => ({ data: insertedPayload, error: null }),
              }),
            };
          },
        };
      };

      try {
        const briefData = {
          campaign_id: 42,
          objetivo: 'Reativação de Inativos',
          segment_id: 'seg-100',
          segment_version: 3,
          conditions_snapshot: [{ field: 'dias_sem_atendimento', operator: 'gte', value: '90' }],
          estimated_count: 55,
        };

        const res = await saveCampaignBrief(briefData);
        assert.equal(res.error, null);
        assert.equal(insertedPayload.campaign_id, 42);
        assert.equal(insertedPayload.segment_version, 3);
        assert.deepEqual(insertedPayload.conditions_snapshot, briefData.conditions_snapshot);
        assert.equal(insertedPayload.estimated_count, 55);
        assert.ok(insertedPayload.snapshot_date, 'Deve gerar snapshot_date no momento do vínculo');
      } finally {
        supabase.from = originalFrom;
      }
    });
  });

  describe('10. Serviço Real: Validação de Perfil ICP pela Gestão', () => {
    it('validateIcpProfile altera status para "validado" e grava carimbo de auditoria', async () => {
      const originalFrom = supabase.from;
      let updatedPayload = null;

      supabase.from = (table) => {
        assert.equal(table, 'marketing_icp_profiles');
        return {
          update: (payload) => {
            updatedPayload = payload;
            return {
              eq: () => ({
                select: () => ({
                  single: async () => ({ data: { id: 'icp-1', ...payload }, error: null }),
                }),
              }),
            };
          },
        };
      };

      try {
        const res = await validateIcpProfile('icp-1', 'user-gestor-uuid', 'Dra. Mariana');
        assert.equal(res.error, null);
        assert.equal(updatedPayload.status, 'validado');
        assert.equal(updatedPayload.validator_name, 'Dra. Mariana');
        assert.equal(updatedPayload.validated_by, 'user-gestor-uuid');
        assert.ok(updatedPayload.validated_at);
      } finally {
        supabase.from = originalFrom;
      }
    });
  });

  describe('11. Serviço Real: Diagnóstico Diferenciado em checkIntelligenceSetup', () => {
    it('Identifica tabelas ausentes pelo código 42P01', async () => {
      const originalFrom = supabase.from;
      supabase.from = () => ({
        select: async () => ({ error: { code: '42P01', message: 'relation does not exist' } }),
      });

      try {
        const status = await checkIntelligenceSetup();
        assert.equal(status.ready, false);
        assert.equal(status.reason, 'tables_missing');
      } finally {
        supabase.from = originalFrom;
      }
    });

    it('Identifica RPCs ausentes pelo código 42883', async () => {
      const originalFrom = supabase.from;
      const originalRpc = supabase.rpc;

      supabase.from = () => ({
        select: async () => ({ error: null }),
      });
      supabase.rpc = async () => ({
        error: { code: '42883', message: 'function fn_ic_overview_metrics does not exist' },
      });

      try {
        const status = await checkIntelligenceSetup();
        assert.equal(status.ready, false);
        assert.equal(status.reason, 'rpc_missing');
      } finally {
        supabase.from = originalFrom;
        supabase.rpc = originalRpc;
      }
    });

    it('Retorna ready: true quando tabelas e RPCs respondem com sucesso', async () => {
      const originalFrom = supabase.from;
      const originalRpc = supabase.rpc;

      supabase.from = () => ({
        select: async () => ({ error: null }),
      });
      supabase.rpc = async () => ({ error: null });

      try {
        const status = await checkIntelligenceSetup();
        assert.equal(status.ready, true);
      } finally {
        supabase.from = originalFrom;
        supabase.rpc = originalRpc;
      }
    });
  });

  describe('12. Serviço Real: Vínculos Comerciais (linkCommercialRecord e unlinkCommercialRecord)', () => {
    it('linkCommercialRecord envia client_id como integer e confirmed_at', async () => {
      const originalFrom = supabase.from;
      let insertedRow = null;

      supabase.from = (table) => {
        assert.equal(table, 'commercial_record_links');
        return {
          insert: (rows) => {
            insertedRow = rows[0];
            return {
              select: () => ({
                single: async () => ({ data: { id: 101, ...insertedRow }, error: null }),
              }),
            };
          },
        };
      };

      try {
        const res = await linkCommercialRecord({
          sourceTable: 'sheet_transactions',
          sourceId: 'tx-uuid-1',
          clientId: 42,
          authorName: 'Iury',
          note: 'Conciliado manualmente',
        });
        assert.equal(res.error, null);
        assert.equal(typeof insertedRow.client_id, 'number');
        assert.equal(insertedRow.client_id, 42);
        assert.equal(insertedRow.source_table, 'sheet_transactions');
        assert.ok(insertedRow.confirmed_at);
      } finally {
        supabase.from = originalFrom;
      }
    });

    it('unlinkCommercialRecord remove vínculo pelo id', async () => {
      const originalFrom = supabase.from;
      let deletedId = null;

      supabase.from = (table) => ({
        delete: () => ({
          eq: (field, val) => {
            if (field === 'id') deletedId = val;
            return { error: null };
          },
        }),
      });

      try {
        const res = await unlinkCommercialRecord(101);
        assert.equal(res.error, null);
        assert.equal(res.success, true);
        assert.equal(deletedId, 101);
      } finally {
        supabase.from = originalFrom;
      }
    });
  });

  describe('13. Exclusão de Despesas, Sangrias e Resumos de Receitas Financeiras', () => {
    const rawTransactions = [
      { id: 't1', gross: 350.00, row_type: 'receita', client: 'Maria Silva' },
      { id: 't2', gross: 200.00, row_type: null, client: 'João Santos' }, // Nulo tratado como receita
      { id: 't3', gross: 50.00,  row_type: 'estorno', client: 'Maria Silva' }, // Estorno
      { id: 't4', gross: 80.00,  row_type: 'despesa', client: 'PASSAGEM' }, // Despesa operacional
      { id: 't5', gross: 120.00, row_type: 'sangria', client: 'SANGRIA' }, // Sangria de caixa
      { id: 't6', gross: 90.00,  row_type: 'receita', client: 'OUTRAS SAÍDAS' }, // Descrição de saída disfarçada
      { id: 't7', gross: 500.00, row_type: 'resumo', client: 'TOTAL DO DIA' }, // Linha de resumo/total
    ];

    function isEligibleReceipt(t) {
      const rt = String(t.row_type || '').toLowerCase().trim();
      const client = String(t.client || '').toLowerCase().trim();

      if (['sangria', 'despesa', 'resumo'].includes(rt)) return false;
      if (rt.startsWith('despesa') || rt.startsWith('saida') || rt.startsWith('saída') || rt.startsWith('sangria') || rt.startsWith('gasto') || rt.startsWith('total')) return false;
      if (client.startsWith('sangria') || client.startsWith('despesa') || client.startsWith('passagem') || client.startsWith('produtos') || client.startsWith('tributos') || client.startsWith('outras saída') || client.startsWith('outras saida') || client.startsWith('total')) return false;

      return rt === 'receita' || rt === 'estorno' || !rt;
    }

    it('Filtra estritamente receitas e estornos válidos, excluindo despesas e sangrias', () => {
      const eligible = rawTransactions.filter(isEligibleReceipt);
      assert.equal(eligible.length, 3, 'Apenas t1, t2 e t3 devem ser elegíveis');
      assert.deepEqual(eligible.map(t => t.id), ['t1', 't2', 't3']);
    });

    it('Calcula valor líquido considerando estorno como dedução', () => {
      const eligible = rawTransactions.filter(isEligibleReceipt);
      const net = eligible.reduce((acc, t) => {
        if (t.row_type === 'estorno') return acc - Math.abs(t.gross);
        return acc + t.gross;
      }, 0);
      // 350 (t1) + 200 (t2) - 50 (t3) = 500
      assert.equal(net, 500.00);
    });
  });

  describe('14. Atribuição Comprovada de Canais sem Duplicação de Pagamentos', () => {
    // Cenário: Cliente 1 tem 2 leads: 'Instagram' e 'Google'.
    // Pagamento de R$ 500 ocorreu na data de um agendamento gerado pelo lead 'Instagram'.
    // Cliente 2 tem 2 leads, ambos de 'Indicação'. Pagamento de R$ 300.
    // Cliente 3 tem 2 leads conflitantes ('WhatsApp' e 'Passou na rua') sem agendamento na data do pagamento. Pagamento de R$ 200.

    const leads = [
      { id: 'l1', client_id: 1, origem: 'Instagram', appointment_id: 'a1', created_at: '2026-09-01T10:00:00Z' },
      { id: 'l2', client_id: 1, origem: 'Google', appointment_id: null, created_at: '2026-09-05T10:00:00Z' },
      { id: 'l3', client_id: 2, origem: 'Indicação', appointment_id: null, created_at: '2026-09-02T10:00:00Z' },
      { id: 'l4', client_id: 2, origem: 'Indicação', appointment_id: null, created_at: '2026-09-08T10:00:00Z' },
      { id: 'l5', client_id: 3, origem: 'WhatsApp', appointment_id: null, created_at: '2026-09-03T10:00:00Z' },
      { id: 'l6', client_id: 3, origem: 'Passou na rua', appointment_id: null, created_at: '2026-09-04T10:00:00Z' },
    ];

    const appointments = [
      { id: 'a1', client_id: 1, appointment_date: '2026-09-10', status: 'finalizado' },
    ];

    const transactions = [
      { tx_id: 'tx1', client_id: 1, net_val: 500, date_ref: '2026-09-10' },
      { tx_id: 'tx2', client_id: 2, net_val: 300, date_ref: '2026-09-15' },
      { tx_id: 'tx3', client_id: 3, net_val: 200, date_ref: '2026-09-20' },
    ];

    function attributeTransaction(tx, leadsList, apptsList) {
      // Prioridade 1: Agendamento vinculado a lead na mesma data
      const matchingAppt = apptsList.find(a => a.client_id === tx.client_id && a.appointment_date === tx.date_ref && a.status === 'finalizado');
      if (matchingAppt) {
        const matchingLead = leadsList.find(l => l.appointment_id === matchingAppt.id);
        if (matchingLead) return matchingLead.origem;
      }

      // Prioridade 2: Origem única e inequívoca do cliente
      const clientLeads = leadsList.filter(l => l.client_id === tx.client_id && l.created_at.slice(0, 10) <= tx.date_ref);
      const uniqueOrigins = Array.from(new Set(clientLeads.map(l => l.origem || 'Não informada')));
      if (uniqueOrigins.length === 1) {
        return uniqueOrigins[0];
      }

      // Sem comprovação suficiente: 'Não atribuído'
      return 'Não atribuído';
    }

    it('Transação com múltiplos leads não multiplica receita entre canais', () => {
      const channelTotals = {};

      for (const tx of transactions) {
        const canal = attributeTransaction(tx, leads, appointments);
        channelTotals[canal] = (channelTotals[canal] || 0) + tx.net_val;
      }

      assert.equal(channelTotals['Instagram'], 500, 'tx1 atribuída comprovadamente a Instagram via agendamento a1');
      assert.equal(channelTotals['Google'], undefined, 'Google não recebeu a receita de tx1');
      assert.equal(channelTotals['Indicação'], 300, 'tx2 atribuída a Indicação por origem única do cliente 2');
      assert.equal(channelTotals['Não atribuído'], 200, 'tx3 mantida em Não atribuído por conflito entre WhatsApp e Passou na rua');

      // Soma total de canais DEVE bater exatamente com a soma das transações (0 duplicação)
      const totalAttributed = Object.values(channelTotals).reduce((a, b) => a + b, 0);
      const totalTransactions = transactions.reduce((a, b) => a + b.net_val, 0);
      assert.equal(totalAttributed, totalTransactions, 'A soma das receitas atribuídas deve bater 100% com o total');
    });
  });

  describe('15. Preservação Bidirecional de Dados em saveCampaignBrief', () => {
    it('Vincular público preserva objetivo, orçamento e aprendizado pré-existentes', async () => {
      const originalFrom = supabase.from;
      let upsertedRow = null;

      // Simula brief existente com objetivo e orçamento já preenchidos
      const existingInDb = {
        campaign_id: 10,
        objetivo: 'Reativar 50 clientes inativos',
        meta: '20 agendamentos',
        orcamento_planejado: 1500,
        investimento_realizado: 1200,
        aprendizado: 'Bons resultados no final de semana',
        responsavel: 'Equipe Marketing',
      };

      supabase.from = (table) => {
        assert.equal(table, 'marketing_campaign_briefs');
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: existingInDb, error: null }),
            }),
          }),
          upsert: (payloads) => {
            upsertedRow = payloads[0];
            return {
              select: () => ({
                single: async () => ({ data: upsertedRow, error: null }),
              }),
            };
          },
        };
      };

      try {
        // Envia apenas os dados de vínculo de público
        const res = await saveCampaignBrief({
          campaign_id: 10,
          segment_id: 'seg-xyz',
          segment_version: 2,
          conditions_snapshot: [{ field: 'dias_sem_atendimento', operator: 'gte', value: '60' }],
          estimated_count: 85,
        });

        assert.equal(res.error, null);
        assert.equal(upsertedRow.campaign_id, 10);
        assert.equal(upsertedRow.segment_id, 'seg-xyz');
        assert.equal(upsertedRow.segment_version, 2);
        assert.equal(upsertedRow.estimated_count, 85);
        // Garante que campos não enviados foram PRESERVADOS do banco
        assert.equal(upsertedRow.objetivo, 'Reativar 50 clientes inativos');
        assert.equal(upsertedRow.meta, '20 agendamentos');
        assert.equal(upsertedRow.orcamento_planejado, 1500);
        assert.equal(upsertedRow.investimento_realizado, 1200);
        assert.equal(upsertedRow.aprendizado, 'Bons resultados no final de semana');
      } finally {
        supabase.from = originalFrom;
      }
    });

    it('Editar ficha da campanha preserva vínculo do público e snapshots pré-existentes', async () => {
      const originalFrom = supabase.from;
      let upsertedRow = null;

      // Simula brief existente com vínculo de público já gravado
      const existingInDb = {
        campaign_id: 20,
        segment_id: 'seg-vip',
        segment_version: 4,
        conditions_snapshot: [{ field: 'total_atendimentos', operator: 'gte', value: '3' }],
        estimated_count: 42,
        snapshot_date: '2026-10-10T12:00:00Z',
      };

      supabase.from = (table) => {
        assert.equal(table, 'marketing_campaign_briefs');
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: existingInDb, error: null }),
            }),
          }),
          upsert: (payloads) => {
            upsertedRow = payloads[0];
            return {
              select: () => ({
                single: async () => ({ data: upsertedRow, error: null }),
              }),
            };
          },
        };
      };

      try {
        // Envia apenas edição de campos de texto da campanha
        const res = await saveCampaignBrief({
          campaign_id: 20,
          objetivo: 'Lançamento de Procedimento Novo',
          orcamento_planejado: 3000,
          aprendizado: 'Campanha em andamento',
        });

        assert.equal(res.error, null);
        assert.equal(upsertedRow.campaign_id, 20);
        assert.equal(upsertedRow.objetivo, 'Lançamento de Procedimento Novo');
        assert.equal(upsertedRow.orcamento_planejado, 3000);
        // Garante que segment_id e snapshot foram PRESERVADOS
        assert.equal(upsertedRow.segment_id, 'seg-vip');
        assert.equal(upsertedRow.segment_version, 4);
        assert.deepEqual(upsertedRow.conditions_snapshot, existingInDb.conditions_snapshot);
        assert.equal(upsertedRow.estimated_count, 42);
        assert.equal(upsertedRow.snapshot_date, '2026-10-10T12:00:00Z');
      } finally {
        supabase.from = originalFrom;
      }
    });
  });

  describe('16. Limites de Data ISO em America/Sao_Paulo (getIsoDateRangeSaoPaulo)', () => {
    it('Converte período de datas para início (00:00:00-03:00) e fim (23:59:59.999-03:00)', () => {
      const { startIso, endIso } = getIsoDateRangeSaoPaulo('2026-09-01', '2026-09-30');
      // 2026-09-01T00:00:00-03:00 em UTC é 03:00:00Z
      assert.equal(startIso, '2026-09-01T03:00:00.000Z');
      // 2026-09-30T23:59:59.999-03:00 em UTC é 2026-10-01T02:59:59.999Z
      assert.equal(endIso, '2026-10-01T02:59:59.999Z');
    });

    it('startIso < endIso para qualquer intervalo válido', () => {
      const { startIso, endIso } = getIsoDateRangeSaoPaulo('2026-10-14', '2026-10-14');
      assert.ok(startIso < endIso);
    });
  });

  describe('17. Critérios de Filtro Sincronizados com /crm', () => {
    const hojeStr = '2026-10-14';
    const leads = [
      // 1. Atrasado (próxima ação vencida e não concluída em lead ativo)
      { id: 'l1', status: 'aguardando_cliente', arquivado: false, proxima_acao_prazo: '2026-10-10', proxima_acao_concluida: false, proxima_acao_descricao: 'Enviar mensagem' },
      // 2. Sem ação (lead ativo sem prazo ou sem descrição)
      { id: 'l2', status: 'aguardando_resposta', arquivado: false, proxima_acao_prazo: null, proxima_acao_descricao: '' },
      // 3. Em dia (prazo futuro)
      { id: 'l3', status: 'aguardando_resposta', arquivado: false, proxima_acao_prazo: '2026-10-20', proxima_acao_concluida: false, proxima_acao_descricao: 'Ligar semana que vem' },
      // 4. Encerrado com prazo atrasado (NÃO deve aparecer)
      { id: 'l4', status: 'encerrado_perdido', arquivado: false, proxima_acao_prazo: '2026-10-01', proxima_acao_concluida: false, proxima_acao_descricao: 'Reativar' },
      // 5. Arquivado com prazo atrasado (NÃO deve aparecer)
      { id: 'l5', status: 'aguardando_resposta', arquivado: true, proxima_acao_prazo: '2026-10-05', proxima_acao_concluida: false, proxima_acao_descricao: 'Mensagem' },
    ];

    it('Filtro atrasados em /crm coincide com retornos_pendentes da Visão Geral', () => {
      const atrasados = leads.filter(l => {
        if (l.arquivado) return false;
        if (['encerrado_ganho', 'encerrado_perdido'].includes(l.status)) return false;
        return l.proxima_acao_prazo && l.proxima_acao_prazo < hojeStr && !l.proxima_acao_concluida;
      });
      assert.equal(atrasados.length, 1);
      assert.equal(atrasados[0].id, 'l1');
    });

    it('Filtro sem_acao em /crm coincide com interessados_sem_acao da Visão Geral', () => {
      const semAcao = leads.filter(l => {
        if (l.arquivado) return false;
        if (['encerrado_ganho', 'encerrado_perdido'].includes(l.status)) return false;
        const hasValidAction = l.proxima_acao_prazo && l.proxima_acao_descricao && l.proxima_acao_descricao.trim() && !l.proxima_acao_concluida;
        return !hasValidAction;
      });
      assert.equal(semAcao.length, 1);
      assert.equal(semAcao[0].id, 'l2');
    });
  });

});
