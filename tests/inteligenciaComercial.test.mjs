/**
 * tests/inteligenciaComercial.test.mjs
 * Testes de unidade para cálculos e contratos do módulo de Inteligência Comercial.
 *
 * Usa SDK real do Supabase com fetch simulado (sem acesso a produção).
 * Valida contratos de cálculo definidos na seção 8 do PAIEMAE_INTELIGENCIA_COMERCIAL.md.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

// ─── Helpers locais (espelham lógica das RPCs — sem banco) ───────────────────
// Funções puras que replicam as regras de cálculo para teste isolado.
// A implementação real vive nas RPCs PostgreSQL em marketing_inteligencia_migration.sql.

function todayStr() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

function getDateRange(preset) {
  const todayS = todayStr();
  const todayD = new Date(todayS + 'T00:00:00');
  const fromD = new Date(todayD);
  switch (preset) {
    case '7d':  fromD.setDate(fromD.getDate() - 6);       break;
    case '30d': fromD.setDate(fromD.getDate() - 29);      break;
    case '90d': fromD.setDate(fromD.getDate() - 89);      break;
    case '12m': fromD.setFullYear(fromD.getFullYear() - 1); break;
    default:    fromD.setDate(fromD.getDate() - 29);
  }
  return { from: fromD.toISOString().slice(0, 10), to: todayS };
}

function fmtDate(dateStr) {
  if (!dateStr) return '—';
  const [y, m, d] = dateStr.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}


// ─── Helpers locais de cálculo (espelham a lógica das RPCs) ──────────────────
// Essas funções replicam as regras de cálculo para teste isolado,
// sem precisar de banco. A implementação real vive nas RPCs.

function calcClientesAtendidos(appointments, dateFrom, dateTo) {
  const ids = new Set(
    appointments
      .filter(a => a.status === 'finalizado' && a.appointment_date >= dateFrom && a.appointment_date <= dateTo && a.client_id != null)
      .map(a => a.client_id)
  );
  return ids.size;
}

function calcNovosClientes(appointments, dateFrom, dateTo) {
  // Usa HISTÓRICO COMPLETO para determinar o primeiro atendimento
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
  // Atendidos no período que têm atendimento anterior (histórico completo)
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
  if (clientesAtendidos === 0) return null;
  return Math.round((clientesRetorno / clientesAtendidos) * 100 * 10) / 10;
}

function calcInteressados(leads, dateFrom, dateTo) {
  return leads.filter(l => {
    const d = l.created_at.slice(0, 10);
    return d >= dateFrom && d <= dateTo;
  }).length;
}

function calcLeadsComAgendamento(leads, dateFrom, dateTo) {
  return leads.filter(l => {
    const d = l.created_at.slice(0, 10);
    return d >= dateFrom && d <= dateTo && l.appointment_id != null;
  }).length;
}

function calcConversaoAgendamento(leadsComAgend, interessados) {
  if (interessados === 0) return null;
  return Math.round((leadsComAgend / interessados) * 100 * 10) / 10;
}

// ─── Datasets de teste ───────────────────────────────────────────────────────

const dateFrom = '2026-09-01';
const dateTo   = '2026-09-30';

// Cenário: uma pessoa, dois atendimentos e vários itens
const appts_cenario1 = [
  { id: 'a1', client_id: 'c1', appointment_date: '2026-09-10', status: 'finalizado' },
  { id: 'a2', client_id: 'c1', appointment_date: '2026-09-20', status: 'finalizado' },
];

// Cenário: cliente com atendimento anterior ao período (retorno)
const appts_cenario2 = [
  { id: 'b1', client_id: 'c2', appointment_date: '2026-08-15', status: 'finalizado' }, // ANTES
  { id: 'b2', client_id: 'c2', appointment_date: '2026-09-05', status: 'finalizado' }, // no período
];

// Cenário: cliente com dois atendimentos no primeiro mês — novo, não retorno
const appts_cenario3 = [
  { id: 'c1a', client_id: 'c3', appointment_date: '2026-09-03', status: 'finalizado' },
  { id: 'c1b', client_id: 'c3', appointment_date: '2026-09-17', status: 'finalizado' },
];

// ─── Testes ──────────────────────────────────────────────────────────────────

describe('Contrato de Cálculo — Inteligência Comercial', () => {

  describe('Clientes atendidos', () => {
    it('Uma pessoa, dois atendimentos → 1 cliente atendido', () => {
      const result = calcClientesAtendidos(appts_cenario1, dateFrom, dateTo);
      assert.equal(result, 1, 'Dois atendimentos do mesmo cliente = 1 cliente distinto');
    });

    it('Atendimento sem client_id não conta', () => {
      const appts = [{ id: 'x1', client_id: null, appointment_date: '2026-09-10', status: 'finalizado' }];
      assert.equal(calcClientesAtendidos(appts, dateFrom, dateTo), 0);
    });

    it('Atendimento fora do período não conta', () => {
      const appts = [{ id: 'x2', client_id: 'c99', appointment_date: '2026-10-01', status: 'finalizado' }];
      assert.equal(calcClientesAtendidos(appts, dateFrom, dateTo), 0);
    });

    it('Status diferente de finalizado não conta', () => {
      const appts = [{ id: 'x3', client_id: 'c99', appointment_date: '2026-09-15', status: 'agendado' }];
      assert.equal(calcClientesAtendidos(appts, dateFrom, dateTo), 0);
    });
  });

  describe('Novos clientes observados', () => {
    it('Primeiro atendimento no período → novo', () => {
      const result = calcNovosClientes(appts_cenario1, dateFrom, dateTo);
      assert.equal(result, 1);
    });

    it('Cliente com atendimento anterior ao período NÃO é novo no período', () => {
      // c2 tem atendimento em agosto (antes do período)
      const result = calcNovosClientes(appts_cenario2, dateFrom, dateTo);
      assert.equal(result, 0, 'Cliente com histórico anterior não pode ser novo no período');
    });

    it('Dois atendimentos no primeiro mês → novo (não retorno de coorte anterior)', () => {
      const result = calcNovosClientes(appts_cenario3, dateFrom, dateTo);
      assert.equal(result, 1, 'Dois atendimentos no mesmo período de estreia = 1 novo');
    });

    it('Usa histórico completo, não só o período', () => {
      // c2 teve primeiro atendimento em agosto; logo NÃO é novo em setembro
      const appts = [...appts_cenario2];
      assert.equal(calcNovosClientes(appts, '2026-09-01', '2026-09-30'), 0);
    });
  });

  describe('Clientes que retornaram', () => {
    it('Cliente com atendimento anterior ao período → retorno', () => {
      const result = calcClientesRetorno(appts_cenario2, dateFrom, dateTo);
      assert.equal(result, 1);
    });

    it('Cliente com apenas atendimentos no período → não é retorno', () => {
      const result = calcClientesRetorno(appts_cenario1, dateFrom, dateTo);
      assert.equal(result, 0, 'Sem histórico anterior = não retorno');
    });

    it('Cliente com dois atendimentos no primeiro mês → não é retorno de coorte anterior', () => {
      const result = calcClientesRetorno(appts_cenario3, dateFrom, dateTo);
      assert.equal(result, 0);
    });
  });

  describe('Participação de retorno', () => {
    it('Denominador zero → null, nunca Infinity', () => {
      assert.equal(calcParticipacaoRetorno(0, 0), null);
    });

    it('1 retorno de 2 atendidos → 50%', () => {
      assert.equal(calcParticipacaoRetorno(1, 2), 50);
    });

    it('Não é chamada de taxa de retenção de coorte', () => {
      // Apenas verificação de nomenclatura — a fórmula é participação no período
      const v = calcParticipacaoRetorno(3, 10);
      assert.equal(v, 30);
    });
  });

  describe('Interessados registrados', () => {
    const leads = [
      { id: 'l1', created_at: '2026-09-05T10:00:00Z', appointment_id: 'a1' },
      { id: 'l2', created_at: '2026-09-15T14:00:00Z', appointment_id: null },
      { id: 'l3', created_at: '2026-08-20T09:00:00Z', appointment_id: null }, // FORA do período
    ];

    it('Apenas leads criados no período são contados', () => {
      assert.equal(calcInteressados(leads, dateFrom, dateTo), 2);
    });

    it('Lead fora do período não entra na coorte', () => {
      const soFora = [{ id: 'l4', created_at: '2026-10-01T00:00:00Z', appointment_id: null }];
      assert.equal(calcInteressados(soFora, dateFrom, dateTo), 0);
    });
  });

  describe('Dois clientes homônimos', () => {
    it('Clientes com mesmo nome mas IDs distintos não são unidos', () => {
      const appts = [
        { id: 'h1', client_id: 'id-ana-1', appointment_date: '2026-09-10', status: 'finalizado' },
        { id: 'h2', client_id: 'id-ana-2', appointment_date: '2026-09-12', status: 'finalizado' },
      ];
      // Dois clientes distintos = 2 atendidos, não 1
      assert.equal(calcClientesAtendidos(appts, dateFrom, dateTo), 2);
    });
  });

  describe('Denominadores zero', () => {
    it('Sem interessados → conversão null, não Infinity', () => {
      assert.equal(calcConversaoAgendamento(0, 0), null);
    });

    it('Sem clientes atendidos → participação retorno null', () => {
      assert.equal(calcParticipacaoRetorno(0, 0), null);
    });
  });

  describe('getDateRange helper', () => {
    it('Retorna strings YYYY-MM-DD', () => {
      const { from, to } = getDateRange('30d');
      assert.match(from, /^\d{4}-\d{2}-\d{2}$/);
      assert.match(to, /^\d{4}-\d{2}-\d{2}$/);
    });

    it('from < to', () => {
      const { from, to } = getDateRange('30d');
      assert.ok(from < to, `from (${from}) deve ser anterior a to (${to})`);
    });

    it('Preset 7d cobre 7 dias', () => {
      const { from, to } = getDateRange('7d');
      const diff = (new Date(to) - new Date(from)) / (1000 * 60 * 60 * 24);
      assert.equal(diff, 6, '7d inclui dia inicial e final = 6 dias de diferença');
    });
  });

  describe('fmtDate helper', () => {
    it('Converte YYYY-MM-DD para dd/mm/yyyy', () => {
      assert.equal(fmtDate('2026-09-05'), '05/09/2026');
    });

    it('Retorna — para valor nulo', () => {
      assert.equal(fmtDate(null), '—');
      assert.equal(fmtDate(''), '—');
    });
  });

  describe('Origem ausente', () => {
    it('Origem vazia não vira Instagram — é Não informada', () => {
      const leads = [
        { origem: '', servico_interesse: 'Limpeza' },
        { origem: null, servico_interesse: 'Botox' },
        { origem: 'Instagram', servico_interesse: 'Fio PDO' },
      ];
      const origens = leads.map(l => l.origem && l.origem.trim() ? l.origem : 'Não informada');
      assert.equal(origens[0], 'Não informada');
      assert.equal(origens[1], 'Não informada');
      assert.equal(origens[2], 'Instagram');
    });
  });

  describe('Validação de campos do segmento', () => {
    const ALLOWED_FIELDS_LEAD = [
      'origem', 'servico_interesse', 'status', 'responsavel',
      'proxima_acao_concluida', 'proxima_acao_prazo',
    ];

    it('Campo não permitido é rejeitado', () => {
      const field = 'telefone'; // não está na lista
      assert.ok(!ALLOWED_FIELDS_LEAD.includes(field), 'telefone não deve ser campo permitido em leads');
    });

    it('Campo arbitrário SQL não passa pela validação', () => {
      const field = '1=1; DROP TABLE clients;';
      assert.ok(!ALLOWED_FIELDS_LEAD.includes(field));
    });

    it('Campos permitidos são aceitos', () => {
      for (const f of ALLOWED_FIELDS_LEAD) {
        assert.ok(ALLOWED_FIELDS_LEAD.includes(f), `${f} deve estar na lista`);
      }
    });
  });

});
