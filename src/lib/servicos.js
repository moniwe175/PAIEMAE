import { useState, useCallback, useEffect } from 'react';
import { supabase, isSupabaseConfigured, getCurrentUser } from './supabase';

// ─── Available categories ───────────────────────────────────
export const CATEGORIAS = [
  'Toxina', 'Preenchedor', 'Combo', 'Bioestimulador', 'Fio',
  'Peeling', 'Skincare', 'Depilação', 'Massagem', 'Limpeza',
];

export const CAT_COLORS = {
  Toxina: 'badge-info',
  Preenchedor: 'badge-warning',
  Combo: 'badge-success',
  Bioestimulador: 'badge-neutral',
  Fio: 'badge-danger',
  Peeling: 'badge-info',
  Skincare: 'badge-neutral',
  'Depilação': 'badge-warning',
  Massagem: 'badge-success',
  Limpeza: 'badge-info',
};

// ─── Default services (seed data) ──────────────────────────
const DEFAULT_SERVICOS = [
  { id: 'svc_1', nome: 'Botox Facial', categoria: 'Toxina', duracao: 45, preco: 650, comissao: 30, ativo: true, descricao: '' },
  { id: 'svc_2', nome: 'Botox Masseter', categoria: 'Toxina', duracao: 30, preco: 450, comissao: 30, ativo: true, descricao: '' },
  { id: 'svc_3', nome: 'Preenchimento Labial', categoria: 'Preenchedor', duracao: 60, preco: 900, comissao: 35, ativo: true, descricao: '' },
  { id: 'svc_4', nome: 'Preenchimento Malar', categoria: 'Preenchedor', duracao: 60, preco: 1100, comissao: 35, ativo: true, descricao: '' },
  { id: 'svc_5', nome: 'Harmonização Facial', categoria: 'Combo', duracao: 120, preco: 2800, comissao: 40, ativo: true, descricao: '' },
  { id: 'svc_6', nome: 'Bioestimulador (Sculptra)', categoria: 'Bioestimulador', duracao: 60, preco: 1500, comissao: 35, ativo: true, descricao: '' },
  { id: 'svc_7', nome: 'Fio de PDO', categoria: 'Fio', duracao: 90, preco: 1800, comissao: 40, ativo: false, descricao: '' },
  { id: 'svc_8', nome: 'Peeling Químico', categoria: 'Peeling', duracao: 60, preco: 320, comissao: 25, ativo: true, descricao: '' },
  { id: 'svc_9', nome: 'Limpeza de Pele Profunda', categoria: 'Skincare', duracao: 90, preco: 180, comissao: 20, ativo: true, descricao: '' },
  { id: 'svc_10', nome: 'Depilação', categoria: 'Depilação', duracao: 60, preco: 120, comissao: 20, ativo: true, descricao: '' },
  { id: 'svc_11', nome: 'Massagem', categoria: 'Massagem', duracao: 60, preco: 150, comissao: 25, ativo: true, descricao: '' },
];

function genId() {
  return 'svc_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// ─── Supabase helpers ────────────────────────────────────────
async function loadFromSupabase() {
  if (!isSupabaseConfigured()) return null;
  const { data, error } = await supabase.from('servicos').select('*').order('created_at');
  if (error || !data) return null;
  return data;
}

async function upsertToSupabase(svc) {
  if (!isSupabaseConfigured()) return;
  const user = await getCurrentUser();
  await supabase.from('servicos').upsert([{ ...svc, user_id: user?.id }], { onConflict: 'id' });
}

async function deleteFromSupabase(id) {
  if (!isSupabaseConfigured()) return;
  await supabase.from('servicos').delete().eq('id', id);
}

async function seedSupabase() {
  if (!isSupabaseConfigured()) return;
  const { data } = await supabase.from('servicos').select('id');
  if (data && data.length > 0) return; // already seeded
  const user = await getCurrentUser();
  const seed = DEFAULT_SERVICOS.map(s => ({ ...s, user_id: user?.id }));
  await supabase.from('servicos').insert(seed);
}

// ─── Hook ───────────────────────────────────────────────────
export function useServicos() {
  const [servicos, setServicos] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    async function init() {
      await seedSupabase();
      const remote = await loadFromSupabase();
      if (remote) {
        setServicos(remote);
      }
      setLoaded(true);
    }
    init();
  }, []);

  const addServico = useCallback(async (data) => {
    const novo = {
      id: genId(),
      nome: data.nome || 'Novo Serviço',
      categoria: data.categoria || '',
      duracao: Number(data.duracao) || 30,
      preco: Number(data.preco) || 0,
      comissao: Number(data.comissao) || 0,
      ativo: true,
      descricao: data.descricao || '',
    };
    await upsertToSupabase(novo);
    setServicos(prev => [...prev, novo]);
    return novo;
  }, []);

  const updateServico = useCallback(async (id, updates) => {
    setServicos(prev => prev.map(s => {
      if (s.id !== id) return s;
      const updated = { ...s, ...updates };
      upsertToSupabase(updated);
      return updated;
    }));
  }, []);

  const removeServico = useCallback(async (id) => {
    await deleteFromSupabase(id);
    setServicos(prev => prev.filter(s => s.id !== id));
  }, []);

  const toggleAtivo = useCallback(async (id) => {
    setServicos(prev => prev.map(s => {
      if (s.id !== id) return s;
      const updated = { ...s, ativo: !s.ativo };
      upsertToSupabase(updated);
      return updated;
    }));
  }, []);

  return {
    servicos,
    addServico,
    updateServico,
    removeServico,
    toggleAtivo,
  };
}
