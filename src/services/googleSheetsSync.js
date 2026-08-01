/**
 * googleSheetsSync.js
 * 
 * Sincroniza dados de uma planilha Google Sheets diretamente com a tabela sheet_transactions do Supabase.
 * Usa a API pública do Google Sheets (gviz/tq) via fetch no navegador.
 */

import { supabase } from '../lib/supabase';
import { upsertSheetTransaction } from './supabaseService';

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
 * Formata data para YYYY-MM-DD aceito pelo PostgreSQL
 */
function formatDateForDb(rawData) {
  if (!rawData) return new Date().toISOString().split('T')[0];
  const str = String(rawData).trim();
  
  // Formato DD/MM/YYYY
  const brMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (brMatch) {
    const day = brMatch[1].padStart(2, '0');
    const month = brMatch[2].padStart(2, '0');
    const year = brMatch[3];
    return `${year}-${month}-${day}`;
  }
  
  // Formato Date(YYYY,M,D) do gviz
  const gvizMatch = str.match(/Date\((\d+),(\d+),(\d+)\)/);
  if (gvizMatch) {
    const y = gvizMatch[1];
    const m = String(Number(gvizMatch[2]) + 1).padStart(2, '0');
    const d = String(gvizMatch[3]).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;

  try {
    const parsed = new Date(str);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().split('T')[0];
    }
  } catch (e) {}

  return new Date().toISOString().split('T')[0];
}

/**
 * Busca dados da planilha usando a API pública gviz/tq do Google.
 */
export async function fetchSheetData(sheetId, gid = '0', range = '') {
  const rangeParam = range ? `&range=${encodeURIComponent(range)}` : '';
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json&gid=${gid}${rangeParam}`;
  
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Erro HTTP ${response.status} ao acessar planilha`);
  
  const text = await response.text();
  const jsonMatch = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]*)\)/);
  if (!jsonMatch) throw new Error('Formato de resposta inválido da planilha');
  
  const json = JSON.parse(jsonMatch[1]);
  if (json.status === 'error') throw new Error(json.errors?.[0]?.message || 'Erro na consulta da planilha');
  
  return json.table;
}

/**
 * Converte os dados brutos da planilha em registros da tabela sheet_transactions.
 */
function parseSheetRows(table) {
  if (!table?.cols || !table?.rows) return { sheetRows: [] };
  
  const colMap = {};
  table.cols.forEach((col, idx) => {
    const label = (col.label || col.id || '').toLowerCase().trim();
    colMap[label] = idx;
    if (/cliente|paciente|nome/.test(label)) colMap._cliente = idx;
    if (/procedimento|servi[çc]|tratamento/.test(label)) colMap._procedimento = idx;
    if (/valor|pre[çc]o|total|bruto|gross/.test(label)) colMap._valor = idx;
    if (/profiss/.test(label)) colMap._profissional = idx;
    if (/comiss/.test(label)) colMap._comissao = idx;
    if (/data|date/.test(label)) colMap._data = idx;
    if (/forma|pagamento|m[eé]todo/.test(label)) colMap._pagamento = idx;
    if (/comanda|id|cod/.test(label)) colMap._comanda = idx;
    if (/tipo|type|row_type/.test(label)) colMap._tipo = idx;
    if (/pix/.test(label)) colMap._pix = idx;
    if (/credito|crédito/.test(label)) colMap._credito = idx;
    if (/debito|débito/.test(label)) colMap._debito = idx;
    if (/dinheiro|espécie|especie/.test(label)) colMap._dinheiro = idx;
    if (/repasse/.test(label)) colMap._repasse = idx;
  });

  const sheetRows = [];
  
  table.rows.forEach((row, rowIdx) => {
    const cells = row.c || [];
    const get = (key) => {
      const idx = colMap[key];
      if (idx === undefined || idx === null) return null;
      const cell = cells[idx];
      return cell?.v ?? cell?.f ?? null;
    };

    const rawValor = get('_valor') ?? get('valor') ?? get('gross') ?? get('total') ?? get('pre\u00e7o');
    let gross = 0;
    if (rawValor !== null) {
      const cleaned = String(rawValor).replace(/[R$\s.]/g, '').replace(',', '.');
      gross = parseFloat(cleaned) || 0;
    }
    if (gross <= 0) return;

    const rawData = get('_data') ?? get('data');
    const dateRef = formatDateForDb(rawData);

    const rawTipo = String(get('_tipo') ?? get('tipo') ?? '').toLowerCase();
    let rowType = 'receita';
    if (/despesa|saida|sa[íi]da|gasto/.test(rawTipo)) rowType = 'despesa';
    else if (/sangria/.test(rawTipo)) rowType = 'sangria';

    const client = String(get('_cliente') ?? get('cliente') ?? '—').trim();
    const procedure = String(get('_procedimento') ?? get('procedimento') ?? '—').trim();
    const professional = String(get('_profissional') ?? get('profissional') ?? '—').trim();
    const paymentMethod = String(get('_pagamento') ?? get('pagamento') ?? 'Pix').trim();
    const comanda = get('_comanda') ?? get('comanda') ?? `row_${rowIdx + 1}`;

    const parseNum = (v) => {
      if (v === null || v === undefined) return 0;
      const c = String(v).replace(/[R$\s.]/g, '').replace(',', '.');
      return parseFloat(c) || 0;
    };

    const pix = parseNum(get('_pix') ?? get('pix'));
    const credito = parseNum(get('_credito') ?? get('credito'));
    const debito = parseNum(get('_debito') ?? get('debito'));
    const dinheiro = parseNum(get('_dinheiro') ?? get('dinheiro'));
    const repasse = parseNum(get('_repasse') ?? get('repasse'));
    const comissaoVal = parseNum(get('_comissao') ?? get('comissao'));

    sheetRows.push({
      comanda: String(comanda).trim(),
      date_ref: dateRef,
      client,
      procedure,
      professional,
      gross,
      payment_method: paymentMethod,
      pix,
      credito,
      debito,
      dinheiro,
      repasse,
      commission_value: comissaoVal > 0 ? comissaoVal : null,
      row_type: rowType,
      tipo: rowType,
      origin: 'planilha',
      is_metadata: false,
    });
  });

  return { sheetRows };
}

/**
 * Sincroniza a planilha Google Sheets diretamente com a tabela sheet_transactions no Supabase.
 */
export async function syncSheetToSupabase(sheetUrl, options = {}) {
  const defaultUrl = 'https://docs.google.com/spreadsheets/d/1uXB-p9iWev-ID7HVZVUj42FBu2J4PkWMo1cocTW2GXI/edit';
  const urlToUse = sheetUrl || defaultUrl;
  const sheetId = extractSheetId(urlToUse);
  if (!sheetId) return { success: false, rowCount: 0, error: 'URL inválida: não foi possível extrair o Sheet ID' };

  const gid = extractGid(urlToUse);

  try {
    const table = await fetchSheetData(sheetId, gid, options.range);
    const { sheetRows } = parseSheetRows(table);
    
    if (!sheetRows || sheetRows.length === 0) {
      return { success: true, rowCount: 0, error: null, warning: 'Nenhum dado encontrado na planilha.' };
    }

    const results = await Promise.allSettled(
      sheetRows.map(row => upsertSheetTransaction(row))
    );
    
    const succeeded = results.filter(r => r.status === 'fulfilled' && !r.value?.error).length;

    await supabase.from('sync_logs').insert([{
      event: 'sync_complete',
      status: 'success',
      details: `Sincronizado ${succeeded} registros na tabela sheet_transactions`,
      message: `Sync Google Sheets (JS): ${succeeded} registros importados`,
      type: 'success',
    }]).catch(() => {});

    return {
      success: true,
      rowCount: succeeded,
      error: null,
    };
  } catch (error) {
    console.error('[GoogleSheetsSync] Erro:', error);
    
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
 */
export function startSheetPolling(sheetUrl, intervalSeconds, onSync) {
  syncSheetToSupabase(sheetUrl).then(onSync).catch(console.error);
  const timer = setInterval(() => {
    syncSheetToSupabase(sheetUrl).then(onSync).catch(console.error);
  }, (intervalSeconds || 30) * 1000);
  return () => clearInterval(timer);
}
