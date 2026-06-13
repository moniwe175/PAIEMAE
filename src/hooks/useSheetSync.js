import { useCallback, useEffect, useRef } from 'react';
import { useSync } from '../contexts/SyncContext';

// ─── Utility functions ─────────────────────────────────────────

// Simple hash function for deduplication
function hashRow(values) {
  const str = values.join('|').toLowerCase().trim();
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32bit integer
  }
  return 'row_' + Math.abs(hash).toString(36);
}

// Parse monetary values from various formats
function parseMonetaryValue(raw) {
  if (!raw) return 0;
  const str = String(raw).trim();

  // Remove R$ prefix
  let cleaned = str.replace(/R\$\s*/g, '');

  // Check if it uses Brazilian format (1.200,00) or international (1,200.00)
  if (cleaned.includes(',')) {
    const lastComma = cleaned.lastIndexOf(',');
    const lastDot = cleaned.lastIndexOf('.');

    if (lastComma > lastDot) {
      // Brazilian: 1.200,00 -> 1200.00
      cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } else {
      // International: 1,200.00 -> 1200.00
      cleaned = cleaned.replace(/,/g, '');
    }
  }

  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

// Parse percentage value
function parsePercentage(raw) {
  if (!raw) return null;
  const str = String(raw).trim().replace('%', '').replace(',', '.');
  const num = parseFloat(str);
  return isNaN(num) ? null : num;
}

// Parse date from various formats
function parseDate(raw) {
  if (!raw) return new Date().toLocaleDateString('pt-BR');
  const str = String(raw).trim();

  // Already in BR format DD/MM/YYYY
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(str)) return str;

  // ISO format YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const [y, m, d] = str.split('-');
    return `${d}/${m}/${y}`;
  }

  // Try Date parse
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    return d.toLocaleDateString('pt-BR');
  }

  return str;
}

// Column mapping field definitions
const MAPPABLE_FIELDS = [
  { key: 'cliente', label: 'Cliente / Paciente', required: true },
  { key: 'procedimento', label: 'Procedimento / Serviço', required: true },
  { key: 'valor', label: 'Valor (R$)', required: true },
  { key: 'profissional', label: 'Profissional', required: false },
  { key: 'comissao', label: 'Comissão (%)', required: false },
  { key: 'data', label: 'Data', required: false },
  { key: 'tipo', label: 'Tipo (receita/despesa)', required: false },
  { key: 'categoria', label: 'Categoria', required: false },
];

// Auto-detect column mapping from header row
function autoDetectMapping(headers) {
  const mapping = {};
  const lowerHeaders = headers.map(h => String(h).toLowerCase().trim());

  const rules = [
    { key: 'cliente', patterns: ['cliente', 'paciente', 'nome', 'patient', 'client'] },
    { key: 'procedimento', patterns: ['procedimento', 'serviço', 'servico', 'service', 'procedure', 'tratamento'] },
    { key: 'valor', patterns: ['valor', 'preço', 'preco', 'value', 'amount', 'total', 'r$'] },
    { key: 'profissional', patterns: ['profissional', 'médico', 'medico', 'doctor', 'profissional', 'executante'] },
    { key: 'comissao', patterns: ['comissão', 'comissao', 'commission', '%', 'pct', 'percentual'] },
    { key: 'data', patterns: ['data', 'date', 'dia', 'data_servico', 'data_serviço'] },
    { key: 'tipo', patterns: ['tipo', 'type', 'natureza', 'entrada_saida'] },
    { key: 'categoria', patterns: ['categoria', 'category', 'classificação', 'classificacao'] },
  ];

  for (const rule of rules) {
    const idx = lowerHeaders.findIndex(h => rule.patterns.some(p => h.includes(p)));
    if (idx !== -1) {
      mapping[rule.key] = idx;
    }
  }

  return mapping;
}

// ─── Main hook ─────────────────────────────────────────────────

export function useSheetSync() {
  const {
    syncConfig,
    syncStatus,
    importFromSheet,
    updateDailySheet,
    connectSheet,
    disconnectSheet,
    addLog,
    startPolling,
    stopPolling,
    setSyncStatus,
  } = useSync();

  // Process a single row from the sheet into transaction + commission
  const processRow = useCallback((rowData, mapping) => {
    const getVal = (key) => {
      const idx = mapping[key];
      return idx !== undefined && idx !== null ? rowData[idx] : '';
    };

    const cliente = String(getVal('cliente') || '').trim();
    const procedimento = String(getVal('procedimento') || '').trim();
    const valorRaw = getVal('valor');
    const profissional = String(getVal('profissional') || '').trim();
    const comissaoRaw = getVal('comissao');
    const dataRaw = getVal('data');
    const tipoRaw = String(getVal('tipo') || '').trim().toLowerCase();
    const categoriaRaw = String(getVal('categoria') || '').trim();

    // Validate required fields
    if (!cliente || !procedimento) return null;

    const valor = parseMonetaryValue(valorRaw);
    if (valor <= 0) return null;

    const data = parseDate(dataRaw);
    const tipo = tipoRaw.includes('despesa') || tipoRaw.includes('expense') || tipoRaw.includes('saída') ? 'despesa' : 'receita';
    const categoria = categoriaRaw || (tipo === 'receita' ? 'Serviços' : 'Outros');
    const comissaoPct = parsePercentage(comissaoRaw);

    // Build transaction
    const rowHash = hashRow([cliente, procedimento, String(valor), data]);
    const pctProf = comissaoPct || 30;
    const profValor = Math.round(valor * (pctProf / 100));
    const transaction = {
      id: rowHash,
      tipo,
      desc: `${procedimento} - ${cliente}`,
      categoria,
      data,
      valor,
      origem: 'planilha',
      // New format fields
      hora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      cliente,
      procedimento,
      total: valor,
      clinica: valor - profValor,
      profissional: profValor,
      pagamento: 'Pix',
      status: 'paid',
      profissionalNome: profissional || '—',
    };

    // Build commission if professional is specified
    let comissao = null;
    if (profissional && tipo === 'receita') {
      const pct = comissaoPct || 30; // default 30%
      comissao = {
        id: rowHash + '_com',
        prof: profissional,
        servico: procedimento,
        paciente: cliente,
        data,
        valorServ: valor,
        pct,
        valorComissao: Math.round(valor * (pct / 100) * 100) / 100,
        status: 'pendente',
        origem: 'planilha',
      };
    }

    return { transaction, comissao, rowHash };
  }, []);

  // Poll Google Sheets API via direct fetch (no gapi needed)
  // Each call FULLY REPLACES the dailySheet state — no accumulation.
  const pollGoogleSheet = useCallback(async () => {
    const apiKey = import.meta.env.VITE_GOOGLE_API_KEY;
    const envSheetId = import.meta.env.VITE_GOOGLE_SHEET_ID;
    const sheetId = syncConfig.sheetId || envSheetId;

    if (!apiKey || !sheetId) {
      addLog('error', 'Google Sheets: API Key ou Sheet ID não configurados no .env');
      setSyncStatus('error');
      return;
    }

    try {
      setSyncStatus('connecting');
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/A1:I100?key=${apiKey}`;
      const response = await fetch(url);

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        const errMsg = errBody?.error?.message || `HTTP ${response.status}`;
        throw new Error(errMsg);
      }

      const json = await response.json();
      const rows = json.values || [];

      console.log('[SheetSync] Raw rows received:', rows.length);
      console.log('[SheetSync] Row 1 (metadata):', JSON.stringify(rows[0]));
      console.log('[SheetSync] Row 3 (headers):', JSON.stringify(rows[2]));

      if (rows.length < 4) {
        // Sheet is empty — REPLACE state with zeros (do not keep old data)
        const emptySheet = {
          dataCaixa: new Date().toLocaleDateString('pt-BR'),
          fundoInicial: 0,
          fundoFinal: 0,
          totalPix: 0,
          totalCredito: 0,
          totalDebito: 0,
          totalDinheiro: 0,
          totalRepasse: 0,
          faturamentoBruto: 0,
          faturamentoLiquido: 0,
          totalDespesas: 0,
          totalTransacoes: 0,
          rows: [],
          expenseRows: [],
          lastUpdated: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        };
        if (updateDailySheet) updateDailySheet(emptySheet);
        addLog('warning', 'Planilha vazia — dados zerados');
        setSyncStatus('connected');
        return;
      }

      // ─── Parse metadata from row 1 (A1, C1, F1) ───────────
      const row1 = rows[0] || [];
      const a1Value = String(row1[0] || '');
      const dateMatch = a1Value.match(/(\d{2}\/\d{2}\/\d{4})/);
      const dataCaixa = dateMatch ? dateMatch[1] : new Date().toLocaleDateString('pt-BR');
      const fundoInicial = parseMonetaryValue(row1[2]) || 0;  // C1
      const fundoFinal = parseMonetaryValue(row1[5]) || 0;    // F1

      // ─── Parse data rows from row 4+ (index 3+) ────────────
      // IMPORTANT: All accumulators are LOCAL — they reset to 0 every poll cycle.
      let totalPix = 0;
      let totalCredito = 0;
      let totalDebito = 0;
      let totalDinheiro = 0;
      let totalRepasse = 0;
      const dataRows = [];

      // Expense categories (all are despesas — summed together for totalDespesas)
      const expenseKeywords = /^(passagem|produtos|tributos|outras?\s*sa[íi]das?|sangria)$/i;
      const skipKeywords = /^(cliente|total|totalizador|subtotal|soma|---)/i;
      let totalDespesas = 0;
      const expenseRows = [];

      for (let i = 3; i < rows.length; i++) {
        const row = rows[i];

        // Skip empty or undefined rows
        if (!row || row.length === 0) continue;

        // Column A (index 0): CLIENTE or expense category
        const label = String(row[0] || '').trim();

        // Skip rows with no label
        if (!label) continue;

        // Skip header/total/separator rows
        if (skipKeywords.test(label)) continue;

        // Read monetary values from columns B-F
        const credito = parseMonetaryValue(row[1]) || 0;
        const debito = parseMonetaryValue(row[2]) || 0;
        const dinheiro = parseMonetaryValue(row[3]) || 0;
        const pix = parseMonetaryValue(row[4]) || 0;
        const repasse = parseMonetaryValue(row[5]) || 0;
        const profissional = String(row[6] || '').trim();   // G: service type
        const profNome = String(row[7] || '').trim();          // H: professional name
        const comandaNum = String(row[8] || '').trim();         // I: command number

        // Row total (sum of all payment columns)
        const rowTotal = credito + debito + dinheiro + pix + repasse;

        // Check if this is an expense category row (including SANGRIA)
        if (expenseKeywords.test(label)) {
          totalDespesas += rowTotal;
          expenseRows.push({ categoria: label, valor: rowTotal, credito, debito, dinheiro, pix, repasse });
          continue;
        }

        // Otherwise, it's a revenue/client row
        totalPix += pix;
        totalCredito += credito;
        totalDebito += debito;
        totalDinheiro += dinheiro;
        totalRepasse += repasse;

        dataRows.push({
          cliente: label, credito, debito, dinheiro, pix, repasse,
          profissional, profNome, comanda: comandaNum,
        });
      }

      const faturamentoBruto = totalPix + totalCredito + totalDebito + totalDinheiro;
      const faturamentoLiquido = faturamentoBruto - totalDespesas;

      console.log('[SheetSync] Parsed:', {
        transacoes: dataRows.length,
        faturamentoBruto,
        faturamentoLiquido,
        totalDespesas,
        totalPix, totalCredito, totalDebito, totalDinheiro, totalRepasse,
        clientes: dataRows.map(r => r.cliente),
        despesas: expenseRows.map(r => `${r.categoria}: R$ ${r.valor.toFixed(2)}`),
      });

      // ─── FULL REPLACEMENT of dailySheet state ───────────────
      // This object COMPLETELY SUBSTITUTES the previous state.
      // If a row was deleted from the sheet, it will be gone here.
      const sheetData = {
        dataCaixa,
        fundoInicial,
        fundoFinal,
        totalPix,
        totalCredito,
        totalDebito,
        totalDinheiro,
        totalRepasse,
        faturamentoBruto,
        faturamentoLiquido,
        totalDespesas,
        totalTransacoes: dataRows.length,
        rows: dataRows,
        expenseRows,
        lastUpdated: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      };

      if (updateDailySheet) {
        updateDailySheet(sheetData);
      }

      addLog('info', `Planilha: ${dataRows.length} transações | R$ ${faturamentoBruto.toFixed(2)} bruto | R$ ${totalDespesas.toFixed(2)} despesas | R$ ${faturamentoLiquido.toFixed(2)} líquido`);
      setSyncStatus('connected');
    } catch (error) {
      addLog('error', `Erro ao sincronizar: ${error.message || 'Erro desconhecido'}`);
      setSyncStatus('error');
    }
  }, [syncConfig.sheetId, addLog, updateDailySheet, setSyncStatus]);

  // Auto-connect when env vars are available
  const autoConnectRef = useRef(false);
  useEffect(() => {
    const apiKey = import.meta.env.VITE_GOOGLE_API_KEY;
    const envSheetId = import.meta.env.VITE_GOOGLE_SHEET_ID;
    if (apiKey && envSheetId && !autoConnectRef.current) {
      autoConnectRef.current = true;
      connectSheet({ sheetId: envSheetId, googleApiKey: apiKey, sheetName: 'Caixa Operacional' });
      addLog('info', 'Auto-conectando à planilha do Google Sheets...');
      startPolling(pollGoogleSheet, 15);
    }
  }, [connectSheet, addLog, startPolling, pollGoogleSheet]);

  // Connect and start syncing
  const connect = useCallback((config) => {
    connectSheet(config);
    const interval = config.pollingInterval || 30;
    addLog('info', `Iniciando sincronização com Google Sheets (a cada ${interval}s)`);
    startPolling(pollGoogleSheet, interval);
  }, [connectSheet, addLog, startPolling, pollGoogleSheet]);

  // Disconnect
  const disconnect = useCallback(() => {
    stopPolling();
    disconnectSheet();
  }, [stopPolling, disconnectSheet]);

  // Load Google API script
  const loadGoogleApi = useCallback(() => {
    return new Promise((resolve, reject) => {
      if (window.gapi) {
        resolve(window.gapi);
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://apis.google.com/js/api.js';
      script.onload = () => {
        window.gapi.load('client', async () => {
          try {
            await window.gapi.client.init({
              apiKey: syncConfig.googleApiKey,
              discoveryDocs: ['https://sheets.googleapis.com/$discovery/rest?version=v4'],
            });
            resolve(window.gapi);
          } catch (err) {
            reject(err);
          }
        });
      };
      script.onerror = () => reject(new Error('Failed to load Google API script'));
      document.head.appendChild(script);
    });
  }, [syncConfig.googleApiKey]);

  // Authenticate with Google
  const authenticateGoogle = useCallback(async (clientId) => {
    try {
      // Load GIS script
      if (!window.google?.accounts?.oauth2) {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://accounts.google.com/gsi/client';
          script.onload = resolve;
          script.onerror = () => reject(new Error('Failed to load Google Identity Services'));
          document.head.appendChild(script);
        });
      }

      return new Promise((resolve, reject) => {
        const tokenClient = window.google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: 'https://www.googleapis.com/auth/spreadsheets.readonly',
          callback: (response) => {
            if (response.error) {
              reject(new Error(response.error));
              return;
            }
            resolve(response);
          },
        });
        tokenClient.requestAccessToken();
      });
    } catch (error) {
      throw error;
    }
  }, []);

  return {
    connect,
    disconnect,
    processRow,
    pollGoogleSheet,
    loadGoogleApi,
    authenticateGoogle,
    autoDetectMapping,
    parseMonetaryValue,
    parsePercentage,
    parseDate,
    hashRow,
    MAPPABLE_FIELDS,
    syncStatus,
    syncConfig,
  };
}

export default useSheetSync;
