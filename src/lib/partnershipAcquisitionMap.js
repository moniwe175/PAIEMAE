export const PARTNERSHIP_MAP_PREFIX = 'partnership-acquisition-v1';

const STEPS = [
  {
    key: 'partners',
    color: 'blue',
    x: 0,
    y: 100,
    text: '1. PARCEIROS\nEscolher 3 para o teste:\n• academia\n• nutricionista\n• salão ou empresa local',
  },
  {
    key: 'value',
    color: 'purple',
    x: 250,
    y: 100,
    text: '2. PROPOSTA DE VALOR\nO que o cliente ganha?\nO que o parceiro ganha?\nO que a clínica ganha?',
  },
  {
    key: 'tracking',
    color: 'yellow',
    x: 500,
    y: 100,
    text: '3. RASTREAMENTO\nCriar link ou código por parceiro.\nRegistrar a origem no CRM antes do agendamento.',
  },
  {
    key: 'test',
    color: 'orange',
    x: 750,
    y: 100,
    text: '4. TESTE DE 30 DIAS\nComeçar pequeno.\nRegistrar toda indicação.\nNão escalar antes dos resultados.',
  },
  {
    key: 'metrics',
    color: 'green',
    x: 750,
    y: 340,
    text: '5. MEDIR\nLeads → agendamentos → atendidos → receita.\nCalcular CAC, margem e recompra por parceiro.',
  },
  {
    key: 'decision',
    color: 'pink',
    x: 500,
    y: 340,
    text: '6. DECISÃO\nESCALAR: margem positiva.\nAJUSTAR: procura sem venda.\nENCERRAR: sem resultado.',
  },
  {
    key: 'scale',
    color: 'green',
    x: 250,
    y: 340,
    text: '7. ESCALAR O QUE FUNCIONA\nFormalizar rotina, responsável e meta.\nReplicar apenas o parceiro validado.',
  },
  {
    key: 'goal',
    color: 'purple',
    x: 0,
    y: 340,
    text: 'RESULTADO DESEJADO\nClientes qualificados com CAC menor e um canal previsível de indicações.',
  },
  {
    key: 'guardrails',
    color: 'orange',
    x: 375,
    y: 570,
    text: 'REGRAS DE SEGURANÇA\nValidar LGPD e regras profissionais.\nSem promessa clínica.\nSem comissão antes de confirmar viabilidade.',
  },
];

const FLOW = [
  ['partners', 'value'],
  ['value', 'tracking'],
  ['tracking', 'test'],
  ['test', 'metrics'],
  ['metrics', 'decision'],
  ['decision', 'scale'],
  ['scale', 'goal'],
  ['guardrails', 'value'],
];

export function hasPartnershipAcquisitionMap(nodes = []) {
  return nodes.some((node) => String(node?.id || '').startsWith(PARTNERSHIP_MAP_PREFIX));
}

export function getPartnershipMapOrigin(nodes = []) {
  if (!nodes.length) return { x: 80, y: 100 };

  const bottom = nodes.reduce((max, node) => {
    const y = Number(node?.position?.y) || 0;
    const estimatedHeight = node?.type === 'ideaNode' ? 300 : 180;
    return Math.max(max, y + estimatedHeight);
  }, 0);

  return { x: 80, y: bottom + 100 };
}

export function buildPartnershipAcquisitionMap({ x = 80, y = 100 } = {}) {
  const titleId = `${PARTNERSHIP_MAP_PREFIX}-title`;
  const nodeId = (key) => `${PARTNERSHIP_MAP_PREFIX}-${key}`;

  const nodes = [
    {
      id: titleId,
      type: 'textNode',
      position: { x: x + 340, y },
      data: { text: 'CANAL DE AQUISIÇÃO POR PARCERIAS — MAPA DE VALIDAÇÃO' },
    },
    ...STEPS.map((step) => ({
      id: nodeId(step.key),
      type: 'noteNode',
      position: { x: x + step.x, y: y + step.y },
      data: { text: step.text, color: step.color },
    })),
  ];

  const edges = FLOW.map(([source, target]) => ({
    id: `${PARTNERSHIP_MAP_PREFIX}-edge-${source}-${target}`,
    source: nodeId(source),
    target: nodeId(target),
    type: 'smoothstep',
  }));

  return { nodes, edges };
}
