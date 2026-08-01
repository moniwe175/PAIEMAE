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
 * Reconhece a estrutura específica do CAIXA (Receitas na tabela superior, Despesas nas linhas inferiores).
 */
function parseSheetRows(table) {
  if (!table?.cols || !table?.rows) return { sheetRows: [] };

  const rows = table.rows;

  // 1. Encontrar a linha de cabeçalho das receitas (ex: linha que contém "CLIENTE", "PROCEDIMENTO", "PROFISSIONAL")
  let headerRowIdx = -1;
  let colMap = {
    cliente: 0,
    credito: 1,
    debito: 2,
    dinheiro: 3,
    pix: 4,
    gross: 5,
    procedimento: 6,
    profissional: 7,
    comanda: 8,
  };

  rows.forEach((row, idx) => {
    const cells = (row.c || []).map(c => c ? String(c.v ?? c.f ?? '').toUpperCase().trim() : '');
    if (cells.includes('CLIENTE') || cells.includes('PROCEDIMENTO') || cells.includes('PROFISSIONAL')) {
      headerRowIdx = idx;
      cells.forEach((cellText, cIdx) => {
        if (/CLIENTE|PACIENTE|NOME/.test(cellText)) colMap.cliente = cIdx;
        if (/CREDITO|CRÉDITO/.test(cellText)) colMap.credito = cIdx;
        if (/DEBITO|DÉBITO/.test(cellText)) colMap.debito = cIdx;
        if (/DINHEIRO/.test(cellText)) colMap.dinheiro = cIdx;
        if (/PIX/.test(cellText)) colMap.pix = cIdx;
        if (/PROCEDIMENTO/.test(cellText)) colMap.procedimento = cIdx;
        if (/PROFISSIONAL/.test(cellText)) colMap.profissional = cIdx;
        if (/COMANDA|ID|TICKET|CODIGO/.test(cellText)) colMap.comanda = cIdx;
      });
    }
  });

  const parseNum = (v) => {
    if (v === null || v === undefined) return 0;
    const c = String(v).replace(/[R$\s.]/g, '').replace(',', '.');
    return parseFloat(c) || 0;
  };

  // 2. Extrair data de referência do título (R0) se presente
  let dateRef = new Date().toISOString().split('T')[0];
  if (rows[0]?.c?.[0]?.v) {
    const headerTitle = String(rows[0].c[0].v);
    const dateMatch = headerTitle.match(/(\d{1,2}\/\d{1,2}\/\d{4})/);
    if (dateMatch) {
      dateRef = formatDateForDb(dateMatch[1]);
    }
  }

  const sheetRows = [];

  // 3. Processar linhas
  rows.forEach((row, rowIdx) => {
    const cells = (row.c || []).map(c => c ? (c.v ?? c.f ?? null) : null);

    if (rowIdx <= headerRowIdx || !cells.some(v => v !== null)) return;

    const col0Str = String(cells[0] || '').trim().toUpperCase();

    // ─── A) Despesas e Sangrias por categoria fixa ───
    const isPassagem = col0Str.includes('PASSAGEM');
    const isProdutos = col0Str.includes('PRODUTOS');
    const isTributos = col0Str.includes('TRIBUTOS');
    const isOutrasSaidas = col0Str.includes('OUTRAS SAÍDAS') || col0Str.includes('OUTRAS SAIDAS');
    const isSangriaRow = col0Str.includes('SANGRIA');
    const isTotalRow = col0Str.includes('TOTAL');

    if (isTotalRow) return;

    if (isPassagem || isProdutos || isTributos || isOutrasSaidas || isSangriaRow) {
      const valor = parseNum(cells[1]); // Coluna B
      const rowType = isSangriaRow ? 'sangria' : 'despesa';
      const catName = isPassagem ? 'Passagem' : isProdutos ? 'Produtos' : isTributos ? 'Tributos' : isOutrasSaidas ? 'Outras Saídas' : 'Sangria';
      const descName = isPassagem ? 'PASSAGEM' : isProdutos ? 'PRODUTOS' : isTributos ? 'TRIBUTOS' : isOutrasSaidas ? 'OUTRAS SAÍDAS' : 'SANGRIA';
      const comandaKey = `despesa_${descName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;

      sheetRows.push({
        comanda: comandaKey,
        date_ref: dateRef,
        client: descName,
        procedure: catName,
        professional: '—',
        gross: valor,
        payment_method: 'Planilha',
        pix: 0,
        credito: 0,
        debito: 0,
        dinheiro: 0,
        repasse: 0,
        commission_value: null,
        row_type: rowType,
        tipo: rowType,
        origin: 'planilha',
        is_metadata: false,
      });
      return;
    }

    // ─── B) Receitas / Transações de Clientes ───
    const clienteVal = cells[colMap.cliente] ?? cells[0];
    const procVal = cells[colMap.procedimento] ?? cells[6];
    const profVal = cells[colMap.profissional] ?? cells[7];
    const comandaVal = cells[colMap.comanda] ?? cells[8];

    const credito = parseNum(cells[colMap.credito] ?? cells[1]);
    const debito = parseNum(cells[colMap.debito] ?? cells[2]);
    const dinheiro = parseNum(cells[colMap.dinheiro] ?? cells[3]);
    const pix = parseNum(cells[colMap.pix] ?? cells[4]);

    const grossCalculated = credito + debito + dinheiro + pix;
    const grossRaw = parseNum(cells[colMap.gross] ?? cells[5]);
    const gross = grossCalculated > 0 ? grossCalculated : grossRaw;

    if (gross <= 0 || !clienteVal || String(clienteVal).trim() === '--') return;

    let paymentMethod = 'Pix';
    if (pix > 0) paymentMethod = 'Pix';
    else if (credito > 0) paymentMethod = 'Crédito';
    else if (debito > 0) paymentMethod = 'Débito';
    else if (dinheiro > 0) paymentMethod = 'Dinheiro';

    const comandaStr = comandaVal ? String(comandaVal).trim() : `rec_${rowIdx}`;

    sheetRows.push({
      comanda: comandaStr,
      date_ref: dateRef,
      client: String(clienteVal).trim(),
      procedure: procVal ? String(procVal).trim() : '—',
      professional: profVal ? String(profVal).trim() : '—',
      gross,
      payment_method: paymentMethod,
      pix,
      credito,
      debito,
      dinheiro,
      repasse: 0,
      commission_value: null,
      row_type: 'receita',
      tipo: 'receita',
      origin: 'planilha',
      is_metadata: false,
    });
  });

  return { sheetRows };
}

/**
 * Sincroniza a planilha Google Sheets com a tabela sheet_transactions no Supabase.
 * Tenta primeiro invocar a Edge Function sync-google-sheet.
 * Caso falhe ou esteja offline, executa a sincronização direta em JavaScript no navegador.
 */
export async function syncSheetToSupabase(sheetUrl, options = {}) {
  const defaultUrl = 'https://docs.google.com/spreadsheets/d/1uXB-p9iWev-ID7HVZVUj42FBu2J4PkWMo1cocTW2GXI/edit';
  const urlToUse = sheetUrl || defaultUrl;
  const sheetId = extractSheetId(urlToUse);
  if (!sheetId) return { success: false, rowCount: 0, error: 'URL inválida: não foi possível extrair o Sheet ID' };

  const connectionId = options.connectionId || options.id;

  // 1. Tentar Edge Function sync-google-sheet do Supabase primeiro
  if (connectionId) {
    try {
      const { data, error } = await supabase.functions.invoke('sync-google-sheet', {
        body: { connection_id: connectionId }
      });
      if (!error && data?.success) {
        console.log('[GoogleSheetsSync] Sincronização via Edge Function executada com sucesso:', data);
        return {
          success: true,
          rowCount: data.rowsProcessed || data.rowsInserted || 0,
          error: null,
          isEdgeFunction: true,
        };
      }
    } catch (edgeErr) {
      console.warn('[GoogleSheetsSync] Edge Function inacessível ou falhou, executando fallback JS:', edgeErr.message);
    }
  }

  // 2. Fallback: Sincronização direta via gviz/tq
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

    // Espelhamento perfeito: deletar registros de planilha que foram removidos do Google Sheets
    const activeComandas = sheetRows.map(r => r.comanda).filter(Boolean);
    if (activeComandas.length > 0) {
      await supabase
        .from('sheet_transactions')
        .delete()
        .eq('origin', 'planilha')
        .not('comanda', 'in', `(${activeComandas.map(c => `"${c}"`).join(',')})`)
        .catch(err => console.warn('[GoogleSheetsSync] Aviso na remoção de itens apagados:', err.message));
    }

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
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
      syncSheetToSupabase(sheetUrl).then(onSync).catch(console.error);
    }
  }, (intervalSeconds || 120) * 1000);
  return () => clearInterval(timer);
}
