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
  insertDailyReport as sbInsertDailyReport, fetchDailyReports as sbFetchDailyReports, fetchLastClosedCashierBalance,
  fetchSheetConnections, upsertSheetConnection as sbUpsertSheetConnection,
  fetchSheetTransactions as sbFetchSheetTransactions,
  fetchSheetTransactionsSummary as sbFetchSheetSummary,
  // ─── Novo sistema de caixa real ───
  fetchTodayCashier, fetchLastClosingBalance, openNewCashier, closeCashierById,
  fetchCashierHistory, insertSangria as sbInsertSangria, fetchTodaySangrias,
  autoClosePreviousCashiers, updateCashierTotals,
} from '../services/supabaseService';
import { defaultCashier, defaultSplitConfig } from '../mocks/financial';
import { syncSheetToSupabase, fetchSheetMetadataDirect } from '../services/googleSheetsSync';

const SyncContext = createContext(null);

const defaultSyncConfig = {
  provider: null,
  sheetId: '',
  sheetName: '',
  range: 'A1:Z1000',
  columnMapping: {},
  syncedRowHashes: [],
  googleClientId: '',
  googleApiKey: '',
};

// Polling intervals for sheet sync:
// - Visible tab: 20s — fast enough for near-real-time updates without overloading
//   the Google Sheets gviz endpoint (no strict rate limit, but 20s balances
//   freshness with network economy).
// - Hidden tab: 60s — keeps background sync alive so data is ready when the user
//   returns, without wasting bandwidth or hitting the API unnecessarily.
const VISIBLE_POLLING_MS = 20_000;
const HIDDEN_POLLING_MS  = 60_000;

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
  // ─── Metadata da Planilha (Fundos C1 e F1) ───
  const [sheetMetadata, setSheetMetadata] = useState({ fundoInicial: 0, fundoFinal: 0 });
  // ─── Novo estado do caixa real ───
  const [todayCashier, setTodayCashier] = useState(null);   // registro do dia no Supabase
  const [cashierSangrias, setCashierSangrias] = useState([]); // sangrias do dia
  const [cashierHistory, setCashierHistory] = useState([]);   // histórico 30 dias
  const [autoClosed, setAutoClosed] = useState(false);        // aviso de fechamento automático


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

        // Executar leitura inicial da planilha para carregar C1 (fundoInicial) e F1 (fundoFinal) imediatamente
        const targetUrl = syncConfig?.sheet_url || sheetsRes.data?.[0]?.sheet_url || 'https://docs.google.com/spreadsheets/d/1uXB-p9iWev-ID7HVZVUj42FBu2J4PkWMo1cocTW2GXI/edit';
        fetchSheetMetadataDirect(targetUrl).then(meta => {
          if (meta && (meta.fundoInicial > 0 || meta.fundoFinal > 0)) {
            setSheetMetadata(meta);
          }
        }).catch(err => console.warn('[SyncContext] Initial sheet metadata warning:', err));

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
  // Inicia o polling automático sempre que uma planilha conectada é detectada no syncConfig.
  // Usa intervalo mais curto quando visível (20s) e mais longo em background (60s).
  useEffect(() => {
    const sheetUrl = syncConfig?.sheet_url;
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

      let consecutiveErrors = 0; // Track consecutive failures to avoid log spam

      const doSync = async () => {
        const isHidden = typeof document !== 'undefined' && document.visibilityState !== 'visible';

        try {
          const result = await syncSheetToSupabase(sheetUrl, { connectionId: syncConfig?.id });
          if (result.success) {
            consecutiveErrors = 0; // Reset on success
            console.log(`[SyncContext] Auto-sync concluído: ${result.rowCount || 0} registros. Fundos C1/F1: ${result.fundoInicial}/${result.fundoFinal}`);
            setLastSyncAt(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
            setSyncedRowCount(result.rowCount || 0);

            if (result.fundoInicial !== undefined) {
              setSheetMetadata({
                fundoInicial: Number(result.fundoInicial) || 0,
                fundoFinal: Number(result.fundoFinal) || 0,
              });
            }

            // Atualização imediata do estado local com os dados mais recentes do Supabase
            const [stRes, summaryRes] = await Promise.all([
              sbFetchSheetTransactions(),
              sbFetchSheetSummary(),
            ]);
            if (!stRes.error && stRes.data) setSheetTransactions(stRes.data);
            if (!summaryRes.error && summaryRes.data) setSheetSummary(summaryRes.data);
          } else {
            // sync returned { success: false } — count error but don't break the loop
            consecutiveErrors++;
            if (consecutiveErrors <= 3) {
              console.warn(`[SyncContext] Sheet sync retornou falha (${consecutiveErrors}x):`, result.error);
            }
          }

          // Re-agendar com o intervalo correto (pode ter mudado de visible→hidden ou vice-versa)
          if (sheetPollTimerRef.current) clearInterval(sheetPollTimerRef.current);
          sheetPollTimerRef.current = setInterval(doSync, currentInterval);
        } catch (e) {
          // Error handling: log only the first few consecutive errors to avoid console spam,
          // then log every 10th error. Never break the polling loop.
          consecutiveErrors++;
          if (consecutiveErrors <= 3 || consecutiveErrors % 10 === 0) {
            console.warn(`[SyncContext] Erro no sheet polling (${consecutiveErrors}x consecutivos):`, e?.message);
          }
          // Re-agendar mesmo com erro — polling nunca para
          if (sheetPollTimerRef.current) clearInterval(sheetPollTimerRef.current);
          sheetPollTimerRef.current = setInterval(doSync, currentInterval);
        }
      };

      console.log(`[SyncContext] Iniciando sheet polling: ${VISIBLE_POLLING_MS / 1000}s (visível) / ${HIDDEN_POLLING_MS / 1000}s (background) para: ${sheetUrl}`);

      // Sync imediato ao carregar/conectar
      doSync();
    }

    return () => {
      // Cleanup only when URL or status changes (handled above)
    };
  }, [syncConfig?.sheet_url, syncConfig?.id, syncStatus]);

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

  // ─── Cashier actions — Sistema Real ──────────────────────────

  /** Carrega caixa de hoje + sangrias + histórico do Supabase */
  const loadCaixaHoje = useCallback(async () => {
    try {
      // 1. Fechar automaticamente caixas de dias anteriores que ficaram abertos
      const { closed } = await autoClosePreviousCashiers();
      if (closed > 0) {
        setAutoClosed(true);
        addLog('warning', `${closed} caixa(s) de dias anteriores fechados automaticamente.`);
      }

      // 2. Buscar caixa aberto de hoje
      const { data: caixaHoje } = await fetchTodayCashier();

      if (caixaHoje) {
        setTodayCashier(caixaHoje);
        // Sincronizar com o cashier legado para compatibilidade com header
        setCashier(prev => ({
          ...prev,
          status: 'aberto',
          saldo: Number(caixaHoje.opening_balance || 0),
          dataAbertura: new Date().toLocaleDateString('pt-BR'),
          sangrias: prev.sangrias || [],
        }));
      } else {
        setTodayCashier(null);
        // Verificar se existe caixa fechado de hoje
        const { data: fechadoHoje } = await supabase
          .from('cashier_state')
          .select('*')
          .eq('date', new Date().toISOString().split('T')[0])
          .eq('status', 'closed')
          .limit(1)
          .maybeSingle();
        if (fechadoHoje) {
          setCashier(prev => ({ ...prev, status: 'fechado', saldo: Number(fechadoHoje.closing_balance || 0) }));
        } else {
          setCashier(prev => ({ ...prev, status: 'fechado' }));
        }
      }

      // 3. Carregar sangrias de hoje
      const { data: sangriasHoje } = await fetchTodaySangrias();
      if (sangriasHoje) setCashierSangrias(sangriasHoje);

      // 4. Carregar histórico
      const { data: hist } = await fetchCashierHistory(30);
      if (hist) setCashierHistory(hist);

    } catch (e) {
      console.warn('[SyncContext] loadCaixaHoje error:', e);
    }
  }, [addLog]);

  /** Abre caixa de hoje automaticamente herdando o saldo do último fechamento ou da planilha */
  const abrirCaixaHoje = useCallback(async (customBalance = null) => {
    if (!requireConnection('abrir caixa')) return null;
    try {
      let openingBal = customBalance;
      if (openingBal === null || openingBal === undefined || Number(openingBal) === 0) {
        if (sheetMetadata?.fundoInicial > 0) {
          openingBal = sheetMetadata.fundoInicial;
        } else {
          const { balance } = await fetchLastClosingBalance();
          openingBal = Number(balance) || 0;
        }
      }
      openingBal = Number(openingBal) || 0;

      const { data, error } = await openNewCashier(openingBal);
      if (error) {
        addLog('error', `Erro ao abrir caixa: ${error.message || error}`);
        return null;
      }
      setTodayCashier(data);
      setCashierSangrias([]);
      setCashier(prev => ({
        ...prev,
        status: 'aberto',
        saldo: openingBal,
        dataAbertura: new Date().toLocaleDateString('pt-BR'),
        sangrias: [],
      }));
      addLog('info', `Caixa aberto — Fundo Inicial: R$ ${openingBal.toFixed(2)}`);
      return data;
    } catch (e) {
      console.warn('[SyncContext] abrirCaixaHoje error:', e);
      return null;
    }
  }, [requireConnection, addLog, sheetMetadata]);

  /** Garante que o caixa está aberto antes de uma operação (auto-open silencioso) */
  const ensureCaixaAberto = useCallback(async () => {
    if (todayCashier && todayCashier.status === 'open') return todayCashier;
    // Verificar no banco antes de abrir
    const { data: found } = await fetchTodayCashier();
    if (found) {
      setTodayCashier(found);
      setCashier(prev => ({ ...prev, status: 'aberto', saldo: Number(found.opening_balance || 0) }));
      return found;
    }
    return await abrirCaixaHoje();
  }, [todayCashier, abrirCaixaHoje]);

  /** Fecha o caixa do dia manualmente */
  const fecharCaixa = useCallback(async () => {
    if (!requireConnection('fechar caixa')) return { success: false, error: 'Supabase desconectado' };
    if (!todayCashier?.id) return { success: false, error: 'Nenhum caixa aberto hoje' };
    try {
      const totalSangrias = cashierSangrias.reduce((a, s) => a + Number(s.valor || 0), 0);
      const closingBal = Number(todayCashier.opening_balance || 0)
        + Number(todayCashier.total_cash_in || 0)
        - totalSangrias;

      const { data, error } = await closeCashierById(todayCashier.id, {
        closingBalance: closingBal,
        autoClosed: false,
        totalCashIn: todayCashier.total_cash_in || 0,
        totalCashOut: totalSangrias,
      });
      if (error) return { success: false, error };

      setTodayCashier(data);
      setCashier(prev => ({ ...prev, status: 'fechado', saldo: closingBal }));
      addLog('info', `Caixa fechado — Saldo Final em Dinheiro: R$ ${closingBal.toFixed(2)}`);

      // Recarregar histórico
      const { data: hist } = await fetchCashierHistory(30);
      if (hist) setCashierHistory(hist);

      return { success: true, closingBalance: closingBal };
    } catch (e) {
      addLog('error', `Erro ao fechar caixa: ${e.message}`);
      return { success: false, error: e.message };
    }
  }, [todayCashier, cashierSangrias, requireConnection, addLog]);

  /** Compatibilidade legado: abre caixa (usa novo sistema internamente) */
  const abrirCaixa = useCallback(async (saldoInicial = null) => {
    return await abrirCaixaHoje();
  }, [abrirCaixaHoje]);

  /** Realiza sangria em dinheiro físico — persiste no Supabase */
  const realizarSangria = useCallback(async (valor, motivo) => {
    if (!requireConnection('realizar sangria')) return;
    if (!todayCashier?.id) {
      addLog('warning', 'Abra o caixa antes de realizar uma sangria.');
      return;
    }
    try {
      const { data, error } = await sbInsertSangria({
        valor: Number(valor),
        motivo,
        cashierDate: new Date().toISOString().split('T')[0],
      });
      if (error) {
        addLog('error', `Erro ao registrar sangria: ${error.message || error}`);
        return;
      }
      // Atualizar lista local de sangrias
      setCashierSangrias(prev => [...prev, data]);
      // Atualizar total_cash_out no banco
      const newTotalOut = cashierSangrias.reduce((a, s) => a + Number(s.valor || 0), 0) + Number(valor);
      await updateCashierTotals(todayCashier.id, {
        totalCashIn: todayCashier.total_cash_in || 0,
        totalCashOut: newTotalOut,
      });
      // Atualizar estado local do todayCashier
      setTodayCashier(prev => prev ? { ...prev, total_cash_out: newTotalOut } : prev);
      // Compatibilidade com cashier legado
      setCashier(prev => ({
        ...prev,
        saldo: (prev.saldo || 0) - Number(valor),
        sangrias: [{ id: data.id, valor: Number(valor), motivo, hora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }), data: new Date().toLocaleDateString('pt-BR') }, ...(prev.sangrias || [])],
      }));
      addLog('warning', `Sangria em Dinheiro: R$ ${Number(valor).toFixed(2)} — ${motivo}`);
    } catch (e) {
      addLog('error', `Sangria falhou: ${e.message}`);
    }
  }, [todayCashier, cashierSangrias, requireConnection, addLog]);

  /** Helpers legado para compatibilidade com Financial.jsx header */
  const getFundoInicialHerdado = useCallback(async () => {
    const { balance } = await fetchLastClosingBalance();
    return Number(balance) || 0;
  }, []);

  const isDiaAtendimento = useCallback((dateObj = new Date()) => {
    const day = dateObj.getDay();
    return day >= 2 && day <= 6;
  }, []);

  // ─── Daily Sheet (read-only from Google Sheets) ─────────────
  const updateDailySheet = useCallback((sheetData) => {
    setDailySheet(sheetData);
  }, []);

  // ─── Save Daily Report to Supabase (Sistema de Caixa) ────
  const saveDailyReport = useCallback(async (customData = {}) => {
    const hojeStr = new Date().toLocaleDateString('pt-BR');
    const dataRef = customData.data || dailySheet?.dataCaixa || cashier.dataAbertura || hojeStr;
    const txsDoDia = (sheetTransactions || []).filter(t => (t.date_ref === dataRef || t.data === dataRef || !t.date_ref));
    let totalDinheiro = 0, totalPix = 0, totalCredito = 0, totalDebito = 0;
    txsDoDia.forEach(t => {
      totalDinheiro += Number(t.dinheiro || 0);
      totalPix += Number(t.pix || 0);
      totalCredito += Number(t.credito || 0);
      totalDebito += Number(t.debito || 0);
      if (!t.dinheiro && !t.pix && !t.credito && !t.debito) {
        const v = Number(t.gross ?? t.total ?? 0);
        const pg = String(t.payment_method || t.pagamento || '').toLowerCase();
        if (pg.includes('dinheiro') || pg.includes('cash') || pg.includes('especie')) totalDinheiro += v;
        else if (pg.includes('pix')) totalPix += v;
        else if (pg.includes('credito')) totalCredito += v;
        else if (pg.includes('debito')) totalDebito += v;
        else totalPix += v;
      }
    });
    const fondoInicial = Number(customData.fundo_inicial ?? todayCashier?.opening_balance ?? cashier.saldo ?? 0);
    const totalSangriasBd = cashierSangrias.reduce((a, s) => a + Number(s.valor || 0), 0);
    const fundoFinalCalculado = fondoInicial + totalDinheiro - totalSangriasBd;
    const fundoFinalReal = Number(customData.fundo_final_real ?? fundoFinalCalculado);
    const report = {
      data: dataRef,
      data_caixa: dataRef.includes('/') ? dataRef.split('/').reverse().join('-') : dataRef,
      fundo_inicial: fondoInicial,
      total_dinheiro: totalDinheiro,
      total_pix: totalPix,
      total_credito: totalCredito,
      total_debito: totalDebito,
      fundo_final_calculado: fundoFinalCalculado,
      fundo_final_real: fundoFinalReal,
      diferenca: fundoFinalReal - fundoFinalCalculado,
      status: fundoFinalReal === fundoFinalCalculado ? 'ok' : 'erro',
      sheet_snapshot: dailySheet?.rows || txsDoDia,
    };
    if (isSupabaseConfigured() && supabaseReady) {
      const result = await sbInsertDailyReport(report);
      if (!result.error) addLog('success', `Relatório salvo: R$ ${fundoFinalReal.toFixed(2)}`);
      return result;
    }
    return { data: report, error: null };
  }, [dailySheet, sheetTransactions, cashier, todayCashier, cashierSangrias, supabaseReady, addLog]);

  // ─── Virada de Dia — verificação periódica ─────────────────
  useEffect(() => {
    const checkTurnover = async () => {
      if (!isSupabaseConfigured()) return;
      const today = new Date().toISOString().split('T')[0];
      // Fecha caixas de dias anteriores automaticamente
      const { closed } = await autoClosePreviousCashiers();
      if (closed > 0) {
        setAutoClosed(true);
        addLog('warning', `Virada de dia: ${closed} caixa(s) fechados automaticamente.`);
        await loadCaixaHoje();
      }
    };
    const timer = setInterval(checkTurnover, 60000); // verifica a cada 1 minuto
    return () => clearInterval(timer);
  }, [addLog, loadCaixaHoje]);

  // ─── Carregar caixa ao inicializar ─────────────────────────
  useEffect(() => {
    if (supabaseReady) {
      loadCaixaHoje();
    }
  }, [supabaseReady, loadCaixaHoje]);

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
    // ─── Caixa Real & Sheet Metadata ───
    sheetMetadata, setSheetMetadata,
    todayCashier, cashierSangrias, cashierHistory, autoClosed,
    abrirCaixa, fecharCaixa, realizarSangria, ensureCaixaAberto,
    loadCaixaHoje, abrirCaixaHoje,
    getFundoInicialHerdado, isDiaAtendimento,
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
