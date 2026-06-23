import { useState, useCallback, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from './supabase';

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

// ─── Default professionals (seed data) ──────────────────────
const DEFAULT_PROFISSIONAIS = [
  {
    id: 'prof_1',
    nome: 'Bárbara',
    cargo: 'Esteticista',
    cor: '#C73B6D',
    telefone: '(11) 99111-1111',
    email: 'barbara@clinica.com',
    comissao: 30,
    servicos: ['Limpeza de Pele', 'Peeling Químico', 'Botox Facial', 'Design de Sobrancelha', 'Drenagem Linfática'],
  },
  {
    id: 'prof_2',
    nome: 'Evelyn',
    cargo: 'Biomédica',
    cor: '#8B5CF6',
    telefone: '(11) 99222-2222',
    email: 'evelyn@clinica.com',
    comissao: 40,
    servicos: ['Harmonização Facial', 'Preenchimento Labial', 'Fio de PDO', 'Bioestimulador', 'Botox Facial'],
  },
  {
    id: 'prof_3',
    nome: 'Bira',
    cargo: 'Esteticista',
    cor: '#D97706',
    telefone: '(11) 99333-3333',
    email: 'bira@clinica.com',
    comissao: 25,
    servicos: ['Depilação a Laser', 'Limpeza de Pele', 'Drenagem Linfática', 'Peeling Químico'],
  },
];

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
  await supabase.from('profissionais').upsert([prof], { onConflict: 'id' });
}

async function deleteFromSupabase(id) {
  if (!isSupabaseConfigured()) return;
  await supabase.from('profissionais').delete().eq('id', id);
}

async function seedSupabase() {
  if (!isSupabaseConfigured()) return;
  const { data } = await supabase.from('profissionais').select('id');
  if (data && data.length > 0) return; // already seeded
  await supabase.from('profissionais').insert(DEFAULT_PROFISSIONAIS);
}

// ─── Hook ───────────────────────────────────────────────────
export function useProfissionais() {
  const [profissionais, setProfissionais] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    async function init() {
      await seedSupabase();
      const remote = await loadFromSupabase();
      if (remote && remote.length > 0) {
        setProfissionais(remote);
      } else {
        // fallback: no Supabase configured, use defaults stored in localStorage
        const raw = localStorage.getItem('erp_profissionais');
        if (raw) {
          try { setProfissionais(JSON.parse(raw)); } catch { setProfissionais(DEFAULT_PROFISSIONAIS); }
        } else {
          setProfissionais(DEFAULT_PROFISSIONAIS);
        }
      }
      setLoaded(true);
    }
    init();
  }, []);

  // Persist to localStorage as fallback
  useEffect(() => {
    if (loaded) {
      localStorage.setItem('erp_profissionais', JSON.stringify(profissionais));
    }
  }, [profissionais, loaded]);

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
