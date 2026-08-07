import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import makeWASocket, { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, makeCacheableSignalKeyStore } from '@whiskeysockets/baileys';
import pino from 'pino';
import qrcode from 'qrcode';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const AUTH_FOLDER = process.env.AUTH_FOLDER || './sessao_whatsapp';
const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS || '30000', 10);
const MAX_EXPIRY_LAG_MS = parseInt(process.env.MAX_EXPIRY_LAG_MS || '3600000', 10);

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('[Worker WhatsApp] ERRO: SUPABASE_URL e SUPABASE_SERVICE_KEY devem estar configurados no .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const logger = pino({ level: 'silent' });

let sock = null;
let isConnected = false;

async function setWAStatus(status, extra = {}) {
  try {
    const payload = {
      id: 1,
      status,
      updated_at: new Date().toISOString(),
      ...extra
    };
    const { error } = await supabase
      .from('whatsapp_connection_status')
      .upsert(payload);

    if (error) {
      console.warn('[Worker WhatsApp] Erro ao salvar status no Supabase:', error.message);
    } else {
      console.log(`[Worker WhatsApp] Status publicado no Supabase: ${status}`);
    }
  } catch (err) {
    console.warn('[Worker WhatsApp] Exceção ao atualizar status no Supabase:', err.message);
  }
}

async function connectToWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_FOLDER);
  const versionInfo = await fetchLatestBaileysVersion().catch(() => ({ version: undefined }));

  sock = makeWASocket({
    version: versionInfo?.version,
    logger,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger),
    },
    printQRInTerminal: true,
    browser: ['EvelynEstheticCenter', 'Chrome', '1.0.0'],
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log('[Worker WhatsApp] Novo QR Code gerado.');
      try {
        const qrBase64 = await qrcode.toDataURL(qr);
        await setWAStatus('qr_ready', { qr_code_base64: qrBase64, error_message: null });
        console.log('[Worker WhatsApp] QR Code (Base64) enviado com sucesso para o Supabase.');
      } catch (qrErr) {
        console.error('[Worker WhatsApp] Erro ao converter QR para Base64:', qrErr.message);
      }
    }

    if (connection === 'connecting') {
      await setWAStatus('connecting');
    }

    if (connection === 'close') {
      isConnected = false;
      const code = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = (code !== DisconnectReason.loggedOut);
      console.log(`[Worker WhatsApp] Conexão fechada. Motivo: ${lastDisconnect?.error?.message}. Reconectando: ${shouldReconnect}`);
      await setWAStatus('disconnected', {
        qr_code_base64: null,
        error_message: lastDisconnect?.error?.message || null
      });

      if (shouldReconnect) {
        setTimeout(connectToWhatsApp, 5000);
      }
    } else if (connection === 'open') {
      isConnected = true;
      const phone = sock.user?.id?.split(':')[0] || null;
      console.log(`[Worker WhatsApp] Conectado ao WhatsApp com sucesso! Número: ${phone}`);
      await setWAStatus('connected', {
        qr_code_base64: null,
        phone_number: phone,
        error_message: null
      });
    }
  });
}

function formatJid(phone) {
  if (!phone) return null;
  let clean = String(phone).replace(/\D/g, '');
  if (!clean.startsWith('55') && (clean.length === 10 || clean.length === 11)) {
    clean = '55' + clean;
  }
  return `${clean}@s.whatsapp.net`;
}

async function processQueue() {
  if (!isConnected || !sock) {
    return;
  }

  try {
    const now = new Date();
    const { data: queue, error } = await supabase
      .from('marketing_queue')
      .select('*')
      .eq('status', 'approved')
      .lte('scheduled_at', now.toISOString())
      .order('scheduled_at', { ascending: true })
      .limit(20);

    if (error) {
      console.error('[Worker WhatsApp] Erro ao buscar fila:', error.message);
      return;
    }

    if (!queue || queue.length === 0) {
      return;
    }

    console.log(`[Worker WhatsApp] Encontradas ${queue.length} mensagens para processar.`);

    for (const item of queue) {
      const scheduledTime = new Date(item.scheduled_at).getTime();
      const expiresTime = item.expires_at ? new Date(item.expires_at).getTime() : null;
      const nowTime = Date.now();

      // Regra de Vencimento
      if ((expiresTime && nowTime > expiresTime) || (nowTime - scheduledTime > MAX_EXPIRY_LAG_MS)) {
        console.log(`[Worker WhatsApp] Mensagem ID ${item.id} expirada. Alterando status.`);
        await supabase
          .from('marketing_queue')
          .update({ status: 'expired', updated_at: new Date().toISOString() })
          .eq('id', item.id);
        continue;
      }

      const jid = formatJid(item.client_phone);
      if (!jid) {
        console.warn(`[Worker WhatsApp] Telefone inválido para mensagem ID ${item.id}: ${item.client_phone}`);
        await supabase
          .from('marketing_queue')
          .update({ status: 'failed', updated_at: new Date().toISOString() })
          .eq('id', item.id);
        continue;
      }

      try {
        console.log(`[Worker WhatsApp] Enviando mensagem ID ${item.id} para ${item.client_name} (${item.client_phone})...`);
        await sock.sendMessage(jid, { text: item.message_text });

        await supabase
          .from('marketing_queue')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', item.id);

        console.log(`[Worker WhatsApp] Mensagem ID ${item.id} enviada com sucesso!`);
      } catch (sendErr) {
        console.error(`[Worker WhatsApp] Falha ao enviar mensagem ID ${item.id}:`, sendErr.message);
        await supabase
          .from('marketing_queue')
          .update({
            status: 'failed',
            error_message: sendErr.message,
            updated_at: new Date().toISOString()
          })
          .eq('id', item.id);
      }
    }
  } catch (err) {
    console.error('[Worker WhatsApp] Erro no processamento da fila:', err.message);
  }
}

async function start() {
  console.log('[Worker WhatsApp] Iniciando serviço...');
  await setWAStatus('connecting');
  await connectToWhatsApp();

  setInterval(processQueue, POLL_INTERVAL_MS);
}

start();
