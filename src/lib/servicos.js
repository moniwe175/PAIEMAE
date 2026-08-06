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

// ─── Hook ───────────────────────────────────────────────────
export function useServicos() {
  const [servicos, setServicos] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    async function init() {
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
