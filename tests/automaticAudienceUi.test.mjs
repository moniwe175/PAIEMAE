import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('Inteligência mostra somente Clientes e Públicos automáticos na navegação', () => {
  const component = fs.readFileSync(path.resolve('src/components/marketing/inteligencia/InteligenicaComercial.jsx'), 'utf8');
  const navStart = component.indexOf('{/* Sub-tabs */}');
  const navEnd = component.indexOf('{/* ── Sub-Aba: Ficha RFM', navStart);
  const navigation = component.slice(navStart, navEnd);

  assert.match(navigation, /label: 'Clientes'/);
  assert.match(navigation, /label: 'Públicos automáticos'/);
  assert.doesNotMatch(navigation, /Públicos e Segmentos/);
  assert.doesNotMatch(navigation, /Perfis de Clientes \(ICP\)/);
  assert.match(component, /Você não precisa criar segmentos/);
});

test('base automática pagina RFM e Agenda sem formulário manual', () => {
  const service = fs.readFileSync(path.resolve('src/services/inteligenciaComercialService.js'), 'utf8');

  assert.match(service, /export async function fetchAutomaticAudienceDataset/);
  assert.match(service, /p_filter_mode: 'todos'/);
  assert.match(service, /\.from\('appointments'\)/);
  assert.match(service, /\.eq\('status', 'finalizado'\)/);
  assert.match(service, /\.range\(appointmentOffset, appointmentOffset \+ pageSize - 1\)/);
});

