import test from 'node:test';
import assert from 'node:assert/strict';

import {
  enrichCrmLeadsWithAutomation,
  summarizeCrmAutomationForLead,
} from '../src/lib/crmAutomation.js';

function lead(journeyKey, overrides = {}) {
  return {
    id: 'lead-1',
    client_id: 10,
    telefone: '(21) 99999-0000',
    _journey: {
      key: journeyKey,
      client: { id: 10, phone: '21999990000' },
      appointments: [{ id: 'appointment-1' }],
    },
    ...overrides,
  };
}

function event(toolId, status, overrides = {}) {
  return {
    id: `${toolId}-${status}`,
    client_id: 10,
    client_phone: '21999990000',
    appointment_id: 'appointment-1',
    tool_id: toolId,
    tool_name: `Ferramenta ${toolId}`,
    status,
    created_at: '2026-10-22T10:00:00Z',
    updated_at: '2026-10-22T10:05:00Z',
    ...overrides,
  };
}

test('agendamento usa somente ferramentas do Motor relacionadas à Agenda', () => {
  const summary = summarizeCrmAutomationForLead(lead('agendada'), [
    event(5, 'sent', { updated_at: '2026-10-22T12:00:00Z' }),
    event(7, 'sent', { tool_name: 'Confirmação de Agendamento' }),
  ]);

  assert.equal(summary.latest.tool_id, 7);
  assert.equal(summary.label, 'Enviado automaticamente');
  assert.equal(summary.detail, 'Confirmação de Agendamento');
  assert.equal(summary.requiresAttention, false);
});

test('falta encontra recuperação pelo telefone mesmo sem vínculo persistido', () => {
  const unlinked = lead('faltou', {
    client_id: null,
    appointment_id: null,
    _journey: { key: 'faltou', client: null, appointments: [] },
  });
  const summary = summarizeCrmAutomationForLead(unlinked, [
    event(17, 'pending', { client_id: 99, appointment_id: null, client_phone: '5521999990000' }),
  ]);

  assert.equal(summary.latest.tool_id, 17);
  assert.equal(summary.label, 'Aguardando revisão no Motor');
  assert.equal(summary.requiresAttention, true);
});

test('falha do Motor fica marcada como atenção sem alterar a etapa da Agenda', () => {
  const original = lead('em_risco');
  const [enriched] = enrichCrmLeadsWithAutomation([original], [event(16, 'failed')]);

  assert.equal(enriched._journey.key, 'em_risco');
  assert.equal(enriched._automation.label, 'Falha no envio automático');
  assert.equal(enriched._automation.requiresAttention, true);
});

test('interessado sem agendamento não finge que o Motor detectou uma conversa', () => {
  const summary = summarizeCrmAutomationForLead(lead('interessada'), [event(7, 'sent')]);
  assert.equal(summary, null);
});

