import { useState, useCallback, useEffect } from 'react';

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

const STORAGE_KEY = 'erp_profissionais';

// ─── Load / Save helpers ────────────────────────────────────
function loadProfissionais() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.warn('[Profissionais] Failed to load from localStorage', e);
  }
  // Seed defaults
  localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_PROFISSIONAIS));
  return DEFAULT_PROFISSIONAIS;
}

function saveProfissionais(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

// ─── Generate unique ID ─────────────────────────────────────
function genId() {
  return 'prof_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// ─── Hook ───────────────────────────────────────────────────
export function useProfissionais() {
  const [profissionais, setProfissionais] = useState(loadProfissionais);

  // Persist on every change
  useEffect(() => {
    saveProfissionais(profissionais);
  }, [profissionais]);

  const addProfissional = useCallback((data) => {
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
    setProfissionais(prev => [...prev, newProf]);
    return newProf;
  }, []);

  const updateProfissional = useCallback((id, updates) => {
    setProfissionais(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  }, []);

  const removeProfissional = useCallback((id) => {
    setProfissionais(prev => prev.filter(p => p.id !== id));
  }, []);

  const addServicoToProfissional = useCallback((profId, servico) => {
    setProfissionais(prev => prev.map(p => {
      if (p.id !== profId) return p;
      if (p.servicos.includes(servico)) return p;
      return { ...p, servicos: [...p.servicos, servico] };
    }));
  }, []);

  const removeServicoFromProfissional = useCallback((profId, servico) => {
    setProfissionais(prev => prev.map(p => {
      if (p.id !== profId) return p;
      return { ...p, servicos: p.servicos.filter(s => s !== servico) };
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
