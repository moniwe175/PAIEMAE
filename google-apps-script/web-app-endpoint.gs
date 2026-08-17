/**
 * ===========================================================================
 *  SISTEMA DE SINCRONIZAÇÃO INSTANTÂNEA — CLÍNICA EVELYN
 * ===========================================================================
 *  Planilha: https://docs.google.com/spreadsheets/d/1uXB-p9iWev-ID7HVZVUj42FBu2J4PkWMo1cocTW2GXI/edit
 *
 *  ─── CORREÇÕES APLICADAS ──────────────────────────────────────────────────
 *  [CORREÇÃO 1] onEdit → dispararSyncEdicao
 *    O gatilho simples onEdit() NÃO tem permissão para usar UrlFetchApp.fetch()
 *    (requisição HTTP para o Supabase). A função foi renomeada para
 *    dispararSyncEdicao() e DEVE ser registrada como um Gatilho Instalável
 *    "Ao editar" (⏰ Acionadores → + Adicionar acionador → dispararSyncEdicao
 *    → Com base na planilha → Ao editar). Isso garante sincronização
 *    INSTANTÂNEA em menos de 1 segundo após qualquer digitação.
 *
 *  [CORREÇÃO 2] parseNum() corrigida
 *    O Google Sheets pode entregar o valor de uma célula numérica já como
 *    number nativo (ex: 1234.56). O replace anterior removia o ponto decimal
 *    e transformava 1234.56 em 123456. Agora a função detecta o tipo e
 *    retorna o número diretamente sem processar texto.
 *
 *  [CORREÇÃO 3] Limpeza da virada preserva o layout fixo
 *    A virada limpa SOMENTE a tabela de atendimentos (A4:I67) e depois
 *    restaura as fórmulas da linha 68 e os rótulos de despesas (70–75)
 *    via restaurarFormulasETabela(), preservando totais e formatação.
 *
 *  [CORREÇÃO 4] Chaves de sincronização com prefixo de data
 *    As chaves de comanda/despesa agora começam com a data (date_ref).
 *    Sem isso, como a planilha é limpa toda noite e as comandas recomeçam
 *    do 1, o dia seguinte sobrescrevia os registros do dia anterior no
 *    Supabase (merge-duplicates no índice único comanda+user_id) e o
 *    histórico mensal nunca acumulava.
 *
 *  [CORREÇÃO 5] Virada SEM pular domingo/segunda
 *    Política atual: caixa 100% automático, todos os dias. O cabeçalho A1
 *    sempre avança para o dia seguinte (antes pulava para terça).
 */

// ─── CONFIGURAÇÕES PADRÃO ──────────────────────────────────────────────────
var SPREADSHEET_ID = '1uXB-p9iWev-ID7HVZVUj42FBu2J4PkWMo1cocTW2GXI';
var SUPABASE_URL = 'https://ecwizjyflxcickbfzhcp.supabase.co';

/**
 * 1. GATILHO DE EDIÇÃO — DEVE SER INSTALÁVEL (não o simples onEdit)
 *
 * ⚠️  AÇÃO NECESSÁRIA UMA ÚNICA VEZ:
 *    Acesse ⏰ Acionadores → + Adicionar acionador:
 *      Função a executar : dispararSyncEdicao
 *      Fonte do evento   : Com base na planilha (não "Com base no tempo")
 *      Tipo de evento    : Ao editar
 *    Salve e autorize. Isso fará a sincronização rodar em < 1 segundo
 *    após cada digitação, sem precisar de F5.
 *
 * IMPORTANTE: NÃO renomeie esta função de volta para onEdit.
 * O gatilho simples onEdit não consegue acessar o Supabase por restrição
 * de segurança do Google (sem permissão para UrlFetchApp.fetch).
 */
function dispararSyncEdicao(e) {
  try {
    var ss = e && e.source ? e.source : SpreadsheetApp.getActiveSpreadsheet();
    var sheetId = ss.getId();

    if (sheetId !== SPREADSHEET_ID) return;

    Logger.log('[dispararSyncEdicao] Edição detectada! Disparando sincronização...');
    sincronizarComSupabase();
  } catch (err) {
    Logger.log('[dispararSyncEdicao] Erro: %s', err.message);
  }
}

/**
 * 2. FUNÇÃO PRINCIPAL DE SINCRONIZAÇÃO
 * Lê a planilha e envia os dados diretamente para a base de dados do sistema.
 */
function sincronizarComSupabase() {
  var props = PropertiesService.getScriptProperties();
  var serviceKey = props.getProperty('SUPABASE_SERVICE_KEY');
  var userId = props.getProperty('SHEET_USER_ID');

  if (!serviceKey || !userId) {
    Logger.log('ERRO: Configure SUPABASE_SERVICE_KEY e SHEET_USER_ID nas Propriedades do Script.');
    return;
  }

  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheets()[0]; // Lê a primeira aba
  var rows = sheet.getDataRange().getValues();

  if (!rows || rows.length < 2) {
    Logger.log('Planilha vazia.');
    return;
  }

  var parsedRows = parseSheetData(rows);
  if (parsedRows.length === 0) {
    Logger.log('Nenhum registro válido encontrado.');
    return;
  }

  // Envia os dados convertidos ao Supabase
  enviarParaSupabase(parsedRows, serviceKey, userId);
}

/**
 * 3. PARSER DA PLANILHA
 */
function parseSheetData(rows) {
  var headerRowIdx = -1;
  var colMap = { cliente: 0, credito: 1, debito: 2, dinheiro: 3, pix: 4, gross: 5, procedimento: 6, profissional: 7, comanda: 8 };

  // Identifica o cabeçalho
  for (var i = 0; i < rows.length; i++) {
    var cells = rows[i].map(function(c) { return String(c || '').toUpperCase().trim(); });
    if (cells.indexOf('CLIENTE') >= 0 || cells.indexOf('PROCEDIMENTO') >= 0 || cells.indexOf('PROFISSIONAL') >= 0) {
      headerRowIdx = i;
      cells.forEach(function(txt, ci) {
        if (/CLIENTE|PACIENTE|NOME/.test(txt)) colMap.cliente = ci;
        if (/CREDITO|CRÉDITO/.test(txt)) colMap.credito = ci;
        if (/DEBITO|DÉBITO/.test(txt)) colMap.debito = ci;
        if (/DINHEIRO/.test(txt)) colMap.dinheiro = ci;
        if (/PIX/.test(txt)) colMap.pix = ci;
        if (/PROCEDIMENTO/.test(txt)) colMap.procedimento = ci;
        if (/PROFISSIONAL/.test(txt)) colMap.profissional = ci;
        if (/COMANDA|ID|TICKET|CODIGO/.test(txt)) colMap.comanda = ci;
      });
    }
  }

  // Identifica a data
  var dateRef = new Date().toISOString().split('T')[0];
  if (rows[0] && rows[0][0]) {
    var dateMatch = String(rows[0][0]).match(/(\d{1,2}\/\d{1,2}\/\d{4})/);
    if (dateMatch) {
      var parts = dateMatch[1].split('/');
      dateRef = parts[2] + '-' + ('0' + parts[1]).slice(-2) + '-' + ('0' + parts[0]).slice(-2);
    }
  }

  var list = [];

  for (var r = headerRowIdx + 1; r < rows.length; r++) {
    var row = rows[r];
    if (!row || !row.some(function(v) { return v !== null && v !== '' && v !== undefined; })) continue;

    var col0 = String(row[0] || '').trim().toUpperCase();
    if (col0.indexOf('TOTAL') >= 0) continue;

    // Categorias fixas de despesa
    var isPassagem = col0.indexOf('PASSAGEM') >= 0;
    var isProdutos = col0.indexOf('PRODUTOS') >= 0;
    var isTributos = col0.indexOf('TRIBUTOS') >= 0;
    var isOutrasSaidas = col0.indexOf('OUTRAS SAÍDAS') >= 0 || col0.indexOf('OUTRAS SAIDAS') >= 0;
    var isSangria = col0.indexOf('SANGRIA') >= 0;

    if (isPassagem || isProdutos || isTributos || isOutrasSaidas || isSangria) {
      var valor = parseNum(row[1]);
      var rowType = isSangria ? 'sangria' : 'despesa';
      var catName = isPassagem ? 'Passagem' : isProdutos ? 'Produtos' : isTributos ? 'Tributos' : isOutrasSaidas ? 'Outras Saídas' : 'Sangria';
      var descName = catName.toUpperCase();
      var key = dateRef + '_despesa_' + catName.toLowerCase().replace(/[^a-z0-9]/g, '_');

      list.push(criarObjetoTx(key, dateRef, descName, catName, '—', valor, 'Planilha', 0, 0, 0, 0, rowType));
      continue;
    }

    // Receitas de atendimentos
    var clienteVal = row[colMap.cliente] != null ? row[colMap.cliente] : row[0];
    var procVal = row[colMap.procedimento] != null ? row[colMap.procedimento] : (row[6] || '');
    var profVal = row[colMap.profissional] != null ? row[colMap.profissional] : (row[7] || '');
    var comandaVal = row[colMap.comanda] != null ? row[colMap.comanda] : (row[8] || '');

    var credito = parseNum(row[colMap.credito] != null ? row[colMap.credito] : row[1]);
    var debito = parseNum(row[colMap.debito] != null ? row[colMap.debito] : row[2]);
    var dinheiro = parseNum(row[colMap.dinheiro] != null ? row[colMap.dinheiro] : row[3]);
    var pix = parseNum(row[colMap.pix] != null ? row[colMap.pix] : row[4]);

    var gross = (credito + debito + dinheiro + pix) || parseNum(row[colMap.gross] != null ? row[colMap.gross] : row[5]);

    if (gross <= 0 || !clienteVal || String(clienteVal).trim() === '--') continue;

    var payMethod = pix > 0 ? 'Pix' : credito > 0 ? 'Crédito' : debito > 0 ? 'Débito' : 'Dinheiro';
    var comandaStr = dateRef + '_' + (comandaVal ? String(comandaVal).trim() : ('rec_' + r));

    list.push(criarObjetoTx(comandaStr, dateRef, String(clienteVal).trim(), String(procVal).trim() || '—', String(profVal).trim() || '—', gross, payMethod, pix, credito, debito, dinheiro, 'receita'));
  }

  return list;
}

/**
 * 4. ENVIO DE DADOS VIA REST API DO SUPABASE
 */
function enviarParaSupabase(transactions, serviceKey, userId) {
  var restUrl = SUPABASE_URL + '/rest/v1/sheet_transactions';
  
  var payload = transactions.map(function(tx) {
    tx.user_id = userId;
    tx.origin = 'planilha';
    tx.is_metadata = false;
    tx.deleted_at = null;
    tx.updated_at = new Date().toISOString();
    return tx;
  });

  var headers = {
    'apikey': serviceKey,
    'Authorization': 'Bearer ' + serviceKey,
    'Content-Type': 'application/json',
    'Prefer': 'resolution=merge-duplicates, return=minimal'
  };

  try {
    var response = UrlFetchApp.fetch(restUrl, {
      method: 'POST',
      headers: headers,
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });

    if (response.getResponseCode() >= 200 && response.getResponseCode() < 300) {
      Logger.log('Sincronização bem-sucedida! %d registros atualizados.', payload.length);
    } else {
      Logger.log('Erro ao sincronizar (HTTP %d): %s', response.getResponseCode(), response.getContentText());
    }
  } catch (e) {
    Logger.log('Erro de rede: %s', e.message);
  }
}

// ─── HELPERS ───────────────────────────────────────────────────────────────

/**
 * [CORREÇÃO 2] parseNum — trata número nativo do Sheets sem remover ponto decimal.
 * Antes: String(1234.56).replace(/[R$\s.]/g, '') → "123456" (errado!)
 * Agora: typeof v === 'number' → retorna direto sem processar texto.
 */
function parseNum(v) {
  if (v === null || v === undefined || v === '') return 0;
  // Se o Sheets já entregou um número puro, usa direto — sem remover ponto!
  if (typeof v === 'number') return isNaN(v) ? 0 : v;
  // Apenas para strings no formato brasileiro: "R$ 1.234,56" → 1234.56
  var s = String(v).replace(/[R$\s]/g, '').replace(/\.(?=\d{3}[,])/g, '').replace(',', '.');
  var n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

function criarObjetoTx(comanda, dateRef, client, procedure, professional, gross, payMethod, pix, credito, debito, dinheiro, rowType) {
  return {
    comanda: comanda,
    date_ref: dateRef,
    client: client,
    procedure: procedure,
    professional: professional,
    gross: gross,
    payment_method: payMethod,
    pix: pix || 0,
    credito: credito || 0,
    debito: debito || 0,
    dinheiro: dinheiro || 0,
    repasse: 0,
    commission_value: null,
    row_type: rowType,
    tipo: rowType
  };
}

/**
 * 5. ROTINA DE VIRADA DE DIA E LIMPEZA AUTOMÁTICA DA PLANILHA
 * Executada automaticamente no final da noite (ex: 23:50) via Gatilho por Tempo
 * (Time-driven trigger) ou pelo Web App (?action=virarDia).
 *  1. Garante a sincronização final dos dados do dia com o Supabase.
 *  2. Pega o Fundo Final do dia (F1) e transfere como Fundo Inicial no C1.
 *  3. Limpa SOMENTE a tabela de atendimentos (linhas 4 a 67) — nunca apaga
 *     da linha 68 em diante (fórmulas, totais e despesas fixas).
 *  4. Restaura fórmulas da linha 68 e rótulos de despesas (70–75).
 *  5. Atualiza o cabeçalho A1 com a data do dia seguinte (sem pular dias).
 */
function virarDiaELimparPlanilha() {
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheets()[0];

    Logger.log('[virarDiaELimparPlanilha] 1. Garantindo sincronização final do dia...');
    sincronizarComSupabase();

    // Força o recálculo de todas as fórmulas (incluindo F1) antes de ler o valor
    SpreadsheetApp.flush();

    // Pega o saldo final atual da célula F1
    var fundoFinal = sheet.getRange('F1').getValue();
    Logger.log('[virarDiaELimparPlanilha] 2. Fundo Final capturado: %s', fundoFinal);

    // 1. Limpa ESTRITAMENTE a tabela de lançamentos de atendimentos (linhas 4 a 67)
    // NUNCA apaga da linha 68 em diante para preservar fórmulas, totais e formatação das despesas
    sheet.getRange('A4:I67').clearContent();

    // 2. Garante que as fórmulas de soma da linha 68 e os rótulos de despesas estejam 100% ativos
    restaurarFormulasETabela(sheet);

    // 3. Atualiza o Fundo Inicial (C1) com o Fundo Final herdado
    if (fundoFinal !== null && fundoFinal !== '' && !isNaN(parseNum(fundoFinal))) {
      sheet.getRange('C1').setValue(fundoFinal);
    }

    // 4. Atualiza a data do cabeçalho A1 para o dia seguinte
    // Política atual: caixa opera TODOS os dias — sem pular domingo/segunda
    var targetDate = new Date();
    if (targetDate.getHours() >= 22) {
      targetDate.setDate(targetDate.getDate() + 1);
    }

    var dataFormatada = Utilities.formatDate(targetDate, "GMT-03:00", "dd/MM/yyyy");
    sheet.getRange('A1').setValue("CAIXA - DIA " + dataFormatada + " :");

    Logger.log('[virarDiaELimparPlanilha] Virada de dia concluída preservando a linha 68 em diante!');
    return true;
  } catch (err) {
    Logger.log('[virarDiaELimparPlanilha] Erro durante a virada do dia: %s', err.message);
    return false;
  }
}

/**
 * Restaura as fórmulas de soma da linha 68 (Totais de B4:B67 a F4:F67)
 * e garante que os rótulos de despesas fixas (linhas 70 a 75) estejam sempre visíveis.
 */
function restaurarFormulasETabela(targetSheet) {
  try {
    var ss = targetSheet ? null : SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = targetSheet || ss.getSheets()[0];

    // Restaura as fórmulas de soma na linha 68 (Totais dos Atendimentos)
    sheet.getRange('B68').setFormula('=SUM(B4:B67)');
    sheet.getRange('C68').setFormula('=SUM(C4:C67)');
    sheet.getRange('D68').setFormula('=SUM(D4:D67)');
    sheet.getRange('E68').setFormula('=SUM(E4:E67)');
    sheet.getRange('F68').setFormula('=SUM(F4:F67)');

    // Restaura os rótulos de despesas e sangria de acordo com o layout oficial (linhas 70 a 75)
    sheet.getRange('A70').setValue('PASSAGEM');
    sheet.getRange('A71').setValue('PRODUTOS');
    sheet.getRange('A72').setValue('TRIBUTOS');
    sheet.getRange('A73').setValue('OUTRAS SAÍDAS');
    sheet.getRange('A74').setValue('SANGRIA');
    sheet.getRange('A75').setValue('TOTAL DE DESPESAS');

    Logger.log('[restaurarFormulasETabela] Fórmulas de soma da linha 68 e rótulos restaurados!');
    return true;
  } catch (e) {
    Logger.log('[restaurarFormulasETabela] Erro: %s', e.message);
    return false;
  }
}

/**
 * 6. ENDPOINTS HTTP PARA EXECUÇÃO REMOTA (WEB APP)
 */
function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) ? e.parameter.action : '';
  if (action === 'virarDia' || action === 'clear') {
    var ok = virarDiaELimparPlanilha();
    return ContentService.createTextOutput(JSON.stringify({ success: ok, message: 'Virada de dia executada.' }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  if (action === 'restaurar' || action === 'fixDespesas' || action === 'fixFormulas') {
    var okRest = restaurarFormulasETabela();
    return ContentService.createTextOutput(JSON.stringify({ success: okRest, message: 'Fórmulas da linha 68 e despesas restauradas.' }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  if (action === 'sync') {
    sincronizarComSupabase();
    return ContentService.createTextOutput(JSON.stringify({ success: true, message: 'Sincronização executada.' }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  return ContentService.createTextOutput(JSON.stringify({ status: 'active', timestamp: new Date().toISOString() }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  return doGet(e);
}
