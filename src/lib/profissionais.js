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

// ─── Supabase helpers ────────────────────────────────────────
async function loadFromSupabase() {
  if (!isSupabaseConfigured()) return null;
  const { data, error } = await supabase.from('profissionais').select('*').order('created_at');
  if (error || !data) return null;
  return data.map(r => ({ ...r, servicos: r.servicos || [] }));
}

async function upsertToSupabase(prof) {
  if (!isSupabaseConfigured()) return;
  const user = await getCurrentUser();
  await supabase.from('profissionais').upsert([{ ...prof, user_id: user?.id }], { onConflict: 'id' });
}

async function deleteFromSupabase(id) {
  if (!isSupabaseConfigured()) return;
  await supabase.from('profissionais').delete().eq('id', id);
}

// ─── Hook ───────────────────────────────────────────────────
export function useProfissionais() {
  const [profissionais, setProfissionais] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    async function init() {
      const remote = await loadFromSupabase();
      if (remote) {
        setProfissionais(remote);
      }
      setLoaded(true);
    }
    init();
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
    };
    await upsertToSupabase(newProf);
    setProfissionais(prev => [...prev, newProf]);
    return newProf;
  }, []);

  const updateProfissional = useCallback(async (id, updates) => {
    setProfissionais(prev => prev.map(p => {
      if (p.id !== id) return p;
      const updated = { ...p, ...updates };
      upsertToSupabase(updated);
      return updated;
    }));
  }, []);

  const removeProfissional = useCallback(async (id) => {
    await deleteFromSupabase(id);
    setProfissionais(prev => prev.filter(p => p.id !== id));
  }, []);

  const addServicoToProfissional = useCallback(async (profId, servico) => {
    setProfissionais(prev => prev.map(p => {
      if (p.id !== profId) return p;
      if (p.servicos.includes(servico)) return p;
      const updated = { ...p, servicos: [...p.servicos, servico] };
      upsertToSupabase(updated);
      return updated;
    }));
  }, []);

  const removeServicoFromProfissional = useCallback(async (profId, servico) => {
    setProfissionais(prev => prev.map(p => {
      if (p.id !== profId) return p;
      const updated = { ...p, servicos: p.servicos.filter(s => s !== servico) };
      upsertToSupabase(updated);
      return updated;
    }));
  }, []);

  return {
    profissionais,
    addProfissional,
    updateProfissional,
    removeProfissional,
    addServicoToProfissional,
    removeServicoFromProfissional,
  };
}
