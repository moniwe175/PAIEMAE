import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PARTNERSHIP_MAP_PREFIX,
  buildPartnershipAcquisitionMap,
  getPartnershipMapOrigin,
  hasPartnershipAcquisitionMap,
} from '../src/lib/partnershipAcquisitionMap.js';

test('monta estratégia visual completa com etapas ligadas em sequência', () => {
  const map = buildPartnershipAcquisitionMap({ x: 50, y: 70 });

  assert.equal(map.nodes.length, 10);
  assert.equal(map.edges.length, 8);
  assert.equal(new Set(map.nodes.map((node) => node.id)).size, map.nodes.length);
  assert.ok(map.nodes.every((node) => ['noteNode', 'textNode'].includes(node.type)));
  assert.ok(map.nodes.some((node) => /CAC, margem e recompra/.test(node.data.text)));
  assert.ok(map.nodes.some((node) => /LGPD e regras profissionais/.test(node.data.text)));

  const nodeIds = new Set(map.nodes.map((node) => node.id));
  assert.ok(map.edges.every((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target)));
});

test('detecta mapa existente e posiciona um novo modelo abaixo do conteúdo atual', () => {
  assert.equal(hasPartnershipAcquisitionMap([]), false);
  assert.equal(hasPartnershipAcquisitionMap([{ id: `${PARTNERSHIP_MAP_PREFIX}-partners` }]), true);
  assert.deepEqual(getPartnershipMapOrigin([]), { x: 80, y: 100 });
  assert.deepEqual(
    getPartnershipMapOrigin([{ id: 'idea-1', type: 'ideaNode', position: { x: 30, y: 500 } }]),
    { x: 80, y: 900 },
  );
});
