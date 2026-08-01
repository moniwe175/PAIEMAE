/**
 * googleSheetsSync.js
 * 
 * Sincroniza dados de uma planilha Google Sheets diretamente com o Supabase.
 * Usa a API pública do Google Sheets (gviz/tq) que não requer autenticação
 * desde que a planilha esteja compartilhada como "qualquer pessoa com o link".
 */

import { supabase } from '../lib/supabase';
import { upsertTransaction, upsertExpense, fetchAllTransactionIds, deleteTransactionsByIds } from './supabaseService';

/**
 * Extrai o Sheet ID da URL do Google Sheets
 */
export function extractSheetId(url) {
  const match = url?.match(/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
}

/**
 * Extrai a aba (gid) da URL do Google Sheets
 */
export function extractGid(url) {
  const match = url?.match(/[#&?]gid=([0-9]+)/);
  return match ? match[1] : '0';
}

/**
 * Busca dados da planilha usando a API pública gviz/tq do Google.
 * A planilha precisa estar com acesso "qualquer pessoa com o link pode visualizar".
 */
export async function fetchSheetData(sheetId, gid = '0', range = '') {
  const rangeParam = range ? `&range=${encodeURIComponent(range)}` : '';
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json&gid=${gid}${rangeParam}`;
  
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Erro HTTP ${response.status} ao acessar planilha`);
  
  const text = await response.text();
  // A API retorna JSONP, precisamos extrair o JSON puro
  const jsonMatch = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]*)\)/);
  if (!jsonMatch) throw new Error('Formato de resposta inválido da planilha');
  
  const json = JSON.parse(jsonMatch[1]);
  if (json.status === 'error') throw new Error(json.errors?.[0]?.message || 'Erro na consulta da planilha');
  
  return json.table;
}

/**
 * Converte os dados brutos da planilha em transações normalizadas.
 * Detecta automaticamente as colunas pelas cabeçalhos.
 */
function parseSheetRows(table) {
  if (!table?.cols || !table?.rows) return { transactions: [], expenses: [] };
  
  // Mapeamento de colunas por nome (case-insensitive)
  const colMap = {};
  table.cols.forEach((col, idx) => {
    const label = (col.label || col.id || '').toLowerCase().trim();
    colMap[label] = idx;
    // Aliases comuns
    if (/cliente|paciente|nome/.test(label)) colMap._cliente = idx;
    if (/procedimento|servi[çc]|tratamento/.test(label)) colMap._procedimento = idx;
    if (/valor|pre[çc]o|total/.test(label)) colMap._valor = idx;
    if (/profiss/.test(label)) colMap._profissional = idx;
    if (/comiss/.test(label)) colMap._comissao = idx;
    if (/data|date/.test(label)) colMap._data = idx;
    if (/forma|pagamento|pix|credito|debito|m[eé]todo/.test(label)) colMap._pagamento = idx;
    if (/comanda|id|cod/.test(label)) colMap._comanda = idx;
    if (/tipo|type/.test(label)) colMap._tipo = idx;
    if (/categ/.test(label)) colMap._categoria = idx;
    if (/repasse/.test(label)) colMap._repasse = idx;
    if (/origem/.test(label)) colMap._origem = idx;
  });

  const transactions = [];
  const expenses = [];
  
  table.rows.forEach((row, rowIdx) => {
    const cells = row.c || [];
    const get = (key) => {
      const idx = colMap[key];
      if (idx === undefined || idx === null) return null;
      const cell = cells[idx];
      return cell?.v ?? cell?.f ?? null;
    };

    // Valor
    const rawValor = get('_valor') ?? get('valor') ?? get('total') ?? get('pre\u00e7o');
    let valor = 0;
    if (rawValor !== null) {
      const cleaned = String(rawValor).replace(/[R$\s.]/g, '').replace(',', '.');
      valor = parseFloat(cleaned) || 0;
    }
    if (valor <= 0) return; // Pula linhas sem valor

    // Data
    const rawData = get('_data') ?? get('data');
    let data = '';
    if (rawData) {
      if (typeof rawData === 'string') {
        data = rawData;
      } else if (rawData instanceof Date) {
        data = rawData.toLocaleDateString('pt-BR');
      }
    }
    if (!data) data = new Date().toLocaleDateString('pt-BR');

    // Tipo — detecta se é despesa ou receita
    const rawTipo = get('_tipo') ?? get('tipo') ?? '';
    const tipStr = String(rawTipo).toLowerCase();
    const isDespesa = /despesa|saida|sa[íi]da|gasto/.test(tipStr);
    const isSangria = /sangria/.test(tipStr);

    if (isDespesa || isSangria) {
      // É uma despesa
      const descricao = get('_cliente') ?? get('_procedimento') ?? get('descricao') ?? get('descri\u00e7\u00e3o') ?? 'Despesa';
      const categoria = get('_categoria') ?? get('_tipo') ?? (isSangria ? 'Sangria' : 'Outros');
      expenses.push({
        id: `sheet_exp_${rowIdx}_${data.replace(/\//g, '')}`,
        data,
        descricao: String(descricao).toUpperCase(),
        categoria: String(categoria),
        valor,
        origem: 'planilha',
        tipo: isSangria ? 'sangria' : 'despesa',
        metodo_pagamento: 'Planilha',
      });
    } else {
      // É uma receita/transação
      const cliente = get('_cliente') ?? get('cliente') ?? '—';
      const procedimento = get('_procedimento') ?? get('procedimento') ?? '—';
      const profissional = get('_profissional') ?? get('profissional') ?? '';
      const pagamento = get('_pagamento') ?? get('pagamento') ?? get('pix') ?? get('credito') ?? get('cr\u00e9dito') ?? 'Pix';
      const comanda = get('_comanda') ?? get('comanda') ?? `row_${rowIdx}`;
      const repasse = get('_repasse') ?? get('repasse') ?? 0;

      transactions.push({
        id: `sheet_${String(comanda).trim() || rowIdx}`,
        comanda: String(comanda).trim() || `row_${rowIdx}`,
        ordem: rowIdx,
        data,
        cliente: String(cliente).trim(),
        procedimento: String(procedimento).trim(),
        profissional: String(profissional).trim(),
        profissional_nome: String(profissional).trim(),
        pagamento: String(pagamento).trim(),
        forma_pagamento: String(pagamento).trim(),
        valor,
        total: valor,
        clinica: valor - (parseFloat(repasse) || 0),
        tipo: 'receita',
        status: 'paid',
        origem: 'planilha',
        hash: null,
      });
    }
  });

  return { transactions, expenses };
}

/**
 * Sincroniza uma planilha com o Supabase.
 * Retorna { success, rowCount, error }
 */
export async function syncSheetToSupabase(sheetUrl, options = {}) {
  const sheetId = extractSheetId(sheetUrl);
  if (!sheetId) return { success: false, rowCount: 0, error: 'URL inválida: não foi possível extrair o Sheet ID' };

  const gid = extractGid(sheetUrl);

  try {
    const table = await fetchSheetData(sheetId, gid, options.range);
    const { transactions, expenses } = parseSheetRows(table);
    
    if (transactions.length === 0 && expenses.length === 0) {
      return { success: true, rowCount: 0, error: null, warning: 'Nenhum dado encontrado na planilha. Verifique se a planilha está compartilhada como "qualquer pessoa com o link".' };
    }

    // Upsert transactions
    const txResults = await Promise.allSettled(
      transactions.map(tx => upsertTransaction(tx))
    );
    
    // Upsert expenses
    const expResults = await Promise.allSettled(
      expenses.map(exp => upsertExpense(exp))
    );

    const txSuccess = txResults.filter(r => r.status === 'fulfilled' && !r.value?.error).length;
    const expSuccess = expResults.filter(r => r.status === 'fulfilled' && !r.value?.error).length;
    const totalSuccess = txSuccess + expSuccess;

    // Log no Supabase
    await supabase.from('sync_logs').insert([{
      event: 'sync_complete',
      status: 'success',
      details: `Sincronizado ${txSuccess} transações e ${expSuccess} despesas da planilha`,
      message: `Sync Google Sheets: ${totalSuccess} registros importados`,
      type: 'success',
    }]).catch(() => {});

    return {
      success: true,
      rowCount: totalSuccess,
      txCount: txSuccess,
      expCount: expSuccess,
      error: null,
    };
  } catch (error) {
    console.error('[GoogleSheetsSync] Erro:', error);
    
    // Log de erro
    await supabase.from('sync_logs').insert([{
      event: 'sync_error',
      status: 'error',
      details: error.message,
      message: `Erro ao sincronizar planilha: ${error.message}`,
      type: 'error',
    }]).catch(() => {});

    return {
      success: false,
      rowCount: 0,
      error: error.message,
    };
  }
}

/**
 * Inicia polling automático de uma planilha.
 * Retorna função para parar o polling.
 */
export function startSheetPolling(sheetUrl, intervalSeconds, onSync) {
  // Sync imediato
  syncSheetToSupabase(sheetUrl).then(onSync).catch(console.error);
  
  // Polling periódico
  const timer = setInterval(() => {
    syncSheetToSupabase(sheetUrl).then(onSync).catch(console.error);
  }, intervalSeconds * 1000);
  
  return () => clearInterval(timer);
}
