import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import {
  checkSupabaseConnection,
  fetchTransactions, insertTransaction as sbInsertTx, deleteTransaction as sbDeleteTx,
  upsertTransaction as sbUpsertTx, fetchAllTransactionIds, deleteTransactionsByIds,
  fetchExpenses, insertExpense as sbInsertExp, deleteExpense as sbDeleteExp,
  upsertExpense as sbUpsertExp,
  fetchComissoes, insertComissao as sbInsertCom, updateComissao as sbUpdateCom,
  fetchCashierState, upsertCashierState,
  fetchSplitConfig, upsertSplitConfig,
  insertSyncLog as sbInsertLog, clearSyncLogs as sbClearLogs, fetchSyncLogs,
  insertDailyReport as sbInsertDailyReport, fetchDailyReports as sbFetchDailyReports,
  fetchSheetConnections, upsertSheetConnection as sbUpsertSheetConnection,
  fetchSheetTransactions as sbFetchSheetTransactions,
  fetchSheetTransactionsSummary as sbFetchSheetSummary,
} from '../services/supabaseService';
import { defaultCashier, defaultSplitConfig } from '../mocks/financial';
import { syncSheetToSupabase } from '../services/googleSheetsSync';

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
  // ─── sheet_transactions: fonte real dos dados financeiros ───
  const [sheetTransactions, setSheetTransactions] = useState([]);
  const [sheetSummary, setSheetSummary] = useState({ receitas: 0, despesas: 0, sangrias: 0, count: { receitas: 0, despesas: 0, sangrias: 0 } });


  const pollTimerRef = useRef(null);
  const countdownTimerRef = useRef(null);
  const connectionCheckRef = useRef(null);
  const realtimeChannelRef = useRef(null);
  const sheetPollTimerRef = useRef(null);
  const sheetPollUrlRef = useRef(null);

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
        const [txRes, expRes, comRes, cashRes, splitRes, logsRes, sheetsRes, stRes, summaryRes] = await Promise.all([
          fetchTransactions(),
          fetchExpenses(),
          fetchComissoes(),
          fetchCashierState(),
          fetchSplitConfig(),
          fetchSyncLogs(50),
          fetchSheetConnections(),
          sbFetchSheetTransactions(),
          sbFetchSheetSummary(),
        ]);

        if (txRes.data?.length > 0) setTransactions(txRes.data);
        if (expRes.data?.length > 0) setExpenses(expRes.data);
        // Carregar dados reais da planilha (sheet_transactions)
        if (stRes.data?.length > 0) setSheetTransactions(stRes.data);
        if (summaryRes.data) setSheetSummary(summaryRes.data);
        if (comRes.data?.length > 0) setComissoes(comRes.data);
        if (cashRes.data) setCashier({ sangrias: [], ...cashRes.data, sangrias: Array.isArray(cashRes.data.sangrias) ? cashRes.data.sangrias : [] });
        if (splitRes.data?.length > 0) setSplitConfig(splitRes.data);
        
        if (sheetsRes.data?.length > 0) {
          const active = sheetsRes.data.find(s => s.status === 'conectado') || sheetsRes.data[0];
          if (active) {
            setSyncConfig({
              provider: active.provider || 'google',
              sheetId: active.sheet_id || '',
              sheetName: active.name || '',
              range: active.range || 'A1:Z1000',
              pollingInterval: active.poll_interval || 30,
              googleApiKey: active.api_key || '',
              sheet_url: active.sheet_url || '',
              id: active.id,
            });
            setSyncStatus(active.status === 'conectado' ? 'connected' : 'disconnected');
          }
        }

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

  // ─── Global Sheet Polling — roda em background independente da página ──
  // Inicia o polling automático sempre que uma planilha conectada é detectada no syncConfig
  useEffect(() => {
    const sheetUrl = syncConfig?.sheet_url;
    const interval = (syncConfig?.pollingInterval || 60) * 1000;
    const isConnected = syncStatus === 'connected';

    // Parar polling anterior se a URL mudou ou desconectou
    if (sheetPollTimerRef.current && (sheetPollUrlRef.current !== sheetUrl || !isConnected)) {
      clearInterval(sheetPollTimerRef.current);
      sheetPollTimerRef.current = null;
      sheetPollUrlRef.current = null;
      console.log('[SyncContext] Sheet polling parado.');
    }

    // Iniciar novo polling se conectado e com URL válida
    if (isConnected && sheetUrl && !sheetPollTimerRef.current) {
      sheetPollUrlRef.current = sheetUrl;
      console.log(`[SyncContext] Iniciando sheet polling a cada ${interval / 1000}s para: ${sheetUrl}`);

      const doSync = async () => {
        try {
          const result = await syncSheetToSupabase(sheetUrl);
          if (result.success && result.rowCount > 0) {
            console.log(`[SyncContext] Auto-sync: ${result.rowCount} registros importados`);
            setLastSyncAt(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
            setSyncedRowCount(result.rowCount);
            // O Supabase Realtime já vai atualizar as transactions automaticamente via subscription
          }
        } catch (e) {
          console.warn('[SyncContext] Erro no sheet polling:', e);
        }
      };

      // Sync imediato ao conectar
      doSync();
      // Polling periódico
      sheetPollTimerRef.current = setInterval(doSync, interval);
    }

    return () => {
      // Não limpa aqui — o cleanup só acontece quando a URL ou status muda (acima)
    };
  }, [syncConfig?.sheet_url, syncStatus, syncConfig?.pollingInterval]);

  // ─── Supabase Realtime: escuta mudanças na tabela transactions ──
  // Quando o Python sync faz upsert/delete, o frontend atualiza automaticamente
  useEffect(() => {
    if (!isSupabaseConfigured()) return;

    const channel = supabase
      .channel('transactions-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'transactions' },
        async (payload) => {
          // Reidratar todas as transações do banco ao detectar qualquer mudança
          try {
            const { data, error } = await supabase
              .from('transactions')
              .select('*')
              .order('ordem', { ascending: true });
            if (!error && data) {
              setTransactions(data);
              setLastSyncAt(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
              setSyncedRowCount(data.length);
              setSyncStatus('connected');
            }
          } catch (e) {
            console.warn('[SyncContext] Realtime rehydrate error:', e);
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[SyncContext] Realtime: subscrito na tabela transactions');
        }
      });

    realtimeChannelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // ─── Supabase Realtime: escuta mudanças na tabela sheet_transactions ──
  useEffect(() => {
    if (!isSupabaseConfigured()) return;

    const channel = supabase
      .channel('sheet-transactions-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sheet_transactions' },
        async () => {
          try {
            const [stRes, summaryRes] = await Promise.all([
              sbFetchSheetTransactions(),
              sbFetchSheetSummary(),
            ]);
            if (!stRes.error && stRes.data) setSheetTransactions(stRes.data);
            if (!summaryRes.error && summaryRes.data) setSheetSummary(summaryRes.data);
          } catch (e) {
            console.warn('[SyncContext] Realtime sheet_transactions rehydrate error:', e);
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[SyncContext] Realtime: subscrito na tabela sheet_transactions');
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // ─── Supabase Realtime: escuta sync_logs para mostrar status do Python ──
  useEffect(() => {
    if (!isSupabaseConfigured()) return;

    const channel = supabase
      .channel('sync-logs-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'sync_logs' },
        (payload) => {
          const log = payload.new;
          if (!log) return;
          // Adicionar ao log local
          const entry = {
            id: log.id || Date.now(),
            timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            type: log.type || log.status || 'info',
            message: log.message || log.details || '',
          };
          setSyncLogs(prev => [entry, ...prev].slice(0, 200));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
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

  // ─── Save Daily Report to Supabase (Sistema de Caixa) ────
  const saveDailyReport = useCallback(async (customData = {}) => {
    const hojeStr = new Date().toLocaleDateString('pt-BR');
    const dataRef = customData.data || dailySheet?.dataCaixa || hojeStr;

    // Filtrar transações para a data
    const txsDoDia = transactions.filter(t => (t.data === dataRef || !t.data || t.data === hojeStr));

    let totalDinheiro = 0;
    let totalPix = 0;
    let totalCredito = 0;
    let totalDebito = 0;

    txsDoDia.forEach(t => {
      const v = Number(t.total ?? t.valor ?? 0);
      const pg = String(t.pagamento || t.forma_pagamento || '').toLowerCase();
      if (pg.includes('dinheiro') || pg.includes('cash') || pg.includes('especie')) totalDinheiro += v;
      else if (pg.includes('pix') || pg.includes('transf')) totalPix += v;
      else if (pg.includes('credito')) totalCredito += v;
      else if (pg.includes('debito')) totalDebito += v;
      else totalPix += v;
    });

    const fundoInicial = Number(customData.fundo_inicial ?? customData.fundoInicial ?? dailySheet?.fundoInicial ?? 0);
    const fundoFinalReal = Number(customData.fundo_final_real ?? customData.fundoFinalReal ?? customData.fundoFinal ?? dailySheet?.fundoFinal ?? 0);
    const fundoFinalCalculado = fundoInicial + totalDinheiro;
    const diferenca = fundoFinalReal - fundoFinalCalculado;
    const status = diferenca === 0 ? 'ok' : 'erro';

    const report = {
      data: dataRef,
      data_caixa: dataRef.includes('/') ? dataRef.split('/').reverse().join('-') : dataRef,
      fundo_inicial: fundoInicial,
      total_dinheiro: totalDinheiro,
      total_pix: totalPix,
      total_credito: totalCredito,
      total_debito: totalDebito,
      fundo_final_calculado: fundoFinalCalculado,
      fundo_final_real: fundoFinalReal,
      diferenca: diferenca,
      status: status,
      sheet_snapshot: dailySheet?.rows || txsDoDia,
    };

    console.log('[SyncContext] Salvando relatório do caixa:', report);

    if (isSupabaseConfigured() && supabaseReady) {
      const result = await sbInsertDailyReport(report);
      if (result.error) {
        console.error('[SyncContext] Failed to save daily report:', result.error);
        addLog('error', `Falha ao salvar relatório do caixa: ${result.error}`);
      } else {
        addLog('success', `Relatório do caixa salvo com status [${status.toUpperCase()}]: Diferença R$ ${diferenca.toFixed(2)}`);
      }
      return result;
    } else {
      addLog('warning', 'Supabase não disponível — relatório salvo apenas localmente');
      return { data: report, error: null };
    }
  }, [dailySheet, transactions, supabaseReady, addLog]);

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
    const errors = [];

    // ── Full sync (espelho): comparar IDs da planilha vs banco e deletar registros excluídos ──
    if (newTransactions.length > 0) {
      try {
        const sheetIds = new Set(newTransactions.map(tx => String(tx.comanda || tx.id).trim()));
        const { data: existingIds } = await fetchAllTransactionIds();
        
        if (existingIds && existingIds.length > 0) {
          const idsToDelete = existingIds.filter(id => !sheetIds.has(id));
          if (idsToDelete.length > 0) {
            console.log('[SyncContext] Deletando registros do banco não presentes na planilha:', idsToDelete);
            await deleteTransactionsByIds(idsToDelete);
          }
        }

        const results = await Promise.all(newTransactions.map(tx => sbUpsertTx(tx)));
        const failed = results.filter(r => r.error);
        const succeeded = results.filter(r => !r.error);
        
        if (failed.length > 0) {
          console.error('[SyncContext] Algumas transações falharam:', failed.map(r => r.error?.message));
          errors.push(`${failed.length} transações falharam: ${failed[0].error?.message || 'erro desconhecido'}`);
          hasError = true;
        }
        
        upsertedCount += succeeded.length;
        
        // Espelhar exatamente os registros da planilha ordenados por ordem
        const upsertedData = results.filter(r => r.data).map(r => r.data);
        if (upsertedData.length > 0) {
          const sorted = [...upsertedData].sort((a, b) => Number(a.ordem ?? 0) - Number(b.ordem ?? 0));
          setTransactions(sorted);
        }
      } catch (e) {
        console.error('[SyncContext] Upsert tx falhou completamente:', e);
        errors.push(`Falha ao persistir transações: ${e.message}`);
        hasError = true;
      }
    }

    // ── Upsert de comissões ──
    if (newComissoes.length > 0) {
      try {
        const results = await Promise.all(newComissoes.map(com => sbInsertCom(com)));
        const succeeded = results.filter(r => !r.error);
        setComissoes(prev => {
          const existingIds = new Set(prev.map(c => c.id));
          const newOnes = succeeded.filter(r => r.data && !existingIds.has(r.data.id)).map(r => r.data);
          return [...newOnes, ...prev];
        });
      } catch (e) {
        console.error('[SyncContext] Insert comissão falhou:', e);
        hasError = true;
      }
    }

    // ── Upsert TODAS as despesas ──
    if (newExpenses.length > 0) {
      try {
        const results = await Promise.all(newExpenses.map(exp => sbUpsertExp(exp)));
        const failed = results.filter(r => r.error);
        const succeeded = results.filter(r => !r.error);

        if (failed.length > 0) {
          console.error('[SyncContext] Algumas despesas falharam:', failed.map(r => r.error?.message));
          errors.push(`${failed.length} despesas falharam: ${failed[0].error?.message || 'erro desconhecido'}`);
          hasError = true;
        }

        upsertedCount += succeeded.length;

        const upsertedData = results.filter(r => r.data).map(r => r.data);
        if (upsertedData.length > 0) {
          setExpenses(prev => {
            const existingIds = new Set(prev.map(e => e.id));
            const newOnes = upsertedData.filter(e => !existingIds.has(e.id));
            const updated = prev.map(e => {
              const found = upsertedData.find(u => u.id === e.id);
              return found || e;
            });
            return [...newOnes, ...updated];
          });
        }
      } catch (e) {
        console.error('[SyncContext] Upsert expense falhou completamente:', e);
        errors.push(`Falha ao persistir despesas: ${e.message}`);
        hasError = true;
      }
    }

    // ── Salvar hashes de linhas sincronizadas ──
    if (rowHashes.length > 0) {
      setSyncConfig(prev => ({
        ...prev,
        syncedRowHashes: [...new Set([...prev.syncedRowHashes, ...rowHashes])],
      }));
    }

    // ── Salvar relatório diário ──
    if (caixaReport) {
      try {
        const reportResult = await sbInsertDailyReport(caixaReport);
        if (reportResult.error) {
          console.error('[SyncContext] Insert daily_report falhou:', reportResult.error);
          // Não bloqueia o contador — relatório é secundário
        }
      } catch (e) {
        console.error('[SyncContext] Insert daily_report exception:', e);
      }
    }

    // ── Mensagem clara de erro se falhou tudo ──
    if (hasError && upsertedCount === 0) {
      const errorMsg = errors.length > 0 ? errors[0] : 'Falha ao persistir dados no banco';
      addLog('error', `❌ ${errorMsg}`);
      return { upsertedCount: 0, error: errorMsg };
    }

    // ── Atualizar contador apenas após confirmação do banco ──
    setSyncedRowCount(prev => prev + upsertedCount);
    setLastSyncAt(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));

    if (hasError) {
      addLog('warning', `⚠️ Sincronização parcial: ${upsertedCount} registros salvos, ${errors.length} com falha.`);
    }

    return { upsertedCount, error: hasError ? errors.join('; ') : null };
  }, [comissoes, supabaseReady, requireConnection, addLog]);

  const connectSheet = useCallback((config) => {
    setSyncConfig(prev => ({ ...prev, ...config }));
    setSyncStatus('connected');
    addLog('success', `Conectado à planilha: ${config.sheetName || config.sheetId}`);
    sbUpsertSheetConnection({ ...config, status: 'conectado' }).catch(err => console.error('[SyncContext] Auto-persist error:', err));
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
    // ─ sheet_transactions: fonte real dos dados financeiros ─
    sheetTransactions, setSheetTransactions,
    sheetSummary, setSheetSummary,
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
