import test from 'node:test';
import assert from 'node:assert/strict';

import {
  attributionLeadFields,
  buildTrackedUrl,
  captureMarketingAttribution,
  getCurrentMarketingAttribution,
  marketingAttributionStorageKeys,
  readAttributionFromUrl,
  slugifyCampaign,
} from '../src/lib/marketingAttribution.js';

function installLocalStorage() {
  const values = new Map();
  global.window = {
    localStorage: {
      getItem: key => values.has(key) ? values.get(key) : null,
      setItem: (key, value) => values.set(key, String(value)),
      removeItem: key => values.delete(key),
      clear: () => values.clear(),
    },
  };
  return values;
}

test('gera slug estável para identificar campanha', () => {
  assert.equal(slugifyCampaign('Botox São Paulo — Outubro 2026'), 'botox-sao-paulo-outubro-2026');
});

test('gera URL rastreável sem apagar parâmetros existentes', () => {
  const result = new URL(buildTrackedUrl('https://clinica.com/agendar?unidade=matriz', {
    utm_id: '42',
    utm_source: 'meta',
    utm_medium: 'paid_social',
    utm_campaign: 'botox-outubro',
    utm_content: 'video-01',
  }));

  assert.equal(result.searchParams.get('unidade'), 'matriz');
  assert.equal(result.searchParams.get('utm_id'), '42');
  assert.equal(result.searchParams.get('utm_source'), 'meta');
  assert.equal(result.searchParams.get('utm_campaign'), 'botox-outubro');
  assert.equal(result.searchParams.get('utm_content'), 'video-01');
});

test('lê UTMs e identificadores oficiais de clique', () => {
  const attribution = readAttributionFromUrl(
    'https://clinica.com/agendar?utm_id=42&utm_source=google&utm_medium=cpc&utm_campaign=laser&gclid=click-123',
    'https://www.google.com/',
  );

  assert.equal(attribution.utm_source, 'google');
  assert.equal(attribution.utm_id, '42');
  assert.equal(attribution.gclid, 'click-123');
  assert.equal(attribution.landing_url, 'https://clinica.com/agendar');
});

test('preserva primeira origem e atualiza a última origem', () => {
  const values = installLocalStorage();
  captureMarketingAttribution('https://clinica.com/?utm_source=meta&utm_campaign=primeiro');
  captureMarketingAttribution('https://clinica.com/?utm_source=google&utm_campaign=ultimo&gclid=abc');

  const stored = getCurrentMarketingAttribution();
  assert.equal(stored.first_touch.utm_source, 'meta');
  assert.equal(stored.last_touch.utm_source, 'google');
  assert.equal(stored.last_touch.gclid, 'abc');
  assert.ok(values.has(marketingAttributionStorageKeys.attribution));

  const leadFields = attributionLeadFields(stored);
  assert.equal(leadFields.utm_campaign, 'ultimo');
  assert.equal(leadFields.attribution_session_id, stored.session_id);
});

test('não cria atribuição quando a URL não contém sinal de campanha', () => {
  installLocalStorage();
  assert.equal(readAttributionFromUrl('https://clinica.com/agendar'), null);
  assert.equal(captureMarketingAttribution('https://clinica.com/agendar'), null);
});
