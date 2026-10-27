export const COMANDA_PAYMENT_METHODS = [
  { key: 'pix', label: 'Pix' },
  { key: 'credito', label: 'Crédito' },
  { key: 'debito', label: 'Débito' },
  { key: 'dinheiro', label: 'Dinheiro' },
];

export function moneyValue(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

export function itemTotal(item = {}) {
  if (item.is_package) return 0;
  const quantity = Math.max(1, Number(item.quantity) || 1);
  return Math.max(0, Number((quantity * moneyValue(item.unit_price) - moneyValue(item.discount)).toFixed(2)));
}

export function calculateComandaTotals(items = []) {
  return items.reduce((summary, item) => {
    const total = itemTotal(item);
    summary.total += total;
    summary.services += 1;
    summary.packageItems += item.is_package ? 1 : 0;
    return summary;
  }, { total: 0, services: 0, packageItems: 0 });
}

export function normalizeSinglePayment(total, method = 'pix') {
  const payment = { pix: 0, credito: 0, debito: 0, dinheiro: 0 };
  if (Object.prototype.hasOwnProperty.call(payment, method)) payment[method] = moneyValue(total);
  return payment;
}

export function paymentTotal(payment = {}) {
  return COMANDA_PAYMENT_METHODS.reduce((sum, method) => sum + moneyValue(payment[method.key]), 0);
}

export function validateDigitalComanda({ items = [], payment = {} } = {}) {
  if (!items.length) return 'Adicione pelo menos um serviço à comanda.';
  if (items.some((item) => !String(item.service_name || '').trim())) return 'Selecione o serviço de todos os itens.';
  if (items.some((item) => !String(item.professional_name || '').trim())) return 'Selecione o profissional de todos os itens.';

  const { total } = calculateComandaTotals(items);
  const paid = paymentTotal(payment);
  if (Math.abs(total - paid) > 0.009) {
    return `As formas de pagamento somam R$ ${paid.toFixed(2)}, mas os serviços avulsos totalizam R$ ${total.toFixed(2)}.`;
  }
  return '';
}

export function comandaProcedureSummary(items = []) {
  const names = items.map((item) => String(item.service_name || '').trim()).filter(Boolean);
  return names.length ? names.join(', ') : 'Sem procedimento';
}

export function allocatePaymentsAcrossItems(items = [], payment = {}) {
  const paidItems = items.filter((item) => !item.is_package && itemTotal(item) > 0);
  const paidTotal = paidItems.reduce((sum, item) => sum + itemTotal(item), 0);
  const running = { pix: 0, credito: 0, debito: 0, dinheiro: 0 };
  let paidIndex = 0;

  return items.map((item) => {
    if (item.is_package) {
      return { ...item, line_total: 0, repasse: 1, payment: { pix: 0, credito: 0, debito: 0, dinheiro: 0 } };
    }

    const total = itemTotal(item);
    paidIndex += 1;
    const isLast = paidIndex === paidItems.length;
    const allocated = {};
    COMANDA_PAYMENT_METHODS.forEach(({ key }) => {
      const source = moneyValue(payment[key]);
      const value = isLast
        ? Number((source - running[key]).toFixed(2))
        : Number((paidTotal > 0 ? source * total / paidTotal : 0).toFixed(2));
      allocated[key] = Math.max(0, value);
      running[key] = Number((running[key] + allocated[key]).toFixed(2));
    });
    return { ...item, line_total: total, repasse: 0, payment: allocated };
  });
}

export function buildInitialComandaItem(appointment = {}, services = []) {
  const service = services.find((item) => (
    String(item.id || '') === String(appointment.service_id || '')
    || String(item.nome || '').trim().toLocaleLowerCase('pt-BR') === String(appointment.servico || '').trim().toLocaleLowerCase('pt-BR')
  ));
  const isPackage = Boolean(appointment.patient_package_id);
  return {
    service_id: service?.id || appointment.service_id || null,
    service_name: service?.nome || appointment.servico || '',
    professional_name: appointment.profissional || '',
    quantity: 1,
    unit_price: isPackage ? 0 : moneyValue(appointment.valor || service?.preco),
    discount: 0,
    is_package: isPackage,
    patient_package_id: appointment.patient_package_id || null,
    notes: '',
  };
}
