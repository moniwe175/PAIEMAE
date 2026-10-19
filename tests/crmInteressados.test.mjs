import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// ─── Helpers Replicados e Testados ──────────────────────────────

const DEFAULT_FOLLOWUP_DAYS = 2;

function normPhone(tel) {
  if (!tel) return '';
  return tel.replace(/\D/g, '');
}

function getWhatsAppUrl(telefone) {
  const raw = normPhone(telefone);
  if (!raw || raw.length < 10) return null;
  const num = raw.startsWith('55') ? raw : `55${raw}`;
  return `https://wa.me/${num}`;
}

function getInstagramUrl(instagram) {
  const handle = (instagram || '').replace(/^@/, '').trim();
  if (!handle) return null;
  return `https://instagram.com/${encodeURIComponent(handle)}`;
}

function addDaysToSaoPauloDate(days = DEFAULT_FOLLOWUP_DAYS, fromDate = new Date()) {
  const spTime = new Date(fromDate.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  spTime.setDate(spTime.getDate() + days);
  const y = spTime.getFullYear();
  const m = String(spTime.getMonth() + 1).padStart(2, '0');
  const d = String(spTime.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function fmtRelativeTime(ts, nowMs = Date.now()) {
  if (!ts) return '—';
  const diffMs = nowMs - new Date(ts).getTime();
  if (diffMs < 0) return 'agora mesmo';
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'agora mesmo';
  if (diffMin < 60) return `há ${diffMin} min`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `há ${diffHours} ${diffHours === 1 ? 'hora' : 'horas'}`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'ontem';
  if (diffDays < 30) return `há ${diffDays} dias`;
  return new Date(ts).toLocaleDateString('pt-BR');
}

function computeJaRespondiUpdates(lead, userEmail = null, baseDate = new Date()) {
  const hasOpenPendingAction = Boolean(
    lead.proxima_acao_descricao &&
    lead.proxima_acao_descricao.trim() &&
    !lead.proxima_acao_concluida
  );

  const prazoD2 = addDaysToSaoPauloDate(DEFAULT_FOLLOWUP_DAYS, baseDate);
  const responsavelAtribuido = (lead.responsavel && lead.responsavel.trim()) ? lead.responsavel : userEmail;

  return {
    status: 'aguardando_cliente',
    responsavel: responsavelAtribuido,
    proxima_acao_descricao: hasOpenPendingAction ? lead.proxima_acao_descricao : 'Retornar contato',
    proxima_acao_prazo: hasOpenPendingAction ? lead.proxima_acao_prazo : prazoD2,
    proxima_acao_responsavel: lead.proxima_acao_responsavel || responsavelAtribuido,
    proxima_acao_concluida: hasOpenPendingAction ? lead.proxima_acao_concluida : false,
    hasOpenPendingAction,
  };
}

function computeDesfazerUpdates(previousLead) {
  return {
    status: 'aguardando_resposta',
    responsavel: previousLead.responsavel,
    proxima_acao_descricao: previousLead.proxima_acao_descricao,
    proxima_acao_prazo: previousLead.proxima_acao_prazo,
    proxima_acao_responsavel: previousLead.proxima_acao_responsavel,
    proxima_acao_concluida: previousLead.proxima_acao_concluida,
  };
}

// ─── 1. Testes de Tempo Relativo (R1 / AC1.1) ───────────────────

test('fmtRelativeTime: formata tempos relativos adequadamente em pt-BR', () => {
  const base = new Date('2026-10-17T18:00:00Z').getTime();

  // Menos de 1 minuto
  assert.equal(fmtRelativeTime('2026-10-17T17:59:45Z', base), 'agora mesmo');

  // Minutos
  assert.equal(fmtRelativeTime('2026-10-17T17:45:00Z', base), 'há 15 min');
  assert.equal(fmtRelativeTime('2026-10-17T17:01:00Z', base), 'há 59 min');

  // Horas
  assert.equal(fmtRelativeTime('2026-10-17T16:00:00Z', base), 'há 2 horas');
  assert.equal(fmtRelativeTime('2026-10-17T17:00:00Z', base), 'há 1 hora');

  // Ontem (1 dia)
  assert.equal(fmtRelativeTime('2026-10-16T18:00:00Z', base), 'ontem');

  // Dias
  assert.equal(fmtRelativeTime('2026-10-14T18:00:00Z', base), 'há 3 dias');

  // Nulo / vazio
  assert.equal(fmtRelativeTime(null, base), '—');
  assert.equal(fmtRelativeTime('', base), '—');
});

// ─── 2. Testes de Contato (WhatsApp e Instagram - AC1.2) ─────────

test('getWhatsAppUrl: normaliza telefone e cuida de prefixo 55', () => {
  // Telefone formatado sem 55
  assert.equal(getWhatsAppUrl('(11) 98765-4321'), 'https://wa.me/5511987654321');

  // Telefone que já começa com 55
  assert.equal(getWhatsAppUrl('+55 (11) 98765-4321'), 'https://wa.me/5511987654321');
  assert.equal(getWhatsAppUrl('5511987654321'), 'https://wa.me/5511987654321');

  // Telefone inválido ou curto
  assert.equal(getWhatsAppUrl('12345'), null);
  assert.equal(getWhatsAppUrl(''), null);
  assert.equal(getWhatsAppUrl(null), null);
});

test('getInstagramUrl: remove @ e aplica encodeURIComponent no handle', () => {
  assert.equal(getInstagramUrl('@clinica.evelyn'), 'https://instagram.com/clinica.evelyn');
  assert.equal(getInstagramUrl('clinica.evelyn'), 'https://instagram.com/clinica.evelyn');
  assert.equal(getInstagramUrl('@maria_estetica_10'), 'https://instagram.com/maria_estetica_10');
  assert.equal(getInstagramUrl('@ana maria'), 'https://instagram.com/ana%20maria');
  assert.equal(getInstagramUrl(''), null);
  assert.equal(getInstagramUrl(null), null);
});

// ─── 3. Testes de Próxima Ação e D+2 (R3 / AC3.1) ───────────────

test('addDaysToSaoPauloDate: calcula D+2 no fuso de São Paulo', () => {
  const fixedDate = new Date('2026-10-17T12:00:00-03:00');
  const d2 = addDaysToSaoPauloDate(2, fixedDate);
  assert.equal(d2, '2026-10-19');
});

test('R3: Não sobrescreve próxima ação pendente aberta', () => {
  const leadComAcaoAberta = {
    id: 'lead-1',
    status: 'aguardando_resposta',
    responsavel: 'paula@clinica.com',
    proxima_acao_descricao: 'Ligar para confirmar agendamento',
    proxima_acao_prazo: '2026-10-25',
    proxima_acao_responsavel: 'paula@clinica.com',
    proxima_acao_concluida: false,
  };

  const updates = computeJaRespondiUpdates(leadComAcaoAberta, 'atendente@clinica.com');

  assert.equal(updates.status, 'aguardando_cliente');
  assert.equal(updates.proxima_acao_descricao, 'Ligar para confirmar agendamento');
  assert.equal(updates.proxima_acao_prazo, '2026-10-25');
  assert.equal(updates.proxima_acao_responsavel, 'paula@clinica.com');
  assert.equal(updates.proxima_acao_concluida, false);
});

test('R3: Preenche "Retornar contato" em D+2 se não houver ação aberta', () => {
  const leadSemAcao = {
    id: 'lead-2',
    status: 'aguardando_resposta',
    responsavel: null,
    proxima_acao_descricao: null,
    proxima_acao_prazo: null,
    proxima_acao_concluida: false,
  };

  const fixedDate = new Date('2026-10-17T12:00:00-03:00');
  const updates = computeJaRespondiUpdates(leadSemAcao, 'maria@clinica.com', fixedDate);

  assert.equal(updates.status, 'aguardando_cliente');
  assert.equal(updates.proxima_acao_descricao, 'Retornar contato');
  assert.equal(updates.proxima_acao_prazo, '2026-10-19');
  assert.equal(updates.proxima_acao_concluida, false);
  assert.equal(updates.responsavel, 'maria@clinica.com');
});

test('R3: Trata ação já concluída como ausência de ação aberta e define novo Retornar contato', () => {
  const leadComAcaoConcluida = {
    id: 'lead-3',
    status: 'aguardando_resposta',
    responsavel: 'carla@clinica.com',
    proxima_acao_descricao: 'Primeiro contato feito ontem',
    proxima_acao_prazo: '2026-10-16',
    proxima_acao_concluida: true,
  };

  const fixedDate = new Date('2026-10-17T12:00:00-03:00');
  const updates = computeJaRespondiUpdates(leadComAcaoConcluida, 'atendente@clinica.com', fixedDate);

  assert.equal(updates.proxima_acao_descricao, 'Retornar contato');
  assert.equal(updates.proxima_acao_prazo, '2026-10-19');
  assert.equal(updates.proxima_acao_concluida, false);
  // Preserva responsável existente
  assert.equal(updates.responsavel, 'carla@clinica.com');
});

// ─── 4. Testes de Responsável e Autor sem Fallbacks Inventados (AC2.1) ──

test('AC2.1: Preserva responsável existente e atribui email logado se vazio', () => {
  const leadComResp = { status: 'aguardando_resposta', responsavel: 'dr.pedro@clinica.com' };
  const updates1 = computeJaRespondiUpdates(leadComResp, 'recepcao@clinica.com');
  assert.equal(updates1.responsavel, 'dr.pedro@clinica.com');

  const leadSemResp = { status: 'aguardando_resposta', responsavel: '' };
  const updates2 = computeJaRespondiUpdates(leadSemResp, 'atendente@clinica.com');
  assert.equal(updates2.responsavel, 'atendente@clinica.com');

  const leadSemEmail = { status: 'aguardando_resposta', responsavel: null };
  const updates3 = computeJaRespondiUpdates(leadSemEmail, null);
  assert.equal(updates3.responsavel, null, 'NÃO deve inventar fallback textual como Recepção');
});

// ─── 5. Testes de Concorrência e Atualização Condicionada (AC2.2, AC2.3) ──

test('AC2.3: Atualização condicionada detecta colisão quando status já foi alterado', () => {
  // Simula banco com lead já respondido
  const dbState = { id: 'lead-100', status: 'aguardando_cliente' };

  function mockUpdateCrmLead(id, updates, expectedStatus = null) {
    if (expectedStatus && dbState.status !== expectedStatus) {
      return { data: null, error: null, count: 0 };
    }
    Object.assign(dbState, updates);
    return { data: { ...dbState }, error: null, count: 1 };
  }

  // Tentativa 1: lead ainda em aguardando_resposta -> atualiza 1 linha
  dbState.status = 'aguardando_resposta';
  const res1 = mockUpdateCrmLead('lead-100', { status: 'aguardando_cliente' }, 'aguardando_resposta');
  assert.equal(res1.count, 1);
  assert.equal(res1.data.status, 'aguardando_cliente');

  // Tentativa 2 concorrente: outro usuário já respondeu -> 0 linhas afetadas
  const res2 = mockUpdateCrmLead('lead-100', { status: 'aguardando_cliente' }, 'aguardando_resposta');
  assert.equal(res2.count, 0);
  assert.equal(res2.data, null);
});

// ─── 6. Testes da Função Desfazer (Undo) ──────────────────────────

test('Desfazer: reverte status para aguardando_resposta e restaura dados anteriores', () => {
  const leadOriginal = {
    id: 'lead-50',
    status: 'aguardando_resposta',
    responsavel: 'joao@clinica.com',
    proxima_acao_descricao: 'Aguardar retorno sobre valores',
    proxima_acao_prazo: '2026-10-22',
    proxima_acao_responsavel: 'joao@clinica.com',
    proxima_acao_concluida: false,
  };

  const revertPayload = computeDesfazerUpdates(leadOriginal);
  assert.equal(revertPayload.status, 'aguardando_resposta');
  assert.equal(revertPayload.responsavel, 'joao@clinica.com');
  assert.equal(revertPayload.proxima_acao_descricao, 'Aguardar retorno sobre valores');
  assert.equal(revertPayload.proxima_acao_prazo, '2026-10-22');
  assert.equal(revertPayload.proxima_acao_concluida, false);
});

// ─── 7. Testes da Mudança de Marketing.jsx (R4 Substituído) ─────

test('R4 Substituído: Marketing.jsx define aba padrão "instagram" e nova ordem', () => {
  const marketingPath = path.resolve('src/pages/Marketing.jsx');
  const code = fs.readFileSync(marketingPath, 'utf8');

  // Aba padrão inicial deve ser 'instagram'
  assert.match(code, /useState\(['"]instagram['"]\)/, 'Aba padrão inicial deve ser instagram');

  // Verifica ordem das abas no renderizador
  const instagramIndex = code.indexOf("subTab === 'instagram'");
  const insightsIndex = code.indexOf("subTab === 'insights'");
  const campanhasIndex = code.indexOf("subTab === 'campanhas'");
  const ideiasIndex = code.indexOf("subTab === 'ideias'");
  const inteligenciaIndex = code.indexOf("subTab === 'inteligencia'");

  assert.ok(instagramIndex > 0, 'Automação Instagram deve existir');
  assert.ok(insightsIndex > instagramIndex, 'Insights deve vir após Automação');
  assert.ok(campanhasIndex > insightsIndex, 'Campanhas deve vir após Insights');
  assert.ok(ideiasIndex > campanhasIndex, 'Ideias deve vir após Campanhas');
  assert.ok(inteligenciaIndex > ideiasIndex, 'Inteligência deve vir após Ideias');
});

// ─── 8. CRM automático: interface e migração ───────────────────

test('CRM exibe somente as quatro abas automáticas e remove qualificação/status manual', () => {
  const crmPath = path.resolve('src/pages/CrmInteressados.jsx');
  const code = fs.readFileSync(crmPath, 'utf8');

  const tabsBlock = code.slice(code.indexOf('const ABAS'), code.indexOf('const JOURNEY_FILTER_LABELS'));
  assert.match(tabsBlock, /label: 'Responder'/);
  assert.match(tabsBlock, /label: 'Agendados'/);
  assert.match(tabsBlock, /label: 'Atendidos'/);
  assert.match(tabsBlock, /label: 'Perdidos'/);
  assert.doesNotMatch(tabsBlock, /label: 'Hoje'|label: 'Atrasados'|label: 'Todos'/);

  assert.ok(code.includes('Etapa automática · atualizada pela Agenda'));
  assert.ok(code.includes('Corrigir vínculo'));
  assert.ok(!code.includes("activeTab === 'qualificacao'"), 'Bloco manual qual_* não deve ser renderizado');
  assert.ok(!code.includes('handleStatusChange'), 'Status não pode mais ser alterado manualmente');
  assert.ok(!code.includes('Já respondi'), 'Ação não pode escrever status manual');
});

test('migração automática cria função, triggers, histórico e backfill idempotente', () => {
  const migrationPath = path.resolve('crm_agenda_automatic_sync.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');

  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.fn_crm_sync_lead_from_agenda\(p_lead_id uuid\)/i);
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.fn_crm_sync_all_leads_from_agenda\(\)/i);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.fn_crm_sync_all_leads_from_agenda\(\) TO authenticated/i);
  assert.match(sql, /AFTER INSERT ON public\.appointments/i);
  assert.match(sql, /AFTER UPDATE OF status, client_id, client_phone, appointment_date, appointment_time/i);
  assert.match(sql, /v_duplicate_leads = 1/i, 'Telefone duplicado não pode ser vinculado automaticamente');
  assert.match(sql, /status = v_new_status/i);
  assert.match(sql, /appointment_id = v_new_appointment_id/i);
  assert.match(sql, /'sincronizacao_automatica_agenda'/i);
  assert.match(sql, /FOR v_lead_id IN SELECT id FROM public\.crm_leads/i, 'Deve recalcular leads existentes');
  assert.doesNotMatch(sql, /CREATE POLICY|DROP POLICY|ENABLE ROW LEVEL SECURITY/i, 'Migração não deve alterar RLS');

  const service = fs.readFileSync(path.resolve('src/services/supabaseService.js'), 'utf8');
  const crmFetch = service.slice(service.indexOf('export async function fetchCrmLeads'), service.indexOf('export async function insertCrmLead'));
  assert.match(crmFetch, /rpc\('fn_crm_sync_all_leads_from_agenda'\)/i, 'Abrir o CRM deve aplicar também a regra temporal de 30 dias');
});
