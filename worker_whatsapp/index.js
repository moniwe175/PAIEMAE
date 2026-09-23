/* global process */

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { pathToFileURL } from 'node:url';

dotenv.config();

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function normalizePhone(phone) {
  if (!phone) return null;

  let clean = String(phone).replace(/\D/g, '');
  if (!clean) return null;

  if (!clean.startsWith('55') && (clean.length === 10 || clean.length === 11)) {
    clean = `55${clean}`;
  }

  return clean.length >= 12 ? clean : null;
}

export function extractQrCode(payload) {
  return payload?.qrcode?.base64 || payload?.qrCode?.base64 || payload?.base64 || null;
}

export function mapEvolutionState(state) {
  if (state === 'open') return 'connected';
  if (state === 'connecting') return 'connecting';
  if (state === 'close' || state === 'refused') return 'disconnected';
  return 'disconnected';
}

function errorText(error) {
  const text = error instanceof Error ? error.message : String(error);
  return text.slice(0, 500);
}

function getInstanceList(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.instances)) return payload.instances;
  return [];
}

function phoneFromInstance(instance) {
  const jid = instance?.ownerJid || instance?.owner || instance?.number;
  if (!jid) return null;
  return String(jid).split('@')[0].split(':')[0].replace(/\D/g, '') || null;
}

class EvolutionWorker {
  constructor({ supabase, evolutionUrl, evolutionApiKey, instanceName, pollIntervalMs, connectionPollIntervalMs, maxExpiryLagMs, requestTimeoutMs }) {
    this.supabase = supabase;
    this.evolutionUrl = evolutionUrl.replace(/\/$/, '');
    this.evolutionApiKey = evolutionApiKey;
    this.instanceName = instanceName;
    this.pollIntervalMs = pollIntervalMs;
    this.connectionPollIntervalMs = connectionPollIntervalMs;
    this.maxExpiryLagMs = maxExpiryLagMs;
    this.requestTimeoutMs = requestTimeoutMs;
    this.isConnected = false;
    this.phoneNumber = null;
    this.queueBusy = false;
    this.connectionBusy = false;
  }

  async evolutionRequest(path, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.requestTimeoutMs);

    try {
      const response = await fetch(`${this.evolutionUrl}${path}`, {
        ...options,
        signal: controller.signal,
        headers: {
          apikey: this.evolutionApiKey,
          'Content-Type': 'application/json',
          ...(options.headers || {}),
        },
      });

      const raw = await response.text();
      let payload = null;
      if (raw) {
        try {
          payload = JSON.parse(raw);
        } catch {
          payload = raw;
        }
      }

      if (!response.ok) {
        const detail = typeof payload === 'string' ? payload : JSON.stringify(payload);
        throw new Error(`Evolution API ${response.status}: ${detail || response.statusText}`);
      }

      return payload;
    } finally {
      clearTimeout(timer);
    }
  }

  async setWAStatus(status, extra = {}) {
    const payload = {
      id: 1,
      status,
      qr_code_base64: extra.qr_code_base64 ?? null,
      phone_number: extra.phone_number ?? (status === 'connected' ? this.phoneNumber : null),
      error_message: extra.error_message ?? null,
      updated_at: new Date().toISOString(),
    };

    const { error } = await this.supabase
      .from('whatsapp_connection_status')
      .upsert(payload);

    if (error) {
      throw new Error(`Falha ao publicar status no Supabase: ${error.message}`);
    }
  }

  async fetchInstances() {
    const query = new URLSearchParams({ instanceName: this.instanceName });
    const payload = await this.evolutionRequest(`/instance/fetchInstances?${query}`);
    return getInstanceList(payload);
  }

  async ensureInstance() {
    const instances = await this.fetchInstances();
    const existing = instances.find((item) =>
      item?.name === this.instanceName ||
      item?.instanceName === this.instanceName ||
      item?.instance?.instanceName === this.instanceName
    );

    if (existing) {
      console.log(`[Worker Evolution] Instância "${this.instanceName}" encontrada.`);
      return existing;
    }

    console.log(`[Worker Evolution] Criando instância "${this.instanceName}"...`);
    const created = await this.evolutionRequest('/instance/create', {
      method: 'POST',
      body: JSON.stringify({
        instanceName: this.instanceName,
        integration: 'WHATSAPP-BAILEYS',
        qrcode: true,
        rejectCall: false,
        groupsIgnore: true,
        alwaysOnline: false,
        readMessages: false,
        readStatus: false,
        syncFullHistory: false,
      }),
    });

    const qr = extractQrCode(created);
    if (qr) {
      await this.setWAStatus('qr_ready', { qr_code_base64: qr });
    }

    return created;
  }

  async waitForEvolution() {
    let attempt = 0;

    while (true) {
      attempt += 1;
      try {
        await this.fetchInstances();
        console.log('[Worker Evolution] Evolution API pronta.');
        return;
      } catch (error) {
        if (attempt === 1 || attempt % 6 === 0) {
          console.warn(`[Worker Evolution] Aguardando Evolution API: ${errorText(error)}`);
        }
        await sleep(5000);
      }
    }
  }

  async syncConnection() {
    if (this.connectionBusy) return;
    this.connectionBusy = true;

    try {
      const statePayload = await this.evolutionRequest(`/instance/connectionState/${encodeURIComponent(this.instanceName)}`);
      const state = statePayload?.instance?.state || statePayload?.state;

      if (state === 'open') {
        const instances = await this.fetchInstances();
        const instance = instances.find((item) =>
          item?.name === this.instanceName || item?.instanceName === this.instanceName
        ) || instances[0];

        this.phoneNumber = phoneFromInstance(instance) || this.phoneNumber;
        this.isConnected = true;
        await this.setWAStatus('connected', { phone_number: this.phoneNumber });
        return;
      }

      this.isConnected = false;
      const connectPayload = await this.evolutionRequest(`/instance/connect/${encodeURIComponent(this.instanceName)}`);
      const qr = extractQrCode(connectPayload);

      if (qr) {
        await this.setWAStatus('qr_ready', { qr_code_base64: qr });
      } else {
        await this.setWAStatus(mapEvolutionState(state));
      }
    } catch (error) {
      this.isConnected = false;
      console.error('[Worker Evolution] Falha ao sincronizar conexão:', errorText(error));
      try {
        await this.setWAStatus('error', { error_message: errorText(error) });
      } catch (statusError) {
        console.error('[Worker Evolution] Falha ao publicar o erro:', errorText(statusError));
      }
    } finally {
      this.connectionBusy = false;
    }
  }

  async updateQueueItem(id, values) {
    const { error } = await this.supabase
      .from('marketing_queue')
      .update({ ...values, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('status', 'approved');

    if (error) throw new Error(error.message);
  }

  async processQueue() {
    if (!this.isConnected || this.queueBusy) return;
    this.queueBusy = true;

    try {
      const now = new Date();
      const { data: queue, error } = await this.supabase
        .from('marketing_queue')
        .select('*')
        .eq('status', 'approved')
        .lte('scheduled_at', now.toISOString())
        .order('scheduled_at', { ascending: true })
        .limit(20);

      if (error) throw new Error(error.message);
      if (!queue?.length) return;

      console.log(`[Worker Evolution] ${queue.length} mensagem(ns) pronta(s) para envio.`);

      for (const item of queue) {
        const scheduledTime = new Date(item.scheduled_at).getTime();
        const expiresTime = item.expires_at ? new Date(item.expires_at).getTime() : null;
        const nowTime = Date.now();

        if ((expiresTime && nowTime > expiresTime) || (nowTime - scheduledTime > this.maxExpiryLagMs)) {
          await this.updateQueueItem(item.id, { status: 'expired' });
          continue;
        }

        const number = normalizePhone(item.client_phone);
        if (!number) {
          await this.updateQueueItem(item.id, {
            status: 'failed',
            error_message: `Telefone inválido: ${item.client_phone || 'não informado'}`,
          });
          continue;
        }

        try {
          await this.evolutionRequest(`/message/sendText/${encodeURIComponent(this.instanceName)}`, {
            method: 'POST',
            body: JSON.stringify({ number, text: item.message_text, delay: 500 }),
          });

          await this.updateQueueItem(item.id, {
            status: 'sent',
            sent_at: new Date().toISOString(),
            error_message: null,
          });
          console.log(`[Worker Evolution] Mensagem ${item.id} enviada para ${number}.`);
        } catch (sendError) {
          const message = errorText(sendError);
          console.error(`[Worker Evolution] Falha na mensagem ${item.id}: ${message}`);
          await this.updateQueueItem(item.id, { status: 'failed', error_message: message });
        }
      }
    } catch (error) {
      console.error('[Worker Evolution] Erro ao processar a fila:', errorText(error));
    } finally {
      this.queueBusy = false;
    }
  }

  async start() {
    console.log('[Worker Evolution] Iniciando integração PAIEMAE...');
    await this.setWAStatus('connecting');
    await this.waitForEvolution();
    await this.ensureInstance();
    await this.syncConnection();

    setInterval(() => this.syncConnection(), this.connectionPollIntervalMs);
    setInterval(() => this.processQueue(), this.pollIntervalMs);
  }

  async shutdown(signal) {
    console.log(`[Worker Evolution] ${signal} recebido. Encerrando...`);
    try {
      await this.setWAStatus('disconnected');
    } finally {
      process.exit(0);
    }
  }
}

export async function startFromEnvironment() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_KEY;
  const evolutionUrl = process.env.EVOLUTION_API_URL || 'http://evolution-api:8080';
  const evolutionApiKey = process.env.EVOLUTION_API_KEY || process.env.AUTHENTICATION_API_KEY;
  const instanceName = process.env.EVOLUTION_INSTANCE_NAME || 'paiemae';

  const missing = [
    ['SUPABASE_URL', supabaseUrl],
    ['SUPABASE_SECRET_KEY', supabaseKey],
    ['EVOLUTION_API_KEY', evolutionApiKey],
  ].filter(([, value]) => !value).map(([name]) => name);

  if (missing.length) {
    throw new Error(`Variáveis obrigatórias ausentes: ${missing.join(', ')}`);
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const worker = new EvolutionWorker({
    supabase,
    evolutionUrl,
    evolutionApiKey,
    instanceName,
    pollIntervalMs: Number.parseInt(process.env.POLL_INTERVAL_MS || '30000', 10),
    connectionPollIntervalMs: Number.parseInt(process.env.CONNECTION_POLL_INTERVAL_MS || '15000', 10),
    maxExpiryLagMs: Number.parseInt(process.env.MAX_EXPIRY_LAG_MS || '3600000', 10),
    requestTimeoutMs: Number.parseInt(process.env.EVOLUTION_REQUEST_TIMEOUT_MS || '15000', 10),
  });

  process.on('SIGINT', () => worker.shutdown('SIGINT'));
  process.on('SIGTERM', () => worker.shutdown('SIGTERM'));

  await worker.start();
  return worker;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  startFromEnvironment().catch((error) => {
    console.error('[Worker Evolution] Falha fatal:', errorText(error));
    process.exit(1);
  });
}
