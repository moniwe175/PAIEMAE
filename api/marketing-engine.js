// ============================================================================
// api/marketing-engine.js — MOTOR DE MARKETING NA NUVEM (Vercel serverless)
// ----------------------------------------------------------------------------
// Substitui o Python local (marketing_engine/). Roda via pg_cron + pg_net
// (ver marketing_engine_cloud_cron.sql) a cada 30 min, em duas metades
// (?half=1 e ?half=2) para caber no limite de 10s do plano Hobby da Vercel.
//
// MESMAS REGRAS do rules.py:
//  * ZERO texto fixo — templates vêm de message_templates ({{tags}}).
//  * Grupo A → 'approved' | Grupo B → 'pending'.
//  * already_queued() = idempotência (nunca duplica disparo).
//  * Fuso da clínica (America/Sao_Paulo) para datas/janelas de hora.
//  * Auditoria por ciclo em marketing_log.
// ============================================================================

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ecwizjyflxcickbfzhcp.supabase.co';
// Chave service_role (a mesma já embutida no INICIAR_SISTEMA_MARKETING.bat).
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVjd2l6anlmbHhjaWNrYmZ6aGNwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzQwMDA4NSwiZXhwIjoyMDkyOTc2MDg1fQ.DzUFVGW4kxQrKQABHw6s02JJxWDYrGxH0hzLFOQ0YZE';

const TZ = 'America/Sao_Paulo';
const DAY_MS = 86400000;
const HOUR_MS = 3600000;

// Configurações (espelho de config/settings.py)
const NPS_DIAS_APOS_CONSULTA = 3;
const CROSSSELL_DIAS_APOS = 14;
const CANCELAMENTO_DIAS = 3;

// Vocabulário de status (o que o site grava + legados em inglês)
const STATUS_ATIVOS = ['aguardando_confirmacao', 'agendado', 'confirmado', 'em_atendimento', 'scheduled', 'confirmed'];
const STATUS_CONCLUIDO = ['finalizado', 'completed'];
const STATUS_NOSHOW = ['cliente_faltou', 'falta', 'no_show'];
const STATUS_CANCELADO = ['cancelado', 'cancelled'];
const STATUS_CLIENTE_ATIVO = ['ativo', 'active'];

// ─── Fuso horário ───────────────────────────────────────────────────────────
// wallNow(): "agora" no relógio de parede da clínica, em ms (pseudo-UTC),
// comparável com apptWall(data, hora) dos agendamentos (texto local).
function wallNow() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).formatToParts(new Date());
  const g = (t) => parts.find((p) => p.type === t).value;
  let h = g('hour');
  if (h === '24') h = '00';
  return Date.UTC(+g('year'), +g('month') - 1, +g('day'), +h, +g('minute'), +g('second'));
}
const isoDay = (ms) => new Date(ms).toISOString().slice(0, 10);
const clinicToday = () => isoDay(wallNow());
const daysFromToday = (n) => isoDay(wallNow() + n * DAY_MS);

function apptWall(dateStr, timeStr) {
  const [y, m, d] = String(dateStr || '').slice(0, 10).split('-').map(Number);
  const [hh, mm] = String(timeStr || '00:00').slice(0, 5).split(':').map(Number);
  if (!y || !m || !d) return null;
  return Date.UTC(y, m - 1, d, hh || 0, mm || 0);
}

// ─── Helpers ────────────────────────────────────────────────────────────────
function render(templateText, tags) {
  let out = templateText;
  for (const [k, v] of Object.entries(tags)) {
    out = out.split(`{{${k}}}`).join(v === null || v === undefined ? '' : String(v));
  }
  return out;
}

async function getTemplate(db, toolId) {
  const { data } = await db
    .from('message_templates')
    .select('tool_id, tool_name, group_type, template_text, active')
    .eq('tool_id', toolId)
    .maybeSingle();
  if (!data || !data.active) return null;
  return data;
}

async function getConfig(db, key, def = '') {
  try {
    const { data } = await db.from('integration_configs').select('value').eq('key', key).maybeSingle();
    return data?.value ?? def;
  } catch {
    return def;
  }
}

async function alreadyQueued(db, clientId, toolId, windowHours = 24) {
  const cutoff = new Date(Date.now() - windowHours * HOUR_MS).toISOString();
  const { data } = await db
    .from('marketing_queue')
    .select('id')
    .eq('client_id', clientId)
    .eq('tool_id', toolId)
    .gte('created_at', cutoff)
    .in('status', ['pending', 'approved', 'sent']);
  return (data || []).length > 0;
}

async function isEngineEnabled(db) {
  try {
    const { data } = await db.from('marketing_engine_settings').select('enabled').eq('id', 1).maybeSingle();
    return data ? data.enabled !== false : true;
  } catch {
    return true;
  }
}

const firstName = (n) => String(n || '').split(' ')[0];
const hhmm = (t) => String(t || '').slice(0, 5);

function entry(appt, tmpl, group, tags, extra = {}) {
  return {
    client_id: appt.client_id ?? appt.id,
    client_name: appt.client_name ?? appt.name,
    client_phone: appt.client_phone ?? appt.phone,
    tool_id: tmpl.tool_id,
    tool_name: tmpl.tool_name,
    group_type: group,
    message_text: render(tmpl.template_text, tags),
    status: group === 'A' ? 'approved' : 'pending',
    scheduled_at: new Date().toISOString(),
    context_data: extra.context || {},
    ...(extra.expiresAtMs ? { expires_at: new Date(extra.expiresAtMs).toISOString() } : {}),
    ...(extra.appointmentId ? { appointment_id: extra.appointmentId } : {}),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// GRUPO A — 11 ferramentas automáticas
// ═══════════════════════════════════════════════════════════════════════════

async function tool_01_lembrete_24h(db) {
  const tmpl = await getTemplate(db, 1);
  if (!tmpl) return [];
  const tomorrow = daysFromToday(1);
  const { data } = await db.from('appointments')
    .select('id, client_id, client_name, client_phone, appointment_date, appointment_time, procedure, professional')
    .eq('appointment_date', tomorrow).in('status', STATUS_ATIVOS);

  const out = [];
  for (const a of data || []) {
    if (!a.client_id || !a.client_phone) continue;
    if (await alreadyQueued(db, a.client_id, 1)) continue;
    out.push(entry(a, tmpl, 'A', {
      nome_paciente: a.client_name || '',
      nome_profissional: a.professional || 'nossa equipe',
      hora_consulta: hhmm(a.appointment_time),
      data_consulta: a.appointment_date || '',
    }, { appointmentId: a.id }));
  }
  return out;
}

async function tool_02_lembrete_2h(db) {
  const tmpl = await getTemplate(db, 2);
  if (!tmpl) return [];
  const now = wallNow();
  const start = now + HOUR_MS + 55 * 60000;
  const end = now + 2 * HOUR_MS + 5 * 60000;
  const today = clinicToday();
  const { data } = await db.from('appointments')
    .select('id, client_id, client_name, client_phone, appointment_time, procedure, professional')
    .eq('appointment_date', today).in('status', STATUS_ATIVOS);

  const out = [];
  for (const a of data || []) {
    if (!a.client_id || !a.appointment_time) continue;
    const dt = apptWall(today, a.appointment_time);
    if (dt === null || dt < start || dt > end) continue;
    if (await alreadyQueued(db, a.client_id, 2, 4)) continue;
    out.push(entry(a, tmpl, 'A', {
      nome_paciente: a.client_name || '',
      nome_profissional: a.professional || 'nossa equipe',
      hora_consulta: hhmm(a.appointment_time),
    }, { appointmentId: a.id }));
  }
  return out;
}

async function tool_03_alerta_atraso_15min(db) {
  const tmpl = await getTemplate(db, 3);
  if (!tmpl) return [];
  const now = wallNow();
  const start = now - 20 * 60000;
  const end = now - 10 * 60000;
  const today = clinicToday();
  const { data } = await db.from('appointments')
    .select('id, client_id, client_name, client_phone, appointment_time, professional')
    .eq('appointment_date', today).in('status', STATUS_ATIVOS);

  const out = [];
  for (const a of data || []) {
    if (!a.client_id || !a.appointment_time) continue;
    const dt = apptWall(today, a.appointment_time);
    if (dt === null || dt < start || dt > end) continue;
    if (await alreadyQueued(db, a.client_id, 3, 2)) continue;
    out.push(entry(a, tmpl, 'A', {
      nome_paciente: a.client_name || '',
      hora_consulta: hhmm(a.appointment_time),
    }, { appointmentId: a.id, expiresAtMs: dt + HOUR_MS })); // Regra de Vencimento
  }
  return out;
}

async function tool_04_no_show_24h(db) {
  const tmpl = await getTemplate(db, 4);
  if (!tmpl) return [];
  const yesterday = daysFromToday(-1);
  const { data } = await db.from('appointments')
    .select('id, client_id, client_name, client_phone, appointment_time')
    .eq('appointment_date', yesterday).in('status', STATUS_NOSHOW);

  const out = [];
  for (const a of data || []) {
    if (!a.client_id) continue;
    if (await alreadyQueued(db, a.client_id, 4)) continue;
    out.push(entry(a, tmpl, 'A', {
      nome_paciente: a.client_name || '',
      hora_consulta: hhmm(a.appointment_time),
    }, { appointmentId: a.id }));
  }
  return out;
}

async function tool_05_aniversario(db) {
  const tmpl = await getTemplate(db, 5);
  if (!tmpl) return [];
  const today = clinicToday();
  const month = today.slice(5, 7);
  const day = today.slice(8, 10);
  const { data } = await db.from('clients')
    .select('id, name, phone, birthdate')
    .in('status', STATUS_CLIENTE_ATIVO)
    .not('birthdate', 'is', null)
    .eq('whatsapp_opt_out', false);

  const out = [];
  for (const c of data || []) {
    const bd = String(c.birthdate || '').slice(0, 10);
    if (bd.length < 10 || bd.slice(5, 7) !== month || bd.slice(8, 10) !== day) continue;
    if (!c.phone) continue;
    if (await alreadyQueued(db, c.id, 5)) continue;
    out.push(entry(c, tmpl, 'A', { nome_paciente: firstName(c.name) }));
  }
  return out;
}

async function tool_06_boas_vindas(db) {
  const tmpl = await getTemplate(db, 6);
  if (!tmpl) return [];
  const linkGoogle = await getConfig(db, 'google_review_link');
  const cutoff = new Date(Date.now() - 2 * HOUR_MS).toISOString();
  const { data } = await db.from('appointments')
    .select('id, client_id, client_name, client_phone')
    .in('status', STATUS_CONCLUIDO).gte('updated_at', cutoff);

  const out = [];
  for (const a of data || []) {
    if (!a.client_id) continue;
    const { count } = await db.from('appointments')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', a.client_id).in('status', STATUS_CONCLUIDO);
    if (count !== 1) continue;
    if (await alreadyQueued(db, a.client_id, 6)) continue;
    out.push(entry(a, tmpl, 'A', {
      nome_paciente: firstName(a.client_name),
      link_google: linkGoogle,
    }, { appointmentId: a.id }));
  }
  return out;
}

async function tool_07_confirmacao_agendamento(db) {
  const tmpl = await getTemplate(db, 7);
  if (!tmpl) return [];
  const cutoff = new Date(Date.now() - 30 * 60000).toISOString();
  const { data } = await db.from('appointments')
    .select('id, client_id, client_name, client_phone, appointment_date, appointment_time, procedure, professional')
    .gte('created_at', cutoff).in('status', STATUS_ATIVOS);

  const out = [];
  for (const a of data || []) {
    if (!a.client_id) continue;
    if (await alreadyQueued(db, a.client_id, 7, 1)) continue;
    out.push(entry(a, tmpl, 'A', {
      nome_paciente: firstName(a.client_name),
      nome_servico: a.procedure || 'procedimento',
      nome_profissional: a.professional || 'nossa equipe',
      data_consulta: a.appointment_date || '',
      hora_consulta: hhmm(a.appointment_time),
    }, { appointmentId: a.id }));
  }
  return out;
}

async function tool_08_pre_procedimento(db) {
  const tmpl = await getTemplate(db, 8);
  if (!tmpl) return [];
  const { data: srv } = await db.from('servicos').select('nome').eq('exige_preparo', true).eq('ativo', true);
  const nomes = new Set((srv || []).map((s) => String(s.nome).toLowerCase()));
  if (!nomes.size) return [];

  const tomorrow = daysFromToday(1);
  const { data } = await db.from('appointments')
    .select('id, client_id, client_name, client_phone, appointment_time, procedure, professional')
    .eq('appointment_date', tomorrow).in('status', STATUS_ATIVOS);

  const out = [];
  for (const a of data || []) {
    if (!a.client_id) continue;
    if (!nomes.has(String(a.procedure || '').toLowerCase())) continue;
    if (await alreadyQueued(db, a.client_id, 8)) continue;
    out.push(entry(a, tmpl, 'A', {
      nome_paciente: firstName(a.client_name),
      nome_servico: a.procedure || 'procedimento',
    }, { appointmentId: a.id }));
  }
  return out;
}

async function tool_09_pos_procedimento(db) {
  const tmpl = await getTemplate(db, 9);
  if (!tmpl) return [];
  const { data: srv } = await db.from('servicos').select('nome').eq('exige_pos_procedimento', true).eq('ativo', true);
  const nomes = new Set((srv || []).map((s) => String(s.nome).toLowerCase()));
  if (!nomes.size) return [];

  const yesterday = daysFromToday(-1);
  const { data } = await db.from('appointments')
    .select('id, client_id, client_name, client_phone, procedure')
    .eq('appointment_date', yesterday).in('status', STATUS_CONCLUIDO);

  const out = [];
  for (const a of data || []) {
    if (!a.client_id) continue;
    if (!nomes.has(String(a.procedure || '').toLowerCase())) continue;
    if (await alreadyQueued(db, a.client_id, 9)) continue;
    out.push(entry(a, tmpl, 'A', {
      nome_paciente: firstName(a.client_name),
      nome_servico: a.procedure || 'procedimento',
    }, { appointmentId: a.id }));
  }
  return out;
}

async function tool_10_lembrete_exames(db) {
  const tmpl = await getTemplate(db, 10);
  if (!tmpl) return [];
  const tomorrow = daysFromToday(1);
  const { data } = await db.from('appointments')
    .select('id, client_id, client_name, client_phone')
    .eq('appointment_date', tomorrow).eq('exames_pendentes', true).in('status', STATUS_ATIVOS);

  const out = [];
  for (const a of data || []) {
    if (!a.client_id) continue;
    if (await alreadyQueued(db, a.client_id, 10, 24 * 7)) continue;
    out.push(entry(a, tmpl, 'A', { nome_paciente: firstName(a.client_name) }, { appointmentId: a.id }));
  }
  return out;
}

async function tool_11_nps(db) {
  const tmpl = await getTemplate(db, 11);
  if (!tmpl) return [];
  const target = daysFromToday(-NPS_DIAS_APOS_CONSULTA);
  const { data } = await db.from('appointments')
    .select('id, client_id, client_name, client_phone')
    .eq('appointment_date', target).in('status', STATUS_CONCLUIDO);

  const out = [];
  for (const a of data || []) {
    if (!a.client_id) continue;
    if (await alreadyQueued(db, a.client_id, 11, 24 * 7)) continue;
    out.push(entry(a, tmpl, 'A', { nome_paciente: firstName(a.client_name) }, { appointmentId: a.id }));
  }
  return out;
}

// ═══════════════════════════════════════════════════════════════════════════
// GRUPO B — 8 ferramentas com revisão humana
// ═══════════════════════════════════════════════════════════════════════════

async function tool_12_recuperacao_orcamento(db) {
  const tmpl = await getTemplate(db, 12);
  if (!tmpl) return [];
  const cutoff = daysFromToday(-7);
  let orcs;
  try {
    const r = await db.from('orcamentos').select('id, client_id, servico_id, created_at')
      .eq('status', 'pendente').lte('created_at', cutoff);
    orcs = r.data || [];
  } catch {
    return []; // tabela 'orcamentos' ainda não existe — ferramenta pausada
  }

  const out = [];
  for (const o of orcs) {
    if (!o.client_id) continue;
    if (await alreadyQueued(db, o.client_id, 12, 24 * 7)) continue;

    let nomeServico = 'o procedimento';
    if (o.servico_id) {
      const { data: s } = await db.from('servicos').select('nome').eq('id', o.servico_id).maybeSingle();
      if (s?.nome) nomeServico = s.nome;
    }
    const { data: cli } = await db.from('clients').select('name, phone').eq('id', o.client_id).maybeSingle();
    if (!cli?.phone) continue;

    out.push(entry({ client_id: o.client_id, client_name: cli.name, client_phone: cli.phone }, tmpl, 'B', {
      nome_paciente: firstName(cli.name),
      nome_servico: nomeServico,
    }, { context: { orcamento_id: o.id, servico: nomeServico } }));
  }
  return out;
}

async function inativos(db, tmplId, dias, windowHours) {
  const tmpl = await getTemplate(db, tmplId);
  if (!tmpl) return [];
  const fim = daysFromToday(-dias);
  const ini = daysFromToday(-(dias + 1));
  const { data } = await db.from('clients')
    .select('id, name, phone, last_visit')
    .in('status', STATUS_CLIENTE_ATIVO)
    .lte('last_visit', fim).gte('last_visit', ini)
    .not('phone', 'is', null)
    .eq('whatsapp_opt_out', false);

  const out = [];
  for (const c of data || []) {
    if (await alreadyQueued(db, c.id, tmplId, windowHours)) continue;
    out.push(entry(c, tmpl, 'B', { nome_paciente: firstName(c.name) },
      { context: { last_visit: c.last_visit, dias_inativo: dias } }));
  }
  return out;
}
const tool_13_inativo_30d = (db) => inativos(db, 13, 30, 24 * 30);
const tool_14_inativo_90d = (db) => inativos(db, 14, 90, 24 * 90);

async function tool_15_pacote_proximo_fim(db) {
  const tmpl = await getTemplate(db, 15);
  if (!tmpl) return [];
  const { data: servicos } = await db.from('servicos')
    .select('id, nome, sessoes_pacote').not('sessoes_pacote', 'is', null).eq('ativo', true);

  const out = [];
  for (const s of servicos || []) {
    const total = s.sessoes_pacote;
    const { data: appts } = await db.from('appointments')
      .select('client_id, client_name, client_phone')
      .eq('procedure', s.nome).in('status', STATUS_CONCLUIDO);

    const porCliente = {};
    for (const a of appts || []) {
      if (!a.client_id) continue;
      porCliente[a.client_id] = porCliente[a.client_id] || { count: 0, ...a };
      porCliente[a.client_id].count += 1;
    }

    for (const [cid, d] of Object.entries(porCliente)) {
      const restantes = total - d.count;
      if (restantes < 1 || restantes > 2) continue;
      if (!d.client_phone) continue;
      if (await alreadyQueued(db, cid, 15, 24 * 30)) continue;
      out.push(entry({ client_id: cid, client_name: d.client_name, client_phone: d.client_phone }, tmpl, 'B', {
        nome_paciente: firstName(d.client_name),
        nome_servico: s.nome,
        sessoes_restantes: restantes,
      }, { context: { servico: s.nome, sessoes_restantes: restantes, sessoes_total: total } }));
    }
  }
  return out;
}

async function tool_16_retorno_inteligente(db) {
  const tmpl = await getTemplate(db, 16);
  if (!tmpl) return [];
  const { data: servicos } = await db.from('servicos')
    .select('nome, dias_para_retorno').not('dias_para_retorno', 'is', null).eq('ativo', true);

  const out = [];
  for (const s of servicos || []) {
    const dias = s.dias_para_retorno;
    const target = daysFromToday(-dias);
    const { data: appts } = await db.from('appointments')
      .select('id, client_id, client_name, client_phone, procedure')
      .eq('appointment_date', target).in('status', STATUS_CONCLUIDO)
      .ilike('procedure', s.nome);

    for (const a of appts || []) {
      if (!a.client_id) continue;
      if (await alreadyQueued(db, a.client_id, 16, 24 * 30)) continue;
      out.push(entry(a, tmpl, 'B', {
        nome_paciente: firstName(a.client_name),
        nome_servico: a.procedure || s.nome,
        dias_retorno: String(dias),
      }, { appointmentId: a.id, context: { servico: s.nome, dias_retorno: dias, data_base: target } }));
    }
  }
  return out;
}

async function tool_17_recuperacao_cancelamento(db) {
  const tmpl = await getTemplate(db, 17);
  if (!tmpl) return [];
  const dias = CANCELAMENTO_DIAS;
  const fim = daysFromToday(-dias);
  const ini = daysFromToday(-(dias + 1));
  const { data } = await db.from('appointments')
    .select('id, client_id, client_name, client_phone')
    .in('status', STATUS_CANCELADO)
    .lte('appointment_date', fim).gte('appointment_date', ini);

  const out = [];
  for (const a of data || []) {
    if (!a.client_id) continue;
    const { count } = await db.from('appointments')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', a.client_id).gte('created_at', new Date(wallNow() - (dias + 1) * DAY_MS).toISOString())
      .in('status', STATUS_ATIVOS);
    if (count > 0) continue; // reagendou depois do cancelamento
    if (await alreadyQueued(db, a.client_id, 17, 24 * dias)) continue;
    out.push(entry(a, tmpl, 'B', { nome_paciente: firstName(a.client_name) }, { appointmentId: a.id }));
  }
  return out;
}

async function tool_18_upgrade_crosssell(db) {
  const tmpl = await getTemplate(db, 18);
  if (!tmpl) return [];
  const target = daysFromToday(-CROSSSELL_DIAS_APOS);
  const { data } = await db.from('appointments')
    .select('id, client_id, client_name, client_phone, procedure')
    .eq('appointment_date', target).in('status', STATUS_CONCLUIDO);

  const out = [];
  for (const a of data || []) {
    if (!a.client_id) continue;
    if (await alreadyQueued(db, a.client_id, 18, 24 * CROSSSELL_DIAS_APOS)) continue;
    out.push(entry(a, tmpl, 'B', {
      nome_paciente: firstName(a.client_name),
      nome_servico: a.procedure || 'procedimento',
    }, { appointmentId: a.id, context: { servico_base: a.procedure } }));
  }
  return out;
}

async function tool_19_data_comemorativa(db) {
  const tmpl = await getTemplate(db, 19);
  if (!tmpl) return [];
  const today = clinicToday();
  const chave = `${Number(today.slice(5, 7))}-${Number(today.slice(8, 10))}`;
  const datas = {
    '3-8': 'Dia Internacional da Mulher',
    '5-12': 'Dia das Mães',
    '6-12': 'Dia dos Namorados',
    '10-12': 'Dia das Crianças',
    '12-25': 'Natal',
  };
  const contexto = datas[chave];
  if (!contexto) return [];

  const { data } = await db.from('clients')
    .select('id, name, phone')
    .in('status', STATUS_CLIENTE_ATIVO)
    .not('phone', 'is', null).not('last_visit', 'is', null)
    .eq('whatsapp_opt_out', false);

  const out = [];
  for (const c of data || []) {
    if (await alreadyQueued(db, c.id, 19, 24 * 365)) continue;
    out.push(entry(c, tmpl, 'B', { nome_paciente: firstName(c.name) }, { context: { data_comemorativa: contexto } }));
  }
  return out;
}

// ─── REGISTRY ───────────────────────────────────────────────────────────────
const ALL_TOOLS = [
  { id: 1, name: 'tool_01_lembrete_24h', fn: tool_01_lembrete_24h },
  { id: 2, name: 'tool_02_lembrete_2h', fn: tool_02_lembrete_2h },
  { id: 3, name: 'tool_03_alerta_atraso_15min', fn: tool_03_alerta_atraso_15min },
  { id: 4, name: 'tool_04_no_show_24h', fn: tool_04_no_show_24h },
  { id: 5, name: 'tool_05_aniversario', fn: tool_05_aniversario },
  { id: 6, name: 'tool_06_boas_vindas', fn: tool_06_boas_vindas },
  { id: 7, name: 'tool_07_confirmacao_agendamento', fn: tool_07_confirmacao_agendamento },
  { id: 8, name: 'tool_08_pre_procedimento', fn: tool_08_pre_procedimento },
  { id: 9, name: 'tool_09_pos_procedimento', fn: tool_09_pos_procedimento },
  { id: 10, name: 'tool_10_lembrete_exames', fn: tool_10_lembrete_exames },
  { id: 11, name: 'tool_11_nps', fn: tool_11_nps },
  { id: 12, name: 'tool_12_recuperacao_orcamento', fn: tool_12_recuperacao_orcamento },
  { id: 13, name: 'tool_13_inativo_30d', fn: tool_13_inativo_30d },
  { id: 14, name: 'tool_14_inativo_90d', fn: tool_14_inativo_90d },
  { id: 15, name: 'tool_15_pacote_proximo_fim', fn: tool_15_pacote_proximo_fim },
  { id: 16, name: 'tool_16_retorno_inteligente', fn: tool_16_retorno_inteligente },
  { id: 17, name: 'tool_17_recuperacao_cancelamento', fn: tool_17_recuperacao_cancelamento },
  { id: 18, name: 'tool_18_upgrade_crosssell', fn: tool_18_upgrade_crosssell },
  { id: 19, name: 'tool_19_data_comemorativa', fn: tool_19_data_comemorativa },
];

async function logCycle(db, toolId, toolName, generated, inserted, error) {
  try {
    await db.from('marketing_log').insert({
      tool_id: toolId,
      tool_name: toolName,
      entries_generated: generated,
      entries_inserted: inserted,
      error,
    });
  } catch {
    // tabela pode ainda não existir — falha silenciosa como no Python
  }
}

// ─── HANDLER ────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  const auth = req.headers.authorization || '';
  if (auth !== `Bearer ${SERVICE_KEY}`) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const url = new URL(req.url, 'https://paiemae.vercel.app');
  const half = Number(url.searchParams.get('half') || 0);
  const tools = half === 1 ? ALL_TOOLS.slice(0, 11) : half === 2 ? ALL_TOOLS.slice(11) : ALL_TOOLS;

  const db = createClient(SUPABASE_URL, SERVICE_KEY);

  if (!(await isEngineEnabled(db))) {
    return res.status(200).json({ ok: true, skipped: true, reason: 'motor desativado no painel' });
  }

  const results = await Promise.all(tools.map(async (t) => {
    try {
      const entries = await t.fn(db);
      let inserted = 0;
      if (entries.length) {
        const { error } = await db.from('marketing_queue').insert(entries);
        if (error) throw error;
        inserted = entries.length;
      }
      await logCycle(db, t.id, t.name, entries.length, inserted, null);
      return { id: t.id, generated: entries.length, inserted, error: null };
    } catch (e) {
      await logCycle(db, t.id, t.name, 0, 0, String(e?.message || e));
      return { id: t.id, generated: 0, inserted: 0, error: String(e?.message || e) };
    }
  }));

  return res.status(200).json({
    ok: true,
    half: half || 'all',
    insertedTotal: results.reduce((s, r) => s + (r.inserted || 0), 0),
    results,
  });
}
