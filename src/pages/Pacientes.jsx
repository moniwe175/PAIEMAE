import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLocation } from 'react-router-dom';
import {
  Users, Plus, Search, Phone, Calendar, FileText, XCircle,
  ChevronRight, Mail, Instagram, Upload, Trash2, AlertTriangle,
  RefreshCw, UserCheck, UserPlus, Clock, Share2,
  DollarSign, CalendarCheck, CalendarX, UserX, CheckCircle2, Activity
} from 'lucide-react';
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip
} from 'recharts';
import {
  fetchClients, insertClient, deleteClient, updateClient, fetchAppointments,
  fetchPackages, fetchPatientPackages, fetchPatientPackageSessions,
} from '../services/supabaseService';
import { getCurrentUser, supabase } from '../lib/supabase';
import PatientPackagesPanel from '../components/patients/PatientPackagesPanel';
import { packageProgress, packageServiceNames } from '../lib/patientPackages';
import {
  appointmentPatientKey,
  buildPatientCommercialHistory,
  calculateLoyalPatientStats,
  calculateScheduledReturnStats,
  derivePatientRelationship,
  getAppointmentRecordedValue,
  isCompletedAppointment,
  resolvePatientSource,
  UNKNOWN_PATIENT_SOURCE,
} from '../lib/patientAnalytics';
import { clinicDateKey } from '../lib/clinicDate';

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

const formatDateBR = (value) => {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : '—';
};

const COMMERCIAL_STATUS = {
  completed: { label: 'Finalizado', color: '#047857', background: '#ECFDF5' },
  scheduled: { label: 'Agendado', color: '#1D4ED8', background: '#EFF6FF' },
  cancelled: { label: 'Cancelado', color: '#6B7280', background: '#F3F4F6' },
  no_show: { label: 'Falta', color: '#B91C1C', background: '#FEF2F2' },
};

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
  [UNKNOWN_PATIENT_SOURCE]: '#6B7280',
};

// ─── Modal Novo / Editar Paciente ─────────────────────────────
// eslint-disable-next-line react/prop-types
function PacienteModal({ onClose, onSave, initialData }) {
  const [form, setForm] = useState(
    initialData || {
      nome: '',
      telefone: '',
      email: '',
      instagram: '',
      nascimento: '',
      cidade: '',
      origem: '',
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
              Origem do Cliente (Como nos conheceu?)
            </label>
            <select
              className="form-input"
              value={form.origem || ''}
              onChange={(e) => set('origem', e.target.value)}
              style={{ fontWeight: 600, color: 'var(--text-dark)' }}
            >
              <option value="">Não informado — configurar depois</option>
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

// Histórico operacional baseado somente na Agenda. Não presume pagamento.
// eslint-disable-next-line react/prop-types
function CommercialHistoryModal({ patient, packages = [], packageSessions = [], onClose }) {
  // eslint-disable-next-line react/prop-types
  const history = patient?.commercialHistory || {};
  const timeline = history.timeline || [];
  const maxMonthlyValue = Math.max(0, ...(history.monthlyEvolution || []).map((item) => item.recordedValue));
  const patientPackages = packages.filter((item) => String(item.client_id) === String(patient?.id));

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(event) => event.stopPropagation()} style={{ width: 'min(1080px, 96vw)', maxWidth: 1080, maxHeight: '92vh', overflow: 'hidden', padding: 0 }}>
        <div className="modal-header" style={{ padding: '18px 22px', margin: 0 }}>
          <div>
            <span className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Activity style={{ width: 19, height: 19 }} />
              Histórico Comercial
            </span>
            {/* eslint-disable-next-line react/prop-types */}
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>{patient?.nome}</div>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Fechar histórico comercial">
            <XCircle />
          </button>
        </div>

        <div style={{ padding: '16px 22px 24px', overflowY: 'auto' }}>
          <div style={{ display: 'flex', gap: 9, alignItems: 'flex-start', padding: '11px 13px', borderRadius: 9, background: '#FFFBEB', border: '1px solid #FDE68A', color: '#92400E', marginBottom: 16 }}>
            <AlertTriangle style={{ width: 17, height: 17, flexShrink: 0, marginTop: 1 }} />
            <div style={{ fontSize: 11.5, lineHeight: 1.45 }}>
              <strong>Valores informados na Agenda.</strong> Atendimento finalizado não comprova pagamento. Parcelas, formas de pagamento, estornos e valores em aberto não fazem parte desta versão.
            </div>
          </div>

          {patientPackages.length > 0 && (
            <div style={{ padding: 15, border: '1px solid var(--border-color)', borderRadius: 10, marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-dark)', marginBottom: 11 }}>Pacotes adquiridos</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 9 }}>
                {patientPackages.map((item) => {
                  const progress = packageProgress(item, packageSessions);
                  return (
                    <div key={item.id} style={{ padding: 11, borderRadius: 9, background: '#FDF8FA', border: '1px solid #F1DDE5' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><strong style={{ fontSize: 11.5 }}>{item.package_name}</strong><span style={{ fontSize: 10, fontWeight: 800, color: progress.remaining ? '#9B2C50' : '#047857' }}>{progress.remaining} restantes</span></div>
                      <div style={{ fontSize: 9.5, color: 'var(--text-muted)', marginTop: 3 }}>{packageServiceNames(item).join(' · ') || 'Serviços conforme pacote'}</div>
                      <div style={{ height: 6, background: '#EEDFE4', borderRadius: 99, overflow: 'hidden', marginTop: 9 }}><div style={{ width: `${progress.percent}%`, height: '100%', background: '#B7796B' }}/></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5, fontSize: 9.5, color: 'var(--text-muted)' }}><span>{progress.used} realizadas</span><span>{progress.total} contratadas</span></div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(145px, 1fr))', gap: 10, marginBottom: 16 }}>
            {[
              { label: 'Atendimentos finalizados', value: history.completedCount || 0, detail: `${history.appointmentsWithValue || 0} com valor informado`, icon: CheckCircle2, color: '#047857', bg: '#ECFDF5' },
              { label: 'Valor registrado', value: formatBRL(history.totalRecordedValue), detail: 'somente finalizados', icon: DollarSign, color: '#047857', bg: '#ECFDF5' },
              { label: 'Ticket observado', value: formatBRL(history.averageTicket), detail: 'somente finalizados com valor', icon: Activity, color: '#7C3AED', bg: '#F5F3FF' },
              { label: 'Próximos horários', value: history.futureCount || 0, detail: history.nextAppointment ? `${formatDateBR(history.nextAppointment.date)} ${history.nextAppointment.time}` : 'nenhum agendamento futuro', icon: CalendarCheck, color: '#1D4ED8', bg: '#EFF6FF' },
              { label: 'Cancelamentos', value: history.cancelledCount || 0, detail: 'em todo o histórico', icon: CalendarX, color: '#6B7280', bg: '#F3F4F6' },
              { label: 'Faltas', value: history.noShowCount || 0, detail: 'não comparecimentos', icon: UserX, color: '#B91C1C', bg: '#FEF2F2' },
            ].map(({ label, value, detail, icon: Icon, color, bg }) => (
              <div key={label} style={{ padding: 13, border: '1px solid var(--border-color)', borderRadius: 10, background: '#fff' }}>
                <div style={{ width: 29, height: 29, borderRadius: 8, display: 'grid', placeItems: 'center', background: bg, color, marginBottom: 9 }}><Icon style={{ width: 15, height: 15 }} /></div>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-dark)' }}>{value}</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-medium)', marginTop: 2 }}>{label}</div>
                <div style={{ fontSize: 9.5, color: 'var(--text-muted)', marginTop: 3 }}>{detail}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: 12, marginBottom: 16 }}>
            <div style={{ padding: 15, border: '1px solid var(--border-color)', borderRadius: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-dark)', marginBottom: 11 }}>Relacionamento com a clínica</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
                {[
                  ['Primeira visita', formatDateBR(history.firstVisit)],
                  ['Última visita', formatDateBR(history.lastVisit)],
                  ['Intervalo médio', history.averageIntervalDays != null ? `${history.averageIntervalDays} dias` : 'Sem recorrência'],
                  ['Próximo serviço', history.nextAppointment?.service || 'Não agendado'],
                ].map(([label, value]) => (
                  <div key={label} style={{ background: 'var(--bg-main)', borderRadius: 8, padding: '9px 10px' }}>
                    <div style={{ fontSize: 9.5, color: 'var(--text-muted)' }}>{label}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-dark)', marginTop: 3 }}>{value}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ padding: 15, border: '1px solid var(--border-color)', borderRadius: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-dark)', marginBottom: 11 }}>Serviços mais realizados</div>
              {(history.topServices || []).slice(0, 4).map((item, index) => (
                <div key={item.service} style={{ display: 'grid', gridTemplateColumns: '22px 1fr auto', gap: 8, alignItems: 'center', padding: '6px 0', borderBottom: index < Math.min(history.topServices.length, 4) - 1 ? '1px solid var(--border-color)' : 'none' }}>
                  <div style={{ width: 20, height: 20, borderRadius: 6, display: 'grid', placeItems: 'center', background: 'var(--color-accent-soft)', color: 'var(--color-primary)', fontSize: 10, fontWeight: 800 }}>{index + 1}</div>
                  <div><div style={{ fontSize: 11.5, fontWeight: 700 }}>{item.service}</div><div style={{ fontSize: 9.5, color: 'var(--text-muted)' }}>{item.sessions} atendimento(s)</div></div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#047857' }}>{formatBRL(item.recordedValue)}</div>
                </div>
              ))}
              {(history.topServices || []).length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>Nenhum atendimento finalizado.</div>}
            </div>
          </div>

          {(history.monthlyEvolution || []).length > 0 && (
            <div style={{ padding: 15, border: '1px solid var(--border-color)', borderRadius: 10, marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-dark)', marginBottom: 11 }}>Evolução dos valores registrados</div>
              <div style={{ display: 'grid', gap: 7 }}>
                {history.monthlyEvolution.slice(-12).map((item) => {
                  const [year, month] = item.month.split('-');
                  const width = maxMonthlyValue > 0 ? Math.max(2, (item.recordedValue / maxMonthlyValue) * 100) : 0;
                  return (
                    <div key={item.month} style={{ display: 'grid', gridTemplateColumns: '55px 1fr 92px', gap: 9, alignItems: 'center' }}>
                      <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{month}/{year}</span>
                      <div style={{ height: 8, background: '#F3E8E5', borderRadius: 99, overflow: 'hidden' }}><div style={{ width: `${width}%`, height: '100%', background: 'linear-gradient(90deg, #B8796D, #C73B6D)', borderRadius: 99 }} /></div>
                      <span style={{ textAlign: 'right', fontSize: 10.5, fontWeight: 700 }}>{formatBRL(item.recordedValue)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div style={{ border: '1px solid var(--border-color)', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ padding: '12px 14px', display: 'flex', justifyContent: 'space-between', gap: 10, borderBottom: '1px solid var(--border-color)', background: 'var(--bg-main)' }}>
              <strong style={{ fontSize: 12 }}>Linha do tempo da Agenda</strong>
              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{timeline.length} registro(s)</span>
            </div>
            {timeline.length > 0 ? (
              <div className="table-wrapper">
                <table style={{ minWidth: 720 }}>
                  <thead><tr><th>Data</th><th>Serviço</th><th>Profissional</th><th>Status</th><th style={{ textAlign: 'right' }}>Valor informado</th></tr></thead>
                  <tbody>
                    {timeline.map((item) => {
                      const status = COMMERCIAL_STATUS[item.statusGroup] || COMMERCIAL_STATUS.scheduled;
                      return (
                        <tr key={item.id || `${item.date}-${item.time}-${item.service}`}>
                          <td><strong style={{ fontSize: 12 }}>{formatDateBR(item.date)}</strong><div style={{ fontSize: 9.5, color: 'var(--text-muted)' }}>{item.time || 'sem horário'}</div></td>
                          <td style={{ fontSize: 12, fontWeight: 600 }}>{item.service}</td>
                          <td style={{ fontSize: 11.5, color: 'var(--text-medium)' }}>{item.professional}</td>
                          <td><span style={{ display: 'inline-flex', padding: '3px 8px', borderRadius: 99, background: status.background, color: status.color, fontSize: 10, fontWeight: 700 }}>{status.label}</span></td>
                          <td style={{ textAlign: 'right', fontWeight: 700, color: item.countedInTotal ? '#047857' : 'var(--text-muted)' }}>
                            {item.value > 0 ? formatBRL(item.value) : '—'}
                            {!item.countedInTotal && item.value > 0 && <div style={{ fontSize: 8.5, fontWeight: 500 }}>não somado</div>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : <div style={{ padding: 28, textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>Nenhum agendamento encontrado para esta paciente.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Componente Principal Pacientes ───────────────────────────
export default function Pacientes() {
  const { canEdit, canViewMetrics, canViewValues } = useAuth();
  const showMetrics = canViewMetrics ? canViewMetrics('pacientes') : true;
  const showValues = canViewValues ? canViewValues('pacientes') : true;
  const location = useLocation();
  const [pacientes, setPacientes] = useState([]);
  const [allAppointments, setAllAppointments] = useState([]);
  const [modal, setModal] = useState(false);
  const [editModal, setEditModal] = useState(null);
  const [deleteModal, setDeleteModal] = useState(null);
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState('Todos'); // 'Todos' | 'Ativo' | 'Inativo' | 'Novo' | 'Risco'
  const [selected, setSelected] = useState(null);
  const [commercialHistoryOpen, setCommercialHistoryOpen] = useState(false);
  const [servicos, setServicos] = useState([]);
  const [packageCatalog, setPackageCatalog] = useState([]);
  const [patientPackages, setPatientPackages] = useState([]);
  const [packageSessions, setPackageSessions] = useState([]);
  const [packagesLoadError, setPackagesLoadError] = useState('');

  // Paginação da tabela de pacientes (busca ainda percorre todos)
  const PAGE_SIZE = 50;
  const [paginaAtual, setPaginaAtual] = useState(1);

  const refreshPackageData = async () => {
    const [catalogRes, packagesRes, sessionsRes] = await Promise.all([
      fetchPackages(),
      fetchPatientPackages(),
      fetchPatientPackageSessions(),
    ]);
    setPackageCatalog(catalogRes.data || []);
    setPatientPackages(packagesRes.data || []);
    setPackageSessions(sessionsRes.data || []);
    const error = packagesRes.error || sessionsRes.error;
    setPackagesLoadError(error ? (error.message || String(error)) : '');
  };

  useEffect(() => { refreshPackageData(); }, []);

  // Período de Análise de Retenção & Recorrência: '30d' | '60d' | '90d'
  const [periodoRetencao, setPeriodoRetencao] = useState('60d');

  // Dias sem retorno para churn: padrão 60 dias
  const churnDiasLimite = 60;

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
          const sourceInfo = resolvePatientSource(item);
          const commercialHistory = buildPatientCommercialHistory({
            id: item.id,
            name: item.name,
            phone: item.phone,
          }, appts, today);

          let ultimaVisita = item.last_visit ? item.last_visit.split('-').reverse().join('/') : 'Nunca';
          let ultimaVisitaIso = item.last_visit || null;
          let diasSemVisita = null;

          if (commercialHistory.lastVisit) {
            ultimaVisita = formatDateBR(commercialHistory.lastVisit);
            ultimaVisitaIso = commercialHistory.lastVisit;
          }

          if (ultimaVisitaIso) {
            const parts = String(ultimaVisitaIso).slice(0, 10).split('-');
            if (parts.length === 3) {
              const dt = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
              diasSemVisita = Math.floor((today.getTime() - dt.getTime()) / 86400000);
            }
          }

          const tempoMedioDias = commercialHistory.averageIntervalDays;
          const totalSessoes = commercialHistory.completedCount;
          const totalGasto = commercialHistory.totalRecordedValue;
          const historicoPaciente = commercialHistory.timeline
            .filter((appointment) => appointment.statusGroup === 'completed')
            .map((appointment) => ({
              dataIso: appointment.date,
              data: formatDateBR(appointment.date),
              servico: appointment.service,
              valor: appointment.value,
            }));

          // 2. Churn Risk status: sem visita há mais de 60 dias ou inativo
          const isEmRisco = (diasSemVisita !== null && diasSemVisita >= 60) || item.status === 'inativo';
          const relacionamento = derivePatientRelationship(totalSessoes, isEmRisco);

          return {
            id: item.id,
            nome: item.name || '',
            telefone: item.phone || '',
            email: item.email || '',
            instagram: item.instagram || '',
            cidade: 'Não informada',
            nascimento: item.birthdate ? item.birthdate.split('-').reverse().join('/') : '',
            origem: sourceInfo.source,
            origemOriginal: sourceInfo.originalSource,
            origemConfirmada: sourceInfo.confirmed,
            ultimaVisita,
            ultimaVisitaIso,
            diasSemVisita,
            isEmRisco,
            tempoMedioDias,
            totalSessoes,
            totalGasto,
            relacionamento,
            status: item.status || 'ativo',
            whatsapp_opt_out: !!item.whatsapp_opt_out,
            avatar: item.avatar || (item.name ? item.name.charAt(0).toUpperCase() : 'U'),
            historico: historicoPaciente,
            commercialHistory,
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
      source: formData.origem || null,
      source_confirmed_at: formData.origem ? new Date().toISOString() : null,
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
        origem: formData.origem || UNKNOWN_PATIENT_SOURCE,
        origemOriginal: formData.origem || '',
        origemConfirmada: Boolean(formData.origem),
        ultimaVisita: 'Nunca',
        diasSemVisita: null,
        isEmRisco: false,
        tempoMedioDias: null,
        totalSessoes: 0,
        totalGasto: Number(data.total_spent) || 0,
        relacionamento: 'Sem histórico',
        status: data.status,
        avatar: data.avatar,
        historico: [],
        commercialHistory: buildPatientCommercialHistory({ id: data.id, name: data.name, phone: data.phone }, []),
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
      source: formData.origem || editModal.origemOriginal || null,
      source_confirmed_at: formData.origem ? new Date().toISOString() : null,
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
              origem: formData.origem || UNKNOWN_PATIENT_SOURCE,
              origemOriginal: data.source || editModal.origemOriginal || '',
              origemConfirmada: Boolean(formData.origem),
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

  // ─── 1. Taxa de retorno no período (30d / 60d / 90d) ─────────
  const retencaoStats = useMemo(() => {
    const days = periodoRetencao === '30d' ? 30 : periodoRetencao === '90d' ? 90 : 60;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = clinicDateKey(cutoff);

    const visitsInPeriod = allAppointments.filter(
      (a) => a.appointment_date >= cutoffStr && isCompletedAppointment(a)
    );

    const clientVisitCounts = {};
    visitsInPeriod.forEach((a) => {
      const key = appointmentPatientKey(a);
      if (!key) return;
      clientVisitCounts[key] = (clientVisitCounts[key] || 0) + 1;
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
  const fidelizacaoStats = useMemo(() => calculateLoyalPatientStats(pacientes), [pacientes]);

  const retornoAgendadoStats = useMemo(() => {
    const days = periodoRetencao === '30d' ? 30 : periodoRetencao === '90d' ? 90 : 60;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    return calculateScheduledReturnStats(pacientes, clinicDateKey(cutoff));
  }, [pacientes, periodoRetencao]);


  // ─── 4. Novos vs Recorrentes (e Faturamento) ─────────────────
  const novosVsRecorrentes = useMemo(() => {
    const days = periodoRetencao === '30d' ? 30 : periodoRetencao === '90d' ? 90 : 60;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = clinicDateKey(cutoff);

    // Agrupamento de agendamentos finalizados no período
    const apptsPeriodo = allAppointments.filter((a) => a.appointment_date >= cutoffStr && isCompletedAppointment(a));

    let faturamentoNovos = 0;
    let faturamentoRecorrentes = 0;
    const setNovos = new Set();
    const setRecorrentes = new Set();

    apptsPeriodo.forEach((a) => {
      const patientKey = appointmentPatientKey(a);
      if (!patientKey) return;
      const v = getAppointmentRecordedValue(a);

      // Verifica se o cliente tem agendamentos ANTERIORES ao cutoffStr
      const temHistoricoAnterior = allAppointments.some(
        (prevApt) =>
          appointmentPatientKey(prevApt) === patientKey &&
          isCompletedAppointment(prevApt) &&
          prevApt.appointment_date < cutoffStr
      );

      if (temHistoricoAnterior) {
        setRecorrentes.add(patientKey);
        faturamentoRecorrentes += v;
      } else {
        setNovos.add(patientKey);
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
      const orig = p.origem || UNKNOWN_PATIENT_SOURCE;
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

  // A origem continua disponível no gráfico de canais abaixo.
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
      if (filtro === 'Fidelizado') return p.relacionamento === 'Fidelizado';
      if (filtro === 'Recorrente') return p.relacionamento === 'Recorrente';
      if (filtro === 'Novo') return p.relacionamento === 'Primeira visita';
      if (filtro === 'SemHistorico') return p.relacionamento === 'Sem histórico';
      if (filtro === 'Risco') return p.isEmRisco;
      return true;
    });
  }, [pacientes, busca, filtro]);

  // Reseta para p.1 ao trocar busca ou filtro
  useEffect(() => { setPaginaAtual(1); }, [busca, filtro]);

  // Fatia a lista para a página atual
  const paginados = useMemo(
    () => filtrados.slice((paginaAtual - 1) * PAGE_SIZE, paginaAtual * PAGE_SIZE),
    [filtrados, paginaAtual]
  );
  const totalPaginas = Math.ceil(filtrados.length / PAGE_SIZE);

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
            origem: editModal.origemConfirmada ? editModal.origem : '',
            nascimento: editModal.nascimento ? editModal.nascimento.split('/').reverse().join('-') : '',
            cidade: editModal.cidade,
            whatsapp_opt_out: !!editModal.whatsapp_opt_out,
            obs: '',
          }}
        />
      )}
      {commercialHistoryOpen && selected && showValues && (
        <CommercialHistoryModal patient={selected} packages={patientPackages} packageSessions={packageSessions} onClose={() => setCommercialHistoryOpen(false)} />
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
                Deseja realmente excluir o paciente <strong>&quot;{deleteModal.nome}&quot;</strong>?
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

      {/* ─── 1. Top KPI Cards & Gráficos (Retorno, Risco, Tempo Médio, Indicação) ─── */}
      {showMetrics && (
        <>
          <div className="grid-4 section-gap">
        {/* 1. Taxa de retorno no período */}
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
            <div className="stat-label">Retorno no período ({periodoRetencao})</div>
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
            <div className="stat-label">Clientes em Risco de Retorno</div>
          </div>
          <div className="stat-sub" style={{ marginTop: 6, color: '#DC2626', fontWeight: 600 }}>
            {churnStats.emRiscoQtd} de {churnStats.totalComHistorico} com histórico · {pacientes.length - churnStats.totalComHistorico} sem histórico
          </div>
        </div>

        {/* 3. Clientes Fidelizados */}
        <div className="stat-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <div className="stat-card-icon" style={{ background: '#ECFDF5', margin: 0 }}>
                <UserCheck style={{ color: '#059669', width: 20, height: 20 }} />
              </div>
              <span className="stat-badge" style={{ fontSize: 10, color: '#047857', background: '#ECFDF5' }}>
                {fidelizacaoStats.percentage}% da base atendida
              </span>
            </div>
            <div className="stat-value" style={{ color: '#059669' }}>
              {fidelizacaoStats.loyal}
            </div>
            <div className="stat-label">Clientes Fidelizados</div>
          </div>
          <div className="stat-sub" style={{ marginTop: 6 }}>
            3 ou mais atendimentos · {fidelizacaoStats.withHistory} clientes com histórico
          </div>
        </div>

        {/* 4. Retorno Já Agendado */}
        <div className="stat-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <div className="stat-card-icon" style={{ background: '#EFF6FF', margin: 0 }}>
                <CalendarCheck style={{ color: '#2563EB', width: 20, height: 20 }} />
              </div>
              {retornoAgendadoStats.recentlyAttended > 0 && (
                <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: '#DBEAFE', color: '#1D4ED8' }}>
                  {retornoAgendadoStats.scheduled} marcados
                </span>
              )}
            </div>
            <div className="stat-value" style={{ color: '#2563EB' }}>
              {retornoAgendadoStats.recentlyAttended > 0 ? `${retornoAgendadoStats.percentage}%` : '—'}
            </div>
            <div className="stat-label">Retorno Já Agendado</div>
          </div>
          <div className="stat-sub" style={{ marginTop: 6 }}>
            {retornoAgendadoStats.scheduled} de {retornoAgendadoStats.recentlyAttended} atendidos no período · {retornoAgendadoStats.withoutReturn} sem próxima visita
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
                    <Pie data={canaisData} cx="50%" cy="50%" innerRadius={42} outerRadius={68} dataKey="value" paddingAngle={3} isAnimationActive={false}>
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
                  <strong>Novos:</strong> {novosVsRecorrentes.qtdNovos}{showValues ? ` (${formatBRL(novosVsRecorrentes.faturamentoNovos)})` : ''}
                </span>
                <span>
                  <strong>Recorrentes:</strong> {novosVsRecorrentes.qtdRecorrentes}{showValues ? ` (${formatBRL(novosVsRecorrentes.faturamentoRecorrentes)})` : ''}
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
                  {showValues ? formatBRL(novosVsRecorrentes.faturamentoNovos) : `${novosVsRecorrentes.qtdNovos} pacientes`}
                </div>
                <div style={{ fontSize: 11, color: '#0284C7', marginTop: 2 }}>
                  {novosVsRecorrentes.qtdNovos} pacientes {showValues ? `(${novosVsRecorrentes.pctNovos.toFixed(1)}% do valor registrado)` : ''}
                </div>
              </div>

              <div style={{ background: '#ECFDF5', padding: 12, borderRadius: 10, border: '1px solid #A7F3D0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#059669', fontSize: 11, fontWeight: 700, marginBottom: 4 }}>
                  <RefreshCw style={{ width: 14, height: 14 }} />
                  RETORNOS (RECORRENTES)
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#047857' }}>
                  {showValues ? formatBRL(novosVsRecorrentes.faturamentoRecorrentes) : `${novosVsRecorrentes.qtdRecorrentes} pacientes`}
                </div>
                <div style={{ fontSize: 11, color: '#059669', marginTop: 2 }}>
                  {novosVsRecorrentes.qtdRecorrentes} pacientes {showValues ? `(${novosVsRecorrentes.pctRecorrentes.toFixed(1)}% do valor registrado)` : ''}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
        </>
      )}

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
                  { k: 'Fidelizado', l: 'Fidelizados' },
                  { k: 'Recorrente', l: 'Recorrentes' },
                  { k: 'Novo', l: 'Primeira visita' },
                  { k: 'Risco', l: '⚠️ Em risco' },
                  { k: 'SemHistorico', l: 'Sem histórico' },
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
                    {showValues && <th style={{ textAlign: 'right' }}>Valor Agenda*</th>}
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {paginados.map((p) => (
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
                          {p.origem || UNKNOWN_PATIENT_SOURCE}
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
                      {showValues && (
                        <td style={{ fontWeight: 600, color: 'var(--success)', textAlign: 'right' }}>
                          {formatBRL(p.totalGasto)}
                        </td>
                      )}
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
                        ) : (
                          <span
                            className="badge"
                            style={{
                              background: p.relacionamento === 'Fidelizado' ? '#DCFCE7' : p.relacionamento === 'Recorrente' ? '#ECFDF5' : p.relacionamento === 'Primeira visita' ? '#E0F2FE' : '#F3F4F6',
                              color: p.relacionamento === 'Fidelizado' ? '#15803D' : p.relacionamento === 'Recorrente' ? '#047857' : p.relacionamento === 'Primeira visita' ? '#0284C7' : '#6B7280',
                            }}
                          >
                            {p.relacionamento}
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

            {/* Paginação */}
            {totalPaginas > 1 && (
              <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {(paginaAtual - 1) * PAGE_SIZE + 1}–{Math.min(paginaAtual * PAGE_SIZE, filtrados.length)} de {filtrados.length} pacientes
                </span>
                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  <button
                    disabled={paginaAtual === 1}
                    onClick={() => setPaginaAtual((p) => p - 1)}
                    style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border-color)', background: paginaAtual === 1 ? 'var(--bg-main)' : '#fff', cursor: paginaAtual === 1 ? 'default' : 'pointer', fontSize: 12, opacity: paginaAtual === 1 ? 0.5 : 1 }}
                  >← Ant.</button>
                  {Array.from({ length: totalPaginas }, (_, i) => i + 1)
                    .filter((n) => Math.abs(n - paginaAtual) <= 2)
                    .map((n) => (
                      <button
                        key={n}
                        onClick={() => setPaginaAtual(n)}
                        style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid', borderColor: n === paginaAtual ? 'var(--color-primary)' : 'var(--border-color)', background: n === paginaAtual ? 'var(--color-primary)' : '#fff', color: n === paginaAtual ? '#fff' : 'var(--text-medium)', cursor: 'pointer', fontSize: 12, fontWeight: n === paginaAtual ? 700 : 500 }}
                      >{n}</button>
                    ))}
                  <button
                    disabled={paginaAtual === totalPaginas}
                    onClick={() => setPaginaAtual((p) => p + 1)}
                    style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border-color)', background: paginaAtual === totalPaginas ? 'var(--bg-main)' : '#fff', cursor: paginaAtual === totalPaginas ? 'default' : 'pointer', fontSize: 12, opacity: paginaAtual === totalPaginas ? 0.5 : 1 }}
                  >Próx. →</button>
                </div>
              </div>
            )}
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
                    Origem: {selected.origem || UNKNOWN_PATIENT_SOURCE}
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

              <PatientPackagesPanel
                patient={selected}
                catalog={packageCatalog}
                packages={patientPackages}
                sessions={packageSessions}
                canEdit={canEdit('pacientes')}
                loadError={packagesLoadError}
                onRefresh={refreshPackageData}
              />

              <div className="divider" />

              {/* 3. Tempo Médio entre Visitas & Métricas do Paciente */}
              <div style={{ display: 'grid', gridTemplateColumns: showValues ? '1fr 1fr' : '1fr', gap: 8, marginBottom: 12 }}>
                <div style={{ textAlign: 'center', background: 'var(--bg-main)', borderRadius: 8, padding: '10px 6px' }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-primary)' }}>
                    {selected.totalSessoes}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Sessões Feitas</div>
                </div>
                {showValues && (
                  <div style={{ textAlign: 'center', background: 'var(--bg-main)', borderRadius: 8, padding: '10px 6px' }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--success)' }}>
                      {formatBRL(selected.totalGasto)}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Valor em Finalizados*</div>
                  </div>
                )}
              </div>

              {showValues && (
                <div style={{ padding: '9px 10px', borderRadius: 8, background: '#FFFBEB', border: '1px solid #FDE68A', color: '#92400E', fontSize: 9.5, lineHeight: 1.4, marginBottom: 12 }}>
                  * Valor informado na Agenda. Não confirma pagamento.
                </div>
              )}

              {showValues && (
                <button
                  className="btn btn-primary btn-sm"
                  style={{ width: '100%', justifyContent: 'center', marginBottom: 12 }}
                  onClick={() => setCommercialHistoryOpen(true)}
                >
                  <Activity style={{ width: 14, height: 14 }} />
                  Ver Histórico Comercial
                </button>
              )}

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
                    {showValues && (
                      <div style={{ fontWeight: 700, color: 'var(--success)', fontSize: 12 }}>
                        {formatBRL(h.valor)}
                      </div>
                    )}
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
