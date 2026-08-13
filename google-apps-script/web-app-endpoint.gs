/**
 * ===========================================================================
 *  GOOGLE APPS SCRIPT — Web App Endpoint (sync-financial)
 *  Recebe requisições HTTP e sincroniza a planilha com o Supabase.
 * ===========================================================================
 *
 *  ARQUITETURA:
 *  ─────────────
 *  Planilha (onEdit) → sync-financial-push.gs → GET neste Web App → Supabase
 *
 *  O trigger onEdit na planilha chama o .gs que faz GET neste Web App.
 *  Este endpoint lê a planilha, parseia e escreve no Supabase.
 *  O frontend recebe via Realtime automaticamente.
 *
 * ===========================================================================
 *
 *  INSTALAÇÃO:
 *  ────────────
 *  1. No editor Apps Script da planilha, crie um NOVO arquivo .gs
 *     (ou cole este código junto com sync-financial-push.gs)
 *
 *  2. Configure as Propriedades do Script (⚙ → Propriedades do script):
 *
 *     SUPABASE_URL         → https://ecwizjyflxcickbfzhcp.supabase.co
 *                             (este é o valor padrão, pode omitir)
 *     SUPABASE_SERVICE_KEY → Chave service_role (Settings → API no painel Supabase)
 *                             ⚠ NUNCA compartilhe esta chave publicamente
 *     SHEET_USER_ID        → UUID do usuário (auth.users.id) dono dos registros
 *     SHEET_ID             → ID da planilha (trecho da URL: /d/<ID>/edit)
 *                             Sem valor padrão no código — configure sempre.
 *     ALLOWED_TOKEN        → Crie uma string aleatória forte (ex: 32 chars hex)
 *                             Este token será usado na URL de chamada.
 *                             Gere com: Utilities.getUuid() + Utilities.getUuid()
 *
 *  3. Faça deploy como Web App:
 *     - Botão "Implantar" → "Novo deploy"
 *     - Tipo: "App da Web"
 *     - Executar como: "Eu" (seu e-mail)
 *     - Quem tem acesso: "Qualquer pessoa" (a segurança está no token)
 *     - Clique em "Implantar"
 *     - COPIE a URL gerada (algo como https://script.google.com/macros/s/XXXXX/exec)
 *
 *  4. Cole essa URL na propriedade do script WEB_APP_URL do arquivo
 *     sync-financial-push.gs para que o trigger onEdit chame este endpoint.
 *
 *  5. Teste manualmente: execute testManual() no editor Apps Script.
 *
 * ===========================================================================
 */

// ─── Web App Handler ───────────────────────────────────────────────────────

/**
 * doGet — Endpoint HTTP GET chamado pelo trigger onEdit.
 *
 * URL: WEB_APP_URL?token=TOKEN&sheetId=SHEET_ID&gid=GID
 *
 * @param {Object} e - Objeto de evento do Apps Script com e.parameter
 * @returns {ContentService.TextOutput} JSON response
 */
function doGet(e) {
  var startTime = new Date();
  var params = (e && e.parameter) || {};

  // ── 1. Autenticação por token ──
  var token = params.token || '';
  var expectedToken = PropertiesService.getScriptProperties().getProperty('ALLOWED_TOKEN');

  if (!expectedToken) {
    return jsonResponse({
      success: false,
      error: 'ALLOWED_TOKEN não configurado nas propriedades do script.'
    }, 500);
  }

  if (token !== expectedToken) {
    Logger.log('[doGet] Token inválido recebido: %s', token.substring(0, 8) + '...');
    return jsonResponse({
      success: false,
      error: 'Token de autenticação inválido.'
    }, 401);
  }

  // ── 2. Parâmetros ──
  // Sem ID hardcoded: vem da URL de chamada ou da propriedade SHEET_ID
  var sheetId = params.sheetId || PropertiesService.getScriptProperties().getProperty('SHEET_ID') || '';
  var gid = params.gid || '0';

  if (!sheetId) {
    return jsonResponse({
      success: false,
      error: 'SHEET_ID não configurado (propriedade do script ou parâmetro da URL).'
    }, 500);
  }

  // ── 3. Lock para edições concorrentes ──
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000); // aguarda até 15s se outro sync estiver rodando
  } catch (lockErr) {
    Logger.log('[doGet] Não foi possível obter o lock: %s', lockErr.message);
    return jsonResponse({
      success: false,
      error: 'Outra sincronização está em andamento. Tente novamente.',
      locked: true
    }, 429);
  }

  try {
    // ── 4. Ler planilha ──
    Logger.log('[doGet] Lendo planilha %s (gid=%s)...', sheetId, gid);
    var sheet = SpreadsheetApp.openById(sheetId);
    var sheets = sheet.getSheets();
    var targetSheet = sheets[0]; // primeira aba

    // Se gid foi especificado, tentar encontrar a aba correspondente
    if (gid !== '0') {
      for (var i = 0; i < sheets.length; i++) {
        if (String(sheets[i].getSheetId()) === gid) {
          targetSheet = sheets[i];
          break;
        }
      }
    }

    var allValues = targetSheet.getDataRange().getValues();

    if (!allValues || allValues.length < 2) {
      return jsonResponse({
        success: true,
        rowsProcessed: 0,
        message: 'Planilha vazia.'
      });
    }

    // ── 5. Parsear dados ──
    var parsed = parseSheetData(allValues);
    Logger.log('[doGet] %d registros parseados.', parsed.length);

    if (parsed.length === 0) {
      return jsonResponse({
        success: true,
        rowsProcessed: 0,
        message: 'Nenhum registro válido encontrado.'
      });
    }

    // ── 6. Upsert no Supabase ──
    var upserted = upsertToSupabase(parsed);

    var elapsed = ((new Date() - startTime) / 1000).toFixed(1);
    Logger.log('[doGet] Sync concluído: %d registros em %ss.', upserted, elapsed);

    return jsonResponse({
      success: true,
      rowsProcessed: upserted,
      elapsed: elapsed + 's',
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    Logger.log('[doGet] ERRO: %s', err.message);
    return jsonResponse({
      success: false,
      error: err.message
    }, 500);
  } finally {
    lock.releaseLock();
  }
}

// ─── Teste Manual ──────────────────────────────────────────────────────────

/**
 * testManual — Execute pelo menu "Executar" no editor Apps Script.
 * Simula uma chamada ao endpoint com os parâmetros corretos.
 */
function testManual() {
  var token = PropertiesService.getScriptProperties().getProperty('ALLOWED_TOKEN') || 'TESTE_TOKEN';
  var sheetId = PropertiesService.getScriptProperties().getProperty('SHEET_ID') || '';
  Logger.log('=== TESTE MANUAL DO WEB APP ===');
  Logger.log('Token usado: %s', token);

  var fakeEvent = {
    parameter: {
      token: token,
      sheetId: sheetId,
      gid: '0'
    }
  };

  var result = doGet(fakeEvent);
  Logger.log('Resposta: %s', result.getContent());
  Logger.log('=== FIM DO TESTE ===');
}

// ─── Parser da Planilha ────────────────────────────────────────────────────

/**
 * Converte valores brutos da planilha em objetos sheet_transactions.
 * Espelha a lógica de parseSheetRows() em src/services/googleSheetsSync.js.
 */
function parseSheetData(rows) {
  if (!rows || rows.length === 0) return [];

  // 1. Encontrar cabeçalho
  var headerRowIdx = -1;
  var colMap = {
    cliente: 0, credito: 1, debito: 2, dinheiro: 3,
    pix: 4, gross: 5, procedimento: 6, profissional: 7, comanda: 8
  };

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

  // 2. Data de referência do título
  var dateRef = formatDateISO(new Date());
  if (rows[0] && rows[0][0]) {
    var title = String(rows[0][0]);
    var dateMatch = title.match(/(\d{1,2}\/\d{1,2}\/\d{4})/);
    if (dateMatch) dateRef = formatDateBR(dateMatch[1]);
  }

  var sheetRows = [];

  // 3. Processar linhas
  for (var r = headerRowIdx + 1; r < rows.length; r++) {
    var row = rows[r];
    if (!row || !row.some(function(v) { return v !== null && v !== '' && v !== undefined; })) continue;

    var col0 = String(row[0] || '').trim().toUpperCase();
    if (col0.indexOf('TOTAL') >= 0) continue;

    // ── Despesas por categoria fixa ──
    var isPassagem = col0.indexOf('PASSAGEM') >= 0;
    var isProdutos = col0.indexOf('PRODUTOS') >= 0;
    var isTributos = col0.indexOf('TRIBUTOS') >= 0;
    var isOutrasSaidas = col0.indexOf('OUTRAS SAÍDAS') >= 0 || col0.indexOf('OUTRAS SAIDAS') >= 0;
    var isSangria = col0.indexOf('SANGRIA') >= 0;

    if (isPassagem || isProdutos || isTributos || isOutrasSaidas || isSangria) {
      var valor = parseNum(row[1]);
      var rowType = isSangria ? 'sangria' : 'despesa';
      var catName = isPassagem ? 'Passagem' : isProdutos ? 'Produtos' : isTributos ? 'Tributos' : isOutrasSaidas ? 'Outras Saídas' : 'Sangria';
      var descName = isPassagem ? 'PASSAGEM' : isProdutos ? 'PRODUTOS' : isTributos ? 'TRIBUTOS' : isOutrasSaidas ? 'OUTRAS SAÍDAS' : 'SANGRIA';
      var comandaKey = 'despesa_' + descName.toLowerCase().replace(/[^a-z0-9]/g, '_');

      sheetRows.push(buildTx(comandaKey, dateRef, descName, catName, '—', valor, 'Planilha', 0, 0, 0, 0, rowType));
      continue;
    }

    // ── Receitas ──
    var clienteVal = row[colMap.cliente] != null ? row[colMap.cliente] : row[0];
    var procVal = row[colMap.procedimento] != null ? row[colMap.procedimento] : (row[6] || '');
    var profVal = row[colMap.profissional] != null ? row[colMap.profissional] : (row[7] || '');
    var comandaVal = row[colMap.comanda] != null ? row[colMap.comanda] : (row[8] || '');

    var credito = parseNum(row[colMap.credito] != null ? row[colMap.credito] : row[1]);
    var debito = parseNum(row[colMap.debito] != null ? row[colMap.debito] : row[2]);
    var dinheiro = parseNum(row[colMap.dinheiro] != null ? row[colMap.dinheiro] : row[3]);
    var pix = parseNum(row[colMap.pix] != null ? row[colMap.pix] : row[4]);

    var grossCalc = credito + debito + dinheiro + pix;
    var grossRaw = parseNum(row[colMap.gross] != null ? row[colMap.gross] : row[5]);
    var gross = grossCalc > 0 ? grossCalc : grossRaw;

    if (gross <= 0 || !clienteVal || String(clienteVal).trim() === '--') continue;

    var payMethod = 'Pix';
    if (pix > 0) payMethod = 'Pix';
    else if (credito > 0) payMethod = 'Crédito';
    else if (debito > 0) payMethod = 'Débito';
    else if (dinheiro > 0) payMethod = 'Dinheiro';

    var comandaStr = comandaVal ? String(comandaVal).trim() : ('rec_' + r);

    sheetRows.push(buildTx(comandaStr, dateRef, String(clienteVal).trim(),
      procVal ? String(procVal).trim() : '—',
      profVal ? String(profVal).trim() : '—',
      gross, payMethod, pix, credito, debito, dinheiro, 'receita'));
  }

  return sheetRows;
}

// ─── Supabase Upsert ───────────────────────────────────────────────────────

/**
 * upsertToSupabase — Upsert atômico usando ON CONFLICT.
 *
 * Requer o unique index parcial:
 *   CREATE UNIQUE INDEX idx_sheet_tx_unique_comanda_user
 *     ON sheet_transactions (comanda, user_id)
 *     WHERE comanda IS NOT NULL AND deleted_at IS NULL;
 *
 * Veja: google-apps-script/migration_unique_comanda.sql
 *
 * Estratégia:
 *   1. POST batch com Prefer: resolution=merge-duplicates (upsert nativo)
 *   2. DELETE registros que não estão mais na planilha
 */
function upsertToSupabase(transactions) {
  var props = PropertiesService.getScriptProperties();
  // Supabase URL conhecida do projeto (pode ser sobrescrita via propriedade)
  var baseUrl = (props.getProperty('SUPABASE_URL') || 'https://ecwizjyflxcickbfzhcp.supabase.co').replace(/\/+$/, '');
  var serviceKey = props.getProperty('SUPABASE_SERVICE_KEY');
  var userId = props.getProperty('SHEET_USER_ID');

  if (!serviceKey) {
    throw new Error('SUPABASE_SERVICE_KEY não configurado nas propriedades do script.');
  }
  if (!userId) {
    throw new Error('SHEET_USER_ID não configurado nas propriedades do script.');
  }

  var restUrl = baseUrl + '/rest/v1/sheet_transactions';
  var upsertHeaders = {
    'apikey': serviceKey,
    'Authorization': 'Bearer ' + serviceKey,
    'Content-Type': 'application/json',
    'Prefer': 'resolution=merge-duplicates, return=minimal'
  };

  // ── Passo 1: Upsert em lote (INSERT ... ON CONFLICT DO UPDATE) ──
  // O unique index parcial garante que (comanda, user_id) com deleted_at IS NULL
  // seja único, e o PostgREST usa isso para resolução de conflitos.
  var payload = transactions.map(function(tx) {
    tx.user_id = userId;
    tx.origin = 'planilha';
    tx.is_metadata = false;
    tx.deleted_at = null;
    tx.updated_at = new Date().toISOString();
    return tx;
  });

  Logger.log('[upsert] Enviando %d registros (batch upsert)...', payload.length);

  var upsertResp = UrlFetchApp.fetch(restUrl, {
    method: 'POST',
    headers: upsertHeaders,
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  var upsertCode = upsertResp.getResponseCode();
  var upserted = payload.length;

  if (upsertCode >= 200 && upsertCode < 300) {
    Logger.log('[upsert] Batch upsert OK! %d registros.', upserted);
  } else {
    Logger.log('[upsert] Batch upsert falhou (HTTP %d): %s', upsertCode, upsertResp.getContentText());
    // Fallback: tentar um por um
    upserted = upsertFallbackOneByOne(transactions, restUrl, upsertHeaders, userId);
  }

  // ── Passo 2: Deletar registros que não estão mais na planilha ──
  var activeComandas = transactions.map(function(t) { return t.comanda; }).filter(Boolean);

  if (activeComandas.length > 0) {
    // Buscar comandas existentes no Supabase
    try {
      var selectUrl = restUrl
        + '?user_id=eq.' + encodeURIComponent(userId)
        + '&origin=eq.planilha'
        + '&deleted_at=is.null'
        + '&select=comanda';

      var selectResp = UrlFetchApp.fetch(selectUrl, {
        method: 'GET',
        headers: {
          'apikey': serviceKey,
          'Authorization': 'Bearer ' + serviceKey,
        },
        muteHttpExceptions: true
      });

      if (selectResp.getResponseCode() >= 200 && selectResp.getResponseCode() < 300) {
        var existingRows = JSON.parse(selectResp.getContentText());
        var toDelete = [];

        existingRows.forEach(function(r) {
          if (r.comanda && activeComandas.indexOf(r.comanda) < 0) {
            toDelete.push(r.comanda);
          }
        });

        if (toDelete.length > 0) {
          Logger.log('[upsert] Removendo %d registros fora da planilha.', toDelete.length);
          var deleteHeaders = {
            'apikey': serviceKey,
            'Authorization': 'Bearer ' + serviceKey,
            'Content-Type': 'application/json'
          };
          // Deletar em batch usando filtro IN
          var comandaFilter = toDelete.map(function(c) {
            return encodeURIComponent(c);
          }).join(',');

          UrlFetchApp.fetch(
            restUrl + '?user_id=eq.' + encodeURIComponent(userId)
            + '&comanda=in.(' + comandaFilter + ')'
            + '&deleted_at=is.null',
            {
              method: 'DELETE',
              headers: deleteHeaders,
              muteHttpExceptions: true
            }
          );
        }
      }
    } catch (delErr) {
      Logger.log('[upsert] Aviso na limpeza: %s', delErr.message);
    }
  }

  return upserted;
}

/**
 * Fallback: upsert um por um (usado quando o batch falha).
 */
function upsertFallbackOneByOne(transactions, restUrl, headers, userId) {
  var count = 0;
  for (var i = 0; i < transactions.length; i++) {
    var tx = transactions[i];
    tx.user_id = userId;
    tx.origin = 'planilha';
    tx.is_metadata = false;
    tx.deleted_at = null;
    tx.updated_at = new Date().toISOString();

    try {
      var resp = UrlFetchApp.fetch(restUrl, {
        method: 'POST',
        headers: headers,
        payload: JSON.stringify(tx),
        muteHttpExceptions: true
      });
      if (resp.getResponseCode() >= 200 && resp.getResponseCode() < 300) {
        count++;
      } else {
        Logger.log('[fallback] Erro comanda=%s HTTP %d: %s', tx.comanda, resp.getResponseCode(), resp.getContentText());
      }
    } catch (err) {
      Logger.log('[fallback] Erro de rede comanda=%s: %s', tx.comanda, err.message);
    }
  }
  Logger.log('[fallback] %d de %d registros sincronizados.', count, transactions.length);
  return count;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function jsonResponse(obj, statusCode) {
  var output = ContentService.createTextOutput(JSON.stringify(obj));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}

function buildTx(comanda, dateRef, client, procedure, professional, gross, payMethod, pix, credito, debito, dinheiro, rowType) {
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

function parseNum(v) {
  if (v === null || v === undefined || v === '') return 0;
  var s = String(v).replace(/[R$\s.]/g, '').replace(',', '.');
  var n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

function formatDateISO(d) {
  var y = d.getFullYear();
  var m = ('0' + (d.getMonth() + 1)).slice(-2);
  var day = ('0' + d.getDate()).slice(-2);
  return y + '-' + m + '-' + day;
}

function formatDateBR(brStr) {
  var parts = brStr.split('/');
  if (parts.length !== 3) return formatDateISO(new Date());
  return parts[2] + '-' + ('0' + parts[1]).slice(-2) + '-' + ('0' + parts[0]).slice(-2);
}
