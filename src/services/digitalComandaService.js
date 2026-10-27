import { supabase, isSupabaseConfigured } from '../lib/supabase';

function result(data = null, error = null) {
  return { data, error };
}

export function isDigitalComandaSchemaMissing(error) {
  const message = String(error?.message || error || '').toLowerCase();
  return error?.code === '42P01'
    || error?.code === 'PGRST205'
    || message.includes('digital_comandas')
    || message.includes('fn_save_digital_comanda');
}

export async function fetchDigitalComandaByAppointment(appointmentId) {
  if (!isSupabaseConfigured() || !appointmentId) return result(null, null);
  const { data, error } = await supabase
    .from('digital_comandas')
    .select('*, digital_comanda_items(*)')
    .eq('appointment_id', appointmentId)
    .neq('status', 'cancelled')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return result(null, error);
  if (data?.digital_comanda_items) {
    data.digital_comanda_items.sort((left, right) => Number(left.position) - Number(right.position));
  }
  return result(data, null);
}

export async function saveDigitalComanda({ comandaId = null, appointmentId, header, items }) {
  if (!isSupabaseConfigured()) return result(null, new Error('Supabase não configurado'));
  const { data, error } = await supabase.rpc('fn_save_digital_comanda', {
    p_comanda_id: comandaId || null,
    p_appointment_id: appointmentId,
    p_header: header || {},
    p_items: items || [],
  });
  return result(data, error);
}

export async function closeDigitalComanda(comandaId) {
  if (!isSupabaseConfigured()) return result(null, new Error('Supabase não configurado'));
  const { data, error } = await supabase.rpc('fn_close_digital_comanda', { p_comanda_id: comandaId });
  return result(data, error);
}

export async function cancelDigitalComanda(comandaId, reason = '') {
  if (!isSupabaseConfigured()) return result(null, new Error('Supabase não configurado'));
  const { data, error } = await supabase.rpc('fn_cancel_digital_comanda', {
    p_comanda_id: comandaId,
    p_reason: reason || null,
  });
  return result(data, error);
}

export async function markDigitalComandaSheetSync(comandaId, success, errorMessage = '') {
  if (!isSupabaseConfigured()) return result(null, new Error('Supabase não configurado'));
  const { data, error } = await supabase.rpc('fn_mark_digital_comanda_sheet_sync', {
    p_comanda_id: comandaId,
    p_success: Boolean(success),
    p_error: errorMessage || null,
  });
  return result(data, error);
}

export async function syncDigitalComandaToSheet(comandaId) {
  if (!isSupabaseConfigured()) return result(null, new Error('Supabase não configurado'));
  const { data, error } = await supabase.functions.invoke('sync-google-sheet', {
    body: { action: 'writeComanda', comanda_id: comandaId },
  });
  if (error) return result(null, error);
  if (data?.success === false) return result(data, new Error(data.error || 'Falha ao enviar a comanda para a planilha'));
  return result(data, null);
}
