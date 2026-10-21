const STORAGE_KEY = 'paiemae_marketing_attribution_v1';
const SESSION_KEY = 'paiemae_marketing_session_v1';

export const MARKETING_QUERY_KEYS = [
  'utm_id',
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
  'gclid',
  'gbraid',
  'wbraid',
  'fbclid',
];

function clean(value, maxLength = 500) {
  return String(value || '').trim().slice(0, maxLength) || null;
}

export function slugifyCampaign(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);
}

export function buildTrackedUrl(baseUrl, params = {}) {
  const raw = String(baseUrl || '').trim();
  if (!raw) return '';

  let url;
  try {
    url = new URL(raw);
  } catch {
    return '';
  }

  MARKETING_QUERY_KEYS.filter(key => key.startsWith('utm_')).forEach((key) => {
    const value = clean(params[key], 200);
    if (value) url.searchParams.set(key, value);
    else url.searchParams.delete(key);
  });

  return url.toString();
}

export function readAttributionFromUrl(href, referrer = '') {
  let url;
  try {
    url = new URL(href);
  } catch {
    return null;
  }

  const values = {};
  MARKETING_QUERY_KEYS.forEach((key) => {
    values[key] = clean(url.searchParams.get(key), 500);
  });

  const hasCampaignSignal = MARKETING_QUERY_KEYS.some((key) => values[key]);
  if (!hasCampaignSignal) return null;

  return {
    ...values,
    landing_url: clean(`${url.origin}${url.pathname}`, 1000),
    referrer: clean(referrer, 1000),
  };
}

function storageAvailable() {
  return typeof window !== 'undefined' && !!window.localStorage;
}

function newSessionId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `mkt-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

export function getMarketingSessionId() {
  if (!storageAvailable()) return null;
  let sessionId = window.localStorage.getItem(SESSION_KEY);
  if (!sessionId) {
    sessionId = newSessionId();
    window.localStorage.setItem(SESSION_KEY, sessionId);
  }
  return sessionId;
}

export function getCurrentMarketingAttribution() {
  if (!storageAvailable()) return null;
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) || 'null');
  } catch {
    return null;
  }
}

export function captureMarketingAttribution(href, referrer = '') {
  if (!storageAvailable()) return null;
  const incoming = readAttributionFromUrl(href, referrer);
  if (!incoming) return getCurrentMarketingAttribution();

  const now = new Date().toISOString();
  const previous = getCurrentMarketingAttribution();
  const touch = {
    ...incoming,
    session_id: getMarketingSessionId(),
    captured_at: now,
  };
  const stored = {
    session_id: touch.session_id,
    first_touch: previous?.first_touch || touch,
    last_touch: touch,
    updated_at: now,
  };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  return stored;
}

export function attributionLeadFields(attribution = getCurrentMarketingAttribution()) {
  const touch = attribution?.last_touch;
  if (!touch) return {};
  return {
    marketing_campaign_id: touch.utm_id,
    attribution_session_id: attribution.session_id || touch.session_id || null,
    utm_source: touch.utm_source,
    utm_medium: touch.utm_medium,
    utm_campaign: touch.utm_campaign,
    utm_content: touch.utm_content,
    utm_term: touch.utm_term,
    gclid: touch.gclid,
    gbraid: touch.gbraid,
    wbraid: touch.wbraid,
    fbclid: touch.fbclid,
    first_touch_at: attribution.first_touch?.captured_at || touch.captured_at,
    last_touch_at: touch.captured_at,
  };
}

export const marketingAttributionStorageKeys = { attribution: STORAGE_KEY, session: SESSION_KEY };
