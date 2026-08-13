/**
 * googleSheetsSync.js
 *
 * Sincronização da planilha Google Sheets com a tabela sheet_transactions.
 *
 * ARQUITETURA SEGURA (a planilha pode ser PRIVADA):
 *   Planilha (privada) → Web App Google Apps Script (lê com a identidade do dono)
 *                      → Supabase (service_role)
 *   Frontend (logado)  → Edge Function "sync-google-sheet" (ponte autenticada)
 *                      → Web App → Supabase
 *
 * O navegador NUNCA lê a planilha diretamente (sem gviz/tq público).
 * A URL da planilha e qualquer token ficam fora do bundle:
 *   - URL do Web App + token → secrets da Edge Function
 *   - service_role           → propriedades do Apps Script
 * Os dados chegam ao frontend via Supabase (select + realtime).
 */

import { supabase } from '../lib/supabase';

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
 * Sincroniza a planilha com a tabela sheet_transactions no Supabase.
 *
 * Não lê a planilha no navegador: invoca a Edge Function "sync-google-sheet",
 * que valida a sessão do usuário e dispara o Web App do Apps Script
 * (o único componente com permissão de leitura na planilha privada).
 *
 * @returns {{ success: boolean, rowCount: number, error: string|null }}
 */
export async function syncSheetToSupabase(sheetUrl, options = {}) {
  // Validação leve da URL (a leitura real acontece server-side)
  if (sheetUrl && !extractSheetId(sheetUrl)) {
    return { success: false, rowCount: 0, error: 'URL inválida: não foi possível extrair o Sheet ID' };
  }

  try {
    const { data, error } = await supabase.functions.invoke('sync-google-sheet', {
      body: { connection_id: options.connectionId || options.id || null },
    });

    if (error) {
      return { success: false, rowCount: 0, error: error.message || 'Falha ao invocar sincronização segura' };
    }

    if (data?.success) {
      return {
        success: true,
        rowCount: data.rowsProcessed || 0,
        elapsed: data.elapsed || null,
        error: null,
      };
    }

    return { success: false, rowCount: 0, error: data?.error || 'Sincronização falhou' };
  } catch (e) {
    return { success: false, rowCount: 0, error: e?.message || 'Erro de rede ao sincronizar' };
  }
}
