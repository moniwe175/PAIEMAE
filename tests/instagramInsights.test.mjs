import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { fetchInstagramInsights, insightErrorMessage } from '../api/instagram.js';

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

function response(data, status = 200) {
  return { ok: status < 400, json: async () => data };
}

test('consulta alcance real e preserva métricas não disponíveis como ausência', async () => {
  const calls = [];
  globalThis.fetch = async input => {
    const url = new URL(input);
    calls.push(url);
    if (url.pathname.endsWith('/123/insights')) {
      assert.equal(url.searchParams.get('period'), 'day');
      if (url.searchParams.get('metric') === 'views') {
        return response({ data: [{ name: 'views', total_value: { value: 83 } }] });
      }
      if (url.searchParams.get('metric') === 'total_interactions') {
        return response({ error: { code: 100, message: 'Métrica indisponível' } }, 400);
      }
      assert.equal(url.searchParams.get('metric'), 'reach');
      assert.equal(url.searchParams.get('metric_type'), 'time_series');
      return response({ data: [{ name: 'reach', values: [
        { value: 4, end_time: '2026-09-28T00:00:00+0000' },
        { value: 7, end_time: '2026-09-29T00:00:00+0000' },
      ] }] });
    }
    if (url.pathname.endsWith('/123/media')) {
      return response({ data: [{ id: '456', caption: 'Reel', media_type: 'VIDEO' }] });
    }
    if (url.pathname.endsWith('/456/insights')) {
      const metric = url.searchParams.get('metric');
      if (metric === 'views') return response({ error: { code: 100, message: 'Métrica indisponível' } }, 400);
      return response({ data: [{ name: metric, total_value: { value: { reach: 28, saved: 2, shares: 1 }[metric] } }] });
    }
    throw new Error('Chamada inesperada: ' + url);
  };
  const result = await fetchInstagramInsights('teste', '123', 7, '456');
  assert.equal(result.reach.length, 2);
  assert.equal(result.reach[1].value, 7);
  assert.deepEqual(result.totals, { views: 83, total_interactions: null });
  assert.deepEqual(result.media, { id: '456', reach: 28, views: null, saved: 2, shares: 1 });
  assert.deepEqual(result.media_summary.totals, { reach: null, views: null, saved: null, shares: null, engagements: null });
  assert.equal(calls.length, 8);
});

test('nega insights sem permissão e explica a configuração necessária', async () => {
  globalThis.fetch = async () => response({ error: { code: 10, message: 'Permission missing' } }, 403);
  await assert.rejects(
    () => fetchInstagramInsights('teste', '123', 30, ''),
    error => insightErrorMessage(error).includes('instagram_manage_insights'),
  );
});

test('consolida encaminhamentos e engajamentos dos conteúdos recentes sem inventar ausência', async () => {
  globalThis.fetch = async input => {
    const url = new URL(input);
    if (url.pathname.endsWith('/123/insights')) {
      const metric = url.searchParams.get('metric');
      if (metric === 'reach') return response({ data: [{ name: 'reach', values: [{ value: 20, end_time: '2026-10-20T00:00:00Z' }] }] });
      return response({ data: [{ name: metric, total_value: { value: 30 } }] });
    }
    if (url.pathname.endsWith('/123/media')) return response({ data: [{
      id: '789', caption: 'Conteúdo', media_type: 'VIDEO', timestamp: new Date().toISOString(), like_count: 5, comments_count: 2,
    }] });
    if (url.pathname.endsWith('/789/insights')) return response({ data: [
      { name: 'reach', total_value: { value: 100 } }, { name: 'views', total_value: { value: 150 } },
      { name: 'saved', total_value: { value: 4 } }, { name: 'shares', total_value: { value: 3 } },
    ] });
    throw new Error(`Chamada inesperada: ${url}`);
  };
  const result = await fetchInstagramInsights('teste', '123', 30, '');
  assert.equal(result.media_summary.posts_count, 1);
  assert.equal(result.media_summary.covered_posts, 1);
  assert.deepEqual(result.media_summary.totals, { reach: 100, views: 150, saved: 4, shares: 3, engagements: 14 });
});
