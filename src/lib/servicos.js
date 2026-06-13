import { useState, useCallback, useEffect } from 'react';

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

const STORAGE_KEY = 'erp_servicos';

// ─── Load / Save helpers ────────────────────────────────────
function loadServicos() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.warn('[Servicos] Failed to load from localStorage', e);
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_SERVICOS));
  return DEFAULT_SERVICOS;
}

function saveServicos(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

function genId() {
  return 'svc_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// ─── Hook ───────────────────────────────────────────────────
export function useServicos() {
  const [servicos, setServicos] = useState(loadServicos);

  useEffect(() => {
    saveServicos(servicos);
  }, [servicos]);

  const addServico = useCallback((data) => {
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
    setServicos(prev => [...prev, novo]);
    return novo;
  }, []);

  const updateServico = useCallback((id, updates) => {
    setServicos(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  }, []);

  const removeServico = useCallback((id) => {
    setServicos(prev => prev.filter(s => s.id !== id));
  }, []);

  const toggleAtivo = useCallback((id) => {
    setServicos(prev => prev.map(s => s.id === id ? { ...s, ativo: !s.ativo } : s));
  }, []);

  return {
    servicos,
    addServico,
    updateServico,
    removeServico,
    toggleAtivo,
  };
}
