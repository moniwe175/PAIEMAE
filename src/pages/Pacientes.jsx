import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLocation } from 'react-router-dom';
import {
  Users, Plus, Search, Phone, Calendar, FileText, Star, XCircle,
  ChevronRight, Mail, Instagram, Upload, Trash2, AlertTriangle,
  RefreshCw, UserCheck, UserPlus, Clock, Sparkles, TrendingUp,
  Share2, PieChart as PieIcon, ArrowRight
} from 'lucide-react';
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Legend
} from 'recharts';
import { fetchClients, insertClient, deleteClient, updateClient, fetchAppointments } from '../services/supabaseService';
import { getCurrentUser, supabase } from '../lib/supabase';

// ─── Search helpers ──────────────────────────────────────────
function normalizeSearchText(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function getPhoneticKey(str) {
  return normalizeSearchText(str)
    .replace(/z/g, 's')
    .replace(/c([ei])/g, 's$1')
    .replace(/ç/g, 's');
}

function scoreClientMatch(clientName, clientPhone, rawQuery) {
  if (!rawQuery) return 0;
  const q = normalizeSearchText(rawQuery);
  if (!q) return 0;

  const qPhonetic = getPhoneticKey(rawQuery);
  const nameNorm = normalizeSearchText(clientName);
  const namePhonetic = getPhoneticKey(clientName);
  const phoneNorm = (clientPhone || '').replace(/\D/g, '');
  const qPhone = rawQuery.replace(/\D/g, '');

  if (nameNorm === q) return 1000;
  if (nameNorm.startsWith(q)) return 900;

  const wordsNorm = nameNorm.split(/\s+/);
  if (wordsNorm.some(w => w.startsWith(q))) return 800;

  if (namePhonetic.startsWith(qPhonetic)) return 700;
  const wordsPhonetic = namePhonetic.split(/\s+/);
  if (wordsPhonetic.some(w => w.startsWith(qPhonetic))) return 600;

  if (nameNorm.includes(q)) return 500;
  if (namePhonetic.includes(qPhonetic)) return 400;

  if (qPhone && phoneNorm.includes(qPhone)) return 300;

  return 0;
}

// ─── Format helpers ───────────────────────────────────────────
const formatBRL = (val) =>
  `R$ ${(Number(val) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// ─── Channel options and colors ───────────────────────────────
const CANAIS_AQUISICAO = [
  'Instagram',
  'Indicação',
  'Google',
  'Passou na rua',
  'WhatsApp / Motor',
  'Outro',
];

const CANAL_COLORS = {
  'Instagram': '#E1306C',
  'Indicação': '#10B981',
  'Google': '#4285F4',
  'Passou na rua': '#F59E0B',
  'WhatsApp / Motor': '#25D366',
  'Outro': '#8B5CF6',
};

// ─── Modal Novo / Editar Paciente ─────────────────────────────
function PacienteModal({ onClose, onSave, initialData }) {
  const [form, setForm] = useState(
    initialData || {
      nome: '',
      telefone: '',
      email: '',
      instagram: '',
      nascimento: '',
      cidade: '',
      origem: 'Instagram',
      obs: '',
    }
  );
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSave = () => {
    if (!form.nome) {
      alert('Por favor, preencha o nome do paciente.');
      return;
    }
    onSave(form);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">{initialData ? 'Editar Paciente' : 'Novo Paciente'}</span>
          <button className="modal-close" onClick={onClose}>
            <XCircle />
          </button>
        </div>
        <div className="form-grid-2">
          <div className="form-group" style={{ gridColumn: 'span 2' }}>
            <label className="form-label">Nome completo *</label>
            <input
              className="form-input"
              placeholder="Nome do paciente"
              value={form.nome}
              onChange={(e) => set('nome', e.target.value)}
              autoFocus
            />
          </div>
          <div className="form-group">
            <label className="form-label">Telefone *</label>
            <input
              className="form-input"
              placeholder="(11) 99999-9999"
              value={form.telefone}
              onChange={(e) => set('telefone', e.target.value)}
            />
          </div>
          <div className="form-group">
            <label className="form-label">E-mail</label>
            <input
              className="form-input"
              type="email"
              placeholder="email@exemplo.com"
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Instagram</label>
            <input
              className="form-input"
              placeholder="@usuario"
              value={form.instagram}
              onChange={(e) => set('instagram', e.target.value)}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Nascimento</label>
            <input
              className="form-input"
              type="date"
              value={form.nascimento}
              onChange={(e) => set('nascimento', e.target.value)}
            />
          </div>

          {/* 5. Origem do Cliente (Canal de Aquisição) */}
          <div className="form-group" style={{ gridColumn: 'span 2' }}>
            <label className="form-label">
              Origem do Cliente (Como nos conheceu?) *
            </label>
            <select
              className="form-input"
              value={form.origem || 'Instagram'}
              onChange={(e) => set('origem', e.target.value)}
              style={{ fontWeight: 600, color: 'var(--text-dark)' }}
            >
              {CANAIS_AQUISICAO.map((canal) => (
                <option key={canal} value={canal}>
                  {canal === 'Indicação' ? '⭐ Indicação de Amigo/Cliente' : canal}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group" style={{ gridColumn: 'span 2', display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="checkbox"
              id="whatsapp_opt_out"
              checked={!!form.whatsapp_opt_out}
              onChange={(e) => set('whatsapp_opt_out', e.target.checked)}
              style={{ width: 15, height: 15, cursor: 'pointer' }}
            />
            <label htmlFor="whatsapp_opt_out" style={{ fontSize: 12.5, cursor: 'pointer' }}>
              Não enviar mensagens automáticas de WhatsApp (opt-out LGPD)
            </label>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
          <button className="btn btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn btn-primary" onClick={handleSave}>
            Salvar Paciente
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Componente Principal Pacientes ───────────────────────────
export default function Pacientes() {
  const { canEdit } = useAuth();
  const location = useLocation();
  const [pacientes, setPacientes] = useState([]);
  const [allAppointments, setAllAppointments] = useState([]);
  const [modal, setModal] = useState(false);
  const [editModal, setEditModal] = useState(null);
  const [deleteModal, setDeleteModal] = useState(null);
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState('Todos'); // 'Todos' | 'Ativo' | 'Inativo' | 'Novo' | 'Risco'
  const [selected, setSelected] = useState(null);
  const [servicos, setServicos] = useState([]);

  // Período de Análise de Retenção & Recorrência: '30d' | '60d' | '90d'
  const [periodoRetencao, setPeriodoRetencao] = useState('60d');

  // Dias sem retorno para churn: padrão 60 dias
  const [churnDiasLimite, setChurnDiasLimite] = useState(60);

  // Calcula quantos dias o serviço está atrasado em relação ao prazo ideal
  function calcDiasAtraso(nomeServico, dataIso) {
    if (!dataIso || !nomeServico || !servicos || servicos.length === 0) return null;
    const n = normalizeSearchText(nomeServico);
    const svc = servicos.find((s) => {
      if (!s.nome) return false;
      const sn = normalizeSearchText(s.nome);
      return sn === n || sn.includes(n) || n.includes(sn);
    });
    if (!svc || !svc.dias_para_retorno || Number(svc.dias_para_retorno) <= 0) return null;

    const parts = String(dataIso).slice(0, 10).split('-');
    if (parts.length < 3) return null;
    const apptDate = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    apptDate.setHours(0, 0, 0, 0);

    const diffDays = Math.floor((today.getTime() - apptDate.getTime()) / 86400000);
    const prazo = Number(svc.dias_para_retorno);
    const atraso = diffDays - prazo;

    return {
      atraso,
      diasPassados: diffDays,
      prazo,
      isAtrasado: atraso > 0,
      servicoNome: svc.nome,
    };
  }

  // Load fresh data from Supabase on mount
  useEffect(() => {
    async function load() {
      const [clientsRes, apptsRes, svcRes] = await Promise.all([
        fetchClients(),
        fetchAppointments(),
        supabase.from('servicos').select('nome, dias_para_retorno').eq('ativo', true),
      ]);
      const data = clientsRes.data;
      const appts = apptsRes.data || [];
      setAllAppointments(appts);
      if (svcRes.data) setServicos(svcRes.data);

      if (data) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const mapped = data.map((item) => {
          const clientAppts = appts.filter(
            (a) =>
              (a.client_name && item.name && a.client_name.trim().toLowerCase() === item.name.trim().toLowerCase()) &&
              a.status === 'finalizado'
          );
          clientAppts.sort((a, b) => new Date(b.appointment_date) - new Date(a.appointment_date));

          let ultimaVisita = item.last_visit ? item.last_visit.split('-').reverse().join('/') : 'Nunca';
          let ultimaVisitaIso = item.last_visit || null;
          let diasSemVisita = null;

          if (clientAppts.length > 0) {
            ultimaVisita = clientAppts[0].appointment_date.split('-').reverse().join('/');
            ultimaVisitaIso = clientAppts[0].appointment_date;
          }

          if (ultimaVisitaIso) {
            const parts = String(ultimaVisitaIso).slice(0, 10).split('-');
            if (parts.length === 3) {
              const dt = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
              diasSemVisita = Math.floor((today.getTime() - dt.getTime()) / 86400000);
            }
          }

          // 3. Intervalo Médio entre Visitas
          const sortedAsc = [...clientAppts].sort((a, b) => new Date(a.appointment_date) - new Date(b.appointment_date));
          let tempoMedioDias = null;
          if (sortedAsc.length >= 2) {
            let totalDiff = 0;
            for (let i = 1; i < sortedAsc.length; i++) {
              const d1 = new Date(sortedAsc[i - 1].appointment_date + 'T00:00:00');
              const d2 = new Date(sortedAsc[i].appointment_date + 'T00:00:00');
              totalDiff += Math.max(1, (d2 - d1) / 86400000);
            }
            tempoMedioDias = Math.round(totalDiff / (sortedAsc.length - 1));
          }

          const totalSessoes = clientAppts.length > 0 ? clientAppts.length : (item.points || 0);

          let calculadoGasto = clientAppts.reduce((acc, a) => {
            let v = 0;
            try {
              if (a.notes && a.notes.startsWith('{')) {
                v = Number(JSON.parse(a.notes).valor) || 0;
              }
            } catch (e) {}
            return acc + v;
          }, 0);
          const totalGasto = clientAppts.length > 0 ? calculadoGasto : (Number(item.total_spent) || 0);

          const historicoPaciente = clientAppts.map((a) => {
            let v = 0;
            try {
              if (a.notes && a.notes.startsWith('{')) {
                v = Number(JSON.parse(a.notes).valor) || 0;
              }
            } catch (e) {}
            return {
              dataIso: a.appointment_date || '',
              data: a.appointment_date ? a.appointment_date.split('-').reverse().join('/') : '',
              servico: a.procedure || 'Sessão',
              valor: v,
            };
          });

          // 2. Churn Risk status: sem visita há mais de 60 dias ou inativo
          const isEmRisco = (diasSemVisita !== null && diasSemVisita >= 60) || item.status === 'inativo';

          return {
            id: item.id,
            nome: item.name || '',
            telefone: item.phone || '',
            email: item.email || '',
            instagram: item.instagram || '',
            cidade: 'Não informada',
            nascimento: item.birthdate ? item.birthdate.split('-').reverse().join('/') : '',
            origem: item.source || 'Instagram',
            ultimaVisita,
            ultimaVisitaIso,
            diasSemVisita,
            isEmRisco,
            tempoMedioDias,
            totalSessoes,
            totalGasto,
            status: item.status || 'ativo',
            whatsapp_opt_out: !!item.whatsapp_opt_out,
            avatar: item.avatar || (item.name ? item.name.charAt(0).toUpperCase() : 'U'),
            historico: historicoPaciente,
            createdAt: item.created_at || new Date().toISOString(),
          };
        });
        setPacientes(mapped);
      }
    }
    load();
  }, []);

  // Auto-select patient if navigated from Agenda
  useEffect(() => {
    if (pacientes.length > 0) {
      const targetName = location.state?.selectedPaciente || new URLSearchParams(location.search).get('paciente');
      if (targetName) {
        const targetClean = targetName.trim().toLowerCase();
        const found = pacientes.find((p) => {
          const pName = (p.nome || '').trim().toLowerCase();
          return pName === targetClean || pName.includes(targetClean) || targetClean.includes(pName);
        });
        if (found) setSelected(found);
      }
    }
  }, [pacientes, location]);

  const cleanAndTitleCaseName = (name) => {
    if (!name) return '';
    const cleaned = name.replace(/^["']|["']$/g, '').trim();
    return cleaned
      .toLowerCase()
      .split(' ')
      .filter((word) => word.length > 0)
      .map((word) => {
        const lowercases = ['de', 'da', 'do', 'dos', 'das', 'e'];
        if (lowercases.includes(word)) return word;
        return word.charAt(0).toUpperCase() + word.slice(1);
      })
      .join(' ');
  };

  const handleSaveNovoPaciente = async (formData) => {
    const currentUser = await getCurrentUser();
    const clientData = {
      name: cleanAndTitleCaseName(formData.nome),
      phone: formData.telefone || '(00) 00000-0000',
      email: formData.email || '',
      instagram: formData.instagram || '',
      birthdate: formData.nascimento || null,
      source: formData.origem || 'Instagram',
      status: 'ativo',
      avatar: formData.nome.charAt(0).toUpperCase(),
      total_spent: 0,
      points: 0,
      user_id: currentUser?.id,
    };

    const { data, error } = await insertClient(clientData);
    if (error) {
      alert('Erro ao salvar paciente no banco de dados: ' + (error.message || error));
      return;
    }

    if (data) {
      const novo = {
        id: data.id,
        nome: data.name,
        telefone: data.phone,
        email: data.email,
        instagram: data.instagram || '',
        cidade: 'Não informada',
        nascimento: data.birthdate ? data.birthdate.split('-').reverse().join('/') : '',
        origem: data.source || 'Instagram',
        ultimaVisita: 'Nunca',
        diasSemVisita: null,
        isEmRisco: false,
        tempoMedioDias: null,
        totalSessoes: data.points || 0,
        totalGasto: Number(data.total_spent) || 0,
        status: data.status,
        avatar: data.avatar,
        historico: [],
        createdAt: data.created_at || new Date().toISOString(),
      };
      setPacientes((prev) => [...prev, novo]);
    }
    setModal(false);
  };

  const handleSaveEditPaciente = async (formData) => {
    const clientData = {
      name: cleanAndTitleCaseName(formData.nome),
      phone: formData.telefone || '(00) 00000-0000',
      email: formData.email || '',
      instagram: formData.instagram || '',
      birthdate: formData.nascimento || null,
      source: formData.origem || 'Instagram',
      avatar: formData.nome.charAt(0).toUpperCase(),
      whatsapp_opt_out: !!formData.whatsapp_opt_out,
    };

    const { data, error } = await updateClient(editModal.id, clientData);
    if (error) {
      alert('Erro ao atualizar paciente no banco de dados: ' + (error.message || error));
      return;
    }

    if (data) {
      setPacientes((prev) =>
        prev.map((p) => {
          if (p.id === editModal.id) {
            const updated = {
              ...p,
              nome: data.name,
              telefone: data.phone,
              email: data.email,
              instagram: data.instagram || '',
              origem: data.source || 'Instagram',
              nascimento: data.birthdate ? data.birthdate.split('-').reverse().join('/') : '',
              avatar: data.avatar,
            };
            if (selected && selected.id === updated.id) {
              setSelected(updated);
            }
            return updated;
          }
          return p;
        })
      );
    }
    setEditModal(null);
  };

  const handleDeletePaciente = async (id) => {
    const { error } = await deleteClient(id);
    if (error) {
      alert('Erro ao excluir paciente no banco de dados: ' + (error.message || error));
      return;
    }
    setPacientes((prev) => prev.filter((p) => p.id !== id));
    if (selected && selected.id === id) setSelected(null);
    setDeleteModal(null);
  };

  const isNovo = (createdAt) => {
    if (!createdAt) return false;
    const date = new Date(createdAt);
    const now = new Date();
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  };

  // ─── 1. Taxa de Retenção (30d / 60d / 90d) ───────────────────
  const retencaoStats = useMemo(() => {
    const days = periodoRetencao === '30d' ? 30 : periodoRetencao === '90d' ? 90 : 60;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = cutoff.toISOString().split('T')[0];

    const visitsInPeriod = allAppointments.filter(
      (a) => a.appointment_date >= cutoffStr && a.status === 'finalizado'
    );

    const clientVisitCounts = {};
    visitsInPeriod.forEach((a) => {
      const name = (a.client_name || '').trim().toLowerCase();
      if (!name) return;
      clientVisitCounts[name] = (clientVisitCounts[name] || 0) + 1;
    });

    const totalAtendidos = Object.keys(clientVisitCounts).length;
    const retornaram = Object.values(clientVisitCounts).filter((c) => c >= 2).length;
    const taxa = totalAtendidos > 0 ? Math.round((retornaram / totalAtendidos) * 100) : 0;

    return {
      taxa,
      retornaram,
      totalAtendidos,
      days,
    };
  }, [allAppointments, periodoRetencao]);

  // ─── 2. Churn Rate (Clientes inativos > X dias) ─────────────
  const churnStats = useMemo(() => {
    const comHistorico = pacientes.filter((p) => p.ultimaVisita !== 'Nunca');
    const emRisco = comHistorico.filter((p) => p.diasSemVisita !== null && p.diasSemVisita >= churnDiasLimite);
    const taxa = comHistorico.length > 0 ? Math.round((emRisco.length / comHistorico.length) * 100) : 0;

    return {
      taxa,
      emRiscoQtd: emRisco.length,
      totalComHistorico: comHistorico.length,
    };
  }, [pacientes, churnDiasLimite]);

  // ─── 3. Frequência / Tempo Médio Geral da Clínica ────────────
  const tempoMedioGeralClinica = useMemo(() => {
    const comIntervalo = pacientes.filter((p) => p.tempoMedioDias !== null && p.tempoMedioDias > 0);
    if (comIntervalo.length === 0) return 0;
    const soma = comIntervalo.reduce((acc, p) => acc + p.tempoMedioDias, 0);
    return Math.round(soma / comIntervalo.length);
  }, [pacientes]);

  // ─── 4. Novos vs Recorrentes (e Faturamento) ─────────────────
  const novosVsRecorrentes = useMemo(() => {
    const days = periodoRetencao === '30d' ? 30 : periodoRetencao === '90d' ? 90 : 60;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = cutoff.toISOString().split('T')[0];

    // Agrupamento de agendamentos finalizados no período
    const apptsPeriodo = allAppointments.filter((a) => a.appointment_date >= cutoffStr && a.status === 'finalizado');

    let faturamentoNovos = 0;
    let faturamentoRecorrentes = 0;
    const setNovos = new Set();
    const setRecorrentes = new Set();

    apptsPeriodo.forEach((a) => {
      const name = (a.client_name || '').trim().toLowerCase();
      if (!name) return;

      let v = 0;
      try {
        if (a.notes && a.notes.startsWith('{')) v = Number(JSON.parse(a.notes).valor) || 0;
      } catch (e) {}

      // Verifica se o cliente tem agendamentos ANTERIORES ao cutoffStr
      const temHistoricoAnterior = allAppointments.some(
        (prevApt) =>
          prevApt.client_name &&
          prevApt.client_name.trim().toLowerCase() === name &&
          prevApt.status === 'finalizado' &&
          prevApt.appointment_date < cutoffStr
      );

      if (temHistoricoAnterior) {
        setRecorrentes.add(name);
        faturamentoRecorrentes += v;
      } else {
        setNovos.add(name);
        faturamentoNovos += v;
      }
    });

    const totalFat = faturamentoNovos + faturamentoRecorrentes;
    const pctNovos = totalFat > 0 ? (faturamentoNovos / totalFat) * 100 : 0;
    const pctRecorrentes = totalFat > 0 ? (faturamentoRecorrentes / totalFat) * 100 : 0;

    return {
      qtdNovos: setNovos.size,
      qtdRecorrentes: setRecorrentes.size,
      faturamentoNovos,
      faturamentoRecorrentes,
      totalFat,
      pctNovos,
      pctRecorrentes,
    };
  }, [allAppointments, periodoRetencao]);

  // ─── 5. Origem do Cliente (Distribuição por Canal) ───────────
  const canaisData = useMemo(() => {
    const map = {};
    CANAIS_AQUISICAO.forEach((c) => (map[c] = 0));

    pacientes.forEach((p) => {
      const orig = p.origem || 'Instagram';
      map[orig] = (map[orig] || 0) + 1;
    });

    const total = pacientes.length;
    const list = Object.entries(map).map(([name, value]) => ({
      name,
      value,
      pct: total > 0 ? (value / total) * 100 : 0,
      color: CANAL_COLORS[name] || '#6B7280',
    }));

    return list.filter((i) => i.value > 0);
  }, [pacientes]);

  // ─── 6. Taxa de Indicação ────────────────────────────────────
  const indicacaoStats = useMemo(() => {
    const indicados = pacientes.filter((p) => (p.origem || '').toLowerCase().includes('indica')).length;
    const total = pacientes.length;
    const taxa = total > 0 ? Math.round((indicados / total) * 100) : 0;
    return { indicados, total, taxa };
  }, [pacientes]);

  // ─── Filtro e Busca ──────────────────────────────────────────
  const filtrados = useMemo(() => {
    let list = pacientes;

    if (busca.trim()) {
      const scored = list
        .map((p) => ({
          paciente: p,
          score: scoreClientMatch(p.nome, p.telefone, busca),
        }))
        .filter((item) => item.score > 0);

      scored.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return (a.paciente.nome || '').localeCompare(b.paciente.nome || '', 'pt-BR');
      });

      list = scored.map((item) => item.paciente);
    }

    return list.filter((p) => {
      const novo = isNovo(p.createdAt);
      if (filtro === 'Novo') return novo;
      if (filtro === 'Ativo') return p.status === 'ativo' && !novo && !p.isEmRisco;
      if (filtro === 'Inativo') return p.status === 'inativo' || p.isEmRisco;
      if (filtro === 'Risco') return p.isEmRisco;
      return true;
    });
  }, [pacientes, busca, filtro]);

  return (
    <div>
      {/* Header */}
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div className="page-header-label">
            <Users />
            PACIENTES E FIDELIZAÇÃO
          </div>
          <h1 className="page-title">Pacientes</h1>
          <p className="page-subtitle">{pacientes.length} pacientes cadastrados na clínica</p>
        </div>
        <div className="content-header" style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={() => document.getElementById('import-csv')?.click()}>
            <Upload style={{ width: 15, height: 15 }} />
            Importar Planilha
          </button>
          <input type="file" accept=".csv" style={{ display: 'none' }} id="import-csv" onChange={() => {}} />
          {canEdit('pacientes') && (
            <button className="btn btn-primary" onClick={() => setModal(true)}>
              <Plus style={{ width: 15, height: 15 }} />
              Novo Paciente
            </button>
          )}
        </div>
      </div>

      {/* Modais */}
      {modal && <PacienteModal onClose={() => setModal(false)} onSave={handleSaveNovoPaciente} />}
      {editModal && (
        <PacienteModal
          onClose={() => setEditModal(null)}
          onSave={handleSaveEditPaciente}
          initialData={{
            nome: editModal.nome,
            telefone: editModal.telefone,
            email: editModal.email,
            instagram: editModal.instagram,
            origem: editModal.origem || 'Instagram',
            nascimento: editModal.nascimento ? editModal.nascimento.split('/').reverse().join('-') : '',
            cidade: editModal.cidade,
            whatsapp_opt_out: !!editModal.whatsapp_opt_out,
            obs: '',
          }}
        />
      )}
      {deleteModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,20,30,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 11000, backdropFilter: 'blur(6px)', padding: 16 }} onClick={() => setDeleteModal(null)}>
          <div style={{ background: '#fff', borderRadius: 22, width: '100%', maxWidth: 400, boxShadow: '0 32px 80px rgba(0,0,0,0.25)', padding: '24px 24px' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                <AlertTriangle style={{ width: 28, height: 28, color: '#DC2626' }} />
              </div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#111827', marginBottom: 12 }}>Excluir Paciente</div>
              <div style={{ fontSize: 14, color: '#4B5563', marginBottom: 24 }}>
                Deseja realmente excluir o paciente <strong>"{deleteModal.nome}"</strong>?
              </div>
              <div style={{ display: 'flex', gap: 12, width: '100%' }}>
                <button onClick={() => setDeleteModal(null)} style={{ flex: 1, padding: '12px 0', borderRadius: 12, border: '1.5px solid #E5E7EB', background: '#fff', fontSize: 14, fontWeight: 600, color: '#374151', cursor: 'pointer' }}>
                  Voltar
                </button>
                <button onClick={() => handleDeletePaciente(deleteModal.id)} style={{ flex: 1, padding: '12px 0', borderRadius: 12, border: 'none', background: '#DC2626', fontSize: 14, fontWeight: 600, color: '#fff', cursor: 'pointer' }}>
                  Excluir
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── 1. Top KPI Cards (Taxa de Retenção, Churn, Tempo Médio, Indicação) ─── */}
      <div className="grid-4 section-gap">
        {/* 1. Taxa de Retenção */}
        <div className="stat-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <div className="stat-card-icon" style={{ background: '#ECFDF5', margin: 0 }}>
                <RefreshCw style={{ color: '#10B981', width: 20, height: 20 }} />
              </div>
              <div style={{ display: 'inline-flex', background: 'var(--bg-main, #F4F5F7)', padding: 2, borderRadius: 6, border: '1px solid var(--border-light)' }}>
                {['30d', '60d', '90d'].map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPeriodoRetencao(p)}
                    style={{
                      border: 'none',
                      background: periodoRetencao === p ? 'var(--bg-card, #fff)' : 'transparent',
                      color: periodoRetencao === p ? 'var(--text-dark)' : 'var(--text-muted)',
                      fontWeight: periodoRetencao === p ? 700 : 500,
                      fontSize: 10,
                      padding: '2px 6px',
                      borderRadius: 4,
                      cursor: 'pointer',
                    }}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
            <div className="stat-value" style={{ color: '#10B981' }}>
              {retencaoStats.taxa}%
            </div>
            <div className="stat-label">Taxa de Retenção ({periodoRetencao})</div>
          </div>
          <div className="stat-sub" style={{ marginTop: 6 }}>
            {retencaoStats.retornaram} de {retencaoStats.totalAtendidos} clientes retornaram
          </div>
        </div>

        {/* 2. Churn Rate */}
        <div className="stat-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <div className="stat-card-icon" style={{ background: '#FEE2E2', margin: 0 }}>
                <AlertTriangle style={{ color: '#DC2626', width: 20, height: 20 }} />
              </div>
              <span className="stat-badge down" style={{ fontSize: 10 }}>
                &gt;{churnDiasLimite}d sem visita
              </span>
            </div>
            <div className="stat-value" style={{ color: churnStats.taxa > 30 ? '#DC2626' : 'var(--text-dark)' }}>
              {churnStats.taxa}%
            </div>
            <div className="stat-label">Churn Rate (Risco de Perda)</div>
          </div>
          <div className="stat-sub" style={{ marginTop: 6, color: '#DC2626', fontWeight: 600 }}>
            {churnStats.emRiscoQtd} cliente(s) em risco de churn
          </div>
        </div>

        {/* 3. Tempo Médio entre Visitas */}
        <div className="stat-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <div className="stat-card-icon" style={{ background: '#EFF6FF', margin: 0 }}>
                <Clock style={{ color: '#3B82F6', width: 20, height: 20 }} />
              </div>
            </div>
            <div className="stat-value" style={{ color: '#3B82F6' }}>
              {tempoMedioGeralClinica > 0 ? `${tempoMedioGeralClinica} dias` : '—'}
            </div>
            <div className="stat-label">Tempo Médio entre Visitas</div>
          </div>
          <div className="stat-sub" style={{ marginTop: 6 }}>
            frequência média dos clientes recorrentes
          </div>
        </div>

        {/* 6. Taxa de Indicação */}
        <div className="stat-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <div className="stat-card-icon" style={{ background: '#FDF4F7', margin: 0 }}>
                <Sparkles style={{ color: 'var(--color-primary, #C73B6D)', width: 20, height: 20 }} />
              </div>
            </div>
            <div className="stat-value" style={{ color: 'var(--color-primary, #C73B6D)' }}>
              {indicacaoStats.taxa}%
            </div>
            <div className="stat-label">Taxa de Indicação</div>
          </div>
          <div className="stat-sub" style={{ marginTop: 6 }}>
            {indicacaoStats.indicados} de {indicacaoStats.total} vieram por indicação
          </div>
        </div>
      </div>

      {/* ─── 4 & 5. Gráficos de Canais de Aquisição & Novos vs Recorrentes ─── */}
      <div className="grid-2 section-gap">
        {/* 5. Origem do Cliente (Canal de Aquisição) */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">
              <Share2 style={{ color: '#8B5CF6' }} />
              Origem dos Clientes (Canais de Aquisição)
            </span>
          </div>

          {canaisData.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 16, alignItems: 'center' }}>
              <div style={{ height: 160 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={canaisData} cx="50%" cy="50%" innerRadius={42} outerRadius={68} dataKey="value" paddingAngle={3}>
                      {canaisData.map((entry, idx) => (
                        <Cell key={idx} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => [`${v} clientes`, 'Quantidade']} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {canaisData.map((c) => (
                  <div key={c.name} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 500 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: c.color }} />
                        {c.name}
                      </span>
                      <span style={{ fontWeight: 700, color: 'var(--text-dark)' }}>
                        {c.value} ({c.pct.toFixed(0)}%)
                      </span>
                    </div>
                    <div style={{ width: '100%', height: 4, background: 'var(--border-light)', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{ width: `${c.pct}%`, height: '100%', background: c.color, borderRadius: 99 }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)' }}>
              Nenhum dado de origem cadastrado
            </div>
          )}
        </div>

        {/* 4. Novos Clientes vs Clientes Recorrentes */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">
              <UserCheck style={{ color: 'var(--success)' }} />
              Novos Clientes vs Recorrentes ({periodoRetencao})
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Barra comparativa de faturamento */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
                <span>
                  <strong>Novos:</strong> {novosVsRecorrentes.qtdNovos} ({formatBRL(novosVsRecorrentes.faturamentoNovos)})
                </span>
                <span>
                  <strong>Recorrentes:</strong> {novosVsRecorrentes.qtdRecorrentes} ({formatBRL(novosVsRecorrentes.faturamentoRecorrentes)})
                </span>
              </div>
              <div style={{ width: '100%', height: 12, background: 'var(--border-light)', borderRadius: 99, overflow: 'hidden', display: 'flex' }}>
                <div
                  style={{
                    width: `${novosVsRecorrentes.pctNovos}%`,
                    height: '100%',
                    background: '#0284C7',
                    transition: 'width 0.4s ease',
                  }}
                  title={`Novos: ${novosVsRecorrentes.pctNovos.toFixed(1)}%`}
                />
                <div
                  style={{
                    width: `${novosVsRecorrentes.pctRecorrentes}%`,
                    height: '100%',
                    background: '#10B981',
                    transition: 'width 0.4s ease',
                  }}
                  title={`Recorrentes: ${novosVsRecorrentes.pctRecorrentes.toFixed(1)}%`}
                />
              </div>
            </div>

            {/* Cards de Resumo */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ background: '#F0F9FF', padding: 12, borderRadius: 10, border: '1px solid #BAE6FD' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#0284C7', fontSize: 11, fontWeight: 700, marginBottom: 4 }}>
                  <UserPlus style={{ width: 14, height: 14 }} />
                  PRIMEIRA VISITA (NOVOS)
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#0369A1' }}>
                  {formatBRL(novosVsRecorrentes.faturamentoNovos)}
                </div>
                <div style={{ fontSize: 11, color: '#0284C7', marginTop: 2 }}>
                  {novosVsRecorrentes.qtdNovos} pacientes ({novosVsRecorrentes.pctNovos.toFixed(1)}% da receita)
                </div>
              </div>

              <div style={{ background: '#ECFDF5', padding: 12, borderRadius: 10, border: '1px solid #A7F3D0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#059669', fontSize: 11, fontWeight: 700, marginBottom: 4 }}>
                  <RefreshCw style={{ width: 14, height: 14 }} />
                  RETORNOS (RECORRENTES)
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#047857' }}>
                  {formatBRL(novosVsRecorrentes.faturamentoRecorrentes)}
                </div>
                <div style={{ fontSize: 11, color: '#059669', marginTop: 2 }}>
                  {novosVsRecorrentes.qtdRecorrentes} pacientes ({novosVsRecorrentes.pctRecorrentes.toFixed(1)}% da receita)
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Listagem de Pacientes com Filtros e Alerta de Churn ───── */}
      <div style={{ display: 'flex', gap: 16 }}>
        <div style={{ flex: 1 }}>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              <div className="search-box" style={{ flex: 1, minWidth: 220 }}>
                <Search />
                <input className="search-input" placeholder="Buscar paciente por nome ou telefone..." value={busca} onChange={(e) => setBusca(e.target.value)} />
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {[
                  { k: 'Todos', l: 'Todos' },
                  { k: 'Ativo', l: 'Ativos' },
                  { k: 'Novo', l: 'Novos' },
                  { k: 'Risco', l: '⚠️ Em Risco de Churn' },
                  { k: 'Inativo', l: 'Inativos' },
                ].map((f) => (
                  <button
                    key={f.k}
                    onClick={() => setFiltro(f.k)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 20,
                      border: '1px solid',
                      borderColor:
                        filtro === f.k
                          ? f.k === 'Risco'
                            ? '#DC2626'
                            : 'var(--color-primary)'
                          : 'var(--border-color)',
                      background:
                        filtro === f.k
                          ? f.k === 'Risco'
                            ? '#DC2626'
                            : 'var(--color-primary)'
                          : '#fff',
                      color:
                        filtro === f.k
                          ? '#fff'
                          : f.k === 'Risco'
                          ? '#DC2626'
                          : 'var(--text-medium)',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                  >
                    {f.l}
                  </button>
                ))}
              </div>
            </div>

            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Paciente</th>
                    <th>Telefone</th>
                    <th>Origem</th>
                    <th>Última Visita</th>
                    <th style={{ textAlign: 'center' }}>Intervalo Médio</th>
                    <th style={{ textAlign: 'center' }}>Sessões</th>
                    <th style={{ textAlign: 'right' }}>Total Gasto</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtrados.map((p) => (
                    <tr
                      key={p.id}
                      style={{ cursor: 'pointer', background: selected?.id === p.id ? 'var(--bg-card-hover)' : '' }}
                      onClick={() => setSelected(selected?.id === p.id ? null : p)}
                    >
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div className="avatar">{p.avatar}</div>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-dark)' }}>{p.nome}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.email || 'Sem e-mail'}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ fontSize: 13, color: 'var(--text-light)' }}>{p.telefone}</td>
                      <td>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            padding: '2px 8px',
                            borderRadius: 4,
                            background: `${CANAL_COLORS[p.origem] || '#6B7280'}18`,
                            color: CANAL_COLORS[p.origem] || '#6B7280',
                          }}
                        >
                          {p.origem || 'Instagram'}
                        </span>
                      </td>
                      <td style={{ fontSize: 13 }}>
                        <span style={{ color: 'var(--text-dark)', fontWeight: 500 }}>{p.ultimaVisita}</span>
                        {p.diasSemVisita !== null && (
                          <span style={{ fontSize: 10, color: p.diasSemVisita >= 60 ? '#DC2626' : 'var(--text-muted)', display: 'block' }}>
                            há {p.diasSemVisita} dia(s)
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: 'center', fontSize: 12 }}>
                        {p.tempoMedioDias ? (
                          <span style={{ fontWeight: 600, color: '#3B82F6' }}>{p.tempoMedioDias} dias</span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>1ª visita</span>
                        )}
                      </td>
                      <td style={{ fontWeight: 600, textAlign: 'center' }}>{p.totalSessoes}</td>
                      <td style={{ fontWeight: 600, color: 'var(--success)', textAlign: 'right' }}>
                        {formatBRL(p.totalGasto)}
                      </td>
                      <td>
                        {p.isEmRisco ? (
                          <span
                            className="badge"
                            style={{
                              background: '#FEE2E2',
                              color: '#DC2626',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                            }}
                            title={`Sem retorno há ${p.diasSemVisita || 60} dias`}
                          >
                            <AlertTriangle style={{ width: 10, height: 10 }} />
                            Risco Churn
                          </span>
                        ) : isNovo(p.createdAt) ? (
                          <span className="badge" style={{ background: '#E0F2FE', color: '#0284C7' }}>
                            Novo
                          </span>
                        ) : (
                          <span className={`badge ${p.status === 'ativo' ? 'badge-success' : 'badge-neutral'}`}>
                            {p.status === 'ativo' ? 'Ativo' : 'Inativo'}
                          </span>
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteModal(p);
                            }}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#ef4444',
                              cursor: 'pointer',
                              padding: '6px',
                              borderRadius: '4px',
                            }}
                            title="Excluir Paciente"
                          >
                            <Trash2 style={{ width: 15, height: 15 }} />
                          </button>
                          <ChevronRight style={{ width: 15, height: 15, color: 'var(--text-muted)' }} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ─── Drawer Perfil do Paciente ───────────────────────────── */}
        {selected && (
          <div style={{ width: 300 }}>
            <div className="card">
              <div className="card-header">
                <span className="card-title">
                  <FileText />
                  Perfil do Paciente
                </span>
                <button className="modal-close" onClick={() => setSelected(null)}>
                  <XCircle />
                </button>
              </div>
              <div style={{ textAlign: 'center', marginBottom: 16 }}>
                <div className="avatar avatar-lg" style={{ margin: '0 auto 8px' }}>
                  {selected.avatar}
                </div>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{selected.nome}</div>
                <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: 4,
                      background: `${CANAL_COLORS[selected.origem] || '#6B7280'}18`,
                      color: CANAL_COLORS[selected.origem] || '#6B7280',
                    }}
                  >
                    Origem: {selected.origem || 'Instagram'}
                  </span>
                  {selected.isEmRisco ? (
                    <span className="badge" style={{ background: '#FEE2E2', color: '#DC2626' }}>
                      ⚠️ Risco Churn
                    </span>
                  ) : (
                    <span className={`badge ${selected.status === 'ativo' ? 'badge-success' : 'badge-neutral'}`}>
                      {selected.status === 'ativo' ? 'Ativo' : 'Inativo'}
                    </span>
                  )}
                </div>
              </div>
              <div className="divider" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12.5 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', color: 'var(--text-light)' }}>
                  <Phone style={{ width: 13, height: 13 }} />
                  {selected.telefone}
                </div>
                {selected.email && (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', color: 'var(--text-light)' }}>
                    <Mail style={{ width: 13, height: 13 }} />
                    {selected.email}
                  </div>
                )}
                {selected.instagram && (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', color: 'var(--text-light)' }}>
                    <Instagram style={{ width: 13, height: 13 }} />
                    {selected.instagram}
                  </div>
                )}
                {selected.nascimento && (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', color: 'var(--text-light)' }}>
                    <Calendar style={{ width: 13, height: 13 }} />
                    {selected.nascimento}
                  </div>
                )}
              </div>
              <div className="divider" />

              {/* 3. Tempo Médio entre Visitas & Métricas do Paciente */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                <div style={{ textAlign: 'center', background: 'var(--bg-main)', borderRadius: 8, padding: '10px 6px' }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-primary)' }}>
                    {selected.totalSessoes}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Sessões Feitas</div>
                </div>
                <div style={{ textAlign: 'center', background: 'var(--bg-main)', borderRadius: 8, padding: '10px 6px' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--success)' }}>
                    {formatBRL(selected.totalGasto)}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Gasto Total</div>
                </div>
              </div>

              {/* 3. Card Intervalo Médio */}
              <div style={{ background: '#EFF6FF', borderRadius: 8, padding: '10px 12px', border: '1px solid #BFDBFE', marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#1D4ED8', fontSize: 11, fontWeight: 700 }}>
                  <Clock style={{ width: 13, height: 13 }} />
                  TEMPO MÉDIO ENTRE VISITAS
                </div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#1E40AF', marginTop: 3 }}>
                  {selected.tempoMedioDias ? `${selected.tempoMedioDias} dias` : '1ª visita (sem histórico)'}
                </div>
                <div style={{ fontSize: 10, color: '#3B82F6', marginTop: 2 }}>
                  {selected.diasSemVisita !== null ? `Última visita há ${selected.diasSemVisita} dias` : 'Nunca visitou'}
                </div>
              </div>

              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-medium)', marginBottom: 8 }}>
                Histórico de Atendimentos
              </div>
              {(selected.historico || []).map((h, i) => {
                const info = calcDiasAtraso(h.servico, h.dataIso);
                return (
                  <div key={i} className="alert-item" style={{ alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <div className="alert-item-label">{h.servico}</div>
                      <div className="alert-item-sub">{h.data}</div>
                      {info !== null && (
                        info.isAtrasado ? (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 3,
                              marginTop: 4,
                              fontSize: 10,
                              fontWeight: 700,
                              padding: '2px 7px',
                              borderRadius: 20,
                              background: '#FEE2E2',
                              color: '#DC2626',
                            }}
                          >
                            ⚠ Atrasado ({info.atraso}d)
                          </span>
                        ) : (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 3,
                              marginTop: 4,
                              fontSize: 10,
                              fontWeight: 700,
                              padding: '2px 7px',
                              borderRadius: 20,
                              background: '#DCFCE7',
                              color: '#16A34A',
                            }}
                          >
                            ✓ Em dia ({info.diasPassados}/{info.prazo}d)
                          </span>
                        )
                      )}
                    </div>
                    <div style={{ fontWeight: 700, color: 'var(--success)', fontSize: 12 }}>
                      {formatBRL(h.valor)}
                    </div>
                  </div>
                );
              })}
              {(selected.historico || []).length === 0 && (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', margin: '12px 0' }}>
                  Nenhuma sessão finalizada.
                </div>
              )}

              <div style={{ display: 'flex', gap: 6, marginTop: 14 }}>
                <button className="btn btn-secondary btn-sm" style={{ flex: 1 }} onClick={() => setEditModal(selected)}>
                  Editar
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  style={{
                    flex: 1,
                    color: '#ef4444',
                    borderColor: 'rgba(239, 68, 68, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 4,
                  }}
                  onClick={() => setDeleteModal(selected)}
                >
                  <Trash2 style={{ width: 13, height: 13 }} />
                  Excluir
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
