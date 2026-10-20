/* eslint-disable react/prop-types */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, BarChart3, Building2, CheckCircle2, CircleDollarSign,
  Download, FileCheck2, Gauge, Loader2, LockKeyhole, Plus, RefreshCw, Save,
  Settings2, ShieldCheck, Store, Target, TrendingUp, Users, X,
} from 'lucide-react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useAuth } from '../contexts/AuthContext';
import {
  buildFranchiseSnapshot, calculateFranchisorResult, projectFranchiseScenario,
} from '../lib/franchiseMetrics';
import {
  addMarketingInvestment, createFranchiseUnit, loadFranchiseBundle,
  saveEconomicModel, saveMonthlyClose, saveMonthlyInput,
  saveNetworkMonthlyInput,
} from '../services/franchiseService';
import './franquia.css';

const brl = (value) => value === null || value === undefined
  ? 'Pendente'
  : Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const pct = (value) => value === null || value === undefined ? 'Pendente' : `${Number(value).toFixed(1)}%`;
const number = (value) => Number(value || 0).toLocaleString('pt-BR');
const monthLabel = (month) => new Date(`${month}-01T12:00:00`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
const inputNumber = (value) => value === null || value === undefined ? '' : value;

const TABS = [
  { id: 'resumo', label: 'Resumo executivo' },
  { id: 'dre', label: 'DRE da unidade' },
  { id: 'viabilidade', label: 'Viabilidade' },
  { id: 'rede', label: 'Rede e padrões' },
  { id: 'relatorio', label: 'Relatório completo' },
];

const Field = ({ label, value, onChange, suffix, type = 'number', step = '0.01', placeholder }) => (
  <label className="fq-field">
    <span>{label}</span>
    <div className="fq-input-wrap">
      <input type={type} step={step} value={inputNumber(value)} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
      {suffix && <small>{suffix}</small>}
    </div>
  </label>
);

const SourceTag = ({ type = 'real' }) => {
  const labels = { real: 'Dado real', calculated: 'Calculado', projected: 'Projeção', pending: 'Pendente' };
  return <span className={`fq-source fq-source-${type}`}>{labels[type]}</span>;
};

function Metric({ label, value, detail, tone = 'neutral', source = 'calculated' }) {
  return (
    <article className={`fq-metric fq-metric-${tone}`}>
      <div className="fq-metric-top"><span>{label}</span><SourceTag type={source} /></div>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

function EmptyValue({ title, children }) {
  return (
    <div className="fq-empty">
      <AlertTriangle size={19} />
      <div><strong>{title}</strong><p>{children}</p></div>
    </div>
  );
}

function StatusLine({ label, value, good }) {
  return (
    <div className="fq-status-line">
      <span>{good ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}{label}</span>
      <strong className={good ? 'is-good' : 'is-warning'}>{value}</strong>
    </div>
  );
}

const DRE_ROWS = [
  ['Receita bruta', 'grossRevenue'], ['(-) Descontos', 'discounts'], ['(-) Estornos', 'refunds'],
  ['= Receita líquida', 'netRevenue', true], ['(-) Impostos', 'taxes'], ['(-) Taxas de cartão', 'cardFees'],
  ['(-) Comissões', 'commissions'], ['(-) Insumos consumidos', 'supplies'],
  ['= Margem de contribuição', 'contributionMargin', true], ['(-) Royalties', 'royalties'],
  ['(-) Fundo de marketing', 'marketingFund'], ['(-) Custos fixos', 'fixedCosts'],
  ['= EBITDA da unidade', 'ebitda', true], ['(-) Pró-labore', 'proLabore'],
  ['(-) Dívidas/financiamentos', 'debtService'], ['= Caixa disponível ao franqueado', 'availableCash', true],
];

function DreTable({ dre }) {
  return (
    <div className="fq-table-wrap">
      <table className="fq-table fq-dre-table">
        <thead><tr><th>Linha gerencial</th><th>Valor</th><th>% receita líquida</th></tr></thead>
        <tbody>
          {DRE_ROWS.map(([label, key, total]) => (
            <tr key={key} className={total ? 'fq-total-row' : ''}>
              <td>{label}</td><td>{brl(dre[key])}</td>
              <td>{dre.netRevenue ? pct((dre[key] / dre.netRevenue) * 100) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ConfigurationModal({ bundle, canEdit, onClose, onSaved }) {
  const [model, setModel] = useState({ ...bundle.model });
  const [monthly, setMonthly] = useState({ ...bundle.monthlyInput });
  const [network, setNetwork] = useState({ ...bundle.networkInput });
  const [marketing, setMarketing] = useState({ channel: '', campaign: '', amount: '', leads: '', new_paying_clients: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const update = (setter, key) => (value) => setter((current) => ({ ...current, [key]: value }));

  const handleSave = async () => {
    setSaving(true); setError('');
    try {
      await Promise.all([
        saveEconomicModel({ ...model, unit_id: bundle.selectedUnit.id, configured: true }),
        saveMonthlyInput({ ...monthly, unit_id: bundle.selectedUnit.id, period_month: bundle.period.month }),
        saveNetworkMonthlyInput({ ...network, network_id: bundle.selectedUnit.network_id, period_month: bundle.period.month }),
      ]);
      if (marketing.channel && Number(marketing.amount) >= 0) {
        await addMarketingInvestment({
          ...marketing, unit_id: bundle.selectedUnit.id, period_month: bundle.period.month,
          amount: Number(marketing.amount || 0), leads: Number(marketing.leads || 0),
          new_paying_clients: marketing.new_paying_clients === '' ? null : Number(marketing.new_paying_clients),
        });
      }
      await onSaved();
      onClose();
    } catch (saveError) { setError(saveError.message || 'Não foi possível salvar.'); }
    finally { setSaving(false); }
  };

  if (!canEdit) return null;
  return (
    <div className="fq-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="fq-modal" role="dialog" aria-modal="true" aria-label="Configurar modelo econômico">
        <header>
          <div><small>CONFIGURAÇÃO</small><h2>Premissas econômicas e custos</h2><p>Preencha uma vez o modelo e, mensalmente, apenas custos que o sistema não consegue captar.</p></div>
          <button className="fq-icon-btn" onClick={onClose} aria-label="Fechar"><X size={20} /></button>
        </header>
        <div className="fq-modal-body">
          <section><h3>1. Investimento inicial</h3><div className="fq-form-grid">
            <Field label="Taxa de franquia" value={model.franchise_fee} onChange={update(setModel, 'franchise_fee')} />
            <Field label="Obra e implantação" value={model.construction_investment} onChange={update(setModel, 'construction_investment')} />
            <Field label="Equipamentos" value={model.equipment_investment} onChange={update(setModel, 'equipment_investment')} />
            <Field label="Estoque inicial" value={model.initial_inventory} onChange={update(setModel, 'initial_inventory')} />
            <Field label="Marketing de inauguração" value={model.preopening_marketing} onChange={update(setModel, 'preopening_marketing')} />
            <Field label="Licenças e projetos" value={model.licenses_investment} onChange={update(setModel, 'licenses_investment')} />
            <Field label="Capital de giro" value={model.working_capital} onChange={update(setModel, 'working_capital')} />
            <Field label="Outros investimentos" value={model.other_initial_investment} onChange={update(setModel, 'other_initial_investment')} />
          </div></section>
          <section><h3>2. Regras da franquia e tributos</h3><div className="fq-form-grid">
            <label className="fq-field"><span>Tipo de royalty</span><select value={model.royalty_type || 'percentual'} onChange={(e) => update(setModel, 'royalty_type')(e.target.value)}><option value="percentual">Percentual</option><option value="fixo">Valor fixo</option><option value="isento">Isento</option></select></label>
            <Field label="Royalty" value={model.royalty_value} onChange={update(setModel, 'royalty_value')} suffix={model.royalty_type === 'percentual' ? '%' : 'R$'} />
            <label className="fq-field"><span>Tipo do fundo</span><select value={model.marketing_fund_type || 'percentual'} onChange={(e) => update(setModel, 'marketing_fund_type')(e.target.value)}><option value="percentual">Percentual</option><option value="fixo">Valor fixo</option><option value="isento">Isento</option></select></label>
            <Field label="Fundo de marketing" value={model.marketing_fund_value} onChange={update(setModel, 'marketing_fund_value')} suffix={model.marketing_fund_type === 'percentual' ? '%' : 'R$'} />
            <Field label="Alíquota de impostos" value={model.tax_rate} onChange={update(setModel, 'tax_rate')} suffix="%" />
            <Field label="Taxa média dos cartões" value={model.card_fee_rate} onChange={update(setModel, 'card_fee_rate')} suffix="%" />
            <Field label="Pró-labore mensal" value={model.monthly_pro_labore} onChange={update(setModel, 'monthly_pro_labore')} />
            <Field label="Parcela de financiamento" value={model.monthly_debt_service} onChange={update(setModel, 'monthly_debt_service')} />
          </div></section>
          <section><h3>3. Custos desta competência</h3><div className="fq-form-grid">
            {[['Folha salarial', 'payroll'], ['Encargos', 'payroll_charges'], ['Aluguel', 'rent'], ['Água, luz e internet', 'utilities'], ['Sistemas', 'systems'], ['Contábil e jurídico', 'accounting_legal'], ['Manutenção', 'maintenance'], ['Seguros', 'insurance'], ['Outros custos fixos', 'other_fixed_costs'], ['Insumos consumidos', 'supplies_cost'], ['Caixa inicial', 'opening_cash'], ['Caixa final', 'closing_cash'], ['Investimentos do mês (CAPEX)', 'capex']].map(([label, key]) => <Field key={key} label={label} value={monthly[key]} onChange={update(setMonthly, key)} />)}
          </div></section>
          <section><h3>4. Capacidade real da unidade <SourceTag type="pending" /></h3><p className="fq-help">Sem estes cinco campos, a ocupação aparece como pendente — não como 0%.</p><div className="fq-form-grid">
            <Field label="Salas simultâneas" value={model.rooms_count} onChange={update(setModel, 'rooms_count')} step="1" />
            <Field label="Profissionais simultâneos" value={model.professionals_capacity} onChange={update(setModel, 'professionals_capacity')} step="1" />
            <Field label="Dias operados/mês" value={model.operating_days_month} onChange={update(setModel, 'operating_days_month')} step="1" />
            <Field label="Horas abertas/dia" value={model.hours_per_day} onChange={update(setModel, 'hours_per_day')} />
            <Field label="Duração média real" value={model.average_session_minutes} onChange={update(setModel, 'average_session_minutes')} suffix="min" step="1" />
          </div></section>
          <section><h3>5. Marketing desta competência</h3><div className="fq-form-grid">
            <Field type="text" label="Canal" value={marketing.channel} onChange={update(setMarketing, 'channel')} placeholder="Ex.: Instagram Ads" />
            <Field type="text" label="Campanha" value={marketing.campaign} onChange={update(setMarketing, 'campaign')} placeholder="Opcional" />
            <Field label="Investimento" value={marketing.amount} onChange={update(setMarketing, 'amount')} />
            <Field label="Leads gerados" value={marketing.leads} onChange={update(setMarketing, 'leads')} step="1" />
            <Field label="Novos clientes pagantes" value={marketing.new_paying_clients} onChange={update(setMarketing, 'new_paying_clients')} step="1" />
          </div></section>
          <section><h3>6. Custos da franqueadora</h3><div className="fq-form-grid">
            {[['Equipe da franqueadora', 'franchisor_payroll'], ['Tecnologia da rede', 'technology_cost'], ['Suporte de campo', 'field_support_cost'], ['Expansão e vendas', 'sales_expansion_cost'], ['Administrativo', 'administrative_cost'], ['Outros custos', 'other_costs'], ['Uso do fundo de marketing', 'marketing_fund_spend'], ['Margem em produtos', 'product_margin_revenue'], ['Outras receitas', 'other_operating_revenue']].map(([label, key]) => <Field key={key} label={label} value={network[key]} onChange={update(setNetwork, key)} />)}
          </div></section>
          {error && <div className="fq-error"><AlertTriangle size={16} />{error}</div>}
        </div>
        <footer><button className="fq-btn fq-btn-ghost" onClick={onClose}>Cancelar</button><button className="fq-btn fq-btn-primary" onClick={handleSave} disabled={saving}>{saving ? <Loader2 className="spin" size={17} /> : <Save size={17} />} Salvar configuração</button></footer>
      </div>
    </div>
  );
}

function Overview({ snapshot, configured }) {
  const { dre, customers, operations, quality } = snapshot;
  return <>
    {!configured && <EmptyValue title="Modelo econômico ainda não configurado">As vendas abaixo são reais, mas lucro, ponto de equilíbrio e viabilidade dependem dos custos, impostos e taxas.</EmptyValue>}
    <div className="fq-metrics-grid">
      <Metric label="Receita líquida" value={brl(dre.netRevenue)} detail={`${number(dre.sessionCount)} venda(s) no mês`} source="real" tone="success" />
      <Metric label="EBITDA da unidade" value={configured ? brl(dre.ebitda) : 'Pendente'} detail={configured ? `${pct(dre.ebitdaMarginPct)} da receita líquida` : 'Configure os custos para calcular'} tone={dre.ebitda >= 0 ? 'success' : 'danger'} source={configured ? 'calculated' : 'pending'} />
      <Metric label="Ponto de equilíbrio" value={configured ? brl(dre.breakEvenRevenue) : 'Pendente'} detail={configured ? `Margem de segurança: ${pct(dre.safetyMarginPct)}` : 'Sem estimativa automática'} source={configured ? 'calculated' : 'pending'} />
      <Metric label="Qualidade dos dados" value={`${quality.score}%`} detail={`${quality.missing.length} pendência(s) para fechar o mês`} tone={quality.score >= 75 ? 'success' : 'warning'} source="calculated" />
    </div>
    <div className="fq-two-columns">
      <section className="fq-panel"><header><div><small>CLIENTES</small><h2>Aquisição e valor</h2></div><Users size={20} /></header>
        <div className="fq-stat-list">
          <StatusLine label="Clientes pagantes únicos" value={number(customers.uniquePayingClients)} good={customers.uniquePayingClients > 0} />
          <StatusLine label="Novos clientes pagantes" value={number(customers.newPayingClients)} good={customers.newPayingClients > 0} />
          <StatusLine label="Clientes recorrentes" value={`${number(customers.returningClients)} (${pct(customers.returningSharePct)})`} good={customers.returningClients > 0} />
          <StatusLine label="CAC" value={customers.cac === null ? 'Pendente' : brl(customers.cac)} good={customers.cac !== null} />
          <StatusLine label="LTV observado" value={customers.observedLtv === null ? 'Pendente' : brl(customers.observedLtv)} good={customers.observedLtv !== null} />
          <StatusLine label="Relação LTV/CAC" value={customers.ltvCacRatio === null ? 'Pendente' : `${customers.ltvCacRatio}x`} good={customers.ltvCacRatio >= 3} />
          <StatusLine label="Recompra em até 90 dias" value={customers.repurchase90Pct === null ? 'Pendente' : pct(customers.repurchase90Pct)} good={customers.repurchase90Pct >= 30} />
        </div>
      </section>
      <section className="fq-panel"><header><div><small>OPERAÇÃO</small><h2>Agenda que afeta o caixa</h2></div><Gauge size={20} /></header>
        <div className="fq-stat-list">
          <StatusLine label="Atendimentos finalizados" value={number(operations.completed)} good={operations.completed > 0} />
          <StatusLine label="Faltas" value={`${number(operations.noShows)} (${pct(operations.noShowRatePct)})`} good={operations.noShowRatePct <= 5} />
          <StatusLine label="Cancelamentos" value={`${number(operations.canceled)} (${pct(operations.cancellationRatePct)})`} good={operations.cancellationRatePct <= 10} />
          <StatusLine label="Capacidade mensal" value={operations.capacityConfigured ? `${number(operations.monthlyCapacity)} atendimentos` : 'Pendente'} good={operations.capacityConfigured} />
          <StatusLine label="Ocupação real" value={operations.capacityConfigured ? pct(operations.occupancyPct) : 'Pendente'} good={operations.capacityConfigured && operations.occupancyPct >= 60} />
        </div>
      </section>
    </div>
    <section className="fq-panel"><header><div><small>PROCEDIMENTOS</small><h2>O que realmente vende</h2></div><BarChart3 size={20} /></header>
      {operations.procedures.length ? <div className="fq-table-wrap"><table className="fq-table"><thead><tr><th>Procedimento</th><th>Sessões</th><th>Receita</th><th>Ticket médio</th></tr></thead><tbody>{operations.procedures.slice(0, 8).map((row) => <tr key={row.name}><td>{row.name}</td><td>{row.sessions}</td><td>{brl(row.revenue)}</td><td>{brl(row.averageTicket)}</td></tr>)}</tbody></table></div> : <p className="fq-muted">Nenhuma venda registrada nesta competência.</p>}
    </section>
  </>;
}

function Viability({ snapshot, model }) {
  const [growth, setGrowth] = useState(0);
  const [inflation, setInflation] = useState(0.4);
  const scenario = useMemo(() => projectFranchiseScenario({ model, baseDre: snapshot.dre, assumptions: { monthlyGrowthPct: growth, annualFixedInflationPct: inflation } }), [model, snapshot.dre, growth, inflation]);
  return <>
    <div className="fq-simulator-head">
      <div><small>SIMULADOR</small><h2>O investimento se paga para o franqueado?</h2><p>Projeção usa a DRE atual como base. Não altera os dados reais.</p></div>
      <div className="fq-inline-fields"><Field label="Crescimento mensal" value={growth} onChange={setGrowth} suffix="%" /><Field label="Inflação anual dos custos" value={inflation} onChange={setInflation} suffix="%" /></div>
    </div>
    <div className="fq-metrics-grid">
      <Metric label="Investimento inicial" value={brl(scenario.initialInvestment)} detail="Taxa + obra + equipamentos + capital de giro" source="calculated" />
      <Metric label="Payback simples" value={scenario.paybackMonth ? `${scenario.paybackMonth} meses` : 'Não atingido'} detail={`Horizonte de ${scenario.projectionMonths} meses`} tone={scenario.viableInHorizon ? 'success' : 'danger'} source="projected" />
      <Metric label="VPL" value={brl(scenario.npv)} detail={`Desconto anual de ${model.annual_discount_rate || 12}%`} tone={scenario.npv >= 0 ? 'success' : 'danger'} source="projected" />
      <Metric label="TIR anual" value={pct(scenario.irrAnnualPct)} detail={`ROI no horizonte: ${pct(scenario.roiPct)}`} tone={scenario.irrAnnualPct > (model.annual_discount_rate || 12) ? 'success' : 'warning'} source="projected" />
    </div>
    <section className="fq-panel"><header><div><small>FLUXO DE CAIXA</small><h2>Acumulado após o investimento</h2></div><TrendingUp size={20} /></header>
      <div className="fq-chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={scenario.rows}><defs><linearGradient id="fqCash" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#8f655b" stopOpacity={0.35}/><stop offset="95%" stopColor="#8f655b" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" stroke="#eadbd7"/><XAxis dataKey="month" tickFormatter={(v) => `M${v}`} /><YAxis tickFormatter={(v) => `${Math.round(v / 1000)}k`} /><Tooltip formatter={(v) => brl(v)} labelFormatter={(v) => `Mês ${v}`} /><Area type="monotone" dataKey="cumulative" name="Caixa acumulado" stroke="#8f655b" fill="url(#fqCash)" strokeWidth={2}/></AreaChart></ResponsiveContainer></div>
    </section>
  </>;
}

function Network({ bundle, snapshot, franchisor, onCreateUnit }) {
  const closesByUnit = new Map(
    bundle.closes
      .filter((close) => close.period_month === bundle.period.month)
      .map((close) => [close.unit_id, close]),
  );
  return <>
    <div className="fq-section-heading"><div><small>REDE</small><h2>Saúde das unidades e da franqueadora</h2><p>O fundo de marketing é controlado à parte e não entra como lucro.</p></div><button className="fq-btn fq-btn-secondary" onClick={onCreateUnit}><Plus size={16}/> Nova unidade</button></div>
    <div className="fq-two-columns">
      <section className="fq-panel"><header><div><small>UNIDADE SELECIONADA</small><h2>{bundle.selectedUnit.name}</h2></div><Store size={20}/></header><div className="fq-stat-list">
        <StatusLine label="Status cadastral" value={bundle.selectedUnit.status} good={bundle.selectedUnit.status === 'ativa'} />
        <StatusLine label="EBITDA" value={bundle.model.configured ? brl(snapshot.dre.ebitda) : 'Pendente'} good={bundle.model.configured && snapshot.dre.ebitda > 0} />
        <StatusLine label="Margem de segurança" value={bundle.model.configured ? pct(snapshot.dre.safetyMarginPct) : 'Pendente'} good={snapshot.dre.safetyMarginPct > 10} />
        <StatusLine label="Última auditoria" value={bundle.audits[0]?.audit_date || 'Não realizada'} good={Boolean(bundle.audits[0])} />
      </div></section>
      <section className="fq-panel"><header><div><small>FRANQUEADORA</small><h2>Resultado separado</h2></div><Building2 size={20}/></header><div className="fq-stat-list">
        <StatusLine label="Receita operacional" value={brl(franchisor.operatingRevenue)} good={franchisor.operatingRevenue > 0} />
        <StatusLine label="EBITDA da franqueadora" value={brl(franchisor.ebitda)} good={franchisor.ebitda > 0} />
        <StatusLine label="Fundo coletado" value={brl(franchisor.marketingFundCollected)} good={true} />
        <StatusLine label="Saldo do fundo" value={brl(franchisor.marketingFundBalance)} good={franchisor.marketingFundBalance >= 0} />
      </div></section>
    </div>
    <section className="fq-panel"><header><div><small>UNIDADES</small><h2>Cadastro e fechamento da rede</h2></div><Building2 size={20}/></header><div className="fq-table-wrap"><table className="fq-table"><thead><tr><th>Código</th><th>Unidade</th><th>Tipo</th><th>Cidade/UF</th><th>Receita líquida</th><th>EBITDA</th><th>Qualidade</th><th>Status</th></tr></thead><tbody>{bundle.units.map((unit) => {
      const close = closesByUnit.get(unit.id);
      const current = unit.id === bundle.selectedUnit.id ? { snapshot, data_quality_score: snapshot.quality.score } : close;
      return <tr key={unit.id}><td>{unit.code}</td><td>{unit.name}{unit.is_pilot && <span className="fq-pill">Piloto</span>}</td><td>{unit.unit_type}</td><td>{[unit.city, unit.state].filter(Boolean).join('/') || 'Pendente'}</td><td>{current?.snapshot?.dre ? brl(current.snapshot.dre.netRevenue) : 'Sem fechamento'}</td><td>{current?.snapshot?.dre ? brl(current.snapshot.dre.ebitda) : '—'}</td><td>{current ? `${current.data_quality_score ?? current.snapshot?.quality?.score ?? 0}%` : '—'}</td><td><span className={`fq-status fq-status-${unit.status}`}>{unit.status}</span></td></tr>;
    })}</tbody></table></div></section>
    <section className="fq-panel"><header><div><small>PADRÕES E COF</small><h2>Documentos e evidências</h2></div><ShieldCheck size={20}/></header>
      {bundle.documents.length ? <div className="fq-table-wrap"><table className="fq-table"><thead><tr><th>Documento</th><th>Versão</th><th>Validade</th><th>Status</th></tr></thead><tbody>{bundle.documents.map((doc) => <tr key={doc.id}><td>{doc.title}</td><td>{doc.version}</td><td>{doc.expires_at || 'Sem vencimento'}</td><td>{doc.status}</td></tr>)}</tbody></table></div> : <EmptyValue title="Biblioteca documental ainda vazia">Cadastre COF, contrato, manuais, padrões operacionais, treinamentos e evidências antes da expansão.</EmptyValue>}
    </section>
  </>;
}

function FullReport({ bundle, snapshot, franchisor, onCloseMonth, closing }) {
  const exportCsv = () => {
    const rows = [
      ['RELATORIO DE FRANQUIA', bundle.selectedUnit.name], ['Competencia', bundle.period.month],
      ['Receita liquida', snapshot.dre.netRevenue], ['EBITDA unidade', snapshot.dre.ebitda],
      ['Caixa disponivel franqueado', snapshot.dre.availableCash], ['Ponto de equilibrio', snapshot.dre.breakEvenRevenue],
      ['CAC', snapshot.customers.cac ?? 'Pendente'], ['LTV observado', snapshot.customers.observedLtv ?? 'Pendente'],
      ['Payback meses', snapshot.scenario.paybackMonth ?? 'Nao atingido'], ['VPL', snapshot.scenario.npv],
      ['EBITDA franqueadora', franchisor.ebitda], ['Qualidade dos dados', snapshot.quality.score],
    ];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(';')).join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob); const link = document.createElement('a');
    link.href = url; link.download = `franquia-${bundle.selectedUnit.code}-${bundle.period.month}.csv`; link.click(); URL.revokeObjectURL(url);
  };
  return <>
    <div className="fq-report-actions"><div><small>RELATÓRIO GERENCIAL</small><h2>Diagnóstico completo da competência</h2><p>Base pronta para prestação de contas, conselho e acompanhamento do franqueado.</p></div><div><button className="fq-btn fq-btn-ghost" onClick={exportCsv}><Download size={16}/> Exportar CSV</button><button className="fq-btn fq-btn-ghost" onClick={() => window.print()}><FileCheck2 size={16}/> Imprimir/PDF</button><button className="fq-btn fq-btn-primary" onClick={onCloseMonth} disabled={closing}>{closing ? <Loader2 className="spin" size={16}/> : <LockKeyhole size={16}/>} Fechar mês</button></div></div>
    <section className="fq-report-cover"><div><span>EVELYN ESTHETIC CENTER</span><h1>Relatório de franquia e viabilidade</h1><p>{bundle.selectedUnit.name} · {monthLabel(bundle.period.month.slice(0, 7))}</p></div><div className="fq-score"><strong>{snapshot.quality.score}%</strong><span>qualidade dos dados</span></div></section>
    <div className="fq-two-columns">
      <section className="fq-panel"><header><div><small>RESUMO</small><h2>Diagnóstico</h2></div><Target size={20}/></header><div className="fq-stat-list">
        <StatusLine label="Unidade operacionalmente lucrativa" value={bundle.model.configured ? (snapshot.dre.ebitda > 0 ? 'Sim' : 'Não') : 'Pendente'} good={snapshot.dre.ebitda > 0} />
        <StatusLine label="Receita acima do ponto de equilíbrio" value={bundle.model.configured ? (snapshot.dre.safetyMarginPct >= 0 ? 'Sim' : 'Não') : 'Pendente'} good={snapshot.dre.safetyMarginPct >= 0} />
        <StatusLine label="LTV maior que 3x o CAC" value={snapshot.customers.ltvCacRatio === null ? 'Pendente' : `${snapshot.customers.ltvCacRatio}x`} good={snapshot.customers.ltvCacRatio >= 3} />
        <StatusLine label="Payback no horizonte" value={snapshot.scenario.paybackMonth ? `${snapshot.scenario.paybackMonth} meses` : 'Não atingido'} good={snapshot.scenario.viableInHorizon} />
      </div></section>
      <section className="fq-panel"><header><div><small>PENDÊNCIAS</small><h2>Antes de decidir</h2></div><AlertTriangle size={20}/></header>{snapshot.quality.missing.length ? <ul className="fq-checklist">{snapshot.quality.missing.map((item) => <li key={item.key}><AlertTriangle size={15}/>{item.label}</li>)}</ul> : <div className="fq-all-good"><CheckCircle2 size={26}/><strong>Dados mínimos completos</strong><span>A competência pode ser fechada.</span></div>}</section>
    </div>
    <section className="fq-panel"><header><div><small>DRE</small><h2>Resultado detalhado da unidade</h2></div><CircleDollarSign size={20}/></header><DreTable dre={snapshot.dre}/></section>
    <div className="fq-two-columns">
      <section className="fq-panel"><header><div><small>ECONOMIA DA UNIDADE</small><h2>Indicadores de sobrevivência</h2></div><TrendingUp size={20}/></header><div className="fq-stat-list">
        <StatusLine label="Margem EBITDA" value={pct(snapshot.dre.ebitdaMarginPct)} good={snapshot.dre.ebitdaMarginPct > 0} />
        <StatusLine label="Cobertura da dívida (DSCR)" value={snapshot.dre.debtCoverageRatio === null ? 'Sem dívida configurada' : `${snapshot.dre.debtCoverageRatio}x`} good={snapshot.dre.debtCoverageRatio === null || snapshot.dre.debtCoverageRatio >= 1.2} />
        <StatusLine label="Fôlego de caixa" value={snapshot.dre.cashRunwayMonths === null ? (snapshot.dre.ebitda >= 0 ? 'Operação positiva' : 'Pendente') : `${snapshot.dre.cashRunwayMonths} meses`} good={snapshot.dre.ebitda >= 0 || snapshot.dre.cashRunwayMonths >= 6} />
        <StatusLine label="Margem de segurança" value={pct(snapshot.dre.safetyMarginPct)} good={snapshot.dre.safetyMarginPct >= 10} />
      </div></section>
      <section className="fq-panel"><header><div><small>CLIENTES</small><h2>Retenção e valor</h2></div><Users size={20}/></header><div className="fq-stat-list">
        <StatusLine label="Frequência média histórica" value={snapshot.customers.averagePurchaseFrequency === null ? 'Pendente' : `${snapshot.customers.averagePurchaseFrequency} compras`} good={snapshot.customers.averagePurchaseFrequency > 1} />
        <StatusLine label="Intervalo médio entre compras" value={snapshot.customers.averageDaysBetweenPurchases === null ? 'Pendente' : `${snapshot.customers.averageDaysBetweenPurchases} dias`} good={snapshot.customers.averageDaysBetweenPurchases !== null} />
        <StatusLine label="Recompra em 30 dias" value={pct(snapshot.customers.repurchase30Pct)} good={snapshot.customers.repurchase30Pct >= 20} />
        <StatusLine label="Recompra em 60 dias" value={pct(snapshot.customers.repurchase60Pct)} good={snapshot.customers.repurchase60Pct >= 25} />
        <StatusLine label="Recompra em 90 dias" value={pct(snapshot.customers.repurchase90Pct)} good={snapshot.customers.repurchase90Pct >= 30} />
      </div></section>
    </div>
  </>;
}

function NewUnitModal({ networkId, onClose, onCreated }) {
  const [form, setForm] = useState({ code: '', name: '', unit_type: 'franqueada', status: 'implantacao', city: '', state: '', owner_name: '' });
  const [saving, setSaving] = useState(false); const [error, setError] = useState('');
  const save = async () => { setSaving(true); setError(''); try { await createFranchiseUnit({ ...form, network_id: networkId, code: form.code.toUpperCase() }); await onCreated(); onClose(); } catch (e) { setError(e.message); } finally { setSaving(false); } };
  return <div className="fq-modal-backdrop"><div className="fq-modal fq-modal-small"><header><div><small>REDE</small><h2>Nova unidade</h2></div><button className="fq-icon-btn" onClick={onClose}><X size={20}/></button></header><div className="fq-modal-body"><div className="fq-form-grid"><Field type="text" label="Código" value={form.code} onChange={(v) => setForm({ ...form, code: v })}/><Field type="text" label="Nome da unidade" value={form.name} onChange={(v) => setForm({ ...form, name: v })}/><Field type="text" label="Cidade" value={form.city} onChange={(v) => setForm({ ...form, city: v })}/><Field type="text" label="UF" value={form.state} onChange={(v) => setForm({ ...form, state: v })}/><Field type="text" label="Franqueado/responsável" value={form.owner_name} onChange={(v) => setForm({ ...form, owner_name: v })}/></div>{error && <div className="fq-error">{error}</div>}</div><footer><button className="fq-btn fq-btn-ghost" onClick={onClose}>Cancelar</button><button className="fq-btn fq-btn-primary" disabled={!form.code || !form.name || saving} onClick={save}>{saving ? <Loader2 className="spin" size={16}/> : <Plus size={16}/>} Criar unidade</button></footer></div></div>;
}

export default function Franquia() {
  const { canEdit } = useAuth();
  const [activeTab, setActiveTab] = useState('resumo');
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [unitId, setUnitId] = useState('');
  const [bundle, setBundle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [unitModalOpen, setUnitModalOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const editable = canEdit('franquia');

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const data = await loadFranchiseBundle({ periodMonth: `${month}-01`, unitId: unitId || undefined });
      setBundle(data);
      if (!unitId && data.selectedUnit?.id) setUnitId(data.selectedUnit.id);
    } catch (loadError) { setError(loadError); }
    finally { setLoading(false); }
  }, [month, unitId]);
  useEffect(() => { load(); }, [load]);

  const snapshot = useMemo(() => bundle ? buildFranchiseSnapshot({
    transactions: bundle.transactions,
    allTransactions: bundle.transactions,
    appointments: bundle.appointments,
    marketingInvestments: bundle.marketingInvestments,
    monthlyInput: bundle.monthlyInput,
    model: bundle.model,
    periodStart: bundle.period.start,
    periodEnd: bundle.period.end,
  }) : null, [bundle]);
  const franchisor = useMemo(() => {
    if (!bundle || !snapshot) return null;
    const otherUnitDres = bundle.closes
      .filter((close) => close.period_month === bundle.period.month && close.unit_id !== bundle.selectedUnit.id)
      .map((close) => close.snapshot?.dre)
      .filter(Boolean);
    return calculateFranchisorResult({
      unitDres: [snapshot.dre, ...otherUnitDres],
      feeLedger: bundle.feeLedger,
      networkInput: bundle.networkInput,
    });
  }, [bundle, snapshot]);

  const closeMonth = async () => {
    if (!bundle || !snapshot) return;
    if (!window.confirm(`Fechar ${monthLabel(month)} com qualidade de dados em ${snapshot.quality.score}%?`)) return;
    setClosing(true);
    try { await saveMonthlyClose({ unit_id: bundle.selectedUnit.id, period_month: bundle.period.month, status: 'fechado', data_quality_score: snapshot.quality.score, snapshot: { ...snapshot, franchisor }, missing_items: snapshot.quality.missing, closed_at: new Date().toISOString() }); await load(); }
    catch (closeError) { window.alert(closeError.message || 'Não foi possível fechar o mês.'); }
    finally { setClosing(false); }
  };

  if (loading && !bundle) return <div className="fq-loading"><Loader2 className="spin"/><span>Calculando a operação real...</span></div>;
  if (error?.code === 'FRANCHISE_SETUP_REQUIRED') return <div className="fq-setup"><Building2 size={34}/><h1>Instalação do módulo Franquia</h1><p>Execute o arquivo <strong>franchise_management_migration.sql</strong> no SQL Editor do Supabase e atualize esta página.</p><button className="fq-btn fq-btn-primary" onClick={load}><RefreshCw size={16}/> Verificar novamente</button></div>;
  if (error) return <div className="fq-setup"><AlertTriangle size={34}/><h1>Não foi possível carregar</h1><p>{error.message}</p><button className="fq-btn fq-btn-primary" onClick={load}><RefreshCw size={16}/> Tentar novamente</button></div>;
  if (!bundle || !snapshot) return null;

  return (
    <main className="fq-page">
      <header className="fq-page-header">
        <div><span className="fq-eyebrow"><Building2 size={15}/> FRANQUIA & VIABILIDADE</span><h1>Gestão econômica da rede</h1><p>Lucro real da unidade, retorno do franqueado e sustentabilidade da franqueadora.</p></div>
        <div className="fq-page-actions">
          <select value={unitId} onChange={(event) => setUnitId(event.target.value)}>{bundle.units.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}</select>
          <input type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
          {editable && <button className="fq-btn fq-btn-primary" onClick={() => setSettingsOpen(true)}><Settings2 size={17}/> Configurar números</button>}
        </div>
      </header>
      <div className="fq-context-bar"><div><Store size={16}/><span><strong>{bundle.selectedUnit.name}</strong> · {monthLabel(month)}</span></div><div><SourceTag type="real"/><span>Vendas e agenda sincronizadas</span><SourceTag type={bundle.model.configured ? 'calculated' : 'pending'}/><span>Custos e viabilidade</span></div></div>
      <nav className="fq-tabs">{TABS.map((tab) => <button key={tab.id} className={activeTab === tab.id ? 'active' : ''} onClick={() => setActiveTab(tab.id)}>{tab.label}</button>)}</nav>
      <div className="fq-content">
        {activeTab === 'resumo' && <Overview snapshot={snapshot} configured={bundle.model.configured} />}
        {activeTab === 'dre' && <><div className="fq-section-heading"><div><small>DEMONSTRAÇÃO GERENCIAL</small><h2>DRE da unidade</h2><p>Do faturamento ao caixa que realmente sobra para o franqueado.</p></div><SourceTag type={bundle.model.configured ? 'calculated' : 'pending'}/></div><section className="fq-panel"><DreTable dre={snapshot.dre}/></section><div className="fq-metrics-grid fq-three"><Metric label="Margem de contribuição" value={pct(snapshot.dre.contributionMarginPct)} detail={brl(snapshot.dre.contributionAfterFranchiseFees)} /><Metric label="Margem EBITDA" value={pct(snapshot.dre.ebitdaMarginPct)} detail={brl(snapshot.dre.ebitda)} tone={snapshot.dre.ebitda >= 0 ? 'success' : 'danger'} /><Metric label="Margem de segurança" value={pct(snapshot.dre.safetyMarginPct)} detail={`Equilíbrio em ${brl(snapshot.dre.breakEvenRevenue)}`} tone={snapshot.dre.safetyMarginPct >= 10 ? 'success' : 'warning'} /></div></>}
        {activeTab === 'viabilidade' && <Viability snapshot={snapshot} model={bundle.model}/>} 
        {activeTab === 'rede' && <Network bundle={bundle} snapshot={snapshot} franchisor={franchisor} onCreateUnit={() => editable && setUnitModalOpen(true)}/>} 
        {activeTab === 'relatorio' && <FullReport bundle={bundle} snapshot={snapshot} franchisor={franchisor} onCloseMonth={closeMonth} closing={closing}/>} 
      </div>
      {settingsOpen && <ConfigurationModal bundle={bundle} canEdit={editable} onClose={() => setSettingsOpen(false)} onSaved={load}/>} 
      {unitModalOpen && <NewUnitModal networkId={bundle.selectedUnit.network_id} onClose={() => setUnitModalOpen(false)} onCreated={load}/>} 
    </main>
  );
}
