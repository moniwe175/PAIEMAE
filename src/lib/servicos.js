import { useState, useCallback, useEffect } from 'react';
import { supabase, isSupabaseConfigured, getCurrentUser } from './supabase';

// ─── Available categories & Ficha options ───────────────────
export const CATEGORIAS = [
  'Toxina', 'Preenchedor', 'Combo', 'Bioestimulador', 'Fio',
  'Peeling', 'Skincare', 'Depilação', 'Massagem', 'Limpeza',
];

export const TIPOS_FICHA_OPCOES = [
  'Ficha Facial',
  'Ficha Corporal',
  'Ficha Capilar',
  'Outros',
  'Qualquer Ficha',
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

// ─── Helpers para codificar/decodificar metadados na descricao ─
function encodeDescricao(text, fichasObrigatorias) {
  const fichas = Array.isArray(fichasObrigatorias) ? fichasObrigatorias.filter(Boolean) : (fichasObrigatorias ? [fichasObrigatorias] : []);
  return JSON.stringify({
    text: text || '',
    fichas: fichas
  });
}

function decodeDescricao(rawDesc) {
  if (!rawDesc) return { descricao: '', fichasObrigatorias: [] };
  try {
    if (typeof rawDesc === 'string' && rawDesc.startsWith('{')) {
      const parsed = JSON.parse(rawDesc);
      const fichas = Array.isArray(parsed.fichas) ? parsed.fichas : (parsed.fichas ? [parsed.fichas] : []);
      return {
        descricao: parsed.text || '',
        fichasObrigatorias: fichas
      };
    }
  } catch (e) {}
  return { descricao: rawDesc, fichasObrigatorias: [] };
}

function mapServiceFromSupabase(item) {
  const { descricao, fichasObrigatorias } = decodeDescricao(item.descricao);
  return {
    ...item,
    descricao: descricao,
    fichasObrigatorias: fichasObrigatorias,
    fichaObrigatoria: fichasObrigatorias[0] || null
  };
}

// ─── Supabase helpers ────────────────────────────────────────
async function loadFromSupabase() {
  if (!isSupabaseConfigured()) return null;
  const { data, error } = await supabase.from('servicos').select('*').order('created_at');
  if (error || !data) return null;
  return data.map(mapServiceFromSupabase);
}

async function upsertToSupabase(svc) {
  if (!isSupabaseConfigured()) return;
  const user = await getCurrentUser();
  
  // Garantir que enviamos apenas colunas válidas no schema do Supabase
  const dbPayload = {
    id: svc.id,
    nome: svc.nome,
    categoria: svc.categoria || '',
    duracao: Number(svc.duracao) || 30,
    preco: Number(svc.preco) || 0,
    comissao: Number(svc.comissao) || 0,
    ativo: svc.ativo ?? true,
    descricao: encodeDescricao(svc.descricao, svc.fichasObrigatorias || (svc.fichaObrigatoria ? [svc.fichaObrigatoria] : [])),
    user_id: user?.id
  };
  
  await supabase.from('servicos').upsert([dbPayload], { onConflict: 'id' });
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
    const fichas = Array.isArray(data.fichasObrigatorias) ? data.fichasObrigatorias : (data.fichaObrigatoria ? [data.fichaObrigatoria] : []);
    const novo = {
      id: genId(),
      nome: data.nome || 'Novo Serviço',
      categoria: data.categoria || '',
      duracao: Number(data.duracao) || 30,
      preco: Number(data.preco) || 0,
      comissao: Number(data.comissao) || 0,
      ativo: true,
      descricao: data.descricao || '',
      fichasObrigatorias: fichas,
      fichaObrigatoria: fichas[0] || null
    };
    await upsertToSupabase(novo);
    setServicos(prev => [...prev, novo]);
    return novo;
  }, []);

  const updateServico = useCallback(async (id, updates) => {
    setServicos(prev => prev.map(s => {
      if (s.id !== id) return s;
      const fichas = updates.fichasObrigatorias !== undefined
        ? updates.fichasObrigatorias
        : (updates.fichaObrigatoria !== undefined ? (updates.fichaObrigatoria ? [updates.fichaObrigatoria] : []) : s.fichasObrigatorias);
      const updated = {
        ...s,
        ...updates,
        fichasObrigatorias: fichas,
        fichaObrigatoria: fichas[0] || null
      };
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

  const addFichaObrigatoria = useCallback(async (id, fichaTipo) => {
    if (!fichaTipo) return;
    setServicos(prev => prev.map(s => {
      if (s.id !== id) return s;
      const current = s.fichasObrigatorias || [];
      if (current.includes(fichaTipo)) return s;
      const nextFichas = [...current, fichaTipo];
      const updated = {
        ...s,
        fichasObrigatorias: nextFichas,
        fichaObrigatoria: nextFichas[0] || null
      };
      upsertToSupabase(updated);
      return updated;
    }));
  }, []);

  const removeFichaObrigatoria = useCallback(async (id, fichaTipo) => {
    setServicos(prev => prev.map(s => {
      if (s.id !== id) return s;
      const current = s.fichasObrigatorias || [];
      const nextFichas = current.filter(f => f !== fichaTipo);
      const updated = {
        ...s,
        fichasObrigatorias: nextFichas,
        fichaObrigatoria: nextFichas[0] || null
      };
      upsertToSupabase(updated);
      return updated;
    }));
  }, []);

  const setFichasObrigatorias = useCallback(async (id, fichasArray) => {
    setServicos(prev => prev.map(s => {
      if (s.id !== id) return s;
      const nextFichas = Array.isArray(fichasArray) ? fichasArray : [];
      const updated = {
        ...s,
        fichasObrigatorias: nextFichas,
        fichaObrigatoria: nextFichas[0] || null
      };
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
    addFichaObrigatoria,
    removeFichaObrigatoria,
    setFichasObrigatorias,
  };
}
