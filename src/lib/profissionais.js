import { useState, useCallback, useEffect } from 'react';
import { supabase, isSupabaseConfigured, getCurrentUser } from './supabase';

// ─── Available services catalog ─────────────────────────────
export const CATALOGO_SERVICOS = [
  'Limpeza de Pele',
  'Peeling Químico',
  'Botox Facial',
  'Design de Sobrancelha',
  'Drenagem Linfática',
  'Harmonização Facial',
  'Preenchimento Labial',
  'Fio de PDO',
  'Bioestimulador',
  'Depilação a Laser',
  'Depilação',
  'Massagem',
  'Microagulhamento',
  'Criolipólise',
  'Radiofrequência',
  'Ultrassom',
  'Carboxiterapia',
];

// ─── Colors for avatars ─────────────────────────────────────
export const CORES_AVATAR = ['#C73B6D', '#8B5CF6', '#D97706', '#0891B2', '#059669', '#DC2626', '#7C3AED', '#EA580C'];

function genId() {
  return 'prof_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// ─── Local state for reactivity across the app ───
let globalProfissionais = null;
let listeners = [];

function notifyListeners() {
  for (const listener of listeners) {
    listener([...(globalProfissionais || [])]);
  }
}

// ─── Supabase helpers ────────────────────────────────────────
async function loadData() {
  if (isSupabaseConfigured()) {
    const { data, error } = await supabase.from('profissionais').select('*').order('created_at');
    if (!error && data) {
      return data.map(r => ({ 
        ...r, 
        servicos: r.servicos || [],
        fotoBase64: r.foto_base64 || null // Map snake_case to camelCase
      }));
    }
  }
  return [];
}

async function upsertToSupabase(prof) {
  if (!isSupabaseConfigured()) {
    console.error('[PROFISSIONAIS] Supabase not configured');
    return;
  }
  const user = await getCurrentUser();
  console.log('[PROFISSIONAIS] Upserting to Supabase:', prof.id, prof.nome);
  // Map camelCase to snake_case for Supabase
  const dbProf = {
    ...prof,
    foto_base64: prof.fotoBase64 || null,
    user_id: user?.id
  };
  delete dbProf.fotoBase64; // Remove camelCase version
  console.log('[PROFISSIONAIS] DB payload:', dbProf);
  const { data, error } = await supabase.from('profissionais').upsert([dbProf], { onConflict: 'id' });
  if (error) {
    console.error('[PROFISSIONAIS] Error upserting:', error);
  } else {
    console.log('[PROFISSIONAIS] Upsert successful:', data);
  }
}

async function deleteFromSupabase(id) {
  if (!isSupabaseConfigured()) return;
  await supabase.from('profissionais').delete().eq('id', id);
}

// ─── Hook ───────────────────────────────────────────────────
export function useProfissionais() {
  const [profissionais, setProfissionais] = useState(globalProfissionais || []);
  const [loaded, setLoaded] = useState(globalProfissionais !== null);

  useEffect(() => {
    let mounted = true;
    const listener = (data) => {
      if (mounted) setProfissionais(data);
    };
    listeners.push(listener);

    if (globalProfissionais === null) {
      loadData().then(data => {
        globalProfissionais = data;
        notifyListeners();
        if (mounted) setLoaded(true);
      });
    }

    return () => {
      mounted = false;
      listeners = listeners.filter(l => l !== listener);
    };
  }, []);

  const addProfissional = useCallback(async (data) => {
    const newProf = {
      id: genId(),
      nome: data.nome || 'Novo Profissional',
      cargo: data.cargo || '',
      cor: data.cor || CORES_AVATAR[Math.floor(Math.random() * CORES_AVATAR.length)],
      telefone: data.telefone || '',
      email: data.email || '',
      comissao: data.comissao || 0,
      servicos: data.servicos || [],
      fotoBase64: data.fotoBase64 || null,
    };
    
    const newList = [...(globalProfissionais || []), newProf];
    globalProfissionais = newList;
    notifyListeners();
    await upsertToSupabase(newProf);
    
    return newProf;
  }, []);

  const updateProfissional = useCallback(async (id, updates) => {
    if (!globalProfissionais) return;
    const newList = globalProfissionais.map(p => {
      if (p.id !== id) return p;
      const updated = { ...p, ...updates };
      upsertToSupabase(updated);
      return updated;
    });
    globalProfissionais = newList;
    notifyListeners();
  }, []);

  const removeProfissional = useCallback(async (id) => {
    if (!globalProfissionais) return;
    const newList = globalProfissionais.filter(p => p.id !== id);
    globalProfissionais = newList;
    notifyListeners();
    await deleteFromSupabase(id);
  }, []);

  const addServicoToProfissional = useCallback(async (profId, servico) => {
    if (!globalProfissionais) return;
    const newList = globalProfissionais.map(p => {
      if (p.id !== profId) return p;
      if (p.servicos.includes(servico)) return p;
      const updated = { ...p, servicos: [...p.servicos, servico] };
      upsertToSupabase(updated);
      return updated;
    });
    globalProfissionais = newList;
    notifyListeners();
  }, []);

  const removeServicoFromProfissional = useCallback(async (profId, servico) => {
    if (!globalProfissionais) return;
    const newList = globalProfissionais.map(p => {
      if (p.id !== profId) return p;
      const updated = { ...p, servicos: p.servicos.filter(s => s !== servico) };
      upsertToSupabase(updated);
      return updated;
    });
    globalProfissionais = newList;
    notifyListeners();
  }, []);

  return {
    profissionais,
    loaded,
    addProfissional,
    updateProfissional,
    removeProfissional,
    addServicoToProfissional,
    removeServicoFromProfissional,
  };
}
