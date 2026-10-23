/* eslint-disable react/prop-types */
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity, AlertTriangle, BarChart3, CheckCircle2, CircleDollarSign,
  Download, FileSpreadsheet, Landmark, Loader2, Plus, Save, Settings2, Target, Trash2, Upload, X,
} from 'lucide-react';
import { buildFinancialHealth, deriveMonthlyCosts, FINANCIAL_TARGETS } from '../../lib/financialHealth';
import { FINANCIAL_CSV_TEMPLATE, parseFinancialCsv } from '../../lib/financialCsv';
import {
  importFinancialEntries, loadFinancialBundle, removeFinancialEntry, saveBudget,
  saveFinancialEntry, saveFinancialModel, saveFinancialMonthlyInput, saveServiceCost,
} from '../../services/financialHealthService';
import { MATRIX_UNIT_ID } from '../../services/franchiseService';
import './financial-health.css';

const money = (value) => value === null || value === undefined
  ? 'Pendente'
  : Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const pct = (value) => value === null || value === undefined ? 'Pendente' : `${Number(value).toFixed(1).replace('.', ',')}%`;
const dateBR = (value) => value ? String(value).slice(0, 10).split('-').reverse().join('/') : '—';
const number = (value) => Number(value) || 0;
const monthLabel = (month) => new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${month}T12:00:00Z`));

const TABS = [
  ['overview', 'Visão gerencial'], ['dre', 'DRE'], ['cash', 'Caixa 13 semanas'],
  ['accounts', 'Contas e orçamento'], ['services', 'Rentabilidade por serviço'],
];

const INPUT_GROUPS = [
  ['Custos de equipe e estrutura', [
    ['payroll', 'Salários'], ['payroll_charges', 'Encargos e benefícios'], ['rent', 'Aluguel e condomínio'],
    ['utilities', 'Água, luz, telefone'], ['systems', 'Sistemas'], ['accounting_legal', 'Contabilidade e jurídico'],
    ['maintenance', 'Manutenção'], ['insurance', 'Seguros'], ['other_fixed_costs', 'Outros custos fixos'],
    ['marketing_expense', 'Marketing e tráfego pago'],
  ]],
  ['Custos variáveis e retiradas', [
    ['supplies_cost', 'Insumos consumidos'], ['discounts', 'Descontos concedidos'], ['refunds', 'Estornos/devoluções'],
    ['pro_labore_override', 'Pró-labore'], ['debt_service_override', 'Parcelas de dívidas'], ['capex', 'Investimentos (equipamentos/obras)'],
  ]],
];

const DRE_ROWS = [
  ['Receita bruta', 'grossRevenue'], ['(-) Descontos', 'discounts'], ['(-) Estornos', 'refunds'],
  ['= Receita líquida', 'netRevenue', true], ['(-) Impostos', 'taxes'], ['(-) Taxas de cartão', 'cardFees'],
  ['(-) Comissões', 'commissions'], ['(-) Insumos consumidos', 'supplies'],
  ['= Margem de contribuição', 'contributionMargin', true], ['(-) Custos fixos', 'fixedCosts'],
  ['= EBITDA operacional', 'ebitda', true], ['(-) Pró-labore', 'proLabore'], ['(-) Serviço da dívida', 'debtService'],
  ['= Caixa após obrigações', 'availableCash', true], ['(-) Investimentos (CAPEX)', 'capex'],
  ['= Geração líquida de caixa', 'netCashAfterInvestments', true],
];

const BUDGET_CATEGORIES = [['folha', 'Folha e encargos'], ['aluguel', 'Aluguel'], ['insumos', 'Insumos'], ['marketing', 'Marketing'], ['outros', 'Outros fixos']];

function Badge({ children, tone = 'neutral' }) { return <span className={`fh-badge fh-${tone}`}>{children}</span>; }

function Metric({ title, value, detail, status = 'real' }) {
  return <div className="fh-metric">
    <div className="fh-metric-top"><span>{title}</span><Badge tone={status === 'pending' ? 'warning' : 'success'}>{status === 'pending' ? 'PENDENTE' : 'DADO REAL'}</Badge></div>
    <strong>{value}</strong><small>{detail}</small>
  </div>;
}

function HealthGauge({ health }) {
  const score = health.score ?? 0;
  const angle = Math.PI - (score / 100) * Math.PI;
  const pointerX = 110 + Math.cos(angle) * 69;
  const pointerY = 106 - Math.sin(angle) * 69;
  return <div className="fh-health-gauge">
    <svg viewBox="0 0 220 126" role="img" aria-label={health.ready ? `Saude financeira: ${score} de 100` : 'Saude financeira aguardando dados'}>
      <defs><linearGradient id="fh-health-gradient" x1="0" x2="1"><stop offset="0%" stopColor="#d45151"/><stop offset="48%" stopColor="#e7a23d"/><stop offset="72%" stopColor="#d5b934"/><stop offset="100%" stopColor="#4a9a68"/></linearGradient></defs>
      <path className="fh-gauge-track" d="M 20 106 A 90 90 0 0 1 200 106"/>
      <path className={`fh-gauge-color ${health.ready ? '' : 'muted'}`} d="M 20 106 A 90 90 0 0 1 200 106" stroke="url(#fh-health-gradient)"/>
      {health.ready && <><line className="fh-gauge-pointer" x1="110" y1="106" x2={pointerX} y2={pointerY}/><circle className="fh-gauge-center" cx="110" cy="106" r="7"/></>}
      <text className="fh-gauge-value" x="110" y="88" textAnchor="middle">{health.ready ? score : '—'}</text>
      <text className="fh-gauge-unit" x="110" y="103" textAnchor="middle">{health.ready ? 'de 100' : 'sem nota'}</text>
    </svg>
    <div className="fh-gauge-labels"><span>Crítico</span><span>Atenção</span><span>Saudável</span></div>
  </div>;
}

function BusinessHealthBoard({ health }) {
  const { businessHealth, guidance, dre, quality } = health;
  const reachedTarget = guidance.healthyRevenue !== null && dre.netRevenue >= guidance.healthyRevenue;
  return <div className="fh-health-board">
    <div className="fh-panel fh-health-score">
      <div className="fh-panel-title"><Activity size={18}/> Nível de saúde do negócio</div>
      <HealthGauge health={businessHealth}/>
      <div className={`fh-health-status ${businessHealth.ready ? 'ready' : 'pending'}`}>
        <strong>{businessHealth.label}</strong><span>{businessHealth.detail}</span>
      </div>
      {!businessHealth.ready && <p className="fh-health-explanation">A nota será liberada quando o fechamento chegar a 95%: custos, taxas, caixa e contas precisam estar conferidos. Hoje está em {quality.score}%.</p>}
    </div>
    <div className="fh-panel fh-revenue-guide">
      <div className="fh-panel-title"><Target size={18}/> Quanto precisamos faturar</div>
      {!guidance.ready ? <div className="fh-guidance-pending"><strong>Ainda não é possível calcular com segurança</strong><p>Preencha custos fixos e variáveis, impostos, taxas, pró-labore e dívidas. Usar somente a receita importada criaria uma meta falsa.</p></div>
        : guidance.marginInsufficient ? <div className="fh-guidance-pending danger"><strong>A margem atual não sustenta a meta</strong><p>Antes de buscar mais volume, revise preços, comissões, insumos, impostos e taxas. Com esta margem, faturar mais pode não gerar caixa suficiente.</p></div>
          : <div className="fh-guidance-grid">
            <div><span>Mínimo para não ter prejuízo</span><strong>{money(guidance.breakEvenRevenue)}</strong><small>ponto de equilíbrio: cobre custos, pró-labore e dívidas</small></div>
            <div className="highlight"><span>Meta mensal saudável</span><strong>{money(guidance.healthyRevenue)}</strong><small>inclui margem EBITDA, caixa e 20% de segurança</small></div>
            <div><span>{reachedTarget ? 'Acima da meta no mês' : 'Falta para a meta do mês'}</span><strong className={reachedTarget ? 'positive' : ''}>{reachedTarget ? money(dre.netRevenue - guidance.healthyRevenue) : money(guidance.gapToHealthyRevenue)}</strong><small>receita líquida atual: {money(dre.netRevenue)}</small></div>
          </div>}
      <div className="fh-health-timeline">
        <div><strong>{guidance.consecutiveHealthyMonths} / {guidance.healthyMonthsRequired} meses</strong><span>Para considerar saudável</span><small>meses fechados seguidos acima da meta e com caixa positivo</small></div>
        <div><strong>{guidance.consecutiveHealthyMonths} / {guidance.sustainableMonthsRequired} meses</strong><span>Para considerar sustentável</span><small>6 meses consistentes e reserva mínima de {FINANCIAL_TARGETS.cashReserveMonths} meses</small></div>
      </div>
      <p className="fh-policy-note">Regra gerencial conservadora desta tela; não é garantia e deve ser revisada com o contador após formar histórico real.</p>
    </div>
  </div>;
}

function SetupNotice() {
  return <div className="fh-setup">
    <FileSpreadsheet size={25}/><div><strong>Falta instalar a base da Central Financeira</strong>
      <p>Execute o arquivo <code>financial_management_migration.sql</code> no SQL Editor do Supabase. Depois atualize esta página.</p></div>
  </div>;
}

function Field({ label, value, onChange, step = '0.01' }) {
  return <label className="fh-field"><span>{label}</span><div className="fh-money-input"><span>R$</span><input type="number" min="0" step={step} value={value ?? ''} onChange={(event) => onChange(event.target.value)}/></div></label>;
}

export default function FinancialHealthCenter({ transactions = [], periodEnd }) {
  const periodMonth = `${String(periodEnd || new Date().toISOString()).slice(0, 7)}-01`;
  const monthPrefix = periodMonth.slice(0, 7);
  const [bundle, setBundle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [setupRequired, setSetupRequired] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('overview');
  const [configOpen, setConfigOpen] = useState(false);
  const [entryOpen, setEntryOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef(null);
  const allTransactions = bundle?.allTransactions?.length ? bundle.allTransactions : transactions;
  const periodTransactions = useMemo(() => allTransactions.filter((row) => String(row.date_ref || '').startsWith(monthPrefix)), [allTransactions, monthPrefix]);

  const reload = async () => {
    setLoading(true); setError('');
    try {
      const data = await loadFinancialBundle({ unitId: MATRIX_UNIT_ID, periodMonth });
      setBundle(data); setSetupRequired(false);
    } catch (loadError) {
      if (loadError.code === 'FINANCIAL_SETUP_REQUIRED') setSetupRequired(true);
      else setError(loadError.message || 'Não foi possível carregar os dados financeiros.');
    } finally { setLoading(false); }
  };
  useEffect(() => { reload(); }, [periodMonth]);

  const health = useMemo(() => bundle ? buildFinancialHealth({
    transactions: periodTransactions,
    allTransactions,
    marketingInvestments: bundle.marketingInvestments,
    model: bundle.model,
    monthlyInput: bundle.monthlyInput,
    monthlyHistory: bundle.monthlyHistory,
    entries: bundle.entries,
    budgets: bundle.budgets,
    serviceCosts: bundle.serviceCosts,
    startDate: new Date().toISOString().slice(0, 10),
  }) : null, [bundle, periodTransactions, allTransactions]);

  const downloadTemplate = () => {
    const blob = new Blob([`\uFEFF${FINANCIAL_CSV_TEMPLATE}`], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'modelo_contas_financeiras.csv'; link.click(); URL.revokeObjectURL(link.href);
  };

  const handleImport = async (event) => {
    const file = event.target.files?.[0]; if (!file) return;
    setSaving(true); setError('');
    try { await importFinancialEntries(parseFinancialCsv(await file.text()), MATRIX_UNIT_ID); await reload(); }
    catch (importError) { setError(importError.message || 'Não foi possível importar a planilha.'); }
    finally { setSaving(false); event.target.value = ''; }
  };

  if (loading && !bundle) return <section className="fh-shell"><div className="fh-loading"><Loader2 className="spin"/> Carregando saúde financeira...</div></section>;
  if (setupRequired) return <section className="fh-shell"><SetupNotice/></section>;
  if (!bundle || !health) return <section className="fh-shell"><div className="fh-error">{error || 'Dados financeiros indisponíveis.'}</div></section>;

  const costsReady = health.quality.checks.find((check) => check.key === 'costs')?.ok;
  const ratesReady = health.quality.checks.find((check) => check.key === 'model')?.ok;
  const dreReady = costsReady && ratesReady;
  const cashReady = health.quality.checks.find((check) => check.key === 'cash')?.ok;

  return <section className="fh-shell" id="central-saude-financeira">
    <header className="fh-header">
      <div><span className="fh-eyebrow"><Landmark size={15}/> GESTÃO E SOBREVIVÊNCIA DO NEGÓCIO</span><h2>Central de Saúde Financeira</h2>
        <p>Lucro, caixa, contas e riscos em um só lugar · competência {monthLabel(periodMonth)}</p></div>
      <div className="fh-actions">
        <button className="fh-btn" onClick={downloadTemplate}><Download size={16}/> Modelo de planilha</button>
        <button className="fh-btn" onClick={() => fileRef.current?.click()} disabled={saving}><Upload size={16}/> Importar contas</button>
        <input ref={fileRef} hidden type="file" accept=".csv,text/csv" onChange={handleImport}/>
        <button className="fh-btn fh-primary" onClick={() => setConfigOpen(true)}><Settings2 size={16}/> Preencher o mês</button>
      </div>
    </header>

    {error && <div className="fh-inline-error"><AlertTriangle size={16}/>{error}<button onClick={() => setError('')}><X size={14}/></button></div>}
    <div className="fh-trust"><span><Badge tone={health.quality.score >= 95 ? 'success' : 'warning'}>{health.quality.score}% COMPLETO</Badge> Qualidade dos dados</span>
      <span>Valores ausentes aparecem como <b>Pendente</b>; o sistema não inventa custos.</span></div>

    <nav className="fh-tabs">{TABS.map(([key, label]) => <button key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>{label}</button>)}</nav>

    {tab === 'overview' && <div className="fh-content">
      <div className="fh-metrics">
        <Metric title="Receita líquida" value={money(health.dre.netRevenue)} detail={`${health.dre.sessionCount} venda(s) importada(s)`}/>
        <Metric title="Geração líquida de caixa" value={dreReady ? money(health.dre.netCashAfterInvestments) : 'Pendente'} detail={dreReady ? `margem de caixa ${pct(health.dre.netCashMarginPct)}` : 'confirme custos, impostos e retiradas'} status={dreReady ? 'real' : 'pending'}/>
        <Metric title="Ponto de equilíbrio" value={dreReady ? money(health.dre.breakEvenRevenue) : 'Pendente'} detail={dreReady ? `margem de segurança ${pct(health.dre.safetyMarginPct)}` : 'depende da estrutura real de custos'} status={dreReady ? 'real' : 'pending'}/>
        <Metric title="Caixa projetado em 13 semanas" value={cashReady ? money(health.forecast.at(-1)?.balance) : 'Pendente'} detail={cashReady ? 'saldo conciliado + contas com vencimento' : 'confirme saldo bancário e importe as contas'} status={cashReady ? 'real' : 'pending'}/>
      </div>
      <BusinessHealthBoard health={health}/>
      <div className="fh-grid-2">
        <div className="fh-panel"><div className="fh-panel-title"><AlertTriangle size={18}/> O que precisa de ação agora</div>
          {health.alerts.length ? <div className="fh-alert-list">{health.alerts.slice(0, 6).map((alert, index) => <div className={`fh-alert fh-alert-${alert.level}`} key={`${alert.title}-${index}`}><AlertTriangle size={17}/><div><strong>{alert.title}</strong><p>{alert.detail}</p><small>{alert.action}</small></div></div>)}</div>
            : <div className="fh-empty"><CheckCircle2/> Nenhum risco crítico detectado com os dados preenchidos.</div>}
        </div>
        <div className="fh-panel"><div className="fh-panel-title"><CheckCircle2 size={18}/> Checklist para confiar no fechamento</div>
          <div className="fh-checks">{health.quality.checks.map((check) => <div key={check.key}><span className={check.ok ? 'done' : ''}>{check.ok ? <CheckCircle2/> : <AlertTriangle/>}{check.label}</span><small>{check.ok ? 'Concluído' : check.action}</small></div>)}</div>
        </div>
      </div>
      <div className="fh-panel fh-client-economics"><div className="fh-panel-title"><CircleDollarSign size={18}/> Economia dos clientes</div><div className="fh-kpi-strip">
        <div><span>Clientes pagantes no mês</span><strong>{health.customers.uniquePayingClients}</strong><small>{health.customers.newPayingClients} novos · {health.customers.returningClients} recorrentes</small></div>
        <div><span>Receita histórica média</span><strong>{money(health.customers.averageLifetimeRevenue)}</strong><small>média já observada por cliente</small></div>
        <div><span>LTV com margem</span><strong>{dreReady ? money(health.customers.observedLtv) : 'Pendente'}</strong><small>receita histórica × margem real</small></div>
        <div><span>CAC</span><strong>{!dreReady ? 'Pendente' : health.customers.newPayingClients > 0 ? money(health.customers.cac) : 'Sem novos pagantes'}</strong><small>investimento ÷ novos pagantes</small></div>
        <div><span>Relação LTV/CAC</span><strong>{!dreReady ? 'Pendente' : health.customers.cac > 0 ? `${health.customers.ltvCacRatio}x` : 'Sem CAC pago'}</strong><small>meta inicial ≥ 3x</small></div>
      </div></div>
      <div className="fh-targets"><strong>Metas iniciais de segurança</strong><span>Margem de contribuição ≥ {FINANCIAL_TARGETS.contributionMarginPct}%</span><span>EBITDA ≥ {FINANCIAL_TARGETS.ebitdaMarginPct}%</span><span>Margem líquida ≥ {FINANCIAL_TARGETS.netMarginPct}%</span><span>Reserva ≥ {FINANCIAL_TARGETS.cashReserveMonths} meses</span><small>Referências gerenciais iniciais; devem ser ajustadas ao histórico real da clínica.</small></div>
    </div>}

    {tab === 'dre' && <div className="fh-content fh-grid-2">
      <div className="fh-panel"><div className="fh-panel-title"><BarChart3 size={18}/> DRE gerencial + ponte de caixa</div>
        {!dreReady && <div className="fh-note">A receita está real, mas o resultado permanece pendente até custos, impostos e taxas serem conferidos.</div>}
        <div className="fh-dre">{DRE_ROWS.map(([label, key, total]) => <div className={total ? 'total' : ''} key={key}><span>{label}</span><strong>{!dreReady && !['grossRevenue', 'discounts', 'refunds', 'netRevenue', 'commissions'].includes(key) ? 'Pendente' : money(health.dre[key])}</strong></div>)}</div>
      </div>
      <div className="fh-panel"><div className="fh-panel-title"><CircleDollarSign size={18}/> Indicadores de sustentabilidade</div>
        <div className="fh-kpi-list">
          <div><span>Margem de contribuição</span><strong>{dreReady ? pct(health.dre.contributionMarginPct) : 'Pendente'}</strong><small>meta inicial ≥ 40%</small></div>
          <div><span>Margem EBITDA</span><strong>{dreReady ? pct(health.dre.ebitdaMarginPct) : 'Pendente'}</strong><small>meta inicial ≥ 15%</small></div>
          <div><span>Margem de caixa</span><strong>{dreReady ? pct(health.dre.netCashMarginPct) : 'Pendente'}</strong><small>meta inicial ≥ 10%</small></div>
          <div><span>Reserva de caixa</span><strong>{cashReady && health.dre.cashReserveMonths !== null ? `${health.dre.cashReserveMonths} meses` : 'Pendente'}</strong><small>meta inicial ≥ 3 meses</small></div>
          <div><span>Cobertura da dívida</span><strong>{health.dre.debtService > 0 && dreReady ? `${health.dre.debtCoverageRatio}x` : health.dre.debtService > 0 ? 'Pendente' : 'Não se aplica'}</strong><small>segurança inicial ≥ 1,2x</small></div>
        </div>
      </div>
    </div>}

    {tab === 'cash' && <div className="fh-content">
      {!cashReady && <div className="fh-note">Para projetar o caixa, marque o saldo bancário como conciliado em “Preencher o mês” e importe as contas futuras.</div>}
      <div className="fh-metrics fh-three"><Metric title="Contas a receber" value={money(health.accounts.receivableOpen)} detail={`${money(health.accounts.receivableOverdue)} vencidos`}/><Metric title="Contas a pagar" value={money(health.accounts.payableOpen)} detail={`${money(health.accounts.payableOverdue)} vencidos`}/><Metric title="Menor saldo projetado" value={cashReady ? money(Math.min(...health.forecast.map((row) => row.balance))) : 'Pendente'} detail="janela móvel de 13 semanas" status={cashReady ? 'real' : 'pending'}/></div>
      <div className="fh-panel fh-table-wrap"><table className="fh-table"><thead><tr><th>Semana</th><th>Período</th><th>Entradas previstas</th><th>Saídas previstas</th><th>Saldo projetado</th></tr></thead><tbody>{health.forecast.map((row) => <tr className={row.negative ? 'danger' : ''} key={row.week}><td>Semana {row.week}</td><td>{dateBR(row.from)} a {dateBR(row.to)}</td><td className="positive">{money(row.inflows)}</td><td>{money(row.outflows)}</td><td><strong>{cashReady ? money(row.balance) : 'Pendente'}</strong></td></tr>)}</tbody></table></div>
    </div>}

    {tab === 'accounts' && <AccountsTab bundle={bundle} health={health} periodMonth={periodMonth} onReload={reload} onError={setError} entryOpen={entryOpen} setEntryOpen={setEntryOpen}/>} 
    {tab === 'services' && <ServicesTab bundle={bundle} health={health} onReload={reload} onError={setError}/>} 
    {configOpen && <ConfigModal bundle={bundle} onClose={() => setConfigOpen(false)} onSaved={async () => { setConfigOpen(false); await reload(); }} onError={setError}/>} 
  </section>;
}

function ConfigModal({ bundle, onClose, onSaved, onError }) {
  const importedCosts = deriveMonthlyCosts(bundle.entries, bundle.periodMonth);
  const [input, setInput] = useState({
    ...bundle.monthlyInput,
    ...(bundle.monthlyInput.costs_confirmed ? {} : importedCosts),
  });
  const [model, setModel] = useState({ ...bundle.model });
  const [saving, setSaving] = useState(false);
  const setValue = (setter, key, value) => setter((old) => ({ ...old, [key]: value === '' ? null : number(value) }));
  const save = async () => {
    setSaving(true);
    try {
      const nonNullableFields = INPUT_GROUPS.flatMap(([, fields]) => fields.map(([key]) => key))
        .filter((key) => !['pro_labore_override', 'debt_service_override'].includes(key));
      const normalizedInput = { ...input };
      nonNullableFields.forEach((key) => { if (normalizedInput[key] === null || normalizedInput[key] === '') normalizedInput[key] = 0; });
      await Promise.all([
        saveFinancialModel({ ...model, tax_rate: number(model.tax_rate), card_fee_rate: number(model.card_fee_rate), unit_id: bundle.unitId, configured: true }),
        saveFinancialMonthlyInput({ ...normalizedInput, unit_id: bundle.unitId, period_month: bundle.periodMonth }),
      ]); await onSaved();
    } catch (error) { onError(error.message); }
    finally { setSaving(false); }
  };
  return <div className="fh-modal-backdrop"><div className="fh-modal fh-modal-wide"><header><div><h3>Fechamento financeiro do mês</h3><p>Preencha com valores reais da contabilidade, banco e planilhas.</p></div><button onClick={onClose}><X/></button></header><div className="fh-modal-body">
    {Object.keys(importedCosts).length > 0 && !bundle.monthlyInput.costs_confirmed && <div className="fh-note">Os custos encontrados na planilha de contas já foram pré-preenchidos abaixo. Confira os valores antes de marcar o mês como revisado.</div>}
    <div className="fh-form-section"><h4>Regras do negócio</h4><div className="fh-form-grid"><label className="fh-field"><span>Impostos sobre a receita</span><div className="fh-money-input"><input type="number" min="0" step="0.01" value={model.tax_rate ?? ''} onChange={(e) => setValue(setModel, 'tax_rate', e.target.value)}/><span>%</span></div></label><label className="fh-field"><span>Taxa média de cartão</span><div className="fh-money-input"><input type="number" min="0" step="0.01" value={model.card_fee_rate ?? ''} onChange={(e) => setValue(setModel, 'card_fee_rate', e.target.value)}/><span>%</span></div></label><label className="fh-checkbox"><input type="checkbox" checked={input.rates_confirmed === true} onChange={(e) => setInput((old) => ({ ...old, rates_confirmed: e.target.checked }))}/><span><b>Impostos e taxas conferidos</b><small>As alíquotas acima representam a realidade deste mês.</small></span></label></div></div>
    {INPUT_GROUPS.map(([title, fields]) => <div className="fh-form-section" key={title}><h4>{title}</h4><div className="fh-form-grid">{fields.map(([key, label]) => <Field key={key} label={label} value={input[key]} onChange={(value) => setValue(setInput, key, value)}/>)}</div></div>)}
    <div className="fh-form-section"><label className="fh-checkbox"><input type="checkbox" checked={input.costs_confirmed === true} onChange={(e) => setInput((old) => ({ ...old, costs_confirmed: e.target.checked }))}/><span><b>Todos os custos do mês foram conferidos</b><small>Marque apenas depois de revisar folha, estrutura, insumos, pró-labore e dívidas.</small></span></label></div>
    <div className="fh-form-section"><h4>Caixa real</h4><div className="fh-form-grid"><Field label="Saldo disponível hoje" value={input.closing_cash} onChange={(value) => setValue(setInput, 'closing_cash', value)}/><label className="fh-checkbox"><input type="checkbox" checked={input.cash_reconciled === true} onChange={(e) => setInput((old) => ({ ...old, cash_reconciled: e.target.checked }))}/><span><b>Saldo conciliado</b><small>O valor acima confere com bancos e dinheiro disponível agora; recebíveis futuros ficam em contas a receber.</small></span></label></div></div>
  </div><footer><button className="fh-btn" onClick={onClose}>Cancelar</button><button className="fh-btn fh-primary" onClick={save} disabled={saving}>{saving ? <Loader2 className="spin"/> : <Save/>} Salvar fechamento</button></footer></div></div>;
}

function AccountsTab({ bundle, health, periodMonth, onReload, onError, entryOpen, setEntryOpen }) {
  const [form, setForm] = useState({ entry_type: 'payable', description: '', category: '', competence_date: periodMonth, due_date: periodMonth, amount: '', paid_amount: 0, status: 'open' });
  const [budget, setBudgetState] = useState(() => Object.fromEntries(BUDGET_CATEGORIES.map(([key]) => [key, bundle.budgets.find((row) => row.category === key)?.budget_amount || ''])));
  const [saving, setSaving] = useState(false);
  const submit = async () => { setSaving(true); try { await saveFinancialEntry({ ...form, unit_id: bundle.unitId, amount: number(form.amount), paid_amount: number(form.paid_amount), payment_date: form.status === 'paid' ? new Date().toISOString().slice(0, 10) : null }); setEntryOpen(false); await onReload(); } catch (error) { onError(error.message); } finally { setSaving(false); } };
  const saveBudgets = async () => { setSaving(true); try { await Promise.all(BUDGET_CATEGORIES.map(([category]) => saveBudget({ unit_id: bundle.unitId, period_month: periodMonth, category, budget_amount: number(budget[category]) }))); await onReload(); } catch (error) { onError(error.message); } finally { setSaving(false); } };
  return <div className="fh-content"><div className="fh-section-head"><div><h3>Contas a pagar e receber</h3><p>Base do fluxo de caixa; uma conta não é despesa duplicada se o pagamento for atualizado aqui.</p></div><button className="fh-btn fh-primary" onClick={() => setEntryOpen(!entryOpen)}><Plus/> Novo lançamento</button></div>
    {entryOpen && <div className="fh-panel fh-entry-form"><div className="fh-form-grid"><label className="fh-field"><span>Tipo</span><select value={form.entry_type} onChange={(e) => setForm({ ...form, entry_type: e.target.value })}><option value="payable">Conta a pagar</option><option value="receivable">Conta a receber</option></select></label><label className="fh-field"><span>Descrição</span><input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}/></label><label className="fh-field"><span>Categoria</span><input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value.toLowerCase() })} placeholder="ex.: aluguel, marketing"/></label><label className="fh-field"><span>Competência</span><input type="date" value={form.competence_date} onChange={(e) => setForm({ ...form, competence_date: e.target.value })}/></label><label className="fh-field"><span>Vencimento</span><input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })}/></label><Field label="Valor" value={form.amount} onChange={(value) => setForm({ ...form, amount: value })}/><Field label="Valor já pago/recebido" value={form.paid_amount} onChange={(value) => setForm({ ...form, paid_amount: value })}/><label className="fh-field"><span>Status</span><select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}><option value="open">Em aberto</option><option value="partial">Parcial</option><option value="paid">Pago/recebido</option></select></label></div><div className="fh-entry-actions"><button className="fh-btn" onClick={() => setEntryOpen(false)}>Cancelar</button><button className="fh-btn fh-primary" disabled={!form.description || !form.amount || saving} onClick={submit}><Save/> Salvar</button></div></div>}
    <div className="fh-panel fh-table-wrap"><table className="fh-table"><thead><tr><th>Vencimento</th><th>Tipo</th><th>Descrição</th><th>Categoria</th><th>Valor</th><th>Em aberto</th><th>Status</th><th></th></tr></thead><tbody>{bundle.entries.length ? bundle.entries.map((entry) => <tr key={entry.id}><td>{dateBR(entry.due_date)}</td><td>{entry.entry_type === 'receivable' ? 'Receber' : 'Pagar'}</td><td>{entry.description}</td><td>{entry.category || <Badge tone="warning">SEM CATEGORIA</Badge>}</td><td>{money(entry.amount)}</td><td>{money(Math.max(0, number(entry.amount) - number(entry.paid_amount)))}</td><td><Badge tone={entry.status === 'paid' ? 'success' : 'warning'}>{entry.status === 'paid' ? 'PAGO' : 'ABERTO'}</Badge></td><td><button className="fh-icon-danger" onClick={async () => { if (!window.confirm('Excluir este lançamento?')) return; try { await removeFinancialEntry(entry.id); await onReload(); } catch (error) { onError(error.message); } }}><Trash2/></button></td></tr>) : <tr><td colSpan="8" className="fh-empty-cell">Nenhuma conta cadastrada. Importe a planilha ou crie o primeiro lançamento.</td></tr>}</tbody></table></div>
    <div className="fh-section-head fh-budget-title"><div><h3>Orçado x realizado</h3><p>Defina limites mensais para enxergar desvios antes do caixa apertar.</p></div><button className="fh-btn" onClick={saveBudgets} disabled={saving}><Save/> Salvar orçamento</button></div><div className="fh-budget-grid">{BUDGET_CATEGORIES.map(([key, label]) => { const row = health.budgetRows.find((item) => item.category === key); return <div className="fh-budget" key={key}><label>{label}<div className="fh-money-input"><span>R$</span><input type="number" value={budget[key]} onChange={(e) => setBudgetState({ ...budget, [key]: e.target.value })}/></div></label><p>Realizado <strong>{money(row?.actual || 0)}</strong></p>{row && <small className={row.variance < 0 ? 'negative' : 'positive'}>{row.variance >= 0 ? `${money(row.variance)} disponíveis` : `${money(Math.abs(row.variance))} acima do limite`}</small>}</div>; })}</div>
  </div>;
}

function ServicesTab({ bundle, health, onReload, onError }) {
  const [drafts, setDrafts] = useState({}); const [saving, setSaving] = useState('');
  const value = (service, key) => drafts[service.name]?.[key] ?? bundle.serviceCosts.find((row) => row.service_name.toLowerCase() === service.name.toLowerCase())?.[key] ?? '';
  const set = (name, key, next) => setDrafts((old) => ({ ...old, [name]: { ...old[name], [key]: next } }));
  const save = async (service) => { setSaving(service.name); try { await saveServiceCost({ unit_id: bundle.unitId, service_name: service.name, material_cost: number(value(service, 'material_cost')), duration_minutes: number(value(service, 'duration_minutes')) || null }); await onReload(); } catch (error) { onError(error.message); } finally { setSaving(''); } };
  return <div className="fh-content"><div className="fh-section-head"><div><h3>Rentabilidade real por serviço</h3><p>Receita e comissão vêm das vendas. Informe somente material consumido e duração; sem isso a margem fica pendente.</p></div></div><div className="fh-panel fh-table-wrap"><table className="fh-table"><thead><tr><th>Serviço</th><th>Sessões</th><th>Receita</th><th>Material por sessão</th><th>Duração</th><th>Margem de contribuição</th><th>Contribuição/hora</th><th></th></tr></thead><tbody>{health.services.length ? health.services.map((service) => <tr key={service.name}><td><strong>{service.name}</strong></td><td>{service.sessions}</td><td>{money(service.revenue)}</td><td><input className="fh-cell-input" type="number" min="0" step="0.01" value={value(service, 'material_cost')} onChange={(e) => set(service.name, 'material_cost', e.target.value)} placeholder="R$ 0,00"/></td><td><input className="fh-cell-input" type="number" min="1" value={value(service, 'duration_minutes')} onChange={(e) => set(service.name, 'duration_minutes', e.target.value)} placeholder="min"/></td><td>{service.configured ? <strong className={service.contribution < 0 ? 'negative' : 'positive'}>{money(service.contribution)} ({pct(service.contributionMarginPct)})</strong> : <Badge tone="warning">PENDENTE</Badge>}</td><td>{service.configured && service.contributionPerHour !== null ? money(service.contributionPerHour) : 'Pendente'}</td><td><button className="fh-icon-save" onClick={() => save(service)} disabled={saving === service.name}>{saving === service.name ? <Loader2 className="spin"/> : <Save/>}</button></td></tr>) : <tr><td colSpan="8" className="fh-empty-cell">Nenhum serviço vendido nesta competência.</td></tr>}</tbody></table></div></div>;
}
