/**
 * ===========================================================================
 *  GOOGLE APPS SCRIPT — Sync Financial Push (Trigger)
 *  Dispara a sincronização ao editar a planilha, chamando o Web App.
 * ===========================================================================
 *
 *  ARQUITETURA:
 *  ─────────────
 *  Planilha (onEdit) → este script → GET web-app-endpoint.gs → Supabase
 *
 *  Este arquivo é LEVE: apenas detecta a edição e dispara uma requisição
 *  HTTP ao Web App (web-app-endpoint.gs), que faz todo o trabalho pesado
 *  (ler planilha, parsear, upsert no Supabase).
 *
 * ===========================================================================
 *
 *  INSTALAÇÃO NA PLANILHA:
 *  ───────────────────────
 *  1. Abra a planilha:
 *     https://docs.google.com/spreadsheets/d/1uXB-p9iWev-ID7HVZVUj42FBu2J4PkWMo1cocTW2GXI/edit
 *
 *  2. Menu "Extensões" → "Apps Script"
 *
 *  3. Cole AMBOS os arquivos no editor:
 *     - Este arquivo (sync-financial-push.gs)
 *     - web-app-endpoint.gs
 *
 *  4. Configure as Propriedades do Script (⚙ → Propriedades do script):
 *
 *     SUPABASE_URL         → https://ecwizjyflxcickbfzhcp.supabase.co
 *     SUPABASE_SERVICE_KEY → service_role key (Supabase → Settings → API)
 *                             ⚠ NUNCA compartilhe publicamente
 *     SHEET_USER_ID        → UUID do usuário (auth.users.id)
 *     SHEET_ID             → ID da planilha (trecho da URL: /d/<ID>/edit)
 *     ALLOWED_TOKEN        → String aleatória forte (gere com Utilities.getUuid())
 *     WEB_APP_URL          → URL do Web App após deploy (veja passo 6)
 *
 *  5. Salve o projeto (Ctrl+S). Nome: "Sync Financeiro".
 *
 *  6. Deploy do Web App (PRIMEIRA VEZ):
 *     - Botão "Implantar" → "Novo deploy"
 *     - Tipo: "App da Web"
 *     - Executar como: "Eu"
 *     - Quem tem acesso: "Qualquer pessoa"
 *     - Implante e COPIE a URL gerada
 *     - Cole a URL na propriedade WEB_APP_URL
 *
 *  7. Adicione o trigger onEdit:
 *     - Menu lateral: "Gatilhos" (⏰)
 *     - "+ Adicionar gatilho"
 *     - Função:          onEdit
 *     - Origem do evento: Da planilha
 *     - Tipo de evento:   Ao editar
 *     - Salve.
 *
 *  7b. (Recomendado) Adicione o gatilho de horário scheduledSync:
 *     - "+ Adicionar gatilho"
 *     - Função:                    scheduledSync
 *     - Origem do evento:          Fonte de eventos baseada em hora
 *     - Tipo de evento:            Timer de minutos
 *     - Intervalo:                 A cada 5 minutos
 *     - Salve. (Garante sync mesmo se algum onEdit for perdido)
 *
 *  8. Autorize as permissões na primeira execução.
 *
 *  PRONTO! A cada edição, o trigger chama o Web App que sincroniza
 *  os dados com o Supabase. O frontend recebe via Realtime.
 *
 * ===========================================================================
 */

// ─── Configuração ──────────────────────────────────────────────────────────
// Sem ID hardcoded: usa a propriedade SHEET_ID ou a planilha ativa.
function getSpreadsheetId() {
  var fromProps = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  if (fromProps) return fromProps;
  try { return SpreadsheetApp.getActiveSpreadsheet().getId(); } catch (e) { return ''; }
}
var GID = '0';

// ─── Trigger principal ─────────────────────────────────────────────────────

/**
 * onEdit — Disparado automaticamente pelo Google Sheets a cada edição.
 * Usa trigger INSTALÁVEL (não simples trigger) para ter permissão de UrlFetchApp.
 */
function onEdit(e) {
  try {
    var ss = e && e.source ? e.source : SpreadsheetApp.getActiveSpreadsheet();
    var sheetId = ss.getId();

    // Só processa edits na planilha configurada
    var configuredId = getSpreadsheetId();
    if (configuredId && sheetId !== configuredId) {
      Logger.log('[onEdit] Planilha diferente (%s), ignorando.', sheetId);
      return;
    }

    Logger.log('[onEdit] Edição detectada. Disparando sincronização...');
    triggerSync();
  } catch (err) {
    Logger.log('[onEdit] ERRO: %s', err.message);
  }
}

// ─── Disparo do Web App ────────────────────────────────────────────────────

/**
 * triggerSync — Faz GET no Web App para iniciar a sincronização.
 * O Web App (web-app-endpoint.gs) lê a planilha, parseia e escreve no Supabase.
 */
function triggerSync() {
  var props = PropertiesService.getScriptProperties();
  var webAppUrl = props.getProperty('WEB_APP_URL');
  var token = props.getProperty('ALLOWED_TOKEN');

  if (!webAppUrl) {
    Logger.log('[triggerSync] ERRO: Propriedade WEB_APP_URL não configurada.');
    return;
  }
  if (!token) {
    Logger.log('[triggerSync] ERRO: Propriedade ALLOWED_TOKEN não configurada.');
    return;
  }

  // Monta URL com parâmetros
  var url = webAppUrl
    + '?token=' + encodeURIComponent(token)
    + '&sheetId=' + encodeURIComponent(getSpreadsheetId())
    + '&gid=' + encodeURIComponent(GID);

  Logger.log('[triggerSync] Chamando Web App: %s', webAppUrl);

  try {
    var response = UrlFetchApp.fetch(url, {
      method: 'GET',
      muteHttpExceptions: true,
      // Timeout curto: o Web App pode demorar, mas não queremos bloquear o trigger
      // O Web App tem lock próprio para concorrência
    });

    var code = response.getResponseCode();
    var body = response.getContentText();

    if (code >= 200 && code < 300) {
      var result = JSON.parse(body);
      if (result.success) {
        Logger.log('[triggerSync] Sucesso! %d registros em %s.',
          result.rowsProcessed || 0, result.elapsed || '?');
      } else {
        Logger.log('[triggerSync] Web App retornou erro: %s', result.error);
      }
    } else if (code === 429) {
      // Lock contention — outro sync em andamento, normal
      Logger.log('[triggerSync] Outra sync em andamento (429). Ignorando.');
    } else {
      Logger.log('[triggerSync] HTTP %d: %s', code, body);
    }
  } catch (fetchErr) {
    Logger.log('[triggerSync] Erro de rede: %s', fetchErr.message);
  }
}

/**
 * scheduledSync — Função para gatilho de HORÁRIO (time-driven trigger).
 * Garante sincronização periódica mesmo sem edição recente.
 * Instale em: Gatilhos → + Adicionar gatilho → scheduledSync →
 * Fonte baseada em hora → Timer de minutos → A cada 5 minutos.
 */
function scheduledSync() {
  Logger.log('[scheduledSync] Sincronização periódica disparada.');
  triggerSync();
}

// ─── Teste Manual ──────────────────────────────────────────────────────────

/**
 * testSyncManual — Execute pelo menu "Executar" no editor Apps Script.
 * Chama o Web App diretamente para testar a sincronização.
 */
function testSyncManual() {
  Logger.log('=== TESTE MANUAL ===');
  triggerSync();
  Logger.log('=== FIM DO TESTE ===');
}

/**
 * testWebAppDirect — Testa o Web App diretamente (sem HTTP),
 * útil para debug quando ambos os arquivos estão no mesmo projeto.
 */
function testWebAppDirect() {
  Logger.log('=== TESTE DIRETO DO WEB APP ===');
  var token = PropertiesService.getScriptProperties().getProperty('ALLOWED_TOKEN') || 'TESTE';
  var fakeEvent = {
    parameter: {
      token: token,
      sheetId: getSpreadsheetId(),
      gid: GID
    }
  };
  var result = doGet(fakeEvent);
  Logger.log('Resposta: %s', result.getContent());
  Logger.log('=== FIM DO TESTE DIRETO ===');
}
