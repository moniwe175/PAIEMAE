import { useEffect, useRef, useCallback } from 'react';
import { useSync } from '../contexts/SyncContext';

/**
 * useSheetSync — Auto-connect and sync with Google Sheets
 */
export default function useSheetSync() {
  const {
    syncConfig,
    syncStatus,
    connectSheet,
    disconnectSheet,
    startPolling,
    addLog,
    importFromSheet
  } = useSync();

  const hasAttempted = useRef(false);

  // Auto-detect column mapping from spreadsheet headers
  const autoDetectMapping = useCallback((headers) => {
    const rules = [
      { key: 'cliente',      match: h => /client|pacient|nome/.test(h) },
      { key: 'procedimento', match: h => /proced|servi[çc]|tratamento/.test(h) },
      { key: 'valor',        match: h => /valor|pre[çc]o|total/.test(h) },
      { key: 'profissional', match: h => /profiss/.test(h) },
      { key: 'comissao',     match: h => /comiss/.test(h) },
      { key: 'data',         match: h => /data|date/.test(h) },
      { key: 'tipo',         match: h => /tipo|type/.test(h) },
      { key: 'categoria',    match: h => /categ/.test(h) },
      { key: 'forma_pagamento', match: h => /forma|pagamento|m[eé]todo/.test(h) }
    ];
    const mapping = {};
    (headers || []).forEach((raw, idx) => {
      const h = (raw || '').toString().toLowerCase().trim();
      for (const rule of rules) {
        if (mapping[rule.key] === undefined && rule.match(h)) {
          mapping[rule.key] = idx;
          break;
        }
      }
    });
    return mapping;
  }, []);

  const pollGoogleSheet = useCallback(async (config) => {
    try {
      const { sheetId, range, googleApiKey } = config;
      if (!sheetId || !googleApiKey) {
        throw new Error('Configuração incompleta (falta ID da planilha ou API Key)');
      }

      const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}?key=${googleApiKey}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Google Sheets API Error (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      const rows = data.values;

      if (!rows || rows.length <= 1) {
        return { success: true, count: 0 };
      }

      const newTransactions = [];
      const newExpenses = [];
      let currentDataCaixa = new Date().toLocaleDateString('pt-BR');
      let fundoInicial = 0;
      let fundoFinal = 0;

      // Helper para valor numérico
      const parseValue = (val) => {
        if (!val) return 0;
        const str = val.toString().replace(/[^\d.,-]/g, '').replace(',', '.');
        return parseFloat(str) || 0;
      };

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length === 0) continue;

        const col0 = (row[0] || '').toString().trim().toUpperCase();

        // Identificar bloco de Caixa e pegar a data e fundos
        if (col0.includes('CAIXA - DIA')) {
          if (row[1]) currentDataCaixa = row[1].toString().trim();
          
          // Procurar FUNDO INICIAL e FINAL na mesma linha
          for (let j = 0; j < row.length; j++) {
            const cell = (row[j] || '').toString().toUpperCase();
            if (cell === 'FUNDO INICIAL') fundoInicial = parseValue(row[j+1]);
            if (cell === 'FUNDO FINAL') fundoFinal = parseValue(row[j+1]);
          }
          continue;
        }

        // Ignorar separadores, cabeçalhos, totais vazios
        if (col0 === '--' || col0 === 'CLIENTE' || col0.includes('TOTAL')) {
          continue;
        }

        // Se for uma linha de dados (precisa ter texto na primeira coluna)
        if (!col0) continue;

        // Categorias de despesa explícitas
        const despesasKeys = ['PASSAGEM', 'PRODUTOS', 'TRIBUTOS', 'OUTRAS SAÍDAS', 'SANGRIA'];
        const isDespesa = despesasKeys.some(k => col0 === k);

        // Achar o valor e forma de pagamento nas colunas 1 a 5
        let valor = 0;
        let formaPagamento = '';
        const formas = ['Crédito', 'Débito', 'Dinheiro', 'Pix', 'Repasse'];
        
        for (let c = 1; c <= 5; c++) {
          const v = parseValue(row[c]);
          if (v > 0) {
            valor = v;
            formaPagamento = formas[c - 1];
            break;
          }
        }

        // Ignorar se não tem valor
        if (valor === 0) continue;

        // Comanda (coluna 7 - índice 7 seria H, 0-indexed: CLIENTE=0, CREDITO=1, DEBITO=2, DINHEIRO=3, PIX=4, REPASSE=5, PROFISSIONAL=6, COMANDA=7)
        const profissional = row[6] ? row[6].toString().trim() : 'Não informado';
        const comanda = row[7] ? row[7].toString().trim() : `CMD_AUTO_${i}`;

        if (isDespesa) {
          newExpenses.push({
            id: `sheet_exp_${comanda}`,
            data: currentDataCaixa,
            descricao: col0,
            categoria: col0,
            valor: valor,
            metodo_pagamento: formaPagamento || 'Outros',
            origem: 'planilha',
            tipo: 'despesa'
          });
        } else {
          newTransactions.push({
            id: `sheet_tx_${comanda}`,
            data: currentDataCaixa,
            cliente: row[0].toString().trim(),
            procedimento: 'Procedimento Importado',
            valor: valor,
            formaPagamento: formaPagamento,
            profissional_nome: profissional,
            comanda: comanda,
            origem: 'planilha',
            tipo: 'receita'
          });
        }
      }

      const totalFound = newTransactions.length + newExpenses.length;
      
      if (totalFound > 0) {
        // Build the daily report payload
        const totalReceitas = newTransactions.reduce((acc, t) => acc + t.valor, 0);
        const totalDespesas = newExpenses.reduce((acc, t) => acc + t.valor, 0);
        const totalLiquido = totalReceitas - totalDespesas;
        
        // Convert DD/MM/YYYY or DD/MM to YYYY-MM-DD for database
        let dateParts = currentDataCaixa.split('/');
        if (dateParts.length === 2) {
           dateParts = [dateParts[0], dateParts[1], new Date().getFullYear().toString()];
        }
        const dataCaixaISO = dateParts.length === 3
          ? `${dateParts[2]}-${dateParts[1].padStart(2, '0')}-${dateParts[0].padStart(2, '0')}`
          : new Date().toISOString().split('T')[0];

        const caixaReport = {
          data_caixa: dataCaixaISO,
          fundo_inicial: fundoInicial,
          fundo_final: fundoFinal,
          faturamento_bruto: totalReceitas,
          total_despesas: totalDespesas,
          total_transacoes: newTransactions.length,
          status: 'fechado'
        };

        const importResult = await importFromSheet(newTransactions, [], newExpenses, [], caixaReport);
        
        if (importResult?.upsertedCount > 0) {
          addLog('success', `${importResult.upsertedCount} novos registros sincronizados da planilha`);
        } else if (importResult?.error) {
          throw new Error('falha ao persistir dados no banco');
        }
        
        return { success: true, count: importResult?.upsertedCount || 0 };
      }

      return { success: true, count: 0 };
    } catch (e) {
      console.error('[useSheetSync] Poll erro:', e);
      addLog('error', `Erro na sincronização: ${e.message}`);
      throw e;
    }
  }, [importFromSheet, addLog]);

  useEffect(() => {
    // Only attempt auto-connect once, and only if disconnected
    if (hasAttempted.current) return;
    if (syncStatus === 'connected') return;

    const savedConfig = syncConfig;
    if (!savedConfig?.sheetId || savedConfig?.provider !== 'google') {
      hasAttempted.current = true;
      return;
    }

    try {
      connectSheet(savedConfig);
      addLog('info', `Auto-conectado à planilha: ${savedConfig.sheetName || savedConfig.sheetId}`);
      startPolling(() => pollGoogleSheet(savedConfig), savedConfig.pollingInterval || 30);
    } catch (e) {
      console.warn('[useSheetSync] Auto-connect failed:', e);
      addLog('error', `Falha na auto-conexão: ${e?.message || 'erro desconhecido'}`);
    }

    hasAttempted.current = true;
  }, [syncConfig, syncStatus, connectSheet, startPolling, addLog, pollGoogleSheet]);

  return {
    connect: connectSheet,
    disconnect: disconnectSheet,
    autoDetectMapping,
    pollGoogleSheet
  };
}
