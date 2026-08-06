/**
 * worker_whatsapp/index.js — Marketing Engine v2
 * ================================================
 * Worker Node.js (Baileys) rodando localmente no computador da clínica.
 * 
 * Responsabilidades:
 *   1. Conexão WhatsApp com QR Code publicado no Supabase (React renderiza)
 *   2. Regra da Retenção: processa mensagens represadas da madrugada ao ligar
 *   3. Regra de Vencimento: cancela mensagens críticas com janela expirada
 *   4. Loop de polling: lê marketing_queue a cada 30s e envia mensagens approved
 * 
 * Dependências (instalar com: npm install):
 *   @whiskeysockets/baileys
 *   @supabase/supabase-js
 *   qrcode
 *   dotenv
 *   pino (logger do Baileys)
 */

import makeWASocket, {
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
} from "@whiskeysockets/baileys";
import { createClient } from "@supabase/supabase-js";
import qrcode from "qrcode";
import pino from "pino";
import "dotenv/config";

// ---------------------------------------------------------------------------
// Configuração
// ---------------------------------------------------------------------------

const SUPABASE_URL         = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY; // service_role key
const AUTH_FOLDER          = process.env.AUTH_FOLDER || "./auth_info_baileys";
const POLL_INTERVAL_MS     = parseInt(process.env.POLL_INTERVAL_MS || "30000"); // 30s
const MAX_EXPIRY_LAG_MS    = parseInt(process.env.MAX_EXPIRY_LAG_MS || "3600000"); // 1h

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error("SUPABASE_URL e SUPABASE_SERVICE_KEY são obrigatórios no .env");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const logger   = pino({ level: "silent" }); // silencia logs verbosos do Baileys

// ---------------------------------------------------------------------------
// 1. Atualizar status da conexão no Supabase (React lê via Realtime)
// ---------------------------------------------------------------------------

async function setWAStatus(status, extra = {}) {
    await supabase
        .from("whatsapp_connection_status")
        .upsert({ id: 1, status, updated_at: new Date().toISOString(), ...extra });
    console.log(`[WA] Status: ${status}`);
}

// ---------------------------------------------------------------------------
// 2. Inicializar conexão Baileys
// ---------------------------------------------------------------------------

let sock = null;

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_FOLDER);
    const { version }          = await fetchLatestBaileysVersion();

    sock = makeWASocket({
        version,
        logger,
        auth: {
            creds: state.creds,
            keys:  makeCacheableSignalKeyStore(state.keys, logger),
        },
        printQRInTerminal: false, // ← QR Code vai para o Supabase, não o terminal
        browser: ["EvelynEstheticCenter", "Chrome", "1.0.0"],
    });

    // Salvar credenciais sempre que atualizadas
    sock.ev.on("creds.update", saveCreds);

    // Gerenciar mudanças de conexão
    sock.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect, qr } = update;

        // QR Code gerado → salvar base64 no Supabase → React renderiza
        if (qr) {
            const qrBase64 = await qrcode.toDataURL(qr);
            await setWAStatus("qr_ready", { qr_code_base64: qrBase64 });
            console.log("[WA] QR Code publicado no Supabase. Abra a aba Integrações para escanear.");
        }

        if (connection === "open") {
            const phone = sock.user?.id?.split(":")[0] || null;
            await setWAStatus("connected", { qr_code_base64: null, phone_number: phone });
            console.log(`[WA] Conectado! Número: ${phone}`);

            // Ao conectar, rodar imediatamente a Regra da Retenção + Vencimento
            await processRetentionQueue();
            await expireStaleMessages();

            // Iniciar loop de polling
            startPollingLoop();
        }

        if (connection === "close") {
            const code = lastDisconnect?.error?.output?.statusCode;
            const shouldReconnect = code !== DisconnectReason.loggedOut;
            await setWAStatus("disconnected", {
                error_message: lastDisconnect?.error?.message || null,
            });
            console.log(`[WA] Conexão encerrada. Código: ${code}. Reconectar: ${shouldReconnect}`);
            if (shouldReconnect) {
                setTimeout(connectToWhatsApp, 5000); // reconecta após 5s
            }
        }

        if (connection === "connecting") {
            await setWAStatus("connecting");
        }
    });
}

// ---------------------------------------------------------------------------
// 3. Regra de Vencimento
//    Cancela mensagens críticas (com expires_at) que já venceram.
//    Rodada ao ligar o PC e antes de cada ciclo de polling.
// ---------------------------------------------------------------------------

async function expireStaleMessages() {
    const now = new Date().toISOString();

    const { data: stale, error } = await supabase
        .from("marketing_queue")
        .select("id, tool_name, client_name, expires_at")
        .eq("status", "approved")
        .not("expires_at", "is", null)
        .lte("expires_at", now);

    if (error) {
        console.error("[Vencimento] Erro ao buscar mensagens vencidas:", error.message);
        return;
    }

    for (const msg of stale || []) {
        await supabase
            .from("marketing_queue")
            .update({ status: "expired", updated_at: now })
            .eq("id", msg.id);

        console.log(`[Vencimento] Cancelado: ${msg.tool_name} para ${msg.client_name} (expirou em ${msg.expires_at})`);
    }

    if (stale?.length) {
        console.log(`[Vencimento] ${stale.length} mensagem(ns) expirada(s) cancelada(s).`);
    }
}

// ---------------------------------------------------------------------------
// 4. Regra da Retenção (Bom Dia)
//    Ao ligar o PC de manhã, processa mensagens represadas da madrugada.
//    Ordena por scheduled_at para respeitar a sequência original.
// ---------------------------------------------------------------------------

async function processRetentionQueue() {
    console.log("[Retenção] Verificando mensagens represadas da madrugada...");

    const now = new Date().toISOString();

    const { data: backlog, error } = await supabase
        .from("marketing_queue")
        .select("*")
        .eq("status", "approved")
        .lte("scheduled_at", now)
        .is("expires_at", null) // mensagens sem vencimento crítico
        .order("scheduled_at", { ascending: true });

    if (error) {
        console.error("[Retenção] Erro:", error.message);
        return;
    }

    if (!backlog?.length) {
        console.log("[Retenção] Nenhuma mensagem represada.");
        return;
    }

    console.log(`[Retenção] ${backlog.length} mensagem(ns) represada(s). Processando...`);

    for (const msg of backlog) {
        await sendMessage(msg);
        await delay(2000); // 2s entre envios para evitar ban
    }
}

// ---------------------------------------------------------------------------
// 5. Loop de Polling (a cada 30s)
//    Lê marketing_queue buscando mensagens approved com scheduled_at <= now.
// ---------------------------------------------------------------------------

let pollingTimer = null;

function startPollingLoop() {
    if (pollingTimer) return; // evita loop duplo

    const run = async () => {
        await expireStaleMessages();
        await processDueMessages();
    };

    run(); // executa imediatamente
    pollingTimer = setInterval(run, POLL_INTERVAL_MS);
    console.log(`[Polling] Loop iniciado (intervalo: ${POLL_INTERVAL_MS / 1000}s)`);
}

async function processDueMessages() {
    const now = new Date().toISOString();

    const { data: due, error } = await supabase
        .from("marketing_queue")
        .select("*")
        .eq("status", "approved")
        .lte("scheduled_at", now)
        .order("scheduled_at", { ascending: true })
        .limit(50); // processa até 50 por ciclo

    if (error) {
        console.error("[Polling] Erro ao buscar fila:", error.message);
        return;
    }

    for (const msg of due || []) {
        await sendMessage(msg);
        await delay(2000); // 2s entre envios
    }
}

// ---------------------------------------------------------------------------
// 6. Envio de mensagem via Baileys
// ---------------------------------------------------------------------------

async function sendMessage(msg) {
    if (!sock) {
        console.warn("[Envio] Socket não inicializado. Mensagem ignorada:", msg.id);
        return;
    }

    // Formatar número: remove formatação, garante sufixo @s.whatsapp.net
    const phone = msg.client_phone
        .replace(/\D/g, "")           // remove tudo que não é dígito
        .replace(/^0+/, "");          // remove zeros à esquerda

    // Adicionar DDI Brasil se não tiver
    const jid = phone.startsWith("55")
        ? `${phone}@s.whatsapp.net`
        : `55${phone}@s.whatsapp.net`;

    try {
        await sock.sendMessage(jid, { text: msg.message_text });

        await supabase
            .from("marketing_queue")
            .update({
                status:     "sent",
                sent_at:    new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .eq("id", msg.id);

        console.log(`[Envio] ✅ ${msg.tool_name} → ${msg.client_name} (${phone})`);

    } catch (err) {
        await supabase
            .from("marketing_queue")
            .update({
                status:        "failed",
                error_message: err.message,
                updated_at:    new Date().toISOString(),
            })
            .eq("id", msg.id);

        console.error(`[Envio] ❌ Falha para ${msg.client_name}: ${err.message}`);
    }
}

// ---------------------------------------------------------------------------
// 7. Utilitários
// ---------------------------------------------------------------------------

function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// 8. Entry point
// ---------------------------------------------------------------------------

console.log("=== Marketing Engine v2 — Worker WhatsApp (Baileys) ===");
console.log(`Supabase: ${SUPABASE_URL}`);
console.log(`Auth folder: ${AUTH_FOLDER}`);
console.log("Iniciando conexão com WhatsApp...\n");

await setWAStatus("connecting");
connectToWhatsApp().catch(console.error);
