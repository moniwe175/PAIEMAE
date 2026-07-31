import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  DollarSign, Plus, XCircle, FileSpreadsheet, Link2, Wallet,
  Printer, Lock, Unlock, AlertTriangle, Clock, CheckCircle, X,
  CreditCard, Banknote, Landmark, TrendingUp, TrendingDown,
  ArrowUpRight, ArrowDownLeft, User, Percent, Edit3, Trash2,
  Filter, Minus, Receipt, ShieldCheck, Calculator, RefreshCw
} from 'lucide-react';
import { useSync } from '../contexts/SyncContext';
import { paymentMethods, calcularSplit } from '../mocks/financial';
import { fetchDailyReports } from '../services/supabaseService';

const TABS = [
  { key: 'caixa', label: 'Caixa' },
  { key: 'transacoes', label: 'Transações' },
  { key: 'despesas', label: 'Despesas' },
  { key: 'split', label: 'Split' },
];

const STATUS_LABELS = { paid: 'Pago', pending: 'Pendente', cancelled: 'Cancelado' };
const STATUS_COLORS = { paid: 'var(--success)', pending: '#E6A800', cancelled: 'var(--danger)' };
const STATUS_BG = { paid: 'var(--success-bg)', pending: '#FFF8E1', cancelled: 'var(--danger-bg)' };

function hoje() { return new Date().toLocaleDateString('pt-BR'); }
function fmtCurrency(v) { return v === undefined || v === null || isNaN(v) ? 'R$ --' : `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
function normalizeTx(t) {
  const total = t.total ?? t.valor ?? 0;
  const split = t.clinica !== undefined ? { clinica: t.clinica, profissional: t.profissional } : calcularSplit(total, 40);
  return {
    ...t,
    hora: t.hora || '--:--',
    cliente: t.cliente || '—',
    procedimento: t.procedimento || t.desc || '—',
    total,
    clinica: split.clinica,
    profissional: split.profissional,
    pagamento: t.pagamento || 'Pix',
    status: t.status || 'paid',
    profissionalNome: t.profissionalNome || t.prof || '—',
  };
}

export default function Financial() {
  const {
    transactions, addTransaction,
    expenses, addExpense, removeExpense,
    cashier, abrirCaixa, fecharCaixa, realizarSangria,
    splitConfig, updateSplitConfig,
    syncStatus, addLog,
    supabaseConnected, connectionError,
    dailySheet,
    pythonSyncStatus,
    lastSyncAt, syncedRowCount,
    saveDailyReport,
  } = useSync();

  const [activeTab, setActiveTab] = useState('caixa');
  const [sangriaModal, setSangriaModal] = useState(false);
  const [caixaConfirm, setCaixaConfirm] = useState(null); // { type: 'abrir' | 'fechar' | 'fechar-pendente', title, message }
  const [caixaLoading, setCaixaLoading] = useState(false);
  const [txModal, setTxModal] = useState(false);
  const [despesaModal, setDespesaModal] = useState(false);
  const [splitEdit, setSplitEdit] = useState(null);
  const [sangriaForm, setSangriaForm] = useState({ valor: '', motivo: '' });
  const [txForm, setTxForm] = useState({ cliente: '', procedimento: '', total: '', pagamento: 'Pix', status: 'paid', profissionalNome: '' });
  const [despesaForm, setDespesaForm] = useState({ descricao: '', categoria: '', valor: '', metodoPagamento: 'Pix' });
  const [txFiltroStatus, setTxFiltroStatus] = useState('todos');
  const [expFiltroCat, setExpFiltroCat] = useState('todos');

  // Estados do Sistema de Caixa (Validação Financeira)
  const [fundoInicialInput, setFundoInicialInput] = useState('0');
  const [fundoFinalRealInput, setFundoFinalRealInput] = useState('0');
  const [reportsHistory, setReportsHistory] = useState([]);
  const [savingReport, setSavingReport] = useState(false);

  const loadReports = useCallback(async () => {
    const { data } = await fetchDailyReports(30);
    setReportsHistory(data ?? []);
  }, []);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  // ─── Caixa confirmation handlers ────────────────────────────
  const handlePromptAbrirCaixa = () => {
    if (cashier.status === 'aberto') {
      const hojeStr = hoje();
      const isDiaAnterior = cashier.dataAbertura && cashier.dataAbertura !== hojeStr;
      setCaixaConfirm({
        type: 'fechar-pendente',
        title: isDiaAnterior ? 'Caixa do dia anterior em aberto' : 'Caixa já está aberto',
        message: isDiaAnterior
          ? `O caixa do dia ${cashier.dataAbertura} ainda não foi fechado. O sistema irá fechá-lo e abrir o caixa de hoje (${hojeStr}). Deseja continuar?`
          : `O caixa já está aberto desde ${cashier.horaAbertura}. Deseja fechá-lo e reabrir?`,
        action: async () => {
          setCaixaLoading(true);
          await new Promise(r => setTimeout(r, 600));
          fecharCaixa();
          await new Promise(r => setTimeout(r, 300));
          abrirCaixa(0);
          setCaixaLoading(false);
          setCaixaConfirm(null);
        },
      });
    } else {
      setCaixaConfirm({
        type: 'abrir',
        title: 'Abrir Caixa',
        message: `Você está prestes a abrir o caixa do dia ${hoje()}. O sistema irá iniciar um novo período de recebimentos e despesas. Tem certeza?`,
        action: async () => {
          setCaixaLoading(true);
          await new Promise(r => setTimeout(r, 600));
          abrirCaixa(0);
          setCaixaLoading(false);
          setCaixaConfirm(null);
        },
      });
    }
  };

  const handlePromptFecharCaixa = () => {
    const resumo = dailySheet
      ? `\n\nResumo da planilha:\n• Faturamento Bruto: R$ ${dailySheet.faturamentoBruto.toFixed(2)}\n• Despesas (Sangria): R$ ${(dailySheet.totalDespesas || 0).toFixed(2)}\n• Faturamento Líquido: R$ ${(dailySheet.faturamentoLiquido ?? dailySheet.faturamentoBruto).toFixed(2)}\n• PIX: R$ ${dailySheet.totalPix.toFixed(2)} | Crédito: R$ ${dailySheet.totalCredito.toFixed(2)}\n• Débito: R$ ${dailySheet.totalDebito.toFixed(2)} | Dinheiro: R$ ${dailySheet.totalDinheiro.toFixed(2)}\n• Total de transações: ${dailySheet.totalTransacoes}`
      : '\n\nAtenção: Nenhum dado da planilha disponível. O relatório será salvo vazio.';

    setCaixaConfirm({
      type: 'fechar',
      title: 'Fechar Caixa',
      message: `Você está prestes a fechar o caixa do dia ${cashier.dataAbertura || hoje()}. O sistema irá gerar o relatório final consolidado e enviá-lo ao Supabase. Esta ação não pode ser desfeita. Tem certeza?${resumo}`,
      action: async () => {
        setCaixaLoading(true);
        const result = await fecharCaixa();
        setCaixaLoading(false);
        if (result && result.success) {
          addLog('success', `Caixa fechado com sucesso! Relatório salvo.`);
        } else if (result && result.error) {
          addLog('error', `Erro ao fechar caixa: ${result.error}`);
          alert(`Erro ao salvar relatório: ${result.error}`);
        }
        setCaixaConfirm(null);
      },
    });
  };

  const handleConfirmCaixa = async () => {
    if (caixaConfirm?.action) {
      await caixaConfirm.action();
    }
  };

  const isConnected = syncStatus === 'connected';
  // Defensive: Supabase may return null instead of [] when the table is empty
  const safeTx = Array.isArray(transactions) ? transactions : [];
  const safeExp = Array.isArray(expenses) ? expenses : [];
  const hasData = dailySheet || safeTx.length > 0 || safeExp.length > 0;

  const txsHoje = useMemo(() => {
    return safeTx.map(normalizeTx).filter(t => t.data === hoje() && t.status === 'paid');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions]);

  // Calcular totais direto das transactions do Supabase (espelho exato da planilha)
  const faturamentoHoje = txsHoje.reduce((a, t) => a + t.total, 0);
  const ticketMedio = txsHoje.length > 0 ? faturamentoHoje / txsHoje.length : 0;
  const aReceber = safeTx.map(normalizeTx).filter(t => t.status === 'pending').reduce((a, t) => a + t.total, 0);
  const pendentesCount = safeTx.map(normalizeTx).filter(t => t.status === 'pending').length;

  // Formas de pagamento calculadas direto do Supabase
  const formasPagamento = useMemo(() => {
    const counts = {};
    txsHoje.forEach(t => {
      const pg = (t.pagamento || 'pix').toLowerCase();
      counts[pg] = (counts[pg] || 0) + t.total;
    });
    const total = Object.values(counts).reduce((a, v) => a + v, 0) || 1;
    return paymentMethods.map(pm => ({
      ...pm,
      valor: counts[(pm.nome || '').toLowerCase()] || counts[pm.id] || 0,
      pct: Math.round(((counts[(pm.nome || '').toLowerCase()] || counts[pm.id] || 0) / total) * 100),
    }));
  }, [txsHoje]);

  // Cálculo das variáveis do Sistema de Caixa (Daily Reports)
  const totalsCaixa = useMemo(() => {
    let dinheiro = 0;
    let pix = 0;
    let credito = 0;
    let debito = 0;

    txsHoje.forEach(t => {
      const v = Number(t.total ?? t.valor ?? 0);
      const pg = String(t.pagamento || t.forma_pagamento || '').toLowerCase();
      if (pg.includes('dinheiro') || pg.includes('cash') || pg.includes('especie')) dinheiro += v;
      else if (pg.includes('pix') || pg.includes('transf')) pix += v;
      else if (pg.includes('credito')) credito += v;
      else if (pg.includes('debito')) debito += v;
      else pix += v;
    });

    const fundoInicial = parseFloat(fundoInicialInput) || 0;
    const fundoFinalReal = parseFloat(fundoFinalRealInput) || 0;
    const fundoFinalCalculado = fundoInicial + dinheiro;
    const diferenca = fundoFinalReal - fundoFinalCalculado;
    const status = diferenca === 0 ? 'ok' : 'erro';

    return {
      dinheiro,
      pix,
      credito,
      debito,
      fundoInicial,
      fundoFinalReal,
      fundoFinalCalculado,
      diferenca,
      status,
    };
  }, [txsHoje, fundoInicialInput, fundoFinalRealInput]);

  const handleSaveDailyReport = async () => {
    setSavingReport(true);
    const result = await saveDailyReport({
      fundo_inicial: totalsCaixa.fundoInicial,
      fundo_final_real: totalsCaixa.fundoFinalReal,
      data: hoje(),
    });
    setSavingReport(false);
    if (result && !result.error) {
      alert(`Relatório do caixa salvo com sucesso no Supabase! Status: ${totalsCaixa.status.toUpperCase()}`);
      loadReports();
    } else {
      alert(`Erro ao salvar relatório: ${result?.error || 'Erro desconhecido'}`);
    }
  };

  // Transações filtradas: fonte única = Supabase (mantido em espelho pelo Python sync)
  const txFiltradas = useMemo(() => {
    const all = safeTx
      .map(normalizeTx)
      .sort((a, b) => Number(a.ordem ?? 0) - Number(b.ordem ?? 0));
    return all.filter(t => txFiltroStatus === 'todos' || t.status === txFiltroStatus);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions, txFiltroStatus]);

  const expFiltradas = useMemo(() => {
    // Merge Supabase expenses + sheet expense rows
    const sheetExpenses = (dailySheet?.expenseRows || []).map(e => ({
      id: `sheet_${e.categoria}`,
      data: dailySheet?.dataCaixa || '--',
      descricao: e.categoria,
      categoria: e.categoria,
      metodo: 'Planilha',
      valor: e.valor,
      origem: 'planilha',
    }));
    const all = [...safeExp, ...sheetExpenses];
    return all.filter(e => expFiltroCat === 'todos' || e.categoria === expFiltroCat);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expenses, dailySheet, expFiltroCat]);

  const handleSangria = () => {
    const v = parseFloat(sangriaForm.valor);
    if (!v || v <= 0) { alert('Informe um valor válido.'); return; }
    if (!sangriaForm.motivo.trim()) { alert('Informe o motivo.'); return; }
    realizarSangria(v, sangriaForm.motivo.trim());
    setSangriaForm({ valor: '', motivo: '' });
    setSangriaModal(false);
  };

  const handleAddTx = () => {
    if (!supabaseConnected) { alert('Modo somente leitura: Supabase desconectado.'); return; }
    const total = parseFloat(txForm.total);
    if (!txForm.cliente.trim() || !txForm.procedimento.trim() || !total) {
      alert('Preencha cliente, procedimento e valor.');
      return;
    }
    const split = calcularSplit(total, 40);
    const result = addTransaction({
      hora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      cliente: txForm.cliente.trim(),
      procedimento: txForm.procedimento.trim(),
      total,
      clinica: split.clinica,
      profissional: split.profissional,
      pagamento: txForm.pagamento,
      status: txForm.status,
      profissionalNome: txForm.profissionalNome || '—',
      data: hoje(),
      origem: 'manual',
      tipo: 'receita',
    });
    if (result === null) return;
    setTxForm({ cliente: '', procedimento: '', total: '', pagamento: 'Pix', status: 'paid', profissionalNome: '' });
    setTxModal(false);
  };

  const handleAddDespesa = () => {
    if (!supabaseConnected) { alert('Modo somente leitura: Supabase desconectado.'); return; }
    const v = parseFloat(despesaForm.valor);
    if (!despesaForm.descricao.trim() || !v) { alert('Preencha descrição e valor.'); return; }
    const result = addExpense({
      data: hoje(),
      descricao: despesaForm.descricao.trim(),
      categoria: despesaForm.categoria || 'Outros',
      valor: v,
      metodoPagamento: despesaForm.metodoPagamento,
      origem: 'manual',
    });
    if (result === null) return;
    setDespesaForm({ descricao: '', categoria: '', valor: '', metodoPagamento: 'Pix' });
    setDespesaModal(false);
  };

  const handleSplitSave = () => {
    if (splitEdit) {
      updateSplitConfig(splitEdit.profissional, splitEdit.percentual);
      setSplitEdit(null);
    }
  };

  return (
    <div>
      {/* Sangria Modal */}
      {sangriaModal && (
        <div className="modal-overlay" onClick={() => setSangriaModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <span className="modal-title"><Minus />Realizar Sangria</span>
              <button className="modal-close" onClick={() => setSangriaModal(false)}><XCircle /></button>
            </div>
            <div className="form-group">
              <label className="form-label">Valor (R$)</label>
              <input className="form-input" type="number" placeholder="0,00" value={sangriaForm.valor} onChange={e => setSangriaForm(f => ({ ...f, valor: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Motivo</label>
              <input className="form-input" placeholder="Ex: Troco, pagamento fornecedor..." value={sangriaForm.motivo} onChange={e => setSangriaForm(f => ({ ...f, motivo: e.target.value }))} />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
              <button className="btn btn-ghost" onClick={() => setSangriaModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSangria} style={{ background: 'var(--danger)', borderColor: 'var(--danger)' }}>
                <Minus />Confirmar Sangria
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Caixa Confirmation Modal */}
      {caixaConfirm && (
        <div className="modal-overlay" onClick={() => !caixaLoading && setCaixaConfirm(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 460 }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: caixaConfirm.type === 'fechar' || caixaConfirm.type === 'fechar-pendente' ? 'var(--danger-bg)' : 'var(--warning-bg)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <AlertTriangle style={{
                    width: 18, height: 18,
                    color: caixaConfirm.type === 'fechar' || caixaConfirm.type === 'fechar-pendente' ? 'var(--danger)' : 'var(--warning)',
                  }} />
                </div>
                <span className="modal-title">{caixaConfirm.title}</span>
              </div>
              <button className="modal-close" onClick={() => !caixaLoading && setCaixaConfirm(null)} disabled={caixaLoading}>
                <XCircle />
              </button>
            </div>

            <div style={{
              background: caixaConfirm.type === 'fechar' || caixaConfirm.type === 'fechar-pendente' ? 'var(--danger-bg)' : 'var(--warning-bg)',
              borderLeft: `4px solid ${caixaConfirm.type === 'fechar' || caixaConfirm.type === 'fechar-pendente' ? 'var(--danger)' : 'var(--warning)'}`,
              borderRadius: 'var(--radius-sm)',
              padding: '14px 16px',
              marginBottom: 20,
            }}>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--text-dark)', lineHeight: 1.6, fontWeight: 500 }}>
                {caixaConfirm.message}
              </p>
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                className="btn btn-ghost"
                onClick={() => setCaixaConfirm(null)}
                disabled={caixaLoading}
              >
                Cancelar
              </button>
              <button
                className="btn btn-primary"
                onClick={handleConfirmCaixa}
                disabled={caixaLoading}
                style={{
                  background: caixaConfirm.type === 'fechar' || caixaConfirm.type === 'fechar-pendente' ? 'var(--danger)' : '#2ECC71',
                  borderColor: caixaConfirm.type === 'fechar' || caixaConfirm.type === 'fechar-pendente' ? 'var(--danger)' : '#2ECC71',
                  minWidth: 140,
                  justifyContent: 'center',
                }}
              >
                {caixaLoading ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{
                      width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)',
                      borderTopColor: '#fff', borderRadius: '50%',
                      animation: 'spin 0.8s linear infinite',
                      display: 'inline-block',
                    }} />
                    Processando...
                  </span>
                ) : caixaConfirm.type === 'fechar-pendente' ? (
                  <><Lock />Fechar e Abrir</>
                ) : caixaConfirm.type === 'fechar' ? (
                  <><Lock />Confirmar Fechamento</>
                ) : (
                  <><Unlock />Confirmar Abertura</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Nova Transação Modal */}
      {txModal && (
        <div className="modal-overlay" onClick={() => setTxModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 460 }}>
            <div className="modal-header">
              <span className="modal-title"><Plus />Nova Transação</span>
              <button className="modal-close" onClick={() => setTxModal(false)}><XCircle /></button>
            </div>
            <div className="form-grid-2">
              <div className="form-group">
                <label className="form-label">Cliente</label>
                <input className="form-input" placeholder="Nome do cliente" value={txForm.cliente} onChange={e => setTxForm(f => ({ ...f, cliente: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Profissional</label>
                <input className="form-input" placeholder="Nome do profissional" value={txForm.profissionalNome} onChange={e => setTxForm(f => ({ ...f, profissionalNome: e.target.value }))} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Procedimento</label>
              <input className="form-input" placeholder="Ex: Botox Facial" value={txForm.procedimento} onChange={e => setTxForm(f => ({ ...f, procedimento: e.target.value }))} />
            </div>
            <div className="form-grid-2">
              <div className="form-group">
                <label className="form-label">Valor Total (R$)</label>
                <input className="form-input" type="number" placeholder="0,00" value={txForm.total} onChange={e => setTxForm(f => ({ ...f, total: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Pagamento</label>
                <select className="form-select" value={txForm.pagamento} onChange={e => setTxForm(f => ({ ...f, pagamento: e.target.value }))}>
                  {['Pix', 'Crédito', 'Débito', 'Dinheiro', 'Boleto'].map(p => <option key={p}>{p}</option>)}
                </select>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Status</label>
              <div className="tabs">
                {[{ k: 'paid', l: 'Pago' }, { k: 'pending', l: 'Pendente' }].map(({ k, l }) => (
                  <button key={k} className={`tab-item${txForm.status === k ? ' active' : ''}`} onClick={() => setTxForm(f => ({ ...f, status: k }))}>{l}</button>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
              <button className="btn btn-ghost" onClick={() => setTxModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleAddTx}><DollarSign />Salvar</button>
            </div>
          </div>
        </div>
      )}

      {/* Nova Despesa Modal */}
      {despesaModal && (
        <div className="modal-overlay" onClick={() => setDespesaModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <span className="modal-title"><Plus />Nova Despesa</span>
              <button className="modal-close" onClick={() => setDespesaModal(false)}><XCircle /></button>
            </div>
            <div className="form-group">
              <label className="form-label">Descrição</label>
              <input className="form-input" placeholder="Ex: Material de consumo" value={despesaForm.descricao} onChange={e => setDespesaForm(f => ({ ...f, descricao: e.target.value }))} />
            </div>
            <div className="form-grid-2">
              <div className="form-group">
                <label className="form-label">Valor (R$)</label>
                <input className="form-input" type="number" placeholder="0,00" value={despesaForm.valor} onChange={e => setDespesaForm(f => ({ ...f, valor: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Categoria</label>
                <select className="form-select" value={despesaForm.categoria} onChange={e => setDespesaForm(f => ({ ...f, categoria: e.target.value }))}>
                  <option value="">Selecione...</option>
                  {['Estoque', 'Fixo', 'Marketing', 'Salários', 'Impostos', 'Outros'].map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Método de Pagamento</label>
              <select className="form-select" value={despesaForm.metodoPagamento} onChange={e => setDespesaForm(f => ({ ...f, metodoPagamento: e.target.value }))}>
                {['Pix', 'Crédito', 'Débito', 'Dinheiro', 'Boleto', 'Transferência'].map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
              <button className="btn btn-ghost" onClick={() => setDespesaModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleAddDespesa} style={{ background: 'var(--danger)', borderColor: 'var(--danger)' }}><Minus />Salvar</button>
            </div>
          </div>
        </div>
      )}

      {/* Split Edit Modal */}
      {splitEdit && (
        <div className="modal-overlay" onClick={() => setSplitEdit(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 360 }}>
            <div className="modal-header">
              <span className="modal-title"><Percent />Editar Split</span>
              <button className="modal-close" onClick={() => setSplitEdit(null)}><XCircle /></button>
            </div>
            <div className="form-group">
              <label className="form-label">Profissional</label>
              <input className="form-input" value={splitEdit.profissional} disabled />
            </div>
            <div className="form-group">
              <label className="form-label">Percentual Profissional (%)</label>
              <input className="form-input" type="number" min="0" max="100" value={splitEdit.percentual} onChange={e => setSplitEdit(s => ({ ...s, percentual: Math.min(100, Math.max(0, parseInt(e.target.value) || 0)) }))} />
            </div>
            <div style={{ padding: 12, background: 'var(--bg-main)', borderRadius: 'var(--radius-sm)', marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                <span style={{ color: 'var(--text-muted)' }}>Profissional: {splitEdit.percentual}%</span>
                <span style={{ color: 'var(--text-muted)' }}>Clínica: {100 - splitEdit.percentual}%</span>
              </div>
              <div style={{ height: 8, background: 'var(--border-color)', borderRadius: 99, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${splitEdit.percentual}%`, background: 'var(--color-primary)', borderRadius: 99, transition: 'width 0.3s' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setSplitEdit(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSplitSave}><CheckCircle />Salvar</button>
            </div>
          </div>
        </div>
      )}

      {/* Page Header */}
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div className="page-header-label"><DollarSign />FINANCEIRO</div>
          <h1 className="page-title">Financeiro</h1>
          <p className="page-subtitle">Caixa · Pagamentos · Split</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {!isConnected && (
            <a href="#/integracoes" className="btn btn-primary btn-sm">
              <Link2 style={{ width: 14, height: 14 }} />Conectar Planilha
            </a>
          )}
          <button className="btn btn-ghost btn-sm" onClick={() => setSangriaModal(true)} disabled={!supabaseConnected} style={!supabaseConnected ? { opacity: 0.5, cursor: 'not-allowed' } : {}}>
            <Minus style={{ width: 14, height: 14 }} />Sangria
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => setTxModal(true)} disabled={!supabaseConnected} style={!supabaseConnected ? { opacity: 0.5, cursor: 'not-allowed' } : {}}>
            <Plus style={{ width: 14, height: 14 }} />Nova Transação
          </button>
        </div>
      </div>

      {/* Disconnected warning banner */}
      {!isConnected && (
        <div style={{
          background: '#FFF8E1',
          border: '1px solid #FFD966',
          borderLeft: '4px solid #FFD966',
          borderRadius: 'var(--radius-sm)',
          padding: '14px 18px',
          marginBottom: 20,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}>
          <AlertTriangle style={{ width: 18, height: 18, color: '#E6A800', flexShrink: 0 }} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#8B6914', marginBottom: 2 }}>Aguardando planilha</div>
            <p style={{ fontSize: 12, color: '#6B5A1E', margin: 0 }}>
              Conecte a planilha <strong>CONTROLE DE CAIXA 01</strong> na aba Integrações para sincronizar os dados financeiros em tempo real.
            </p>
          </div>
        </div>
      )}

      {/* Supabase read-only banner */}
      {!supabaseConnected && (
        <div style={{
          background: '#FEF2F2',
          border: '1px solid #FECACA',
          borderLeft: '4px solid #EF4444',
          borderRadius: 'var(--radius-sm)',
          padding: '14px 18px',
          marginBottom: 20,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}>
          <AlertTriangle style={{ width: 18, height: 18, color: '#DC2626', flexShrink: 0 }} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#991B1B', marginBottom: 2 }}>Modo somente leitura</div>
            <p style={{ fontSize: 12, color: '#7F1D1D', margin: 0 }}>
              {connectionError || 'Supabase desconectado. Novas inserções, edições e fechamentos de caixa estão bloqueados até que a conexão seja restabelecida.'}
            </p>
          </div>
        </div>
      )}

      {/* Python Sync status banner */}
      {supabaseConnected && (
        <div style={{
          background: pythonSyncStatus?.status === 'success' ? 'var(--success-bg)'
            : pythonSyncStatus?.status === 'error' ? 'var(--danger-bg)'
            : '#FFF8E1',
          border: `1px solid ${
            pythonSyncStatus?.status === 'success' ? 'var(--success)'
            : pythonSyncStatus?.status === 'error' ? 'var(--danger)'
            : '#FFD966'}`,
          borderLeft: `4px solid ${
            pythonSyncStatus?.status === 'success' ? 'var(--success)'
            : pythonSyncStatus?.status === 'error' ? 'var(--danger)'
            : '#FFD966'}`,
          borderRadius: 'var(--radius-sm)',
          padding: '10px 16px',
          marginBottom: 20,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          fontSize: 12,
        }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
            background: pythonSyncStatus?.status === 'success' ? 'var(--success)'
              : pythonSyncStatus?.status === 'error' ? 'var(--danger)'
              : '#E6A800',
            boxShadow: pythonSyncStatus?.status === 'success' ? '0 0 0 3px rgba(46,204,113,0.2)' : 'none',
          }} />
          <span style={{ color: 'var(--text-dark)', fontWeight: 600 }}>
            {pythonSyncStatus?.status === 'success' ? 'Python Sync ativo'
              : pythonSyncStatus?.status === 'error' ? 'Python Sync com erro'
              : 'Aguardando Python Sync'}
          </span>
          <span style={{ color: 'var(--text-muted)' }}>
            {pythonSyncStatus?.message || 'Inicie o sync_financeiro.py no computador da clínica para sincronizar a planilha automaticamente.'}
          </span>
          {lastSyncAt && (
            <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', flexShrink: 0 }}>
              Último update: {lastSyncAt} • {syncedRowCount} linhas
            </span>
          )}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid-4 section-gap">
        {/* Caixa do Dia - Dark Green */}
        <div className="stat-card" style={{
          background: '#1A4D2E',
          color: '#fff',
          border: '1px solid #1A4D2E',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Wallet style={{ width: 18, height: 18, color: '#D4F1E8' }} />
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: '#A8D5BA' }}>Caixa do Dia</span>
            </div>
            <span style={{
              padding: '2px 8px',
              borderRadius: 99,
              fontSize: 10,
              fontWeight: 700,
              background: cashier.status === 'aberto' ? '#D4F1E8' : '#FF9AA233',
              color: cashier.status === 'aberto' ? '#1A7A4C' : '#FF9AA2',
            }}>
              {cashier.status === 'aberto' ? 'Aberto' : 'Fechado'}
            </span>
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, marginBottom: 4, color: '#fff' }}>
            {isConnected
              ? fmtCurrency(dailySheet ? (dailySheet.faturamentoLiquido ?? dailySheet.faturamentoBruto) : cashier.saldo)
              : 'R$ --'}
          </div>
          <div style={{ fontSize: 11, color: '#A8D5BA' }}>
            {dailySheet
              ? `Bruto: ${fmtCurrency(dailySheet.faturamentoBruto)} • Despesas: ${fmtCurrency(dailySheet.totalDespesas || 0)} • ${dailySheet.totalTransacoes} tx`
              : cashier.status === 'aberto' && cashier.horaAbertura
                ? `Aberto às ${cashier.horaAbertura}`
              : isConnected ? 'Caixa fechado' : 'Aguardando planilha'}
          </div>
          {cashier.status === 'fechado' && (
            <button className="btn btn-sm" onClick={handlePromptAbrirCaixa} style={{ marginTop: 10, background: '#D4F1E8', color: '#1A4D2E', border: 'none', fontWeight: 700 }}>
              <Unlock style={{ width: 12, height: 12 }} />Abrir Caixa
            </button>
          )}
        </div>

        {/* Faturamento Hoje */}
        <div className="stat-card">
          <div className="stat-card-icon" style={{ background: 'var(--success-bg)' }}>
            <TrendingUp style={{ color: 'var(--success)' }} />
          </div>
          <div className="stat-value" style={{ color: 'var(--success)' }}>
            {fmtCurrency(faturamentoHoje)}
          </div>
          <div className="stat-label">Faturamento Hoje</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
            {syncedRowCount > 0 ? `${syncedRowCount} transações no banco` : 'Aguardando Python Sync'}
          </div>
        </div>

        {/* Ticket Médio */}
        <div className="stat-card">
          <div className="stat-card-icon" style={{ background: 'var(--info-bg)' }}>
            <Receipt style={{ color: 'var(--info)' }} />
          </div>
          <div className="stat-value" style={{ color: 'var(--info)' }}>
            {isConnected ? fmtCurrency(ticketMedio) : 'R$ --'}
          </div>
          <div className="stat-label">Ticket Médio</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
            {isConnected ? `${dailySheet ? dailySheet.totalTransacoes : txsHoje.length} procedimentos pagos` : 'Aguardando planilha'}
          </div>
        </div>

        {/* A Receber */}
        <div className="stat-card">
          <div className="stat-card-icon" style={{ background: 'var(--warning-bg)' }}>
            <Clock style={{ color: 'var(--warning)' }} />
          </div>
          <div className="stat-value" style={{ color: 'var(--warning)' }}>
            {isConnected ? fmtCurrency(aReceber) : 'R$ --'}
          </div>
          <div className="stat-label">A Receber</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
            {isConnected ? `${pendentesCount} pagamentos pendentes` : 'Aguardando planilha'}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ borderBottom: '1px solid var(--border-color)', marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 0 }}>
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: '10px 20px',
                fontSize: 13,
                fontWeight: 600,
                color: activeTab === tab.key ? 'var(--text-dark)' : 'var(--text-muted)',
                background: 'none',
                border: 'none',
                borderBottom: activeTab === tab.key ? '2px solid var(--text-dark)' : '2px solid transparent',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab: Caixa */}
      {activeTab === 'caixa' && (
        <div>
          <div className="grid-2 section-gap">
            {/* Payment Methods */}
            <div className="card">
              <div className="card-header">
                <span className="card-title"><CreditCard />Formas de Pagamento — Hoje</span>
              </div>
              {isConnected && formasPagamento.filter(pm => pm.ativo).map(pm => (
                <div key={pm.id} style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
                    <span style={{ fontWeight: 600, color: 'var(--text-dark)' }}>{pm.nome}</span>
                    <span style={{ color: 'var(--text-medium)' }}>{fmtCurrency(pm.valor)}</span>
                  </div>
                  <div style={{ height: 8, background: 'var(--border-color)', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: `${pm.pct}%`,
                      background: pm.id === 'pix' ? '#32BCAD' : pm.id === 'credito' ? '#185ABD' : pm.id === 'debito' ? '#0F9D58' : '#E6A800',
                      borderRadius: 99,
                      transition: 'width 0.5s',
                    }} />
                  </div>
                </div>
              ))}
              {!isConnected && (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, padding: 30 }}>
                  <CreditCard style={{ width: 32, height: 32, opacity: 0.3, margin: '0 auto 10px' }} />
                  <p>Conecte a planilha para ver as formas de pagamento</p>
                </div>
              )}
            </div>

            {/* Cashier Actions */}
            <div className="card">
              <div className="card-header">
                <span className="card-title"><Wallet />Ações do Caixa</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <button
                  className="btn btn-sm"
                  onClick={cashier.status === 'aberto' ? handlePromptFecharCaixa : handlePromptAbrirCaixa}
                  disabled={caixaLoading}
                  style={{
                    justifyContent: 'flex-start',
                    background: cashier.status === 'aberto' ? 'var(--danger-bg)' : 'var(--success-bg)',
                    color: cashier.status === 'aberto' ? 'var(--danger)' : 'var(--success)',
                    border: 'none',
                    fontWeight: 600,
                    opacity: caixaLoading ? 0.6 : 1,
                    cursor: caixaLoading ? 'not-allowed' : 'pointer',
                  }}
                >
                  {cashier.status === 'aberto' ? <Lock style={{ width: 14, height: 14 }} /> : <Unlock style={{ width: 14, height: 14 }} />}
                  {cashier.status === 'aberto' ? 'Fechar Caixa' : 'Abrir Caixa'}
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => setSangriaModal(true)} style={{ justifyContent: 'flex-start' }}>
                  <Minus style={{ width: 14, height: 14 }} />Realizar Sangria
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => window.print()} style={{ justifyContent: 'flex-start' }}>
                  <Printer style={{ width: 14, height: 14 }} />Imprimir Relatório
                </button>
              </div>

              {/* Sangrias list */}
              {(cashier.sangrias ?? []).length > 0 && (
                <div style={{ marginTop: 16, borderTop: '1px solid var(--border-color)', paddingTop: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>Sangrias Realizadas</div>
                  {(cashier.sangrias ?? []).map(s => (
                    <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '6px 0', borderBottom: '1px solid var(--border-light)' }}>
                      <span style={{ color: 'var(--text-medium)' }}>{s.motivo}</span>
                      <span style={{ fontWeight: 700, color: 'var(--danger)' }}>- {fmtCurrency(s.valor)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Sistema de Caixa — Validação Financeira (daily_reports) */}
          <div className="card section-gap" style={{ marginTop: 20 }}>
            <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <ShieldCheck style={{ width: 18, height: 18, color: totalsCaixa.status === 'ok' ? 'var(--success)' : 'var(--danger)' }} />
                Sistema de Caixa — Validação Financeira Diária
              </span>
              <span className="badge" style={{
                fontSize: 12,
                fontWeight: 700,
                background: totalsCaixa.status === 'ok' ? 'var(--success-bg)' : 'var(--danger-bg)',
                color: totalsCaixa.status === 'ok' ? 'var(--success)' : 'var(--danger)',
                padding: '4px 10px',
                borderRadius: 99,
              }}>
                STATUS: {totalsCaixa.status === 'ok' ? 'OK (Caixa Batido)' : 'ERRO (Diferença)'}
              </span>
            </div>

            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: -6, marginBottom: 16 }}>
              O sistema calcula o <strong>Fundo Final Calculado</strong> (<code>Fundo Inicial + Total Dinheiro</code>) e compara com o <strong>Fundo Final Real</strong> físico para validação.
            </p>

            <div className="grid-4" style={{ gap: 12, marginBottom: 16 }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: 11 }}>Fundo Inicial (R$)</label>
                <input
                  className="form-input"
                  type="number"
                  step="0.01"
                  value={fundoInicialInput}
                  onChange={e => setFundoInicialInput(e.target.value)}
                  placeholder="0,00"
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: 11 }}>Total Dinheiro Entradas (R$)</label>
                <input className="form-input" value={fmtCurrency(totalsCaixa.dinheiro)} disabled style={{ background: 'var(--bg-main)', fontWeight: 700 }} />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: 11 }}>Fundo Final Calculado (R$)</label>
                <input className="form-input" value={fmtCurrency(totalsCaixa.fundoFinalCalculado)} disabled style={{ background: 'var(--bg-main)', fontWeight: 800, color: 'var(--color-primary)' }} />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: 11 }}>Fundo Final Real Físico (R$)</label>
                <input
                  className="form-input"
                  type="number"
                  step="0.01"
                  value={fundoFinalRealInput}
                  onChange={e => setFundoFinalRealInput(e.target.value)}
                  placeholder="0,00"
                  style={{ borderColor: totalsCaixa.status === 'ok' ? 'var(--success)' : 'var(--danger)' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, paddingTop: 12, borderTop: '1px solid var(--border-color)' }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  Diferença: <strong style={{ color: totalsCaixa.diferenca === 0 ? 'var(--success)' : 'var(--danger)', fontSize: 14 }}>{fmtCurrency(totalsCaixa.diferenca)}</strong>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  PIX: {fmtCurrency(totalsCaixa.pix)} • Crédito: {fmtCurrency(totalsCaixa.credito)} • Débito: {fmtCurrency(totalsCaixa.debito)}
                </div>
              </div>

              <button
                className="btn btn-primary"
                onClick={handleSaveDailyReport}
                disabled={savingReport || !supabaseConnected}
                style={{
                  background: totalsCaixa.status === 'ok' ? 'var(--success)' : 'var(--danger)',
                  borderColor: totalsCaixa.status === 'ok' ? 'var(--success)' : 'var(--danger)',
                }}
              >
                {savingReport ? 'Salvando...' : <><ShieldCheck style={{ width: 14, height: 14 }} />Gravar Validação de Caixa</>}
              </button>
            </div>
          </div>

          {/* Histórico de Fechamentos (daily_reports) */}
          <div className="card" style={{ marginTop: 20, padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-dark)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Calculator style={{ width: 16, height: 16, color: 'var(--color-primary)' }} />
                Histórico de Validações de Caixa (daily_reports)
              </span>
              <button className="btn btn-ghost btn-sm" onClick={loadReports}>
                <RefreshCw style={{ width: 12, height: 12 }} />Atualizar
              </button>
            </div>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Data</th>
                    <th style={{ textAlign: 'right' }}>Fundo Inicial</th>
                    <th style={{ textAlign: 'right' }}>Dinheiro</th>
                    <th style={{ textAlign: 'right' }}>Calculado</th>
                    <th style={{ textAlign: 'right' }}>Real Físico</th>
                    <th style={{ textAlign: 'right' }}>Diferença</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {reportsHistory.map((rep, idx) => (
                    <tr key={rep.id || idx}>
                      <td style={{ fontWeight: 600, fontSize: 12 }}>{rep.data || rep.data_caixa}</td>
                      <td style={{ textAlign: 'right', fontSize: 12 }}>{fmtCurrency(rep.fundo_inicial)}</td>
                      <td style={{ textAlign: 'right', fontSize: 12 }}>{fmtCurrency(rep.total_dinheiro)}</td>
                      <td style={{ textAlign: 'right', fontSize: 12, fontWeight: 600 }}>{fmtCurrency(rep.fundo_final_calculado)}</td>
                      <td style={{ textAlign: 'right', fontSize: 12, fontWeight: 600 }}>{fmtCurrency(rep.fundo_final_real)}</td>
                      <td style={{ textAlign: 'right', fontSize: 12, fontWeight: 700, color: Number(rep.diferenca ?? 0) === 0 ? 'var(--success)' : 'var(--danger)' }}>
                        {fmtCurrency(rep.diferenca)}
                      </td>
                      <td>
                        <span className="badge" style={{
                          fontSize: 10,
                          fontWeight: 700,
                          background: (rep.status === 'ok' || Number(rep.diferenca ?? 0) === 0) ? 'var(--success-bg)' : 'var(--danger-bg)',
                          color: (rep.status === 'ok' || Number(rep.diferenca ?? 0) === 0) ? 'var(--success)' : 'var(--danger)',
                        }}>
                          {(rep.status || 'ok').toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {reportsHistory.length === 0 && (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 12, padding: 30 }}>
                  Nenhum registro de fechamento em daily_reports
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab: Transações */}
      {activeTab === 'transacoes' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-dark)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Receipt style={{ width: 16, height: 16, color: 'var(--color-primary)' }} />
              Transações (Espelho Inteligente com Hash e Ordem Preservada)
            </span>
            <div className="tabs">
              {[{ k: 'todos', l: 'Todos' }, { k: 'paid', l: 'Pagos' }, { k: 'pending', l: 'Pendentes' }, { k: 'cancelled', l: 'Cancelados' }].map(({ k, l }) => (
                <button key={k} className={`tab-item${txFiltroStatus === k ? ' active' : ''}`} onClick={() => setTxFiltroStatus(k)} style={{ fontSize: 11 }}>{l}</button>
              ))}
            </div>
          </div>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 60 }}>Ordem</th>
                  <th>Comanda (ID)</th>
                  <th>Cliente</th>
                  <th>Profissional</th>
                  <th style={{ textAlign: 'right' }}>Valor</th>
                  <th>Pagamento</th>
                  <th>Hash Integridade</th>
                  <th>Origem</th>
                </tr>
              </thead>
              <tbody>
                {txFiltradas.map((t, idx) => (
                  <tr key={t.id || idx}>
                    <td>
                      <span className="badge badge-neutral" style={{ fontSize: 11, fontWeight: 700 }}>
                        #{t.ordem || idx + 1}
                      </span>
                    </td>
                    <td>
                      <span className="badge" style={{ fontSize: 11, background: '#E8F5E9', color: '#2E7D32', fontWeight: 700 }}>
                        {t.comanda || t.id}
                      </span>
                    </td>
                    <td style={{ fontWeight: 500, fontSize: 13 }}>{t.cliente}</td>
                    <td style={{ fontWeight: 500, fontSize: 12 }}>{t.profissional || t.profissionalNome || '—'}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, fontSize: 13 }}>{fmtCurrency(t.total)}</td>
                    <td>
                      <span className="badge badge-neutral" style={{ fontSize: 10, textTransform: 'uppercase' }}>
                        {t.pagamento}
                      </span>
                    </td>
                    <td>
                      {t.hash ? (
                        <span title={t.hash} style={{ fontFamily: 'monospace', fontSize: 10, color: 'var(--text-muted)', background: 'var(--bg-main)', padding: '2px 6px', borderRadius: 4 }}>
                          {t.hash.substring(0, 8)}...
                        </span>
                      ) : (
                        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>—</span>
                      )}
                    </td>
                    <td>
                      <span className={`origem-badge ${t.origem === 'planilha' ? 'origem-planilha' : 'origem-manual'}`} style={{ fontSize: 10 }}>
                        {t.origem === 'planilha' ? <><FileSpreadsheet style={{ width: 10, height: 10 }} />Planilha</> : 'Manual'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {txFiltradas.length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, padding: 40 }}>
                <Receipt style={{ width: 32, height: 32, opacity: 0.3, margin: '0 auto 10px' }} />
                <p>{isConnected ? 'Nenhuma transação encontrada' : 'Conecte a planilha para visualizar transações'}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab: Despesas */}
      {activeTab === 'despesas' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-dark)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <TrendingDown style={{ width: 16, height: 16, color: 'var(--danger)' }} />
              Despesas
            </span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <div className="tabs">
                {[{ k: 'todos', l: 'Todas' }, { k: 'Estoque', l: 'Estoque' }, { k: 'Fixo', l: 'Fixo' }, { k: 'Marketing', l: 'Marketing' }, { k: 'Outros', l: 'Outros' }].map(({ k, l }) => (
                  <button key={k} className={`tab-item${expFiltroCat === k ? ' active' : ''}`} onClick={() => setExpFiltroCat(k)} style={{ fontSize: 11 }}>{l}</button>
                ))}
              </div>
              <button className="btn btn-primary btn-sm" onClick={() => setDespesaModal(true)}><Plus style={{ width: 12, height: 12 }} />Nova Despesa</button>
            </div>
          </div>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr><th>Data</th><th>Descrição</th><th>Categoria</th><th>Método</th><th style={{ textAlign: 'right' }}>Valor</th><th style={{ width: 40 }} /></tr>
              </thead>
              <tbody>
                {expFiltradas.map(e => {
                  const isFromSheet = e.origem === 'planilha';
                  const metodo = e.metodoPagamento || e.metodo || '—';
                  return (
                  <tr key={e.id}>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{e.data}</td>
                    <td style={{ fontWeight: 500, fontSize: 13 }}>{e.descricao}</td>
                    <td>
                      <span className="badge" style={{
                        fontSize: 10,
                        background: e.categoria === 'Estoque' ? '#E3F2FD' : e.categoria === 'Fixo' ? '#FFF3E0' : e.categoria === 'Marketing' ? '#F3E5F5' : isFromSheet ? '#FDE8E8' : 'var(--neutral-bg)',
                        color: e.categoria === 'Estoque' ? '#1565C0' : e.categoria === 'Fixo' ? '#E65100' : e.categoria === 'Marketing' ? '#6A1B9A' : isFromSheet ? '#B91C1C' : 'var(--text-medium)',
                      }}>
                        {e.categoria}
                      </span>
                    </td>
                    <td><span className="badge badge-neutral" style={{ fontSize: 10 }}>{metodo}</span></td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--danger)', fontSize: 13 }}>- {fmtCurrency(e.valor)}</td>
                    <td>
                      {!isFromSheet && (
                        <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }} onClick={() => removeExpense(e.id)}>
                          <Trash2 style={{ width: 12, height: 12 }} />
                        </button>
                      )}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
            {expFiltradas.length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, padding: 40 }}>
                <TrendingDown style={{ width: 32, height: 32, opacity: 0.3, margin: '0 auto 10px' }} />
                <p>{isConnected ? 'Nenhuma despesa encontrada' : 'Conecte a planilha para visualizar despesas'}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab: Split */}
      {activeTab === 'split' && (
        <div>
          <div className="grid-3 section-gap">
            {(Array.isArray(splitConfig) ? splitConfig : []).map(sc => (
              <div className="card" key={sc.profissional}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 10,
                    background: 'var(--color-primary-bg)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <User style={{ width: 18, height: 18, color: 'var(--color-primary)' }} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-dark)' }}>{sc.profissional}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Profissional</div>
                  </div>
                </div>

                <div style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
                    <span style={{ color: 'var(--text-muted)' }}>Profissional: <strong style={{ color: 'var(--text-dark)' }}>{sc.percentual}%</strong></span>
                    <span style={{ color: 'var(--text-muted)' }}>Clínica: <strong style={{ color: 'var(--text-dark)' }}>{100 - sc.percentual}%</strong></span>
                  </div>
                  <div style={{ height: 10, background: 'var(--border-color)', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: `${sc.percentual}%`,
                      background: 'var(--color-primary)',
                      borderRadius: 99,
                      transition: 'width 0.5s',
                    }} />
                  </div>
                </div>

                <button className="btn btn-ghost btn-sm" style={{ width: '100%', justifyContent: 'center' }} onClick={() => setSplitEdit({ ...sc })}>
                  <Edit3 style={{ width: 12, height: 12 }} />Editar Split
                </button>
              </div>
            ))}
          </div>

          <div className="card" style={{ marginTop: 16 }}>
            <div className="card-header">
              <span className="card-title"><Percent />Como funciona o Split</span>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-medium)', lineHeight: 1.6, margin: 0 }}>
              O split define a divisão do valor de cada procedimento entre o profissional e a clínica.
              Quando uma transação é importada da planilha, o valor é automaticamente dividido conforme a
              configuração acima. O valor da clínica é calculado como: <strong>Total - Percentual do Profissional</strong>.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
