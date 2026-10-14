/* eslint-disable react/prop-types */
/**
 * InteligenicaComercial.jsx
 * Sub-aba de Inteligência Comercial dentro de Marketing.
 * Três visões: Visão Geral, Clientes e Públicos, Canais e Campanhas.
 *
 * Carregado sob demanda (conditional render em Marketing.jsx).
 * Não faz chamadas à Meta, Instagram, nem altera automações existentes.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import {
  TrendingUp, Users, UserPlus, RefreshCw, Target, AlertTriangle,
  Clock, CheckCircle, Plus, Archive, ChevronRight, Info, Settings,
  Search, Layers, Star, Megaphone, BookOpen, X, Save, Eye,
  BarChart2, Filter, AlertCircle, HelpCircle,
} from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import {
  checkIntelligenceSetup,
  fetchOverviewMetrics,
  fetchCanalStats,
  fetchClientRFM,
  fetchSegments,
  saveSegment,
  updateSegment,
  archiveSegment,
  previewSegment,
  fetchIcpProfiles,
  saveIcpProfile,
  updateIcpProfile,
  fetchCampaignBrief,
  saveCampaignBrief,
  fetchCommercialSettings,
  saveCommercialSettings,
  getDateRange,
  fmtDate,
  fmtBRL,
} from '../../../services/inteligenciaComercialService';

// ─── Constantes ───────────────────────────────────────────────────────────────

const PERIOD_PRESETS = [
  { key: '7d',  label: 'Últimos 7 dias' },
  { key: '30d', label: 'Últimos 30 dias' },
  { key: '90d', label: 'Últimos 90 dias' },
  { key: '12m', label: 'Últimos 12 meses' },
];

const SUBVIEWS = [
  { key: 'visao-geral',       label: 'Visão Geral',       icon: BarChart2 },
  { key: 'clientes-publicos', label: 'Clientes e Públicos', icon: Users },
  { key: 'canais-campanhas',  label: 'Canais e Campanhas', icon: Target },
];

const SEGMENT_FIELDS_LEAD = [
  { value: 'origem',                label: 'Origem' },
  { value: 'servico_interesse',     label: 'Serviço de interesse' },
  { value: 'status',                label: 'Etapa do CRM' },
  { value: 'responsavel',           label: 'Responsável' },
  { value: 'proxima_acao_concluida',label: 'Próxima ação concluída' },
  { value: 'proxima_acao_prazo',    label: 'Prazo da próxima ação' },
];

const SEGMENT_FIELDS_CLIENT = [
  { value: 'source',       label: 'Origem' },
  { value: 'status',       label: 'Status' },
  { value: 'city',         label: 'Cidade' },
  { value: 'neighborhood', label: 'Bairro' },
  { value: 'name',         label: 'Nome' },
];

const OPERATORS_TEXT = [
  { value: 'eq',       label: 'igual a' },
  { value: 'neq',      label: 'diferente de' },
  { value: 'contains', label: 'contém' },
  { value: 'is_null',  label: 'não informado' },
  { value: 'not_null', label: 'informado' },
];

const OPERATORS_DATE = [
  { value: 'gte', label: 'a partir de' },
  { value: 'lte', label: 'até' },
  { value: 'eq',  label: 'igual a' },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function MetricCard({ label, value, sublabel, unit, note, color = '#8B5CF6', icon: Icon, loading, unavailable }) {
  return (
    <div style={{
      background: 'var(--bg-card)',
      border: `1px solid ${unavailable ? '#374151' : color + '33'}`,
      borderRadius: 12,
      padding: '20px 24px',
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      minWidth: 160,
      flex: 1,
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: unavailable ? '#374151' : color, borderRadius: '12px 12px 0 0' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {Icon && <Icon size={16} style={{ color: unavailable ? 'var(--text-muted)' : color }} />}
        <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>{label}</span>
      </div>
      {loading ? (
        <div style={{ height: 40, display: 'flex', alignItems: 'center' }}>
          <div style={{ width: 60, height: 28, background: 'var(--bg-main)', borderRadius: 6, animation: 'pulse 1.5s infinite' }} />
        </div>
      ) : unavailable ? (
        <div>
          <span style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic' }}>Indisponível</span>
          {note && <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '4px 0 0', lineHeight: 1.4 }}>{note}</p>}
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{ fontSize: 32, fontWeight: 700, color: 'var(--text-dark)', lineHeight: 1 }}>
              {value === null || value === undefined ? '—' : value}
            </span>
            {unit && <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{unit}</span>}
          </div>
          {sublabel && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{sublabel}</span>}
          {note && <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0, lineHeight: 1.4 }}>{note}</p>}
        </>
      )}
    </div>
  );
}

function ActionCard({ label, count, description, color, icon: Icon, onAction, actionLabel, loading }) {
  return (
    <div style={{
      background: 'var(--bg-card)',
      border: `1px solid ${color}33`,
      borderRadius: 12,
      padding: '18px 20px',
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      flex: 1,
      minWidth: 200,
    }}>
      <div style={{
        width: 48, height: 48, borderRadius: 10,
        background: color + '18',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <Icon size={22} style={{ color }} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-dark)' }}>
            {loading ? '…' : (count ?? 0)}
          </span>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{label}</span>
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 0', lineHeight: 1.4 }}>{description}</p>
      </div>
      {onAction && (
        <button
          onClick={onAction}
          style={{
            background: color + '18', border: `1px solid ${color}44`,
            borderRadius: 8, padding: '6px 12px',
            color, fontSize: 12, fontWeight: 500,
            cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
          }}
        >
          {actionLabel || 'Ver →'}
        </button>
      )}
    </div>
  );
}

function CoverageStrip({ cobertura, loading }) {
  if (loading) return null;
  if (!cobertura) return null;
  const pct = cobertura.pct_com_client;
  const semClient = cobertura.total_appointments_finalizados - cobertura.appointments_com_client;

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 10,
      padding: '14px 20px',
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      flexWrap: 'wrap',
    }}>
      <Info size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
      <span style={{ fontSize: 13, color: 'var(--text-muted)', flex: 1, minWidth: 200 }}>
        <strong style={{ color: 'var(--text-dark)' }}>Qualidade dos dados:</strong>
        {' '}{cobertura.total_appointments_finalizados} atendimentos finalizados no período —
        {' '}{cobertura.appointments_com_client} com cliente vinculado
        {pct !== null ? ` (${pct}%)` : ''}.
        {semClient > 0 && (
          <> {semClient} sem vínculo de cliente — não entram nos indicadores por cliente.</>
        )}
      </span>
      <span style={{
        fontSize: 11, padding: '3px 10px', borderRadius: 20,
        background: pct === null ? '#374151' : pct >= 80 ? '#10B98118' : pct >= 50 ? '#D9770618' : '#DC262618',
        color: pct === null ? 'var(--text-muted)' : pct >= 80 ? '#10B981' : pct >= 50 ? '#D97706' : '#DC2626',
        fontWeight: 600,
      }}>
        {pct === null ? 'Sem dados' : `${pct}% vinculados`}
      </span>
    </div>
  );
}

function RevenueUnavailableCard() {
  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid #374151',
      borderRadius: 12,
      padding: '20px 24px',
      display: 'flex',
      gap: 14,
      alignItems: 'flex-start',
    }}>
      <AlertCircle size={18} style={{ color: '#6B7280', flexShrink: 0, marginTop: 2 }} />
      <div>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)', fontWeight: 600 }}>
          Recebimentos confirmados — Indisponível
        </p>
        <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
          <code>sheet_transactions.client</code> é texto livre sem chave para <code>clients</code>.
          Para habilitar este indicador, associe manualmente os lançamentos via{' '}
          <strong>Qualidade dos dados → Conciliação financeira</strong> (em desenvolvimento).
        </p>
      </div>
    </div>
  );
}

function SetupPendingBanner({ reason }) {
  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid #D9770644',
      borderRadius: 12,
      padding: '32px',
      textAlign: 'center',
      maxWidth: 520,
      margin: '60px auto',
    }}>
      <AlertTriangle size={40} style={{ color: '#D97706', marginBottom: 16 }} />
      <h3 style={{ margin: '0 0 12px', color: 'var(--text-dark)', fontSize: 18 }}>
        Configuração do banco pendente
      </h3>
      <p style={{ margin: '0 0 20px', color: 'var(--text-muted)', fontSize: 14, lineHeight: 1.6 }}>
        As tabelas e funções da Inteligência Comercial não foram encontradas.
        Execute <code style={{ background: 'var(--bg-main)', padding: '2px 6px', borderRadius: 4 }}>
          marketing_inteligencia_migration.sql
        </code> no SQL Editor do Supabase e recarregue.
      </p>
      {reason === 'tables_missing' && (
        <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>
          O restante do ERP continua funcionando normalmente.
        </p>
      )}
    </div>
  );
}

// ─── Visão Geral ─────────────────────────────────────────────────────────────

function VisaoGeral({ periodPreset, onPeriodChange }) {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const { from, to } = useMemo(() => getDateRange(periodPreset), [periodPreset]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: err } = await fetchOverviewMetrics(from, to);
    if (err) {
      setError(err?.message || 'Erro ao carregar métricas');
    } else {
      setMetrics(data);
    }
    setLoading(false);
  }, [from, to]);

  useEffect(() => { load(); }, [load]);

  const m = metrics || {};

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Período */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, color: 'var(--text-muted)', marginRight: 4 }}>Período:</span>
        {PERIOD_PRESETS.map(p => (
          <button
            key={p.key}
            onClick={() => onPeriodChange(p.key)}
            style={{
              padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 500,
              border: periodPreset === p.key ? '1px solid #8B5CF6' : '1px solid var(--border)',
              background: periodPreset === p.key ? '#8B5CF620' : 'transparent',
              color: periodPreset === p.key ? '#8B5CF6' : 'var(--text-muted)',
              cursor: 'pointer',
            }}
          >{p.label}</button>
        ))}
        <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 4 }}>
          {fmtDate(from)} – {fmtDate(to)}
        </span>
        <button onClick={load} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
          <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
        </button>
      </div>

      {error && (
        <div style={{ background: '#DC262618', border: '1px solid #DC262644', borderRadius: 8, padding: '12px 16px', color: '#DC2626', fontSize: 13 }}>
          Erro ao carregar métricas: {error}
        </div>
      )}

      {/* Indicadores principais */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <MetricCard
          label="Clientes atendidos"
          value={m.clientes_atendidos}
          sublabel={`${m.novos_clientes ?? '—'} novos observados no período`}
          note="Distintos com atendimento finalizado no período"
          icon={Users}
          color="#8B5CF6"
          loading={loading}
        />
        <MetricCard
          label="Clientes que retornaram"
          value={m.clientes_retorno}
          unit={m.participacao_retorno != null ? `(${m.participacao_retorno}% dos atendidos)` : ''}
          note="Com atendimento finalizado anterior ao início do período. Não é taxa de retenção de coorte."
          icon={RefreshCw}
          color="#10B981"
          loading={loading}
        />
        <MetricCard
          label="Interessados registrados"
          value={m.interessados}
          sublabel={m.conversao_agendamento != null
            ? `${m.leads_com_agendamento} com agendamento (${m.conversao_agendamento}%)`
            : `${m.leads_com_agendamento ?? '—'} com agendamento vinculado`}
          note="Leads criados no CRM no período. Conversão: coorte com appointment_id."
          icon={UserPlus}
          color="#3B82F6"
          loading={loading}
        />
        <MetricCard
          label="Recebimentos confirmados"
          unavailable
          note="sheet_transactions.client é texto sem FK para clients."
          icon={TrendingUp}
          loading={loading}
        />
      </div>

      {/* Oportunidades agora (retrato atual, não período) */}
      <div>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Agora — retrato da operação
        </p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <ActionCard
            label="retornos pendentes"
            description="Próxima ação vencida, não concluída, lead aberto"
            count={loading ? null : (m.retornos_pendentes ?? 0)}
            color="#DC2626"
            icon={AlertTriangle}
            loading={loading}
            actionLabel="Ver no CRM →"
            onAction={() => window.location.href = '/crm'}
          />
          <ActionCard
            label="sem próximo passo"
            description="Lead aberto sem próxima ação definida"
            count={loading ? null : (m.leads_sem_proximo_passo ?? 0)}
            color="#D97706"
            icon={Clock}
            loading={loading}
            actionLabel="Ver no CRM →"
            onAction={() => window.location.href = '/crm'}
          />
          <div style={{
            background: 'var(--bg-card)',
            border: '1px dashed var(--border)',
            borderRadius: 12,
            padding: '18px 20px',
            flex: 1, minWidth: 200,
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <CheckCircle size={20} style={{ color: 'var(--text-muted)' }} />
            <span style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.4 }}>
              Configure segmentos de retorno em <strong>Clientes e Públicos</strong> para criar um terceiro cartão personalizado.
            </span>
          </div>
        </div>
      </div>

      {/* Recebimentos — card de ausência */}
      <RevenueUnavailableCard />

      {/* Qualidade dos dados */}
      <CoverageStrip cobertura={m.cobertura} loading={loading} />

    </div>
  );
}

// ─── Visão: Clientes e Públicos ──────────────────────────────────────────────

function ClientesPublicos({ periodPreset }) {
  const { user } = useAuth();
  const [subTab, setSubTab] = useState('rfm');
  const [rfmData, setRfmData] = useState([]);
  const [rfmLoading, setRfmLoading] = useState(false);
  const [rfmError, setRfmError] = useState(null);

  const [segments, setSegments] = useState([]);
  const [segLoading, setSegLoading] = useState(false);
  const [showSegEditor, setShowSegEditor] = useState(false);
  const [editingSeg, setEditingSeg] = useState(null);

  const [icpProfiles, setIcpProfiles] = useState([]);
  const [icpLoading, setIcpLoading] = useState(false);
  const [showIcpForm, setShowIcpForm] = useState(false);
  const [icpForm, setIcpForm] = useState({ name: '', necessidades: '', servicos_interesse: [], regiao: '', criterios_relacionamento: '', responsavel: '', status: 'hipotese' });

  const { from, to } = useMemo(() => getDateRange(periodPreset), [periodPreset]);

  // Carregar RFM
  useEffect(() => {
    if (subTab !== 'rfm') return;
    setRfmLoading(true);
    fetchClientRFM(from, to, 50, 0).then(({ data, error }) => {
      if (error) setRfmError(error?.message || 'Erro ao carregar dados');
      else { setRfmData(data || []); setRfmError(null); }
      setRfmLoading(false);
    });
  }, [subTab, from, to]);

  // Carregar segmentos
  useEffect(() => {
    if (subTab !== 'segmentos') return;
    setSegLoading(true);
    fetchSegments().then(({ data }) => {
      setSegments(data || []);
      setSegLoading(false);
    });
  }, [subTab]);

  // Carregar ICP
  useEffect(() => {
    if (subTab !== 'icp') return;
    setIcpLoading(true);
    fetchIcpProfiles().then(({ data }) => {
      setIcpProfiles(data || []);
      setIcpLoading(false);
    });
  }, [subTab]);

  const handleArchiveSeg = async (id) => {
    await archiveSegment(id);
    setSegments(prev => prev.filter(s => s.id !== id));
  };

  const handleSaveIcp = async () => {
    const { data, error } = await saveIcpProfile(icpForm);
    if (!error && data) {
      setIcpProfiles(prev => [data, ...prev]);
      setShowIcpForm(false);
      setIcpForm({ name: '', necessidades: '', servicos_interesse: [], regiao: '', criterios_relacionamento: '', responsavel: '', status: 'hipotese' });
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Sub-tabs */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
        {[
          { key: 'rfm', label: 'Ficha RFM' },
          { key: 'segmentos', label: 'Segmentos' },
          { key: 'icp', label: 'Perfis ICP' },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setSubTab(t.key)}
            style={{
              padding: '8px 16px', background: 'none',
              border: 'none', borderBottom: subTab === t.key ? '2px solid #8B5CF6' : '2px solid transparent',
              color: subTab === t.key ? '#8B5CF6' : 'var(--text-muted)',
              fontWeight: subTab === t.key ? 600 : 400,
              fontSize: 13, cursor: 'pointer',
              marginBottom: -1,
            }}
          >{t.label}</button>
        ))}
      </div>

      {/* ── Ficha RFM ── */}
      {subTab === 'rfm' && (
        <div>
          <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)', flex: 1 }}>
              Recência e frequência de atendimento. <strong>Período:</strong> {fmtDate(from)} – {fmtDate(to)}.
              Valor (V do RFM) indisponível: <code>sheet_transactions.client</code> é texto sem FK.
            </p>
          </div>
          {rfmLoading ? (
            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Carregando…</p>
          ) : rfmError ? (
            <p style={{ color: '#DC2626', fontSize: 13 }}>{rfmError}</p>
          ) : rfmData.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
              Nenhum cliente com atendimento finalizado no período selecionado.
            </p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {['Cliente', 'Origem', 'Primeiro atend.', 'Último atend.', 'Dias sem atend.', 'Atend. no período', 'Total histórico'].map(h => (
                      <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rfmData.map((r, i) => (
                    <tr key={r.client_id} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? 'transparent' : 'var(--bg-main)' }}>
                      <td style={{ padding: '8px 12px', color: 'var(--text-dark)', fontWeight: 500 }}>{r.client_name}</td>
                      <td style={{ padding: '8px 12px', color: 'var(--text-muted)' }}>
                        {r.client_source
                          ? <span style={{ background: '#8B5CF618', color: '#8B5CF6', padding: '2px 8px', borderRadius: 10, fontSize: 11 }}>{r.client_source}</span>
                          : <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: 11 }}>Não informada</span>
                        }
                      </td>
                      <td style={{ padding: '8px 12px', color: 'var(--text-muted)' }}>{fmtDate(r.primeiro_atendimento)}</td>
                      <td style={{ padding: '8px 12px', color: 'var(--text-muted)' }}>{fmtDate(r.ultimo_atendimento)}</td>
                      <td style={{ padding: '8px 12px' }}>
                        <span style={{
                          color: r.dias_sem_atendimento > 60 ? '#DC2626' : r.dias_sem_atendimento > 30 ? '#D97706' : '#10B981',
                          fontWeight: 600,
                        }}>{r.dias_sem_atendimento}d</span>
                      </td>
                      <td style={{ padding: '8px 12px', color: 'var(--text-dark)', textAlign: 'center' }}>{r.atendimentos_periodo}</td>
                      <td style={{ padding: '8px 12px', color: 'var(--text-muted)', textAlign: 'center' }}>{r.atendimentos_total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Segmentos ── */}
      {subTab === 'segmentos' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>
              Segmentos salvos com critérios versionados. Pertencer a um segmento não equivale a autorizar envio.
            </p>
            <button
              onClick={() => { setEditingSeg(null); setShowSegEditor(true); }}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px', background: '#8B5CF6', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}
            >
              <Plus size={14} /> Novo segmento
            </button>
          </div>

          {showSegEditor && (
            <SegmentEditor
              initial={editingSeg}
              segments={segments}
              onSave={async (seg) => {
                const authorName = user?.user_metadata?.full_name || user?.email;
                let res;
                if (editingSeg?.id) {
                  res = await updateSegment(editingSeg.id, seg, editingSeg.version);
                } else {
                  res = await saveSegment(seg, user?.id, authorName);
                }
                if (res.error) {
                  alert(res.error.message || 'Erro ao salvar segmento');
                  return;
                }
                fetchSegments().then(({ data }) => setSegments(data || []));
                setShowSegEditor(false);
                setEditingSeg(null);
              }}
              onClose={() => { setShowSegEditor(false); setEditingSeg(null); }}
            />
          )}

          {segLoading ? (
            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Carregando…</p>
          ) : segments.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Nenhum segmento salvo ainda.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {segments.map(seg => (
                <div key={seg.id} style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  padding: '14px 18px',
                  display: 'flex', alignItems: 'center', gap: 12,
                }}>
                  <Layers size={16} style={{ color: '#8B5CF6', flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-dark)', fontSize: 14 }}>{seg.name}</span>
                      <span style={{
                        fontSize: 10, padding: '2px 8px', borderRadius: 10,
                        background: seg.entity_base === 'lead' ? '#3B82F618' : '#10B98118',
                        color: seg.entity_base === 'lead' ? '#3B82F6' : '#10B981',
                        fontWeight: 600, textTransform: 'uppercase',
                      }}>{seg.entity_base}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>v{seg.version}</span>
                    </div>
                    {seg.description && (
                      <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>{seg.description}</p>
                    )}
                    <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--text-muted)' }}>
                      {seg.conditions?.length ?? 0} condição(ões) · autor: {seg.author_name || '—'}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      onClick={() => { setEditingSeg(seg); setShowSegEditor(true); }}
                      style={{ padding: '5px 10px', background: 'none', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer' }}
                    >Editar</button>
                    <button
                      onClick={() => handleArchiveSeg(seg.id)}
                      style={{ padding: '5px 10px', background: 'none', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer' }}
                    ><Archive size={12} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Perfis ICP ── */}
      {subTab === 'icp' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>
              Hipóteses de público ideal sustentadas por segmento e evidência. A gestão valida.
            </p>
            <button
              onClick={() => setShowIcpForm(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px', background: '#8B5CF6', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}
            >
              <Plus size={14} /> Novo perfil
            </button>
          </div>

          {showIcpForm && (
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <h4 style={{ margin: 0, color: 'var(--text-dark)' }}>Novo perfil ICP</h4>
                <button onClick={() => setShowIcpForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={18} /></button>
              </div>
              {[
                { key: 'name', label: 'Nome do perfil *', placeholder: 'Ex: Mulheres 30-45 de Pinheiros' },
                { key: 'necessidades', label: 'Necessidades declaradas', placeholder: 'O que buscam?' },
                { key: 'regiao', label: 'Região', placeholder: 'Bairro, cidade ou área' },
                { key: 'criterios_relacionamento', label: 'Critérios de relacionamento', placeholder: 'Frequência, serviços, etc.' },
                { key: 'responsavel', label: 'Responsável', placeholder: '' },
              ].map(f => (
                <div key={f.key}>
                  <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>{f.label}</label>
                  <input
                    className="form-input"
                    placeholder={f.placeholder}
                    value={icpForm[f.key] || ''}
                    onChange={e => setIcpForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                  />
                </div>
              ))}
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Status</label>
                <select className="form-select" value={icpForm.status} onChange={e => setIcpForm(prev => ({ ...prev, status: e.target.value }))}>
                  <option value="hipotese">Hipótese (ainda não validado)</option>
                  <option value="validado">Validado pela gestão</option>
                </select>
              </div>
              <button
                onClick={handleSaveIcp}
                disabled={!icpForm.name}
                style={{ padding: '8px 20px', background: '#8B5CF6', border: 'none', borderRadius: 8, color: '#fff', fontWeight: 600, cursor: icpForm.name ? 'pointer' : 'not-allowed', opacity: icpForm.name ? 1 : 0.5, alignSelf: 'flex-start' }}
              ><Save size={14} style={{ marginRight: 6 }} />Salvar perfil</button>
            </div>
          )}

          {icpLoading ? (
            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Carregando…</p>
          ) : icpProfiles.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Nenhum perfil ICP cadastrado ainda.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {icpProfiles.map(p => (
                <div key={p.id} style={{
                  background: 'var(--bg-card)', border: '1px solid var(--border)',
                  borderRadius: 10, padding: '16px 20px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                    <Star size={16} style={{ color: p.status === 'validado' ? '#10B981' : '#D97706' }} />
                    <span style={{ fontWeight: 600, color: 'var(--text-dark)' }}>{p.name}</span>
                    <span style={{
                      fontSize: 11, padding: '2px 8px', borderRadius: 10, fontWeight: 600,
                      background: p.status === 'validado' ? '#10B98118' : '#D9770618',
                      color: p.status === 'validado' ? '#10B981' : '#D97706',
                    }}>{p.status === 'validado' ? 'Validado pela gestão' : 'Hipótese'}</span>
                  </div>
                  {p.necessidades && <p style={{ margin: '0 0 4px', fontSize: 13, color: 'var(--text-muted)' }}><strong>Necessidades:</strong> {p.necessidades}</p>}
                  {p.regiao && <p style={{ margin: '0 0 4px', fontSize: 13, color: 'var(--text-muted)' }}><strong>Região:</strong> {p.regiao}</p>}
                  {p.responsavel && <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}><strong>Responsável:</strong> {p.responsavel}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Editor de Segmentos ─────────────────────────────────────────────────────

function SegmentEditor({ initial, onSave, onClose }) {
  const [form, setForm] = useState({
    name: initial?.name || '',
    description: initial?.description || '',
    entity_base: initial?.entity_base || 'lead',
    conditions: initial?.conditions || [],
    janela_dias: initial?.janela_dias || '',
  });
  const [preview, setPreview] = useState(null);
  const [prevLoading, setPrevLoading] = useState(false);
  const [prevError, setPrevError] = useState(null);
  const [saving, setSaving] = useState(false);

  const fields = form.entity_base === 'lead' ? SEGMENT_FIELDS_LEAD : SEGMENT_FIELDS_CLIENT;

  const addCondition = () => {
    setForm(f => ({
      ...f,
      conditions: [...f.conditions, { field: fields[0].value, operator: 'eq', value: '' }],
    }));
  };

  const updateCondition = (i, key, val) => {
    setForm(f => {
      const conds = [...f.conditions];
      conds[i] = { ...conds[i], [key]: val };
      return { ...f, conditions: conds };
    });
  };

  const removeCondition = (i) => {
    setForm(f => ({ ...f, conditions: f.conditions.filter((_, idx) => idx !== i) }));
  };

  const runPreview = async () => {
    setPrevLoading(true);
    setPrevError(null);
    const { data, error } = await previewSegment(form.entity_base, form.conditions, 10);
    if (error) { setPrevError(error?.message || 'Erro'); }
    else if (data?.error) { setPrevError(data.error); }
    else { setPreview(data); }
    setPrevLoading(false);
  };

  const handleSave = async () => {
    if (!form.name) return;
    setSaving(true);
    await onSave({ ...form, janela_dias: form.janela_dias ? Number(form.janela_dias) : null });
    setSaving(false);
  };

  const operatorsFor = (field) => {
    if (field === 'proxima_acao_prazo') return OPERATORS_DATE;
    return OPERATORS_TEXT;
  };

  const needsValue = (op) => !['is_null', 'not_null'].includes(op);

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid #8B5CF644',
      borderRadius: 12,
      padding: 20,
      display: 'flex', flexDirection: 'column', gap: 14,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h4 style={{ margin: 0, color: 'var(--text-dark)' }}>{initial ? 'Editar' : 'Novo'} segmento</h4>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={18} /></button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Nome *</label>
          <input className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Interessados sem agendamento" />
        </div>
        <div>
          <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Entidade-base</label>
          <select className="form-select" value={form.entity_base} onChange={e => setForm(f => ({ ...f, entity_base: e.target.value, conditions: [] }))}>
            <option value="lead">Interessado (lead)</option>
            <option value="cliente">Cliente</option>
          </select>
        </div>
        <div style={{ gridColumn: '1/-1' }}>
          <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Descrição</label>
          <input className="form-input" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Finalidade deste segmento" />
        </div>
      </div>

      {/* Condições */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Condições (combinadas por E)</span>
          <button
            onClick={addCondition}
            style={{ padding: '3px 10px', background: 'none', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer' }}
          >+ Adicionar</button>
        </div>

        {form.conditions.length === 0 && (
          <p style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>
            Nenhuma condição — o segmento inclui todos os registros da entidade-base.
            Campo desconhecido nunca satisfaz uma condição por acidente.
          </p>
        )}

        {form.conditions.map((cond, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
            <select
              className="form-select"
              value={cond.field}
              onChange={e => updateCondition(i, 'field', e.target.value)}
              style={{ flex: 1.5 }}
            >
              {fields.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
            <select
              className="form-select"
              value={cond.operator}
              onChange={e => updateCondition(i, 'operator', e.target.value)}
              style={{ flex: 1 }}
            >
              {operatorsFor(cond.field).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            {needsValue(cond.operator) && (
              <input
                className="form-input"
                value={cond.value || ''}
                onChange={e => updateCondition(i, 'value', e.target.value)}
                placeholder="Valor"
                style={{ flex: 1.5 }}
              />
            )}
            <button
              onClick={() => removeCondition(i)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#DC2626', padding: '0 4px' }}
            ><X size={14} /></button>
          </div>
        ))}
      </div>

      {/* Prévia */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <button
          onClick={runPreview}
          disabled={prevLoading}
          style={{ padding: '7px 16px', background: 'none', border: '1px solid #8B5CF6', borderRadius: 8, color: '#8B5CF6', fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' }}
        >
          <Eye size={14} style={{ marginRight: 6 }} />
          {prevLoading ? 'Calculando…' : 'Prévia'}
        </button>
        {prevError && <span style={{ fontSize: 12, color: '#DC2626', alignSelf: 'center' }}>{prevError}</span>}
        {preview && !prevError && (
          <div style={{ fontSize: 13, color: 'var(--text-muted)', alignSelf: 'center' }}>
            <strong style={{ color: 'var(--text-dark)' }}>{preview.count}</strong> registros correspondem às condições.
            {preview.sample?.length > 0 && (
              <span> Ex: {preview.sample.slice(0, 3).map(s => s.nome || s.name || s.id).join(', ')}{preview.count > 3 ? '…' : ''}</span>
            )}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={handleSave}
          disabled={!form.name || saving}
          style={{ padding: '8px 20px', background: '#8B5CF6', border: 'none', borderRadius: 8, color: '#fff', fontWeight: 600, cursor: form.name ? 'pointer' : 'not-allowed', opacity: form.name ? 1 : 0.5 }}
        >{saving ? 'Salvando…' : 'Salvar segmento'}</button>
        <button onClick={onClose} style={{ padding: '8px 16px', background: 'none', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-muted)', cursor: 'pointer' }}>Cancelar</button>
      </div>
    </div>
  );
}

// ─── Visão: Canais e Campanhas ────────────────────────────────────────────────

function CanaisCampanhas({ campanhas, periodPreset }) {
  const [canalStats, setCanalStats] = useState([]);
  const [canalLoading, setCanalLoading] = useState(true);
  const [canalError, setCanalError] = useState(null);

  const [selectedCampanha, setSelectedCampanha] = useState(null);
  const [brief, setBrief] = useState(null);
  const [briefLoading, setBriefLoading] = useState(false);
  const [briefSaving, setBriefSaving] = useState(false);
  const [briefForm, setBriefForm] = useState({});

  const { from, to } = useMemo(() => getDateRange(periodPreset), [periodPreset]);

  useEffect(() => {
    setCanalLoading(true);
    fetchCanalStats(from, to).then(({ data, error }) => {
      if (error) setCanalError(error?.message || 'Erro ao carregar canais');
      else { setCanalStats(data || []); setCanalError(null); }
      setCanalLoading(false);
    });
  }, [from, to]);

  const openBrief = async (campanha) => {
    setSelectedCampanha(campanha);
    setBriefLoading(true);
    const { data } = await fetchCampaignBrief(campanha.id);
    const b = data || {};
    setBrief(b);
    setBriefForm({
      campaign_id: campanha.id,
      objetivo: b.objetivo || '',
      meta: b.meta || '',
      publico_descricao: b.publico_descricao || '',
      responsavel: b.responsavel || '',
      okr_kr_ref: b.okr_kr_ref || '',
      orcamento_planejado: b.orcamento_planejado || '',
      investimento_realizado: b.investimento_realizado || '',
      resultado_observado: b.resultado_observado || '',
      decisao: b.decisao || '',
      aprendizado: b.aprendizado || '',
    });
    setBriefLoading(false);
  };

  const saveBrief = async () => {
    setBriefSaving(true);
    const { data, error } = await saveCampaignBrief({
      ...briefForm,
      orcamento_planejado: briefForm.orcamento_planejado ? Number(briefForm.orcamento_planejado) : null,
      investimento_realizado: briefForm.investimento_realizado ? Number(briefForm.investimento_realizado) : null,
    });
    if (!error && data) {
      setBrief(data);
      alert('Brief salvo com sucesso!');
    } else if (error) {
      alert('Erro ao salvar: ' + (error?.message || error));
    }
    setBriefSaving(false);
  };

  const CANAL_COLORS = ['#8B5CF6', '#3B82F6', '#10B981', '#D97706', '#DC2626', '#EC4899'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Tabela de desempenho por canal */}
      <div>
        <h4 style={{ margin: '0 0 12px', color: 'var(--text-dark)', fontSize: 15 }}>
          Desempenho por canal de origem
        </h4>
        <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--text-muted)' }}>
          Leads registrados no período {fmtDate(from)} – {fmtDate(to)} agrupados por <code>origem</code>.
          Atribuição simples: lead → appointment_id → atendimento. Recebimentos indisponíveis sem conciliação financeira.
        </p>

        {canalLoading ? (
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Carregando…</p>
        ) : canalError ? (
          <p style={{ color: '#DC2626', fontSize: 13 }}>{canalError}</p>
        ) : canalStats.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
            Nenhum lead registrado no período. Verifique o CRM ou ajuste o período.
          </p>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {['Canal / Origem', 'Interessados', 'Com agendamento', 'Clientes atendidos vinculados', 'Cobertura de atribuição', 'Recebimentos'].map(h => (
                      <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {canalStats.map((row, i) => {
                    const conversao = row.interessados_total > 0
                      ? Math.round((Number(row.interessados_com_agendamento) / Number(row.interessados_total)) * 100)
                      : null;
                    return (
                      <tr key={row.canal} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? 'transparent' : 'var(--bg-main)' }}>
                        <td style={{ padding: '8px 12px' }}>
                          <span style={{
                            background: CANAL_COLORS[i % CANAL_COLORS.length] + '18',
                            color: CANAL_COLORS[i % CANAL_COLORS.length],
                            padding: '2px 10px', borderRadius: 10, fontSize: 12, fontWeight: 600,
                          }}>{row.canal}</span>
                        </td>
                        <td style={{ padding: '8px 12px', color: 'var(--text-dark)', fontWeight: 600 }}>{row.interessados_total}</td>
                        <td style={{ padding: '8px 12px', color: 'var(--text-muted)' }}>{row.interessados_com_agendamento}</td>
                        <td style={{ padding: '8px 12px', color: 'var(--text-muted)' }}>{row.clientes_atendidos_vinculados}</td>
                        <td style={{ padding: '8px 12px' }}>
                          {conversao !== null
                            ? <span style={{ color: conversao > 50 ? '#10B981' : conversao > 20 ? '#D97706' : '#DC2626' }}>{conversao}%</span>
                            : <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Não calculável</span>
                          }
                        </td>
                        <td style={{ padding: '8px 12px', color: 'var(--text-muted)', fontStyle: 'italic', fontSize: 12 }}>Indisponível</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Gráfico */}
            <div style={{ height: 160, marginTop: 16 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={canalStats.slice(0, 8)} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="canal" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                  <Tooltip
                    contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: 'var(--text-dark)' }}
                  />
                  <Bar dataKey="interessados_total" name="Interessados" radius={[4, 4, 0, 0]}>
                    {canalStats.slice(0, 8).map((_, i) => (
                      <Cell key={i} fill={CANAL_COLORS[i % CANAL_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </div>

      {/* Campanhas com brief */}
      <div>
        <h4 style={{ margin: '0 0 12px', color: 'var(--text-dark)', fontSize: 15 }}>
          Campanhas — Plano e resultado
        </h4>
        <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--text-muted)' }}>
          Clique em uma campanha para abrir o brief analítico. Os campos originais da campanha são preservados.
        </p>

        {(!campanhas || campanhas.length === 0) ? (
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Nenhuma campanha cadastrada.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {campanhas.map(c => (
              <div
                key={c.id}
                style={{
                  background: 'var(--bg-card)',
                  border: selectedCampanha?.id === c.id ? '1px solid #8B5CF6' : '1px solid var(--border)',
                  borderRadius: 10,
                  padding: '14px 18px',
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 12,
                }}
                onClick={() => openBrief(c)}
              >
                <Megaphone size={16} style={{ color: '#8B5CF6', flexShrink: 0 }} />
                <span style={{ fontWeight: 500, color: 'var(--text-dark)', flex: 1 }}>{c.nome}</span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.canal}</span>
                <span style={{
                  fontSize: 11, padding: '2px 8px', borderRadius: 10, fontWeight: 600,
                  background: c.status === 'ativo' ? '#10B98118' : c.status === 'concluido' ? '#3B82F618' : '#6B728018',
                  color: c.status === 'ativo' ? '#10B981' : c.status === 'concluido' ? '#3B82F6' : '#6B7280',
                }}>{c.status}</span>
                <ChevronRight size={14} style={{ color: 'var(--text-muted)' }} />
              </div>
            ))}
          </div>
        )}

        {/* Brief form */}
        {selectedCampanha && (
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid #8B5CF644',
            borderRadius: 12,
            padding: 20,
            marginTop: 16,
            display: 'flex', flexDirection: 'column', gap: 14,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h4 style={{ margin: 0, color: 'var(--text-dark)' }}>
                Brief — {selectedCampanha.nome}
              </h4>
              <button onClick={() => setSelectedCampanha(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={18} /></button>
            </div>

            {briefLoading ? (
              <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Carregando…</p>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {[
                    { key: 'objetivo', label: 'Objetivo mensurável', placeholder: 'Ex: Aumentar agendamentos de limpeza de pele' },
                    { key: 'meta', label: 'Meta', placeholder: 'Ex: 20 agendamentos em outubro' },
                    { key: 'publico_descricao', label: 'Público / Segmento', placeholder: 'Descreva o público-alvo' },
                    { key: 'responsavel', label: 'Responsável', placeholder: '' },
                    { key: 'okr_kr_ref', label: 'Referência OKR (texto)', placeholder: 'Ex: KR-2024-Q4-1' },
                  ].map(f => (
                    <div key={f.key} style={{ gridColumn: f.key === 'publico_descricao' ? '1/-1' : undefined }}>
                      <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>{f.label}</label>
                      <input className="form-input" placeholder={f.placeholder} value={briefForm[f.key] || ''} onChange={e => setBriefForm(p => ({ ...p, [f.key]: e.target.value }))} />
                    </div>
                  ))}
                  <div>
                    <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Orçamento planejado (R$)</label>
                    <input className="form-input" type="number" placeholder="0,00" value={briefForm.orcamento_planejado || ''} onChange={e => setBriefForm(p => ({ ...p, orcamento_planejado: e.target.value }))} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Investimento realizado (R$)</label>
                    <input className="form-input" type="number" placeholder="0,00" value={briefForm.investimento_realizado || ''} onChange={e => setBriefForm(p => ({ ...p, investimento_realizado: e.target.value }))} />
                  </div>
                  <div style={{ gridColumn: '1/-1' }}>
                    <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Resultado observado</label>
                    <textarea className="form-input" rows={2} value={briefForm.resultado_observado || ''} onChange={e => setBriefForm(p => ({ ...p, resultado_observado: e.target.value }))} style={{ resize: 'vertical' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Decisão</label>
                    <select className="form-select" value={briefForm.decisao || ''} onChange={e => setBriefForm(p => ({ ...p, decisao: e.target.value }))}>
                      <option value="">Não definida</option>
                      <option value="repetir">Repetir</option>
                      <option value="ajustar">Ajustar</option>
                      <option value="encerrar">Encerrar</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Aprendizado</label>
                    <input className="form-input" placeholder="O que aprendemos com esta campanha?" value={briefForm.aprendizado || ''} onChange={e => setBriefForm(p => ({ ...p, aprendizado: e.target.value }))} />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button
                    onClick={saveBrief}
                    disabled={briefSaving}
                    style={{ padding: '8px 20px', background: '#8B5CF6', border: 'none', borderRadius: 8, color: '#fff', fontWeight: 600, cursor: 'pointer', opacity: briefSaving ? 0.7 : 1 }}
                  >{briefSaving ? 'Salvando…' : 'Salvar brief'}</button>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    Os campos originais da campanha ({selectedCampanha.canal}, mensagem, etc.) são preservados.
                  </span>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Componente Principal ─────────────────────────────────────────────────────

export default function InteligenicaComercial({ campanhas }) {
  const [subView, setSubView] = useState('visao-geral');
  const [setup, setSetup] = useState(null);
  const [periodPreset, setPeriodPreset] = useState('30d');

  useEffect(() => {
    checkIntelligenceSetup().then(setSetup);
  }, []);

  if (!setup) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
        Verificando configuração…
      </div>
    );
  }

  if (!setup.ready) {
    return <SetupPendingBanner reason={setup.reason} />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Cabeçalho */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10,
            background: 'linear-gradient(135deg, #8B5CF6, #6D28D9)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <TrendingUp size={18} style={{ color: '#fff' }} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, color: 'var(--text-dark)', fontWeight: 700 }}>Inteligência Comercial</h3>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>Dados → Público → Ideia → Campanha → Resultado</p>
          </div>
        </div>
      </div>

      {/* Sub-view tabs */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border)' }}>
        {SUBVIEWS.map(sv => {
          const Icon = sv.icon;
          return (
            <button
              key={sv.key}
              onClick={() => setSubView(sv.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '10px 18px',
                background: 'none',
                border: 'none',
                borderBottom: subView === sv.key ? '2px solid #8B5CF6' : '2px solid transparent',
                color: subView === sv.key ? '#8B5CF6' : 'var(--text-muted)',
                fontWeight: subView === sv.key ? 600 : 400,
                fontSize: 13, cursor: 'pointer',
                marginBottom: -1,
              }}
            >
              <Icon size={15} />
              {sv.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      {subView === 'visao-geral' && (
        <VisaoGeral periodPreset={periodPreset} onPeriodChange={setPeriodPreset} />
      )}
      {subView === 'clientes-publicos' && (
        <ClientesPublicos periodPreset={periodPreset} />
      )}
      {subView === 'canais-campanhas' && (
        <CanaisCampanhas campanhas={campanhas || []} periodPreset={periodPreset} />
      )}
    </div>
  );
}
