const normalize = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

const splitLine = (line, delimiter) => {
  const cells = [];
  let current = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"' && line[index + 1] === '"' && quoted) { current += '"'; index += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === delimiter && !quoted) { cells.push(current.trim()); current = ''; }
    else current += char;
  }
  cells.push(current.trim());
  return cells;
};

const parseMoney = (value) => {
  const text = String(value || '').replace(/R\$/gi, '').replace(/\s/g, '');
  const normalized = text.includes(',') ? text.replace(/\./g, '').replace(',', '.') : text;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : 0;
};

const parseDate = (value) => {
  const text = String(value || '').trim();
  const br = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  return /^\d{4}-\d{2}-\d{2}/.test(text) ? text.slice(0, 10) : null;
};

const valueOf = (row, ...keys) => keys.map((key) => row[key]).find((value) => value !== undefined && value !== '');

export function parseFinancialCsv(text) {
  const lines = String(text || '').replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) throw new Error('A planilha precisa ter cabeçalho e pelo menos um lançamento.');
  const delimiter = (lines[0].match(/;/g) || []).length >= (lines[0].match(/,/g) || []).length ? ';' : ',';
  const headers = splitLine(lines[0], delimiter).map(normalize);
  const rows = lines.slice(1).map((line) => {
    const values = splitLine(line, delimiter);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']));
  });

  const parsed = rows.map((row, index) => {
    const typeRaw = normalize(valueOf(row, 'tipo', 'type', 'entry_type'));
    const entryType = typeRaw.includes('receber') || typeRaw.includes('receita') || typeRaw.includes('entrada') || typeRaw === 'receivable' ? 'receivable' : 'payable';
    const description = valueOf(row, 'descricao', 'description', 'historico');
    const competenceDate = parseDate(valueOf(row, 'competencia', 'competence_date', 'data_competencia'));
    const dueDate = parseDate(valueOf(row, 'vencimento', 'due_date', 'data_vencimento'));
    const amount = parseMoney(valueOf(row, 'valor', 'amount'));
    const paidAmount = parseMoney(valueOf(row, 'valor_pago', 'paid_amount', 'recebido'));
    if (!description || !competenceDate || !dueDate || amount <= 0) throw new Error(`Linha ${index + 2}: preencha descrição, competência, vencimento e valor.`);
    const statusRaw = normalize(valueOf(row, 'status', 'situacao'));
    const status = paidAmount >= amount || ['pago', 'recebido', 'paid'].includes(statusRaw)
      ? 'paid'
      : paidAmount > 0 ? 'partial' : 'open';
    const external = valueOf(row, 'id', 'external_id', 'codigo') || `${entryType}|${description}|${dueDate}|${amount}`;
    const behaviorRaw = normalize(valueOf(row, 'comportamento', 'cost_behavior'));
    const behaviorAliases = { fixo: 'fixed', variavel: 'variable', imposto: 'tax', divida: 'debt', investimento: 'investment', retirada: 'withdrawal' };
    const costBehavior = behaviorAliases[behaviorRaw] || behaviorRaw || null;
    return {
      entry_type: entryType,
      description: String(description).trim(),
      category: normalize(valueOf(row, 'categoria', 'category')) || null,
      cost_behavior: costBehavior,
      competence_date: competenceDate,
      due_date: dueDate,
      amount,
      paid_amount: Math.min(amount, paidAmount),
      payment_date: parseDate(valueOf(row, 'data_pagamento', 'payment_date')),
      status,
      counterparty: valueOf(row, 'fornecedor_cliente', 'fornecedor', 'cliente', 'counterparty') || null,
      payment_method: valueOf(row, 'forma_pagamento', 'payment_method') || null,
      external_id: String(external).trim(),
      notes: valueOf(row, 'observacoes', 'observacao', 'notes') || null,
    };
  });
  return parsed;
}

export const FINANCIAL_CSV_TEMPLATE = 'tipo;descricao;categoria;comportamento;competencia;vencimento;valor;valor_pago;data_pagamento;status;fornecedor_cliente;forma_pagamento;id;observacoes\nPagar;Aluguel;aluguel;fixed;01/10/2026;10/10/2026;3500,00;3500,00;10/10/2026;pago;Imobiliária;Pix;ALUGUEL-2026-10;\nReceber;Pacote cliente;pacotes;;01/10/2026;25/10/2026;1200,00;0,00;;aberto;Nome do cliente;Pix;REC-001;';
