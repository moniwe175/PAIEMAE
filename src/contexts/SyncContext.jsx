import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { isSupabaseConfigured } from '../lib/supabase';
import {
  checkSupabaseConnection,
  fetchTransactions, insertTransaction as sbInsertTx, deleteTransaction as sbDeleteTx,
  upsertTransaction as sbUpsertTx,
  fetchExpenses, insertExpense as sbInsertExp, deleteExpense as sbDeleteExp,
  upsertExpense as sbUpsertExp,
  fetchComissoes, insertComissao as sbInsertCom, updateComissao as sbUpdateCom,
  fetchCashierState, upsertCashierState,
  fetchSplitConfig, upsertSplitConfig,
  insertSyncLog as sbInsertLog, clearSyncLogs as sbClearLogs, fetchSyncLogs,
  insertDailyReport as sbInsertDailyReport, fetchDailyReports as sbFetchDailyReports,
} from '../services/supabaseService';
import { defaultCashier, defaultSplitConfig } from '../mocks/financial';

const SyncContext = createContext(null);

const defaultSyncConfig = {
  provider: null,
  sheetId: '',
  sheetName: '',
  range: 'A1:Z1000',
  pollingInterval: 30,
  columnMapping: {},
  syncedRowHashes: [],
  googleClientId: '',
  googleApiKey: '',
};

export function SyncProvider({ children }) {
  const [transactions, setTransactions] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [comissoes, setComissoes] = useState([]);
  const [cashier, setCashier] = useState(defaultCashier);
  const [splitConfig, setSplitConfig] = useState(defaultSplitConfig);
  const [syncConfig, setSyncConfig] = useState(defaultSyncConfig);
  const [syncLogs, setSyncLogs] = useState([]);
  const [syncStatus, setSyncStatus] = useState('disconnected');
  const [lastSyncAt, setLastSyncAt] = useState(null);
  const [syncedRowCount, setSyncedRowCount] = useState(0);
  const [nextSyncIn, setNextSyncIn] = useState(null);
  const [supabaseReady, setSupabaseReady] = useState(false);
  const [supabaseConnected, setSupabaseConnected] = useState(false);
  const [connectionError, setConnectionError] = useState(null);
  const [dailySheet, setDailySheet] = useState(null);

  const pollTimerRef = useRef(null);
  const countdownTimerRef = useRef(null);
  const connectionCheckRef = useRef(null);

  // ─── Load from Supabase on mount + connectivity monitor ────
  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setSupabaseConnected(false);
      setConnectionError('Supabase não configurado. Verifique as variáveis de ambiente.');
      return;
    }

    async function verifyConnection() {
      const { connected, error } = await checkSupabaseConnection();
      setSupabaseConnected(connected);
      if (!connected) {
        const msg = error || 'Falha na conexão com Supabase';
        setConnectionError(msg);
        console.error('[SyncContext] Supabase connection error:', msg);
      } else {
        setConnectionError(null);
      }
      return connected;
    }

    async function loadFromSupabase() {
      const connected = await verifyConnection();
      if (!connected) return;

      try {
        const [txRes, expRes, comRes, cashRes, splitRes, logsRes] = await Promise.all([
          fetchTransactions(),
          fetchExpenses(),
          fetchComissoes(),
          fetchCashierState(),
          fetchSplitConfig(),
          fetchSyncLogs(50),
        ]);

        if (txRes.data?.length > 0) setTransactions(txRes.data);
        if (expRes.data?.length > 0) setExpenses(expRes.data);
        if (comRes.data?.length > 0) setComissoes(comRes.data);
        if (cashRes.data) setCashier(cashRes.data);
        if (splitRes.data?.length > 0) setSplitConfig(splitRes.data);
        
        if (logsRes.data?.length > 0) {
          const formattedLogs = logsRes.data.map(l => ({
            id: l.id,
            type: l.type,
            message: l.message,
            timestamp: new Date(l.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
          }));
          setSyncLogs(formattedLogs);
        }

        setSupabaseReady(true);
      } catch (e) {
        console.warn('[SyncContext] Failed to load from Supabase, using empty fallback:', e);
        setSupabaseConnected(false);
        setConnectionError('Falha ao carregar dados do Supabase. Modo somente leitura ativado.');
      }
    }

    loadFromSupabase();

    // Periodic connectivity check every 30s
    connectionCheckRef.current = setInterval(verifyConnection, 30000);

    return () => {
      if (connectionCheckRef.current) clearInterval(connectionCheckRef.current);
    };
  }, []);

  // State is persisted to Supabase via the mutation helpers below.

  // ─── Sync helpers ───────────────────────────────────────────
  const syncToSupabase = useCallback(async (table, data) => {
    if (!isSupabaseConfigured() || !supabaseReady) return;
    try {
      switch (table) {
        case 'transactions': await sbInsertTx(data); break;
        case 'expenses': await sbInsertExp(data); break;
        case 'comissoes': await sbInsertCom(data); break;
        case 'cashier_state': await upsertCashierState(data); break;
        case 'split_config': await upsertSplitConfig(data); break;
        default: break;
      }
    } catch (e) {
      console.warn(`[SyncContext] Failed to sync ${table} to Supabase:`, e);
    }
  }, [supabaseReady]);

  // ─── Logs ───────────────────────────────────────────────────
  const addLog = useCallback((type, message) => {
    const entry = {
      id: Date.now() + Math.random(),
      timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      type,
      message,
    };
    setSyncLogs(prev => [entry, ...prev].slice(0, 200));
    if (isSupabaseConfigured() && supabaseReady) {
      sbInsertLog({ type, message, timestamp: entry.timestamp }).catch(() => {});
    }
  }, [supabaseReady]);

  const clearLogs = useCallback(() => {
    setSyncLogs([]);
    if (isSupabaseConfigured() && supabaseReady) sbClearLogs().catch(() => {});
  }, [supabaseReady]);

  // ─── Connection guard ─────────────────────────────────────
  const requireConnection = useCallback((actionName) => {
    if (!isSupabaseConfigured()) {
      const msg = `Não foi possível ${actionName}: Supabase não configurado.`;
      console.error('[SyncContext]', msg);
      setConnectionError(msg);
      return false;
    }
    if (!supabaseConnected) {
      const msg = `Não foi possível ${actionName}: Supabase desconectado. Modo somente leitura ativado.`;
      console.error('[SyncContext]', msg);
      setConnectionError(msg);
      return false;
    }
    return true;
  }, [supabaseConnected]);

  // ─── Transaction actions ────────────────────────────────────
  const addTransaction = useCallback((tx) => {
    if (!requireConnection('adicionar transação')) return null;
    const newTx = { ...tx, id: tx.id || Date.now() + Math.random(), origem: tx.origem || 'manual' };
    setTransactions(prev => [newTx, ...prev]);
    syncToSupabase('transactions', newTx);
    return newTx;
  }, [syncToSupabase, requireConnection]);

  const removeTransaction = useCallback((id) => {
    if (!requireConnection('remover transação')) return;
    setTransactions(prev => prev.filter(t => t.id !== id));
    if (isSupabaseConfigured() && supabaseReady) sbDeleteTx(id).catch(() => {});
  }, [supabaseReady, requireConnection]);

  // ─── Expense actions ────────────────────────────────────────
  const addExpense = useCallback((exp) => {
    if (!requireConnection('adicionar despesa')) return null;
    const newExp = { ...exp, id: exp.id || Date.now() + Math.random(), origem: exp.origem || 'manual' };
    setExpenses(prev => [newExp, ...prev]);
    syncToSupabase('expenses', newExp);
    return newExp;
  }, [syncToSupabase, requireConnection]);

  const removeExpense = useCallback((id) => {
    if (!requireConnection('remover despesa')) return;
    setExpenses(prev => prev.filter(e => e.id !== id));
    if (isSupabaseConfigured() && supabaseReady) sbDeleteExp(id).catch(() => {});
  }, [supabaseReady, requireConnection]);

  // ─── Commission actions ─────────────────────────────────────
  const addComissao = useCallback((com) => {
    if (!requireConnection('adicionar comissão')) return null;
    const newCom = { ...com, id: com.id || Date.now() + Math.random(), origem: com.origem || 'manual' };
    setComissoes(prev => [newCom, ...prev]);
    syncToSupabase('comissoes', newCom);
    return newCom;
  }, [syncToSupabase, requireConnection]);

  const removeComissao = useCallback((id) => {
    if (!requireConnection('remover comissão')) return;
    setComissoes(prev => prev.filter(c => c.id !== id));
  }, [requireConnection]);

  const updateComissaoStatus = useCallback((id, status) => {
    if (!requireConnection('atualizar comissão')) return;
    setComissoes(prev => prev.map(c => c.id === id ? { ...c, status } : c));
    if (isSupabaseConfigured() && supabaseReady) sbUpdateCom(id, { status }).catch(() => {});
  }, [supabaseReady, requireConnection]);

  // ─── Cashier actions ────────────────────────────────────────
  const abrirCaixa = useCallback((saldoInicial = 0) => {
    if (!requireConnection('abrir caixa')) return;
    const newState = {
      status: 'aberto',
      saldo: saldoInicial,
      horaAbertura: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      dataAbertura: new Date().toLocaleDateString('pt-BR'),
      sangrias: [],
    };
    setCashier(newState);
    syncToSupabase('cashier_state', newState);
    addLog('info', 'Caixa aberto');
  }, [syncToSupabase, addLog, requireConnection]);

  // ─── Daily Sheet (read-only from Google Sheets) ─────────────
  const updateDailySheet = useCallback((sheetData) => {
    setDailySheet(sheetData);
  }, []);

  // ─── Save Daily Report to Supabase (only on fecharCaixa) ────
  const saveDailyReport = useCallback(async () => {
    if (!dailySheet) {
      console.warn('[SyncContext] No daily sheet data to save');
      return { data: null, error: 'Sem dados da planilha para salvar' };
    }

    // Convert DD/MM/YYYY to YYYY-MM-DD for database
    const dateParts = dailySheet.dataCaixa.split('/');
    const dataCaixaISO = dateParts.length === 3
      ? `${dateParts[2]}-${dateParts[1].padStart(2, '0')}-${dateParts[0].padStart(2, '0')}`
      : new Date().toISOString().split('T')[0];

    const report = {
      data_caixa: dataCaixaISO,
      fundo_inicial: dailySheet.fundoInicial,
      fundo_final: dailySheet.fundoFinal,
      total_pix: dailySheet.totalPix,
      total_credito: dailySheet.totalCredito,
      total_debito: dailySheet.totalDebito,
      total_dinheiro: dailySheet.totalDinheiro,
      total_repasse: dailySheet.totalRepasse,
      faturamento_bruto: dailySheet.faturamentoBruto,
      total_despesas: 0,
      total_transacoes: dailySheet.totalTransacoes,
      status: 'fechado',
      sheet_snapshot: dailySheet.rows,
    };

    console.log('[SyncContext] Saving daily report:', report);

    if (isSupabaseConfigured() && supabaseReady) {
      const result = await sbInsertDailyReport(report);
      if (result.error) {
        console.error('[SyncContext] Failed to save daily report:', result.error);
        addLog('error', `Falha ao salvar relatório diário: ${result.error}`);
      } else {
        addLog('success', `Relatório diário salvo: R$ ${dailySheet.faturamentoBruto.toFixed(2)}`);
      }
      return result;
    } else {
      addLog('warning', 'Supabase não disponível — relatório salvo apenas localmente');
      return { data: report, error: null };
    }
  }, [dailySheet, supabaseReady, addLog]);

  const fecharCaixa = useCallback(async () => {
    if (!requireConnection('fechar caixa')) return { success: false, error: 'Supabase desconectado' };

    // Save daily report to Supabase first
    const reportResult = await saveDailyReport();
    if (reportResult.error) {
      addLog('error', `Erro ao salvar relatório: ${reportResult.error}`);
      return { success: false, error: reportResult.error };
    }

    // Then close the cashier
    const newState = { ...cashier, status: 'fechado', horaAbertura: null, dataAbertura: null };
    setCashier(newState);
    syncToSupabase('cashier_state', newState);
    addLog('info', `Caixa fechado — Faturamento: R$ ${(dailySheet?.faturamentoBruto || 0).toFixed(2)}`);
    return { success: true, report: reportResult.data };
  }, [cashier, syncToSupabase, addLog, requireConnection, saveDailyReport, dailySheet]);

  const realizarSangria = useCallback((valor, motivo) => {
    if (!requireConnection('realizar sangria')) return;
    const sangria = {
      id: 'sangria_' + Date.now(),
      valor,
      motivo,
      hora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      data: new Date().toLocaleDateString('pt-BR'),
    };
    const newState = {
      ...cashier,
      saldo: cashier.saldo - valor,
      sangrias: [sangria, ...cashier.sangrias],
    };
    setCashier(newState);
    syncToSupabase('cashier_state', newState);
    addLog('warning', `Sangria realizada: R$ ${valor.toLocaleString('pt-BR')} - ${motivo}`);
  }, [cashier, syncToSupabase, addLog, requireConnection]);

  // ─── Split config ───────────────────────────────────────────
  const updateSplitConfig = useCallback((profissional, percentual) => {
    if (!requireConnection('atualizar configuração de split')) return;
    setSplitConfig(prev => {
      const updated = prev.map(s => s.profissional === profissional ? { ...s, percentual } : s);
      syncToSupabase('split_config', updated.find(s => s.profissional === profissional));
      return updated;
    });
  }, [syncToSupabase, requireConnection]);

  // ─── Import from sheet (upsert to Supabase) ─────────────────
  const importFromSheet = useCallback(async (newTransactions, newComissoes = [], newExpenses = [], rowHashes = [], caixaReport = null) => {
    if (!requireConnection('importar da planilha')) return { upsertedCount: 0, error: 'Supabase desconectado' };

    let upsertedCount = 0;
    let hasError = false;

    if (newTransactions.length > 0) {
      const existingIds = new Set(transactions.map(t => t.id));
      const toUpsert = newTransactions.filter(t => !existingIds.has(t.id));
      
      if (supabaseReady && toUpsert.length > 0) {
        try {
          await Promise.all(toUpsert.map(tx => sbUpsertTx(tx)));
          upsertedCount += toUpsert.length;
        } catch (e) {
          console.error('[SyncContext] Upsert tx failed:', e);
          hasError = true;
        }
      }
      setTransactions(prev => [...toUpsert, ...prev]);
    }
    
    if (newComissoes.length > 0) {
      const existingIds = new Set(comissoes.map(c => c.id));
      const unique = newComissoes.filter(c => !existingIds.has(c.id));
      
      if (supabaseReady && unique.length > 0) {
        try {
          await Promise.all(unique.map(com => sbInsertCom(com)));
        } catch (e) {
          console.error('[SyncContext] Insert comissão failed:', e);
          hasError = true;
        }
      }
      setComissoes(prev => [...unique, ...prev]);
    }
    
    if (newExpenses.length > 0) {
      const existingIds = new Set(expenses.map(e => e.id));
      const toUpsert = newExpenses.filter(e => !existingIds.has(e.id));
      
      if (supabaseReady && toUpsert.length > 0) {
        try {
          await Promise.all(toUpsert.map(exp => sbUpsertExp(exp)));
          upsertedCount += toUpsert.length;
        } catch (e) {
          console.error('[SyncContext] Upsert expense failed:', e);
          hasError = true;
        }
      }
      setExpenses(prev => [...toUpsert, ...prev]);
    }
    
    if (rowHashes.length > 0) {
      setSyncConfig(prev => ({
        ...prev,
        syncedRowHashes: [...new Set([...prev.syncedRowHashes, ...rowHashes])],
      }));
    }
    
    // Salvar metadados do caixa (Fundo inicial, faturamento, despesas)
    if (caixaReport && supabaseReady) {
      try {
        await sbInsertDailyReport(caixaReport);
      } catch (e) {
        console.error('[SyncContext] Insert daily_report failed:', e);
        hasError = true;
      }
    }
    
    if (hasError && upsertedCount === 0) {
      return { upsertedCount: 0, error: 'falha ao persistir dados no banco' };
    }

    setSyncedRowCount(prev => prev + upsertedCount);
    setLastSyncAt(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
    
    return { upsertedCount, error: hasError ? 'Alguns registros falharam' : null };
  }, [transactions, comissoes, expenses, supabaseReady, requireConnection]);

  const connectSheet = useCallback((config) => {
    setSyncConfig(prev => ({ ...prev, ...config }));
    setSyncStatus('connected');
    addLog('success', `Conectado à planilha: ${config.sheetName || config.sheetId}`);
  }, [addLog]);

  const disconnectSheet = useCallback(() => {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    pollTimerRef.current = null;
    countdownTimerRef.current = null;
    setSyncStatus('disconnected');
    setNextSyncIn(null);
    setSyncConfig(prev => ({ ...prev, provider: null, sheetId: '', sheetName: '', syncedRowHashes: [] }));
    addLog('info', 'Desconectado da planilha');
  }, [addLog]);

  const startPolling = useCallback((pollFn, intervalSeconds) => {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    pollFn();
    pollTimerRef.current = setInterval(pollFn, intervalSeconds * 1000);
    let countdown = intervalSeconds;
    setNextSyncIn(countdown);
    countdownTimerRef.current = setInterval(() => {
      countdown -= 1;
      if (countdown <= 0) countdown = intervalSeconds;
      setNextSyncIn(countdown);
    }, 1000);
  }, []);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    pollTimerRef.current = null;
    countdownTimerRef.current = null;
    setNextSyncIn(null);
  }, []);

  const value = {
    transactions, setTransactions,
    expenses, setExpenses,
    comissoes, setComissoes,
    cashier, setCashier,
    splitConfig, setSplitConfig,
    syncConfig, syncLogs,
    syncStatus, setSyncStatus,
    lastSyncAt, syncedRowCount, nextSyncIn,
    supabaseReady, supabaseConnected, connectionError,
    dailySheet, updateDailySheet, saveDailyReport,

    addTransaction, removeTransaction,
    addExpense, removeExpense,
    addComissao, removeComissao, updateComissaoStatus,
    abrirCaixa, fecharCaixa, realizarSangria,
    updateSplitConfig,

    importFromSheet,
    connectSheet, disconnectSheet,
    startPolling, stopPolling,
    addLog, clearLogs,
  };

  return (
    <SyncContext.Provider value={value}>
      {children}
    </SyncContext.Provider>
  );
}

export function useSync() {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error('useSync must be used within SyncProvider');
  return ctx;
}

export default SyncContext;
