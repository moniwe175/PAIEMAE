import { useState, useEffect } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import {
  DollarSign, Calendar, Users, AlertTriangle,
  TrendingUp, Package, ChevronRight, Clock, Star
} from 'lucide-react';
import SheetSyncStatus from '../components/integration/SheetSyncStatus';
import OKRWeeklySnapshot from '../components/dashboard/OKRWeeklySnapshot';
import StickyNotesPanel from '../components/dashboard/StickyNotesPanel';
import { generateAutoNotes } from '../lib/noteAutomation';
import { fetchStickyNotes, insertStickyNote, updateStickyNote, fetchActiveOKRTasks } from '../services/okrService';
import { fetchInventory, fetchAppointments, fetchSheetTransactionsRange, todayBRT } from '../services/supabaseService';
import { getCurrentUser } from '../lib/supabase';

// ─── Sub-components ───────────────────────────────────────────
function StatCard({ icon: Icon, iconBg, iconColor, badge, badgeClass, value, label, sub }) {
  return (
    <div className="stat-card">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div className="stat-card-icon" style={{ background: iconBg }}>
          <Icon style={{ color: iconColor }} />
        </div>
        {badge && (
          <span className={`stat-badge ${badgeClass}`}>
            <TrendingUp style={{ width: 10, height: 10 }} />
            {badge}
          </span>
        )}
      </div>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
      {sub && <div className="stat-sub">{sub}</div>}
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

// ─── Dashboard ────────────────────────────────────────────────
export default function Dashboard() {
  const [manualNotes, setManualNotes] = useState([]);
  const [okrTasks, setOkrTasks] = useState([]);
  const [okrCycle, setOkrCycle] = useState(null);
  const [stockAlerts, setStockAlerts] = useState([]);
  const [todayAppointments, setTodayAppointments] = useState([]);
  const [sheetTx, setSheetTx] = useState([]); // receitas reais da planilha (sheet_transactions)

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
    async function loadAppointments() {
      const { data } = await fetchAppointments();
      if (data) {
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
    loadAppointments();
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

      {/* Stat Cards */}
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
