import { useState, useEffect } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import {
  DollarSign, Calendar, Users, AlertTriangle,
  TrendingUp, Package, ChevronRight, Clock, Star,
  Tag, CalendarCheck, Target, Edit3, Check, X
} from 'lucide-react';
import SheetSyncStatus from '../components/integration/SheetSyncStatus';
import OKRWeeklySnapshot from '../components/dashboard/OKRWeeklySnapshot';
import StickyNotesPanel from '../components/dashboard/StickyNotesPanel';
import { generateAutoNotes } from '../lib/noteAutomation';
import { useProfissionais } from '../lib/profissionais';
import { fetchStickyNotes, insertStickyNote, updateStickyNote, fetchActiveOKRTasks } from '../services/okrService';
import { fetchInventory, fetchAppointments, fetchSheetTransactionsRange, todayBRT } from '../services/supabaseService';
import { getCurrentUser } from '../lib/supabase';

// ─── Sub-components ───────────────────────────────────────────
function StatCard({ icon: Icon, iconBg, iconColor, badge, badgeClass, value, label, sub, action, children }) {
  return (
    <div className="stat-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
          <div className="stat-card-icon" style={{ background: iconBg, margin: 0 }}>
            <Icon style={{ color: iconColor }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {badge && (
              <span className={`stat-badge ${badgeClass}`}>
                <TrendingUp style={{ width: 10, height: 10 }} />
                {badge}
              </span>
            )}
            {action}
          </div>
        </div>
        <div className="stat-value">{value}</div>
        <div className="stat-label">{label}</div>
        {sub && <div className="stat-sub">{sub}</div>}
      </div>
      {children}
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        borderRadius: 8,
        padding: '8px 14px',
        boxShadow: 'var(--shadow-md)',
        fontSize: 12,
      }}>
        <p style={{ margin: 0, color: 'var(--text-muted)', marginBottom: 2 }}>{label}</p>
        <p style={{ margin: 0, fontWeight: 700, color: 'var(--text-dark)' }}>
          R$ {payload[0].value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
        </p>
      </div>
    );
  }
  return null;
};

function getWeekRangeBRT(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay(); // 0 = Dom, 1 = Seg, ..., 6 = Sab
  const diffToMon = (day === 0 ? -6 : 1) - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMon);

  const saturday = new Date(monday);
  saturday.setDate(monday.getDate() + 5);

  const fmt = (dt) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(dt);
  return {
    startStr: fmt(monday),
    endStr: fmt(saturday)
  };
}

// ─── Dashboard ────────────────────────────────────────────────
export default function Dashboard() {
  const { profissionais } = useProfissionais();
  const [manualNotes, setManualNotes] = useState([]);
  const [okrTasks, setOkrTasks] = useState([]);
  const [okrCycle, setOkrCycle] = useState(null);
  const [stockAlerts, setStockAlerts] = useState([]);
  const [allAppointments, setAllAppointments] = useState([]);
  const [todayAppointments, setTodayAppointments] = useState([]);
  const [sheetTx, setSheetTx] = useState([]); // receitas reais da planilha (sheet_transactions)
  const [ocupacaoPeriodo, setOcupacaoPeriodo] = useState('hoje'); // 'hoje' | 'semana'

  // Meta Mensal Configurável
  const [metaMensal, setMetaMensal] = useState(() => {
    const saved = localStorage.getItem('erp_meta_mensal');
    return saved ? Number(saved) || 10000 : 10000;
  });
  const [showMetaModal, setShowMetaModal] = useState(false);
  const [tempMeta, setTempMeta] = useState('');

  useEffect(() => {
    async function loadNotes() {
      const { data } = await fetchStickyNotes();
      if (data) setManualNotes(data);
    }
    async function loadStock() {
      const { data } = await fetchInventory();
      if (data) {
        const alerts = data
          .map(p => ({ ...p, estoque: Number(p.estoque)||0, minimo: Number(p.minimo)||0 }))
          .filter(p => p.estoque <= p.minimo)
          .map(p => ({ nome: p.nome, lote: p.fornecedor || '', estoque: p.estoque, minimo: p.minimo }));
        setStockAlerts(alerts);
      }
    }
    async function loadAppointmentsData() {
      const { data } = await fetchAppointments();
      if (data) {
        setAllAppointments(data);
        const todayStr = new Date().toISOString().split('T')[0];
        const todayApts = data
          .filter(a => a.appointment_date === todayStr)
          .map(a => ({
            hora: a.appointment_time || '',
            paciente: a.client_name || '',
            servico: a.service_name || '',
            status: a.status || 'aguardando',
          }));
        setTodayAppointments(todayApts);
      }
    }
    async function loadOKRTasks() {
      const { data, cycle } = await fetchActiveOKRTasks();
      setOkrTasks(data || []);
      setOkrCycle(cycle || null);
    }
    async function loadRevenue() {
      // Cobre o mês atual e os últimos 7 dias de uma vez
      const hoje = todayBRT();
      const d7 = new Date();
      d7.setDate(d7.getDate() - 6);
      const fmt = (dt) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(dt);
      const start7 = fmt(d7);
      const startMes = `${hoje.slice(0, 7)}-01`;
      const start = startMes < start7 ? startMes : start7;
      const { data } = await fetchSheetTransactionsRange(start, hoje);
      if (data) setSheetTx(data);
    }
    loadNotes();
    loadStock();
    loadAppointmentsData();
    loadOKRTasks();
    loadRevenue();
  }, []);

  const today = new Date();
  const diaSemana = today.toLocaleDateString('pt-BR', { weekday: 'long' });
  const dataBr = today.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  // Compute real stats from sheet_transactions (mesma fonte dos Relatórios)
  const hoje = todayBRT();
  const startMes = `${hoje.slice(0, 7)}-01`;
  const gross = (r) => Number(r.gross) || 0;
  const fmtBRT = (dt) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(dt);

  const txMes = sheetTx.filter(r => r.date_ref >= startMes);
  const faturamentoMes = txMes.reduce((sum, r) => sum + gross(r), 0);

  const txHoje = sheetTx.filter(r => r.date_ref === hoje);
  const faturamentoHoje = txHoje.reduce((sum, r) => sum + gross(r), 0);

  // Unique active patients count (clientes com receita no mês)
  const activePatients = new Set(txMes.filter(r => r.client).map(r => r.client)).size;

  // 1. Ticket Médio
  const totalSessoesMes = txMes.length || allAppointments.filter(a => a.appointment_date >= startMes && a.status !== 'bloqueado' && a.status !== 'cancelado').length || 0;
  const ticketMedio = totalSessoesMes > 0 ? (faturamentoMes / totalSessoesMes) : 0;

  // 2. Taxa de Ocupação (hoje / semana)
  const activeProfsCount = Math.max(1, (profissionais || []).length);
  const slotsDia = activeProfsCount * 10; // Capacidade padrão de 10 horários por profissional/dia
  const slotsSemana = slotsDia * 6; // 6 dias úteis (Seg a Sáb)

  const aptsHoje = allAppointments.filter(a => a.appointment_date === hoje && a.status !== 'bloqueado' && a.status !== 'cancelado');
  const weekRange = getWeekRangeBRT(today);
  const aptsSemana = allAppointments.filter(a =>
    a.appointment_date >= weekRange.startStr &&
    a.appointment_date <= weekRange.endStr &&
    a.status !== 'bloqueado' &&
    a.status !== 'cancelado'
  );

  const preenchidosHoje = aptsHoje.length;
  const taxaHoje = slotsDia > 0 ? Math.min(100, Math.round((preenchidosHoje / slotsDia) * 100)) : 0;

  const preenchidosSemana = aptsSemana.length;
  const taxaSemana = slotsSemana > 0 ? Math.min(100, Math.round((preenchidosSemana / slotsSemana) * 100)) : 0;

  const isHoje = ocupacaoPeriodo === 'hoje';
  const taxaOcupacaoAtiva = isHoje ? taxaHoje : taxaSemana;
  const preenchidosAtivo = isHoje ? preenchidosHoje : preenchidosSemana;
  const slotsAtivo = isHoje ? slotsDia : slotsSemana;

  // 3. Meta do Mês vs Realizado
  const progressoMeta = metaMensal > 0 ? Math.round((faturamentoMes / metaMensal) * 100) : 0;

  const handleOpenEditMeta = () => {
    setTempMeta(String(metaMensal));
    setShowMetaModal(true);
  };

  const handleSaveMetaSubmit = (e) => {
    if (e) e.preventDefault();
    const parsed = Number(tempMeta.replace(/[^\d.,]/g, '').replace(',', '.'));
    const val = parsed > 0 ? parsed : 10000;
    setMetaMensal(val);
    localStorage.setItem('erp_meta_mensal', String(val));
    setShowMetaModal(false);
  };

  // Revenue data for last 7 days
  const revenueData = (() => {
    const days = [];
    const dayLabels = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = fmtBRT(d);
      const [y, m, dd] = key.split('-').map(Number);
      const wd = new Date(Date.UTC(y, m - 1, dd)).getUTCDay();
      days.push({
        dia: dayLabels[wd],
        valor: sheetTx.filter(r => r.date_ref === key).reduce((sum, r) => sum + gross(r), 0),
      });
    }
    return days;
  })();

  // Auto-generate notes from system state
  const autoNotes = generateAutoNotes({ stockAlerts, okrs: [], appointments: todayAppointments, okrTasks, okrCycle });
  const allNotes = [...autoNotes, ...manualNotes.filter(n => !n.dismissed)];

  const handleDismissNote = async (note) => {
    if (note.auto_generated) return;
    const { error } = await updateStickyNote(note.id, { dismissed: true });
    if (!error) {
      setManualNotes(prev => prev.filter(n => n.id !== note.id));
    }
  };
  const handleAddNote = async (note) => {
    const user = await getCurrentUser();
    const payload = {
      ...note,
      dismissed: false,
      ordem: manualNotes.length,
      source: 'dashboard',
      user_id: user?.id,
    };
    const { data, error } = await insertStickyNote(payload);
    if (!error && data) {
      setManualNotes(prev => [...prev, data]);
    }
  };
  const handleMoveNote = async (noteId, newPriority) => {
    const { error } = await updateStickyNote(noteId, { prioridade: newPriority });
    if (!error) {
      setManualNotes(prev => prev.map(n => n.id === noteId ? { ...n, prioridade: newPriority } : n));
    }
  };

  // Sync stats
  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div className="page-header-label">
              <Star />
              PAINEL DE CONTROLE
            </div>
            <h1 className="page-title">
              Bom {diaSemana.split('-')[0].trim().includes('seg') || diaSemana.startsWith('ter') || diaSemana.startsWith('qua') || diaSemana.startsWith('qui') || diaSemana.startsWith('sex') ? 'dia' : 'dia'}, Evelyn
            </h1>
            <p className="page-subtitle">{dataBr}</p>
          </div>
          <SheetSyncStatus compact />
        </div>
      </div>

      {/* Existing Stat Cards (Preservados integralmente) */}
      <div className="grid-4 section-gap">
        <StatCard
          icon={DollarSign}
          iconBg="#EFF7F2"
          iconColor="var(--success)"
          value={`R$ ${faturamentoMes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
          label="Faturamento do Mês"
          sub={`${txMes.length} transações da planilha`}
        />
        <StatCard
          icon={Calendar}
          iconBg="var(--info-bg)"
          iconColor="var(--info)"
          badge="hoje"
          badgeClass="neutral"
          value={`R$ ${faturamentoHoje.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
          label="Faturamento Hoje"
          sub={`${txHoje.length} receitas`}
        />
        <StatCard
          icon={Users}
          iconBg="var(--info-bg)"
          iconColor="var(--info)"
          value={String(activePatients)}
          label="Clientes Ativos"
          sub="com receitas no mês"
        />
        <StatCard
          icon={AlertTriangle}
          iconBg="var(--danger-bg)"
          iconColor="var(--danger)"
          value={String(stockAlerts.length)}
          label="Estoque Crítico"
          sub="produtos abaixo do mínimo"
        />
      </div>

      {/* Novos Cards de Métricas Adicionais */}
      <div className="grid-3 section-gap">
        {/* 1. Ticket Médio */}
        <StatCard
          icon={Tag}
          iconBg="#F3E8FF"
          iconColor="#8B5CF6"
          value={`R$ ${ticketMedio.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          label="Ticket Médio"
          sub={`${totalSessoesMes} ${totalSessoesMes === 1 ? 'sessão realizada' : 'sessões realizadas'} no mês`}
        />

        {/* 2. Taxa de Ocupação (hoje/semana) */}
        <StatCard
          icon={CalendarCheck}
          iconBg="#E0F2FE"
          iconColor="#0284C7"
          value={`${taxaOcupacaoAtiva}%`}
          label={`Taxa de Ocupação (${isHoje ? 'Hoje' : 'Semana'})`}
          action={
            <div style={{
              display: 'inline-flex',
              background: 'var(--bg-main, #F4F5F7)',
              borderRadius: 6,
              padding: 2,
              border: '1px solid var(--border-light, #E5E7EB)'
            }}>
              <button
                type="button"
                onClick={() => setOcupacaoPeriodo('hoje')}
                style={{
                  border: 'none',
                  background: isHoje ? 'var(--bg-card, #fff)' : 'transparent',
                  color: isHoje ? 'var(--text-dark, #111827)' : 'var(--text-muted, #6B7280)',
                  fontWeight: isHoje ? 700 : 500,
                  fontSize: 11,
                  padding: '3px 8px',
                  borderRadius: 4,
                  cursor: 'pointer',
                  boxShadow: isHoje ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                Hoje
              </button>
              <button
                type="button"
                onClick={() => setOcupacaoPeriodo('semana')}
                style={{
                  border: 'none',
                  background: !isHoje ? 'var(--bg-card, #fff)' : 'transparent',
                  color: !isHoje ? 'var(--text-dark, #111827)' : 'var(--text-muted, #6B7280)',
                  fontWeight: !isHoje ? 700 : 500,
                  fontSize: 11,
                  padding: '3px 8px',
                  borderRadius: 4,
                  cursor: 'pointer',
                  boxShadow: !isHoje ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                Semana
              </button>
            </div>
          }
        >
          <div style={{ marginTop: 10 }}>
            <div style={{
              width: '100%',
              height: 7,
              background: 'var(--border-light, #E5E7EB)',
              borderRadius: 99,
              overflow: 'hidden'
            }}>
              <div style={{
                width: `${Math.min(100, Math.max(0, taxaOcupacaoAtiva))}%`,
                height: '100%',
                background: taxaOcupacaoAtiva >= 80 ? 'linear-gradient(90deg, #10B981, #059669)' : 'linear-gradient(90deg, #0284C7, #38BDF8)',
                borderRadius: 99,
                transition: 'width 0.4s ease'
              }} />
            </div>
            <div className="stat-sub" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
              <span>{preenchidosAtivo} de {slotsAtivo} horários preenchidos</span>
              <span style={{ fontWeight: 600, color: 'var(--text-dark)' }}>{taxaOcupacaoAtiva}%</span>
            </div>
          </div>
        </StatCard>

        {/* 3. Meta do Mês vs Realizado */}
        <StatCard
          icon={Target}
          iconBg="#ECFDF5"
          iconColor="#10B981"
          value={`${progressoMeta}%`}
          label="Meta do Mês vs Realizado"
          action={
            <button
              type="button"
              onClick={handleOpenEditMeta}
              title="Configurar Meta Mensal"
              style={{
                border: 'none',
                background: 'transparent',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: 4,
                borderRadius: 4,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'color 0.15s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-primary, #C73B6D)'}
              onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
            >
              <Edit3 style={{ width: 13, height: 13 }} />
            </button>
          }
        >
          <div style={{ marginTop: 10 }}>
            <div style={{
              width: '100%',
              height: 7,
              background: 'var(--border-light, #E5E7EB)',
              borderRadius: 99,
              overflow: 'hidden'
            }}>
              <div style={{
                width: `${Math.min(100, Math.max(0, progressoMeta))}%`,
                height: '100%',
                background: progressoMeta >= 100
                  ? 'linear-gradient(90deg, #10B981, #059669)'
                  : 'linear-gradient(90deg, var(--color-primary, #C73B6D), #8B5CF6)',
                borderRadius: 99,
                transition: 'width 0.4s ease'
              }} />
            </div>
            <div className="stat-sub" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4, fontSize: 11 }}>
              <span>Meta R$ {metaMensal.toLocaleString('pt-BR')} | Realizado R$ {faturamentoMes.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</span>
              <span style={{ fontWeight: 700, color: progressoMeta >= 100 ? 'var(--success, #10B981)' : 'var(--text-dark)' }}>{progressoMeta}%</span>
            </div>
          </div>
        </StatCard>
      </div>

      {/* Modal de Configuração da Meta Mensal */}
      {showMetaModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          backdropFilter: 'blur(4px)',
          animation: 'fadeIn 0.2s ease'
        }}>
          <div style={{
            background: 'var(--bg-card, #ffffff)',
            borderRadius: 12,
            padding: 24,
            width: '100%',
            maxWidth: 400,
            boxShadow: 'var(--shadow-lg, 0 10px 25px rgba(0,0,0,0.15))',
            border: '1px solid var(--border-color, #E5E7EB)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: '#ECFDF5',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#10B981'
                }}>
                  <Target style={{ width: 18, height: 18 }} />
                </div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-dark)' }}>
                  Meta Financeira Mensal
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowMetaModal(false)}
                style={{
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                  padding: 4
                }}
              >
                <X style={{ width: 18, height: 18 }} />
              </button>
            </div>

            <form onSubmit={handleSaveMetaSubmit}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-medium)', marginBottom: 6 }}>
                  Valor da Meta (R$)
                </label>
                <div style={{ position: 'relative' }}>
                  <span style={{
                    position: 'absolute',
                    left: 12,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    fontSize: 14,
                    fontWeight: 600,
                    color: 'var(--text-muted)'
                  }}>
                    R$
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    value={tempMeta}
                    onChange={(e) => setTempMeta(e.target.value)}
                    placeholder="10000"
                    autoFocus
                    style={{
                      width: '100%',
                      padding: '10px 12px 10px 38px',
                      borderRadius: 8,
                      border: '1px solid var(--border-color, #D1D5DB)',
                      background: 'var(--bg-main, #F9FAFB)',
                      fontSize: 15,
                      fontWeight: 600,
                      color: 'var(--text-dark)',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
                <p style={{ margin: '6px 0 0', fontSize: 11, color: 'var(--text-muted)' }}>
                  Essa meta é usada no cálculo de atingimento mensal no painel da clínica.
                </p>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setShowMetaModal(false)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 6,
                    border: '1px solid var(--border-color, #D1D5DB)',
                    background: 'transparent',
                    color: 'var(--text-medium)',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '8px 16px',
                    borderRadius: 6,
                    border: 'none',
                    background: 'var(--color-primary, #C73B6D)',
                    color: '#fff',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}
                >
                  <Check style={{ width: 14, height: 14 }} />
                  Salvar Meta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* OKR Weekly Snapshot */}
      <div className="section-gap">
        <OKRWeeklySnapshot keyResults={[]} onKRClick={kr => document.getElementById('sticky-notes-panel')?.scrollIntoView({ behavior: 'smooth' })} />
      </div>

      {/* Revenue Chart + Stock Alerts */}
      <div className="grid-2-1 section-gap">
        {/* Revenue Chart */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">
              <TrendingUp />
              Faturamento - Últimos 7 dias
            </span>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={revenueData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" vertical={false} />
              <XAxis
                dataKey="dia"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                tickFormatter={(v) => `R$${v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v}`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="monotone"
                dataKey="valor"
                stroke="var(--color-primary)"
                strokeWidth={2}
                dot={{ fill: 'var(--color-primary)', r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Stock Alerts */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">
              <Package />
              Alertas de Estoque
            </span>
          </div>
          <div>
            {stockAlerts.map((item, i) => (
              <div key={i} className="alert-item">
                <div>
                  <div className="alert-item-label">{item.nome}</div>
                  <div className="alert-item-sub">{item.lote}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className={`alert-item-qty ${item.estoque === 0 ? 'zero' : 'low'}`}>
                    {item.estoque}
                  </div>
                  <div className="alert-item-sub">min: {item.minimo}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Sticky Notes Panel */}
      <div className="section-gap" id="sticky-notes-panel">
        <StickyNotesPanel notes={allNotes} onDismiss={handleDismissNote} onAdd={handleAddNote} onMove={handleMoveNote} />
      </div>

      {/* Today Appointments */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">
            <Clock />
            Agendamentos de Hoje
          </span>
          <a href="/agenda" style={{ fontSize: 12, color: 'var(--color-primary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 2, fontWeight: 600 }}>
            Ver todos <ChevronRight style={{ width: 13, height: 13 }} />
          </a>
        </div>

        {todayAppointments.length === 0 ? (
          <div className="empty-state">
            <Calendar />
            <p>Nenhum agendamento para hoje</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Horário</th>
                  <th>Paciente</th>
                  <th>Serviço</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {todayAppointments.map((apt, i) => (
                  <tr key={i}>
                    <td>
                      <span style={{ fontWeight: 600, color: 'var(--text-dark)' }}>{apt.hora}</span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div className="avatar">
                          {apt.paciente.charAt(0)}
                        </div>
                        <span style={{ fontWeight: 500 }}>{apt.paciente}</span>
                      </div>
                    </td>
                    <td style={{ color: 'var(--text-light)' }}>{apt.servico}</td>
                    <td>
                      <span className={`badge ${apt.status === 'confirmado' ? 'badge-success' : 'badge-warning'}`}>
                        {apt.status === 'confirmado' ? 'Confirmado' : 'Aguardando'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
