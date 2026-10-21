import { supabase, isSupabaseConfigured } from '../lib/supabase.js';

export async function persistMarketingTouch(attribution) {
  const touch = attribution?.last_touch;
  if (!isSupabaseConfigured() || !touch?.session_id) return { data: null, error: null };

  const { data, error } = await supabase.rpc('fn_marketing_capture_touch', {
    p_session_id: touch.session_id,
    p_campaign_id: touch.utm_id || null,
    p_landing_url: touch.landing_url || null,
    p_referrer: touch.referrer || null,
    p_utm_source: touch.utm_source || null,
    p_utm_medium: touch.utm_medium || null,
    p_utm_campaign: touch.utm_campaign || null,
    p_utm_content: touch.utm_content || null,
    p_utm_term: touch.utm_term || null,
    p_gclid: touch.gclid || null,
    p_gbraid: touch.gbraid || null,
    p_wbraid: touch.wbraid || null,
    p_fbclid: touch.fbclid || null,
  });

  // A aplicação continua funcionando antes de a migração ser executada.
  if (error && !['42883', 'PGRST202'].includes(error.code)) {
    console.warn('[Marketing Attribution] toque não persistido:', error.message);
  }
  return { data, error };
}

export async function fetchCampaignPerformance() {
  if (!isSupabaseConfigured()) return { data: [], error: null };
  const { data, error } = await supabase.rpc('fn_marketing_campaign_performance');
  if (error) {
    if (!['42883', 'PGRST202'].includes(error.code)) {
      console.warn('[Marketing Attribution] métricas indisponíveis:', error.message);
    }
    return { data: [], error };
  }
  return { data: data || [], error: null };
}
