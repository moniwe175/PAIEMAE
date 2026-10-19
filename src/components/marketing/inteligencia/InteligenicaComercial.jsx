/* eslint-disable react/prop-types */
/**
 * InteligenicaComercial.jsx
 * Sub-aba de Inteligência Comercial dentro de Marketing.
 * Três visões: Visão Geral, Clientes e Públicos, Canais e Campanhas.
 *
 * Totalmente integrada com conciliação financeira, segmentos avançados por serviço/frequência,
 * ICP com evidências e validação, paginação de clientes, indicadores clicáveis (drilldown),
 * e fluxo completo de Público → Ideia → Campanha.
 *
 * Restrições rigorosas mantidas: sem chamadas à Meta, Instagram ou alteração de automações.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import {
  TrendingUp, Users, UserPlus, RefreshCw, Target, AlertTriangle,
  Clock, CheckCircle, Plus, Archive, ChevronRight, Info, Settings,
  Search, Layers, Star, Megaphone, BookOpen, X, Eye,
  BarChart2, Check, DollarSign,
  ArrowRight, ShieldCheck, Edit3, Link2, ExternalLink, Calendar,
  ChevronLeft,
} from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { supabase } from '../../../lib/supabase';
import { buildAutomaticAudienceInsights } from '../../../lib/automaticAudiences';
import { insertIdea } from '../../../services/marketingIdeasService';
import { fetchCampaigns, fetchClients } from '../../../services/supabaseService';
import {
  checkIntelligenceSetup,
  fetchOverviewMetrics,
  fetchCanalStats,
  fetchClientRFM,
  fetchAutomaticAudienceDataset,
  fetchSegments,
  saveSegment,
  updateSegment,
  archiveSegment,
  previewSegment,
  fetchIcpProfiles,
  saveIcpProfile,
  updateIcpProfile,
  validateIcpProfile,
  fetchCampaignBrief,
  saveCampaignBrief,
  fetchUnlinkedTransactions,
  linkCommercialRecord,
  unlinkCommercialRecord,
  fetchCommercialLinks,
  fetchCommercialSettings,
  saveCommercialSettings,
  getDateRange,
  getIsoDateRangeSaoPaulo,
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
  { key: 'visao-geral',       label: 'Visão Geral',         icon: BarChart2 },
  { key: 'clientes-publicos', label: 'Clientes e Públicos', icon: Users },
  { key: 'canais-campanhas',  label: 'Canais e Campanhas',  icon: Target },
];

const SEGMENT_FIELDS_LEAD = [
  { value: 'origem',                 label: 'Origem',                    type: 'text' },
  { value: 'servico_interesse',      label: 'Serviço de interesse',      type: 'text' },
  { value: 'status',                 label: 'Etapa do CRM',              type: 'text' },
  { value: 'responsavel',            label: 'Responsável',               type: 'text' },
  { value: 'proxima_acao_concluida', label: 'Próxima ação concluída',    type: 'boolean' },
  { value: 'proxima_acao_prazo',     label: 'Prazo da próxima ação',     type: 'date' },
];

const SEGMENT_FIELDS_CLIENT = [
  { value: 'name',                label: 'Nome do cliente',            type: 'text' },
  { value: 'source',              label: 'Origem de aquisição',        type: 'text' },
  { value: 'status',              label: 'Status do paciente',         type: 'text' },
  { value: 'city',                label: 'Cidade',                     type: 'text' },
  { value: 'neighborhood',        label: 'Bairro',                     type: 'text' },
  { value: 'total_atendimentos',  label: 'Total de atendimentos',      type: 'numeric' },
  { value: 'dias_sem_atendimento',label: 'Dias sem atendimento',       type: 'numeric' },
  { value: 'servico_realizado',   label: 'Serviço/procedimento feito', type: 'text' },
];

const OPERATORS_BY_TYPE = {
  text: [
    { value: 'eq',       label: 'igual a' },
    { value: 'neq',      label: 'diferente de' },
    { value: 'contains', label: 'contém' },
    { value: 'is_null',  label: 'não informado' },
    { value: 'not_null', label: 'informado' },
  ],
  numeric: [
    { value: 'gte',      label: 'maior ou igual a' },
    { value: 'lte',      label: 'menor ou igual a' },
    { value: 'eq',       label: 'igual a' },
    { value: 'neq',      label: 'diferente de' },
    { value: 'is_null',  label: 'não informado' },
    { value: 'not_null', label: 'informado' },
  ],
  date: [
    { value: 'gte',      label: 'a partir de' },
    { value: 'lte',      label: 'até' },
    { value: 'eq',       label: 'igual a' },
    { value: 'is_null',  label: 'não informado' },
    { value: 'not_null', label: 'informado' },
  ],
  boolean: [
    { value: 'eq',       label: 'é igual a' },
    { value: 'is_null',  label: 'não definido' },
    { value: 'not_null', label: 'definido' },
  ],
};

// ─── Componentes Compartilhados ───────────────────────────────────────────────

function MetricCard({
  label, value, sublabel, unit, note, color = '#8B5CF6',
  icon: Icon, loading, unavailable, onClick, badge,
}) {
  const isClickable = Boolean(onClick);

  return (
    <div
      onClick={isClickable ? onClick : undefined}
      style={{
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
        cursor: isClickable ? 'pointer' : 'default',
        transition: 'transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease',
      }}
      onMouseEnter={e => {
        if (isClickable) {
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.boxShadow = `0 8px 20px ${color}15`;
          e.currentTarget.style.borderColor = color;
        }
      }}
      onMouseLeave={e => {
        if (isClickable) {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = 'none';
          e.currentTarget.style.borderColor = unavailable ? '#374151' : color + '33';
        }
      }}
    >
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: unavailable ? '#374151' : color, borderRadius: '12px 12px 0 0' }} />
      
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {Icon && <Icon size={16} style={{ color: unavailable ? 'var(--text-muted)' : color }} />}
          <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>{label}</span>
        </div>
        {badge && (
          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 12, background: color + '18', color, fontWeight: 600 }}>
            {badge}
          </span>
        )}
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
          {isClickable && (
            <div style={{ fontSize: 11, color, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
              Ver registros <ChevronRight size={12} />
            </div>
          )}
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
      minWidth: 220,
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
            borderRadius: 8, padding: '7px 12px',
            color, fontSize: 12, fontWeight: 600,
            cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
            transition: 'background 0.2s',
          }}
        >
          {actionLabel || 'Ver →'}
        </button>
      )}
    </div>
  );
}

// ─── Modal de Detalhamento / Registros (Drilldown) ─────────────────────────────

function RecordsModal({ title, subtitle, items = [], loading, columns = [], onClose }) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 15;

  const filtered = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter(it => {
      return columns.some(c => {
        const val = it[c.key];
        if (val == null) return false;
        return String(val).toLowerCase().includes(q);
      });
    });
  }, [items, search, columns]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1100 }}>
      <div
        className="modal"
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: 860, width: '92%', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}
      >
        <div className="modal-header">
          <div>
            <span className="modal-title" style={{ fontSize: 16 }}>{title}</span>
            {subtitle && <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>{subtitle}</p>}
          </div>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>

        {/* Barra de pesquisa rápida */}
        <div style={{ padding: '8px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <Search size={14} style={{ color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="form-input"
            placeholder="Filtrar registros por paciente, procedimento, origem..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            style={{ fontSize: 12, padding: '4px 8px', flex: 1, border: 'none', background: 'transparent' }}
          />
          {search && (
            <button
              onClick={() => { setSearch(''); setPage(1); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 11 }}
            >
              Limpar busca
            </button>
          )}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          {loading ? (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '30px 0' }}>Carregando registros…</p>
          ) : paginated.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '30px 0' }}>
              {search ? 'Nenhum registro encontrado para a busca informada.' : 'Nenhum registro correspondente encontrado.'}
            </p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {columns.map(c => (
                    <th key={c.key} style={{ padding: '8px 12px', textAlign: c.align || 'left', color: 'var(--text-muted)', fontWeight: 600 }}>
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginated.map((it, idx) => (
                  <tr key={it.id || idx} style={{ borderBottom: '1px solid var(--border)', background: idx % 2 === 0 ? 'transparent' : 'var(--bg-main)' }}>
                    {columns.map(c => (
                      <td key={c.key} style={{ padding: '10px 12px', textAlign: c.align || 'left', color: 'var(--text-dark)' }}>
                        {c.render ? c.render(it) : it[c.key] || '—'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Rodapé com Paginação */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Exibindo {filtered.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} a {Math.min(currentPage * pageSize, filtered.length)} de {filtered.length} registro(s)
          </span>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {totalPages > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <button
                  className="btn btn-ghost"
                  style={{ fontSize: 11, padding: '4px 8px' }}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                >
                  <ChevronLeft size={14} /> Anterior
                </button>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', margin: '0 4px' }}>
                  {currentPage} / {totalPages}
                </span>
                <button
                  className="btn btn-ghost"
                  style={{ fontSize: 11, padding: '4px 8px' }}
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                >
                  Próxima <ChevronRight size={14} />
                </button>
              </div>
            )}
            <button className="btn btn-ghost" onClick={onClose}>Fechar</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Modal de Conciliação Financeira ──────────────────────────────────────────

function FinancialReconciliationModal({ from, to, onClose, onRefreshMetrics }) {
  const { user } = useAuth();
  const [tab, setTab] = useState('pendentes'); // 'pendentes' | 'confirmados'
  const [unlinked, setUnlinked] = useState([]);
  const [confirmed, setConfirmed] = useState([]);
  const [loading, setLoading] = useState(true);
  const [clientsList, setClientsList] = useState([]);
  const [selectedClients, setSelectedClients] = useState({}); // { txId: clientId }
  const [actionLoading, setActionLoading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [unlRes, confRes, cliRes] = await Promise.all([
      fetchUnlinkedTransactions(from, to, 100, 0),
      fetchCommercialLinks(100, 0),
      fetchClients(),
    ]);

    setUnlinked(unlRes.data || []);
    setConfirmed(confRes.data || []);
    setClientsList(cliRes.data || []);
    setLoading(false);
  }, [from, to]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleLink = async (tx) => {
    const clientId = selectedClients[tx.transaction_id] || tx.suggested_client_id;
    if (!clientId) {
      alert('Selecione um paciente para associar a esta transação.');
      return;
    }

    setActionLoading(true);
    const authorName = user?.user_metadata?.full_name || user?.email || 'Gestor';
    const { error } = await linkCommercialRecord({
      sourceTable: 'sheet_transactions',
      sourceId: tx.transaction_id,
      clientId: Number(clientId),
      authorId: user?.id,
      authorName,
      note: `Conciliado manualmente para ${tx.client_text}`,
    });

    if (error) {
      alert('Erro ao vincular: ' + error.message);
    } else {
      await loadData();
      if (onRefreshMetrics) onRefreshMetrics();
    }
    setActionLoading(false);
  };

  const handleUnlink = async (linkId) => {
    if (!confirm('Deseja realmente remover esta associação comercial?')) return;
    setActionLoading(true);
    const { error } = await unlinkCommercialRecord(linkId);
    if (error) {
      alert('Erro ao desvincular: ' + error.message);
    } else {
      await loadData();
      if (onRefreshMetrics) onRefreshMetrics();
    }
    setActionLoading(false);
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1200 }}>
      <div
        className="modal"
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: 940, width: '95%', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
      >
        <div className="modal-header">
          <div>
            <span className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <DollarSign size={18} style={{ color: '#10B981' }} />
              Conciliação Financeira Comercial
            </span>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
              Associação manual confirmada entre lançamentos da planilha e pacientes do cadastro.
            </p>
          </div>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>

        {/* Abas da conciliação */}
        <div style={{ display: 'flex', gap: 8, padding: '0 20px', borderBottom: '1px solid var(--border)' }}>
          <button
            onClick={() => setTab('pendentes')}
            style={{
              padding: '10px 16px', background: 'none', border: 'none',
              borderBottom: tab === 'pendentes' ? '2px solid #10B981' : '2px solid transparent',
              color: tab === 'pendentes' ? '#10B981' : 'var(--text-muted)',
              fontWeight: tab === 'pendentes' ? 600 : 400,
              fontSize: 13, cursor: 'pointer',
            }}
          >
            Lançamentos pendentes ({unlinked.length})
          </button>
          <button
            onClick={() => setTab('confirmados')}
            style={{
              padding: '10px 16px', background: 'none', border: 'none',
              borderBottom: tab === 'confirmados' ? '2px solid #10B981' : '2px solid transparent',
              color: tab === 'confirmados' ? '#10B981' : 'var(--text-muted)',
              fontWeight: tab === 'confirmados' ? 600 : 400,
              fontSize: 13, cursor: 'pointer',
            }}
          >
            Vínculos confirmados ({confirmed.length})
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          {loading ? (
            <p style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Carregando dados financeiros…</p>
          ) : tab === 'pendentes' ? (
            unlinked.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                <CheckCircle size={36} style={{ color: '#10B981', margin: '0 auto 12px' }} />
                <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-dark)', margin: 0 }}>Tudo conciliado!</p>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '4px 0 0' }}>
                  Não há lançamentos financeiros pendentes de associação para o período de {fmtDate(from)} a {fmtDate(to)}.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {unlinked.map(tx => {
                  const currentSelected = selectedClients[tx.transaction_id] || tx.suggested_client_id;
                  return (
                    <div
                      key={tx.transaction_id}
                      style={{
                        background: 'var(--bg-main)',
                        border: '1px solid var(--border)',
                        borderRadius: 10,
                        padding: '14px 18px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: 12,
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 240 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontWeight: 600, color: 'var(--text-dark)', fontSize: 14 }}>
                            {tx.client_text || '(Sem nome na planilha)'}
                          </span>
                          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                            • {fmtDate(tx.date_ref)}
                          </span>
                          <span style={{
                            fontSize: 11, padding: '2px 8px', borderRadius: 10,
                            background: '#10B98118', color: '#10B981', fontWeight: 600,
                          }}>
                            {fmtBRL(tx.gross)}
                          </span>
                        </div>
                        <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
                          Procedimento: {tx.procedure || '—'} • Método: {tx.payment_method || '—'} • Profissional: {tx.professional || '—'}
                        </p>
                      </div>

                      {/* Seleção do Paciente */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <label style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>Associar a paciente:</label>
                          <select
                            className="form-select"
                            style={{ fontSize: 12, padding: '5px 10px', minWidth: 200 }}
                            value={currentSelected || ''}
                            onChange={e => setSelectedClients(prev => ({ ...prev, [tx.transaction_id]: e.target.value }))}
                          >
                            <option value="">Selecione o paciente…</option>
                            {tx.suggested_client_id && (
                              <option value={tx.suggested_client_id}>
                                ⭐ Sugestão: {tx.suggested_client_name} (ID {tx.suggested_client_id})
                              </option>
                            )}
                            {clientsList
                              .filter(c => c.id !== tx.suggested_client_id)
                              .map(c => (
                                <option key={c.id} value={c.id}>
                                  {c.name} {c.phone ? `(${c.phone})` : ''}
                                </option>
                              ))}
                          </select>
                        </div>

                        <button
                          className="btn btn-primary"
                          style={{ alignSelf: 'flex-end', padding: '6px 14px', fontSize: 12 }}
                          disabled={actionLoading || !currentSelected}
                          onClick={() => handleLink(tx)}
                        >
                          <Check size={14} style={{ marginRight: 4 }} /> Confirmar Vínculo
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            confirmed.length === 0 ? (
              <p style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Nenhum vínculo confirmado ativo.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {confirmed.map(link => (
                  <div
                    key={link.id}
                    style={{
                      background: 'var(--bg-main)', border: '1px solid var(--border)',
                      borderRadius: 10, padding: '12px 16px', display: 'flex',
                      alignItems: 'center', justifyContent: 'space-between',
                    }}
                  >
                    <div>
                      <span style={{ fontWeight: 600, color: 'var(--text-dark)', fontSize: 13 }}>
                        {link.clients?.name || `Paciente #${link.client_id}`}
                      </span>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 8 }}>
                        (Origem ID: {link.source_id.slice(0, 8)}…)
                      </span>
                      <p style={{ margin: '3px 0 0', fontSize: 11, color: 'var(--text-muted)' }}>
                        Confirmado por {link.author_name || 'Gestão'} em {fmtDate(link.confirmed_at)} {link.note ? `• ${link.note}` : ''}
                      </p>
                    </div>
                    <button
                      className="btn btn-ghost"
                      style={{ color: '#DC2626', fontSize: 12, padding: '4px 10px' }}
                      disabled={actionLoading}
                      onClick={() => handleUnlink(link.id)}
                    >
                      Desvincular
                    </button>
                  </div>
                ))}
              </div>
            )
          )}
        </div>

        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost" onClick={onClose}>Concluir</button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal de Configurações Comerciais (Metas & North Star) ───────────────────

function CommercialSettingsModal({ onClose, onSaved }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    meta_mensal_atendimentos: '',
    meta_mensal_interessados: '',
    definicao_metrica_principal: '',
    okr_kr_ref: '',
    periodo_padrao_dias: 30,
  });

  useEffect(() => {
    fetchCommercialSettings().then(({ data }) => {
      if (data) {
        setForm({
          meta_mensal_atendimentos: data.meta_mensal_atendimentos ?? '',
          meta_mensal_interessados: data.meta_mensal_interessados ?? '',
          definicao_metrica_principal: data.definicao_metrica_principal || '',
          okr_kr_ref: data.okr_kr_ref || '',
          periodo_padrao_dias: data.periodo_padrao_dias || 30,
        });
      }
      setLoading(false);
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const { data, error } = await saveCommercialSettings(form, user?.id);
    if (error) {
      alert('Erro ao salvar configurações: ' + error.message);
    } else {
      if (onSaved) onSaved(data);
      onClose();
    }
    setSaving(false);
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1200 }}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 560, width: '92%' }}>
        <div className="modal-header">
          <span className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Settings size={18} style={{ color: '#8B5CF6' }} />
            Configurações Comerciais e Metas
          </span>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>

        {loading ? (
          <p style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>Carregando…</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '16px 20px' }}>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Metas e definições operacionais registradas pela gestão. Não alteram OKRs automaticamente.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                  Meta mensal de atendimentos
                </label>
                <input
                  type="number"
                  className="form-input"
                  placeholder="Ex: 80"
                  value={form.meta_mensal_atendimentos}
                  onChange={e => setForm(f => ({ ...f, meta_mensal_atendimentos: e.target.value }))}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                  Meta mensal de interessados (leads)
                </label>
                <input
                  type="number"
                  className="form-input"
                  placeholder="Ex: 120"
                  value={form.meta_mensal_interessados}
                  onChange={e => setForm(f => ({ ...f, meta_mensal_interessados: e.target.value }))}
                />
              </div>
            </div>

            <div>
              <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                Definição da Métrica Principal (North Star)
              </label>
              <textarea
                className="form-input"
                rows={2}
                placeholder="Ex: Clientes atendidos com alto nível de satisfação e retorno biológico planejado."
                value={form.definicao_metrica_principal}
                onChange={e => setForm(f => ({ ...f, definicao_metrica_principal: e.target.value }))}
              />
            </div>

            <div>
              <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                Referência a Objetivo / KR existente (OKR)
              </label>
              <input
                className="form-input"
                placeholder="Ex: KR-2026-Q4: Crescimento sustentável de novos atendimentos"
                value={form.okr_kr_ref}
                onChange={e => setForm(f => ({ ...f, okr_kr_ref: e.target.value }))}
              />
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 10 }}>
              <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Salvando…' : 'Salvar Metas'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Modal para Criar Ideia a Partir de Segmento ──────────────────────────────

function CreateIdeaFromSegmentModal({ segment, onClose, onSuccess }) {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    titulo: `Ação para: ${segment.name}`,
    descricao: segment.description || `Ação voltada ao público do segmento "${segment.name}" (${segment.conditions?.length || 0} critérios).`,
    canal: 'Instagram',
    tipo: 'conteudo',
    servico_tema: '',
    objetivo: 'Atrair e engajar este segmento específico',
    publico: segment.name,
    regiao: '',
  });

  const handleCreate = async () => {
    if (!form.titulo.trim()) {
      alert('Informe o título da ideia.');
      return;
    }
    setSaving(true);
    const { data, error } = await insertIdea({
      ...form,
      tags: ['inteligencia_comercial', segment.entity_base],
    }, user);

    if (error) {
      alert('Erro ao criar ideia: ' + error.message);
    } else {
      if (onSuccess) onSuccess(data);
      onClose();
    }
    setSaving(false);
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1200 }}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 560, width: '92%' }}>
        <div className="modal-header">
          <span className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <BookOpen size={18} style={{ color: '#8B5CF6' }} />
            Criar Ideia na Lousa a partir do Público
          </span>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>

        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>
            Cria uma nova ideia em <strong>Ideias e Planejamento</strong> com as hipóteses e critérios deste público já preenchidos.
          </p>

          <div>
            <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Título da Ideia *</label>
            <input className="form-input" value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Canal Principal</label>
              <select className="form-select" value={form.canal} onChange={e => setForm(f => ({ ...f, canal: e.target.value }))}>
                <option value="Instagram">Instagram</option>
                <option value="WhatsApp">WhatsApp</option>
                <option value="Live">Live</option>
                <option value="Stories">Stories</option>
                <option value="Reels">Reels</option>
                <option value="Outro">Outro</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Tipo</label>
              <select className="form-select" value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}>
                <option value="conteudo">Conteúdo</option>
                <option value="promocao">Ação Especial</option>
                <option value="live">Live</option>
                <option value="campanha">Campanha</option>
              </select>
            </div>
          </div>

          <div>
            <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Hipótese / Descrição da Ação</label>
            <textarea className="form-input" rows={2} value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} />
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
            <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
            <button className="btn btn-primary" onClick={handleCreate} disabled={saving}>
              {saving ? 'Criando…' : 'Criar Ideia na Lousa'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Modal para Vincular Público a Campanha com Snapshot ──────────────────────

function LinkCampaignModal({ segment, onClose, onSuccess }) {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedCampaignId, setSelectedCampaignId] = useState('');
  const [estimatedCount, setEstimatedCount] = useState(null);

  useEffect(() => {
    Promise.all([
      fetchCampaigns(),
      previewSegment(segment.entity_base, segment.conditions, 1, segment.janela_dias),
    ]).then(([campRes, prevRes]) => {
      setCampaigns(campRes.data || []);
      if (prevRes.data?.count !== undefined) {
        setEstimatedCount(prevRes.data.count);
      }
      setLoading(false);
    });
  }, [segment]);

  const handleLink = async () => {
    if (!selectedCampaignId) {
      alert('Selecione uma campanha para vincular este público.');
      return;
    }
    setSaving(true);
    const { data, error } = await saveCampaignBrief({
      campaign_id: Number(selectedCampaignId),
      segment_id: segment.id,
      segment_version: segment.version,
      conditions_snapshot: segment.conditions,
      estimated_count: estimatedCount,
      snapshot_date: new Date().toISOString(),
      publico_descricao: `Segmento: ${segment.name} (v${segment.version}) — estimado em ${estimatedCount ?? '—'} registros no momento do vínculo.`,
    });

    if (error) {
      alert('Erro ao vincular: ' + error.message);
    } else {
      if (onSuccess) onSuccess(data);
      onClose();
    }
    setSaving(false);
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1200 }}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 540, width: '92%' }}>
        <div className="modal-header">
          <span className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Link2 size={18} style={{ color: '#8B5CF6' }} />
            Vincular Público à Campanha
          </span>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>

        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>
            Vincula o segmento <strong>{segment.name}</strong> a uma campanha existente, gravando um
            snapshot imutável dos critérios e tamanho da amostra ({estimatedCount ?? '…'} pessoas).
          </p>

          {loading ? (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>Carregando campanhas…</p>
          ) : campaigns.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Nenhuma campanha disponível para vínculo.</p>
          ) : (
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                Selecione a Campanha *
              </label>
              <select
                className="form-select"
                value={selectedCampaignId}
                onChange={e => setSelectedCampaignId(e.target.value)}
              >
                <option value="">Selecione uma campanha…</option>
                {campaigns.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.nome} ({c.canal} • {c.status})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 10 }}>
            <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
            <button className="btn btn-primary" onClick={handleLink} disabled={saving || !selectedCampaignId}>
              {saving ? 'Vinculando…' : 'Confirmar Vínculo'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Visão 1: Visão Geral ─────────────────────────────────────────────────────

function VisaoGeral({ periodPreset, onPeriodChange, onSwitchTab }) {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [drilldown, setDrilldown] = useState(null);
  const [showReconciliation, setShowReconciliation] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

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

  // Detalhamento de Clientes Atendidos (com classificação rigorosa de Novo e Retorno)
  const openAttendedDrilldown = async (filterType = 'todos') => {
    setDrilldown({
      title: filterType === 'novos' ? 'Novos Clientes no Período' : filterType === 'retorno' ? 'Clientes que Retornaram no Período' : 'Clientes Atendidos no Período',
      subtitle: `Período: ${fmtDate(from)} a ${fmtDate(to)}`,
      loading: true,
      items: [],
    });

    // 1. Atendimentos finalizados no período
    const { data: periodAppts } = await supabase
      .from('appointments')
      .select('id, client_id, client_name, client_phone, procedure, appointment_date, status')
      .eq('status', 'finalizado')
      .gte('appointment_date', from)
      .lte('appointment_date', to)
      .order('appointment_date', { ascending: false });

    // Agrupa por cliente no período
    const clientMap = new Map();
    (periodAppts || []).forEach(a => {
      const cid = a.client_id;
      if (!cid) return;
      if (!clientMap.has(cid)) {
        clientMap.set(cid, {
          id: cid,
          client_id: cid,
          client_name: a.client_name || `Paciente #${cid}`,
          client_phone: a.client_phone || '—',
          procedure: a.procedure || '—',
          appointment_date: a.appointment_date,
          total_no_periodo: 0,
        });
      }
      clientMap.get(cid).total_no_periodo += 1;
    });

    const clientIds = Array.from(clientMap.keys());
    
    // 2. Verifica histórico prévio para saber se é Novo ou Retorno (mesma regra da RPC)
    const priorClientIds = new Set();
    if (clientIds.length > 0) {
      const { data: priorAppts } = await supabase
        .from('appointments')
        .select('client_id')
        .eq('status', 'finalizado')
        .lt('appointment_date', from)
        .in('client_id', clientIds);
      (priorAppts || []).forEach(p => priorClientIds.add(p.client_id));
    }

    const allClients = Array.from(clientMap.values()).map(c => {
      const isRetorno = priorClientIds.has(c.client_id);
      return {
        ...c,
        tipo: isRetorno ? 'Retorno' : 'Novo cliente',
      };
    });

    let filtered = allClients;
    if (filterType === 'novos') {
      filtered = allClients.filter(c => c.tipo === 'Novo cliente');
    } else if (filterType === 'retorno') {
      filtered = allClients.filter(c => c.tipo === 'Retorno');
    }

    setDrilldown({
      title: filterType === 'novos' ? 'Novos Clientes Observados' : filterType === 'retorno' ? 'Clientes que Retornaram' : 'Clientes Únicos Atendidos no Período',
      subtitle: `${filtered.length} paciente(s) entre ${fmtDate(from)} e ${fmtDate(to)}`,
      loading: false,
      items: filtered,
      columns: [
        { key: 'client_name', label: 'Paciente' },
        { key: 'client_phone', label: 'Telefone' },
        { key: 'procedure', label: 'Procedimento Recente' },
        { key: 'appointment_date', label: 'Último no Período', render: it => fmtDate(it.appointment_date) },
        { key: 'total_no_periodo', label: 'Atendimentos', align: 'center' },
        {
          key: 'tipo',
          label: 'Classificação',
          render: it => (
            <span style={{
              fontSize: 11,
              padding: '2px 8px',
              borderRadius: 12,
              fontWeight: 600,
              background: it.tipo === 'Retorno' ? '#10B9811A' : '#8B5CF61A',
              color: it.tipo === 'Retorno' ? '#10B981' : '#8B5CF6',
            }}>
              {it.tipo}
            </span>
          ),
        },
      ],
    });
  };

  // Detalhamento de Interessados (delimitado exatamente por America/Sao_Paulo)
  const openLeadsDrilldown = async (onlyConverted = false) => {
    setDrilldown({
      title: onlyConverted ? 'Interessados com Agendamento Válido' : 'Novos Interessados no Período',
      subtitle: `Período: ${fmtDate(from)} a ${fmtDate(to)}`,
      loading: true,
      items: [],
    });

    // Delimitação exata dos limites de data em America/Sao_Paulo (UTC-3)
    const { startIso, endIso } = getIsoDateRangeSaoPaulo(from, to);

    const { data: leadsData } = await supabase
      .from('crm_leads')
      .select('id, nome, telefone, origem, servico_interesse, status, created_at, appointment_id')
      .gte('created_at', startIso)
      .lte('created_at', endIso)
      .order('created_at', { ascending: false });

    // Verifica status real dos agendamentos vinculados
    const apptIds = (leadsData || []).map(l => l.appointment_id).filter(Boolean);
    const apptMap = new Map();
    if (apptIds.length > 0) {
      const { data: appts } = await supabase
        .from('appointments')
        .select('id, status, appointment_date, procedure')
        .in('id', apptIds);
      (appts || []).forEach(a => apptMap.set(a.id, a));
    }

    const processed = (leadsData || []).map(l => {
      const appt = l.appointment_id ? apptMap.get(l.appointment_id) : null;
      const isCanceled = appt && ['cancelado', 'desmarcado', 'falta'].includes(appt.status);
      const isPastCutoff = appt && appt.appointment_date > to;
      const isValid = appt && !isCanceled && !isPastCutoff;

      let agendamentoLabel = 'Sem agendamento';
      let agendamentoBadgeColor = 'var(--text-muted)';
      if (appt) {
        if (isCanceled) {
          agendamentoLabel = `Cancelado (${appt.status})`;
          agendamentoBadgeColor = '#DC2626';
        } else if (isPastCutoff) {
          agendamentoLabel = `Pós-corte (${fmtDate(appt.appointment_date)})`;
          agendamentoBadgeColor = '#D97706';
        } else {
          agendamentoLabel = `Válido (${fmtDate(appt.appointment_date)})`;
          agendamentoBadgeColor = '#10B981';
        }
      }

      return {
        ...l,
        isValidConversion: isValid,
        agendamentoLabel,
        agendamentoBadgeColor,
      };
    });

    const itemsToShow = onlyConverted ? processed.filter(l => l.isValidConversion) : processed;

    setDrilldown({
      title: onlyConverted ? 'Interessados com Agendamento Válido (Conversão)' : 'Interessados Registrados no CRM',
      subtitle: `${itemsToShow.length} lead(s) registrado(s) entre ${fmtDate(from)} e ${fmtDate(to)}`,
      loading: false,
      items: itemsToShow,
      columns: [
        { key: 'nome', label: 'Nome' },
        { key: 'origem', label: 'Origem', render: it => it.origem || 'Não informada' },
        { key: 'servico_interesse', label: 'Interesse' },
        { key: 'status', label: 'Etapa do CRM' },
        {
          key: 'agendamentoLabel',
          label: 'Situação Agendamento',
          render: it => (
            <span style={{ fontSize: 11, color: it.agendamentoBadgeColor, fontWeight: 600 }}>
              {it.agendamentoLabel}
            </span>
          ),
        },
        { key: 'created_at', label: 'Data de Entrada', render: it => fmtDate(it.created_at) },
      ],
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Barra de Período e Ações */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Período:</span>
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
            >
              {p.label}
            </button>
          ))}
          <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 4 }}>
            ({fmtDate(from)} – {fmtDate(to)})
          </span>
          <button onClick={load} title="Atualizar dados" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
            <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          </button>
        </div>

        <button
          className="btn btn-ghost"
          style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}
          onClick={() => setShowSettings(true)}
        >
          <Settings size={14} /> Metas e Definições
        </button>
      </div>

      {error && (
        <div style={{ background: '#DC262618', border: '1px solid #DC262644', borderRadius: 8, padding: '12px 16px', color: '#DC2626', fontSize: 13 }}>
          Erro ao carregar métricas: {error}
        </div>
      )}

      {/* 4 Indicadores Principais */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <MetricCard
          label="Clientes atendidos"
          value={m.clientes_atendidos}
          sublabel={`${m.novos_clientes ?? '—'} novos observados no período`}
          note="Distintos com atendimento finalizado no período"
          icon={Users}
          color="#8B5CF6"
          loading={loading}
          onClick={() => openAttendedDrilldown('todos')}
        />
        <MetricCard
          label="Clientes que retornaram"
          value={m.clientes_retorno}
          unit={m.participacao_retorno != null ? `(${m.participacao_retorno}% dos atendidos)` : ''}
          note="Com atendimento finalizado anterior ao início do período. Não é taxa de retenção de coorte."
          icon={RefreshCw}
          color="#10B981"
          loading={loading}
          onClick={() => openAttendedDrilldown('retorno')}
        />
        <MetricCard
          label="Interessados registrados"
          value={m.interessados}
          sublabel={m.conversao_agendamento != null
            ? `${m.leads_com_agendamento} com agendamento válido (${m.conversao_agendamento}%)`
            : `${m.leads_com_agendamento ?? '—'} com agendamento vinculado`}
          note="Leads criados no CRM no período. Conversão: coorte com agendamento não cancelado."
          icon={UserPlus}
          color="#3B82F6"
          loading={loading}
          onClick={() => openLeadsDrilldown(false)}
        />

        {/* Recebimentos confirmados e conciliados */}
        {m.receita_status === 'disponivel' || m.receita_status === 'parcial' ? (
          <MetricCard
            label="Recebimentos confirmados"
            value={fmtBRL(m.receita_liquida_vinculada)}
            sublabel={m.ticket_medio_vinculado ? `Ticket médio: ${fmtBRL(m.ticket_medio_vinculado)}` : 'Valores conciliados'}
            note={m.receita_nota}
            icon={TrendingUp}
            color="#059669"
            loading={loading}
            badge={`${m.saude_base?.cobertura_financeira_pct || 0}% conciliado`}
            onClick={() => setShowReconciliation(true)}
          />
        ) : (
          <MetricCard
            label="Recebimentos confirmados"
            unavailable
            note={m.receita_nota || 'sheet_transactions.client é texto sem FK. Associe na conciliação para habilitar valores.'}
            icon={TrendingUp}
            loading={loading}
            onClick={() => setShowReconciliation(true)}
          />
        )}
      </div>

      {/* Retrato da Operação: Onde focar agora */}
      <div>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Agora — retrato da operação
        </p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <ActionCard
            label="retornos pendentes"
            description="Próxima ação vencida, não concluída em lead aberto (exclui arquivados)"
            count={loading ? null : (m.retornos_pendentes ?? 0)}
            color="#DC2626"
            icon={AlertTriangle}
            loading={loading}
            actionLabel="Abrir CRM atrasados →"
            onAction={() => window.location.href = '/crm?filtro=atrasados'}
          />
          <ActionCard
            label="sem próximo passo"
            description="Lead aberto sem próxima ação definida no CRM"
            count={loading ? null : (m.interessados_sem_acao ?? 0)}
            color="#D97706"
            icon={Clock}
            loading={loading}
            actionLabel="Abrir CRM sem ação →"
            onAction={() => window.location.href = '/crm?filtro=sem_acao'}
          />
          <ActionCard
            label="revisar relacionamento"
            description="Clientes inativos ou sem retorno recente para reativação"
            count={m.clientes_atendidos ? Math.max(0, (m.clientes_atendidos - (m.clientes_retorno || 0))) : 0}
            color="#8B5CF6"
            icon={CheckCircle}
            loading={loading}
            actionLabel="Revisar Clientes →"
            onAction={() => {
              if (onSwitchTab) onSwitchTab('clientes-publicos', 'sem_retorno');
            }}
          />
        </div>
      </div>

      {/* Faixa de Qualidade dos Dados e Cobertura */}
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: '16px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 260 }}>
          <Info size={18} style={{ color: '#8B5CF6', flexShrink: 0 }} />
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            <strong style={{ color: 'var(--text-dark)' }}>Saúde da Base e Conciliação:</strong>
            {' '}{m.saude_base?.total_appointments ?? 0} atendimentos finalizados ({m.saude_base?.pct_com_client ?? 0}% com paciente vinculado).
            {' '}• {m.saude_base?.transacoes_vinculadas ?? 0} de {m.saude_base?.transacoes_total ?? 0} lançamentos conciliados ({m.saude_base?.cobertura_financeira_pct ?? 0}%).
          </div>
        </div>

        <button
          className="btn btn-primary"
          style={{ fontSize: 12, padding: '7px 16px', display: 'flex', alignItems: 'center', gap: 6 }}
          onClick={() => setShowReconciliation(true)}
        >
          <DollarSign size={14} /> Conciliação Financeira
        </button>
      </div>

      {/* Modais de drilldown e conciliação */}
      {drilldown && (
        <RecordsModal
          title={drilldown.title}
          subtitle={drilldown.subtitle}
          items={drilldown.items}
          loading={drilldown.loading}
          columns={drilldown.columns}
          onClose={() => setDrilldown(null)}
        />
      )}

      {showReconciliation && (
        <FinancialReconciliationModal
          from={from}
          to={to}
          onClose={() => setShowReconciliation(false)}
          onRefreshMetrics={load}
        />
      )}

      {showSettings && (
        <CommercialSettingsModal
          onClose={() => setShowSettings(false)}
          onSaved={load}
        />
      )}

    </div>
  );
}

// ─── Visão 2: Clientes e Públicos ─────────────────────────────────────────────

function ClientesPublicos({ periodPreset, initialRfmFilter = 'atendidos_periodo' }) {
  const { user, canEdit } = useAuth();
  const [subTab, setSubTab] = useState('rfm'); // 'rfm' | 'automaticos'

  // RFM states
  const [rfmData, setRfmData] = useState([]);
  const [rfmLoading, setRfmLoading] = useState(false);
  const [rfmError, setRfmError] = useState(null);
  const [rfmFilterMode, setRfmFilterMode] = useState(initialRfmFilter);
  const [rfmPage, setRfmPage] = useState(1);
  const [rfmPageSize] = useState(25);
  const [rfmTotalCount, setRfmTotalCount] = useState(0);

  // Públicos e perfil calculados com Agenda + Financeiro, sem cadastro manual.
  const [automaticInsights, setAutomaticInsights] = useState(null);
  const [automaticLoading, setAutomaticLoading] = useState(false);
  const [automaticError, setAutomaticError] = useState(null);
  const [selectedAudienceId, setSelectedAudienceId] = useState('retorno');

  // Segmentos states
  const [segments, setSegments] = useState([]);
  const [segLoading, setSegLoading] = useState(false);
  const [showSegEditor, setShowSegEditor] = useState(false);
  const [editingSeg, setEditingSeg] = useState(null);
  const [segConflictError, setSegConflictError] = useState(null);

  // Ações de Ideia e Campanha
  const [ideaModalSegment, setIdeaModalSegment] = useState(null);
  const [campaignModalSegment, setCampaignModalSegment] = useState(null);
  const [feedbackToast, setFeedbackToast] = useState(null);

  // ICP states
  const [icpProfiles, setIcpProfiles] = useState([]);
  const [icpLoading, setIcpLoading] = useState(false);
  const [showIcpForm, setShowIcpForm] = useState(false);
  const [editingIcp, setEditingIcp] = useState(null);
  const [icpForm, setIcpForm] = useState({
    name: '', necessidades: '', servicos_interesse: '', regiao: '',
    criterios_relacionamento: '', responsavel: '', segment_id: '', status: 'hipotese',
  });

  const { from, to } = useMemo(() => getDateRange(periodPreset), [periodPreset]);

  // Carrega RFM com suporte a paginação e modo de filtro
  const loadRFM = useCallback(async () => {
    setRfmLoading(true);
    setRfmError(null);
    const offset = (rfmPage - 1) * rfmPageSize;
    const { data, error } = await fetchClientRFM(from, to, rfmPageSize, offset, rfmFilterMode);
    if (error) {
      setRfmError(error.message || 'Erro ao carregar dados RFM');
    } else {
      setRfmData(data || []);
      if (data && data[0] && data[0].total_count !== undefined) {
        setRfmTotalCount(Number(data[0].total_count));
      } else {
        setRfmTotalCount((data || []).length);
      }
    }
    setRfmLoading(false);
  }, [from, to, rfmPage, rfmPageSize, rfmFilterMode]);

  useEffect(() => {
    if (subTab === 'rfm') loadRFM();
  }, [subTab, loadRFM]);

  const loadAutomaticInsights = useCallback(async () => {
    setAutomaticLoading(true);
    setAutomaticError(null);
    const { data, error } = await fetchAutomaticAudienceDataset(from, to);
    if (error) {
      setAutomaticError(error.message || 'Erro ao calcular públicos automáticos');
      setAutomaticInsights(null);
    } else {
      setAutomaticInsights(buildAutomaticAudienceInsights(data?.rfm || [], data?.appointments || []));
    }
    setAutomaticLoading(false);
  }, [from, to]);

  useEffect(() => {
    if (subTab === 'automaticos') loadAutomaticInsights();
  }, [subTab, loadAutomaticInsights]);

  // Carrega segmentos
  const loadSegments = useCallback(async () => {
    setSegLoading(true);
    const { data, error } = await fetchSegments();
    if (!error) setSegments(data || []);
    setSegLoading(false);
  }, []);

  useEffect(() => {
    if (subTab === 'segmentos') loadSegments();
  }, [subTab, loadSegments]);

  // Carrega ICP
  const loadICP = useCallback(async () => {
    setIcpLoading(true);
    const { data, error } = await fetchIcpProfiles();
    if (!error) setIcpProfiles(data || []);
    setIcpLoading(false);
  }, []);

  useEffect(() => {
    if (subTab === 'icp') loadICP();
  }, [subTab, loadICP]);

  const handleArchiveSeg = async (seg) => {
    if (!confirm(`Deseja arquivar o segmento "${seg.name}"?`)) return;
    const { error } = await archiveSegment(seg.id, seg.version);
    if (error) {
      alert(error.message || 'Erro ao arquivar segmento');
    } else {
      setSegments(prev => prev.filter(s => s.id !== seg.id));
    }
  };

  const handleSaveIcp = async () => {
    if (!icpForm.name.trim()) {
      alert('Informe o nome do perfil.');
      return;
    }
    const servicosArray = typeof icpForm.servicos_interesse === 'string'
      ? icpForm.servicos_interesse.split(',').map(s => s.trim()).filter(Boolean)
      : icpForm.servicos_interesse;

    const payload = {
      ...icpForm,
      servicos_interesse: servicosArray,
      segment_id: icpForm.segment_id || null,
    };

    let res;
    if (editingIcp) {
      res = await updateIcpProfile(editingIcp.id, payload);
    } else {
      res = await saveIcpProfile(payload);
    }

    if (res.error) {
      alert('Erro ao salvar ICP: ' + res.error.message);
    } else {
      loadICP();
      setShowIcpForm(false);
      setEditingIcp(null);
      setIcpForm({ name: '', necessidades: '', servicos_interesse: '', regiao: '', criterios_relacionamento: '', responsavel: '', segment_id: '', status: 'hipotese' });
    }
  };

  const handleValidateIcp = async (icp) => {
    if (!confirm(`Confirmar validação do perfil ICP "${icp.name}" pela gestão?`)) return;
    const authorName = user?.user_metadata?.full_name || user?.email || 'Gestão';
    const { error } = await validateIcpProfile(icp.id, user?.id, authorName);
    if (error) {
      alert('Erro ao validar ICP: ' + error.message);
    } else {
      loadICP();
      setFeedbackToast('Perfil ICP validado formalmente pela gestão!');
      setTimeout(() => setFeedbackToast(null), 4000);
    }
  };

  const totalPages = Math.ceil(rfmTotalCount / rfmPageSize) || 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {feedbackToast && (
        <div style={{ background: '#10B98118', border: '1px solid #10B98144', borderRadius: 8, padding: '10px 16px', color: '#10B981', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
          <CheckCircle size={16} /> {feedbackToast}
        </div>
      )}

      {/* Sub-tabs */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border)' }}>
        {[
          { key: 'rfm', label: 'Clientes' },
          { key: 'automaticos', label: 'Públicos automáticos' },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setSubTab(t.key)}
            style={{
              padding: '9px 18px', background: 'none',
              border: 'none', borderBottom: subTab === t.key ? '2px solid #8B5CF6' : '2px solid transparent',
              color: subTab === t.key ? '#8B5CF6' : 'var(--text-muted)',
              fontWeight: subTab === t.key ? 600 : 400,
              fontSize: 13, cursor: 'pointer',
              marginBottom: -1,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Sub-Aba: Ficha RFM ── */}
      {subTab === 'rfm' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Filtrar população:</span>
              {[
                { key: 'atendidos_periodo', label: 'Atendidos no período' },
                { key: 'sem_retorno',       label: 'Sem retorno no período' },
                { key: 'todos',             label: 'Todos com histórico' },
              ].map(f => (
                <button
                  key={f.key}
                  onClick={() => { setRfmFilterMode(f.key); setRfmPage(1); }}
                  style={{
                    padding: '4px 12px', borderRadius: 16, fontSize: 12,
                    border: rfmFilterMode === f.key ? '1px solid #8B5CF6' : '1px solid var(--border)',
                    background: rfmFilterMode === f.key ? '#8B5CF618' : 'transparent',
                    color: rfmFilterMode === f.key ? '#8B5CF6' : 'var(--text-muted)',
                    cursor: 'pointer', fontWeight: 500,
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Data de corte: <strong>{fmtDate(to)}</strong>
            </span>
          </div>

          {rfmLoading ? (
            <p style={{ color: 'var(--text-muted)', padding: '30px 0', textAlign: 'center' }}>Carregando ficha RFM…</p>
          ) : rfmError ? (
            <div style={{ background: '#DC262618', padding: 12, borderRadius: 8, color: '#DC2626', fontSize: 13 }}>
              {rfmError}
            </div>
          ) : rfmData.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', padding: '30px 0', textAlign: 'center' }}>
              Nenhum cliente atende ao filtro no período selecionado.
            </p>
          ) : (
            <>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      {['Paciente', 'Origem', 'Primeiro atend.', 'Último atend. (corte)', 'Dias sem atend.', 'Atend. no período', 'Atend. total', 'Valor no período', 'Valor histórico'].map(h => (
                        <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rfmData.map((r, i) => (
                      <tr key={r.client_id} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? 'transparent' : 'var(--bg-main)' }}>
                        <td style={{ padding: '9px 12px', color: 'var(--text-dark)', fontWeight: 600 }}>{r.client_name}</td>
                        <td style={{ padding: '9px 12px' }}>
                          {r.client_source ? (
                            <span style={{ background: '#8B5CF618', color: '#8B5CF6', padding: '2px 8px', borderRadius: 10, fontSize: 11 }}>
                              {r.client_source}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: 11 }}>Não informada</span>
                          )}
                        </td>
                        <td style={{ padding: '9px 12px', color: 'var(--text-muted)' }}>{fmtDate(r.primeiro_atendimento)}</td>
                        <td style={{ padding: '9px 12px', color: 'var(--text-muted)' }}>{fmtDate(r.ultimo_atendimento)}</td>
                        <td style={{ padding: '9px 12px' }}>
                          <span style={{
                            color: r.dias_sem_atendimento > 90 ? '#DC2626' : r.dias_sem_atendimento > 45 ? '#D97706' : '#10B981',
                            fontWeight: 600,
                          }}>
                            {r.dias_sem_atendimento != null ? `${r.dias_sem_atendimento}d` : '—'}
                          </span>
                        </td>
                        <td style={{ padding: '9px 12px', color: 'var(--text-dark)', textAlign: 'center', fontWeight: 600 }}>
                          {r.atendimentos_periodo}
                        </td>
                        <td style={{ padding: '9px 12px', color: 'var(--text-muted)', textAlign: 'center' }}>
                          {r.atendimentos_total}
                        </td>
                        <td style={{ padding: '9px 12px', color: Number(r.valor_periodo) > 0 ? '#10B981' : 'var(--text-muted)' }}>
                          {Number(r.valor_periodo) > 0 ? fmtBRL(r.valor_periodo) : '—'}
                        </td>
                        <td style={{ padding: '9px 12px', color: Number(r.valor_total) > 0 ? 'var(--text-dark)' : 'var(--text-muted)' }}>
                          {Number(r.valor_total) > 0 ? fmtBRL(r.valor_total) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Paginação */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, flexWrap: 'wrap', gap: 10 }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  Total: {rfmTotalCount} cliente(s) • Página {rfmPage} de {totalPages}
                </span>

                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    className="btn btn-ghost"
                    style={{ fontSize: 12, padding: '4px 10px' }}
                    disabled={rfmPage <= 1}
                    onClick={() => setRfmPage(p => Math.max(1, p - 1))}
                  >
                    <ChevronLeft size={14} /> Anterior
                  </button>
                  <button
                    className="btn btn-ghost"
                    style={{ fontSize: 12, padding: '4px 10px' }}
                    disabled={rfmPage >= totalPages}
                    onClick={() => setRfmPage(p => p + 1)}
                  >
                    Próxima <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Sub-Aba: Públicos calculados automaticamente ── */}
      {subTab === 'automaticos' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <h3 style={{ margin: 0, color: 'var(--text-dark)', fontSize: 16 }}>Públicos prontos para usar</h3>
              <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: 12, maxWidth: 720 }}>
                Calculados pela Agenda, histórico de clientes e receitas conciliadas. Você não precisa criar segmentos,
                preencher critérios nem cadastrar perfil ideal.
              </p>
            </div>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 14, padding: '5px 10px', background: '#10B98118', color: '#07845D', fontSize: 11, fontWeight: 700 }}>
              <RefreshCw size={12} /> Atualização automática
            </span>
          </div>

          {automaticLoading ? (
            <p style={{ color: 'var(--text-muted)', padding: '36px 0', textAlign: 'center' }}>Analisando os atendimentos…</p>
          ) : automaticError ? (
            <div style={{ background: '#DC262618', padding: 12, borderRadius: 8, color: '#DC2626', fontSize: 13 }}>
              {automaticError}
            </div>
          ) : automaticInsights ? (
            <>
              <div style={{ background: 'linear-gradient(135deg, #8B5CF614, #3B82F60C)', border: '1px solid #8B5CF633', borderRadius: 12, padding: '16px 18px', display: 'grid', gridTemplateColumns: 'minmax(240px, 1.5fr) repeat(3, minmax(100px, .6fr))', gap: 16, alignItems: 'center' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <Target size={17} style={{ color: '#8B5CF6' }} />
                    <strong style={{ color: 'var(--text-dark)', fontSize: 14 }}>{automaticInsights.profile.name}</strong>
                    <span style={{ background: '#8B5CF618', color: '#8B5CF6', borderRadius: 10, padding: '2px 7px', fontSize: 10, fontWeight: 700 }}>
                      evidência {automaticInsights.profile.confidence}
                    </span>
                  </div>
                  <p style={{ margin: '6px 0 0', color: 'var(--text-muted)', fontSize: 12, lineHeight: 1.5 }}>
                    {automaticInsights.profile.summary}
                  </p>
                </div>
                {[
                  ['Clientes usados', automaticInsights.profile.sampleCount],
                  ['Média de atendimentos', automaticInsights.profile.sampleCount ? automaticInsights.profile.averageVisits.toFixed(1) : '—'],
                  ['Valor médio histórico', automaticInsights.profile.averageValue > 0 ? fmtBRL(automaticInsights.profile.averageValue) : '—'],
                ].map(([label, value]) => (
                  <div key={label}>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</div>
                    <div style={{ marginTop: 3, fontSize: 17, fontWeight: 700, color: 'var(--text-dark)' }}>{value}</div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 10 }}>
                {automaticInsights.audiences.map(audience => {
                  const selected = selectedAudienceId === audience.id;
                  return (
                    <button
                      key={audience.id}
                      type="button"
                      onClick={() => setSelectedAudienceId(audience.id)}
                      style={{
                        textAlign: 'left', padding: 15, borderRadius: 11, cursor: 'pointer',
                        background: selected ? `${audience.color}12` : 'var(--bg-card)',
                        border: `1px solid ${selected ? audience.color : 'var(--border)'}`,
                        boxShadow: selected ? `0 0 0 1px ${audience.color}22` : 'none',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                        <strong style={{ color: 'var(--text-dark)', fontSize: 13 }}>{audience.name}</strong>
                        <span style={{ minWidth: 28, height: 28, borderRadius: 14, display: 'inline-flex', justifyContent: 'center', alignItems: 'center', background: `${audience.color}18`, color: audience.color, fontWeight: 800, fontSize: 13 }}>
                          {audience.count}
                        </span>
                      </div>
                      <p style={{ margin: '7px 0', color: 'var(--text-muted)', fontSize: 11, lineHeight: 1.4 }}>{audience.description}</p>
                      <div style={{ fontSize: 10, color: audience.color, fontWeight: 650 }}>{audience.rule}</div>
                    </button>
                  );
                })}
              </div>

              {(() => {
                const audience = automaticInsights.audiences.find(item => item.id === selectedAudienceId)
                  || automaticInsights.audiences[0];
                if (!audience) return null;
                return (
                  <div style={{ border: '1px solid var(--border)', borderRadius: 12, background: 'var(--bg-card)', overflow: 'hidden' }}>
                    <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                      <div>
                        <strong style={{ color: 'var(--text-dark)', fontSize: 14 }}>{audience.name}</strong>
                        <div style={{ marginTop: 3, color: 'var(--text-muted)', fontSize: 11 }}>{audience.action}</div>
                      </div>
                      <div style={{ display: 'flex', gap: 14, color: 'var(--text-muted)', fontSize: 11 }}>
                        {audience.topService && <span><strong>Serviço mais comum:</strong> {audience.topService}</span>}
                        {audience.topSource && <span><strong>Origem principal:</strong> {audience.topSource}</span>}
                      </div>
                    </div>

                    {audience.members.length === 0 ? (
                      <p style={{ margin: 0, padding: 24, color: 'var(--text-muted)', textAlign: 'center', fontSize: 12 }}>
                        Nenhum cliente está neste público hoje. Ele será atualizado sozinho conforme a Agenda mudar.
                      </p>
                    ) : (
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                          <thead>
                            <tr style={{ background: 'var(--bg-main)', color: 'var(--text-muted)' }}>
                              {['Cliente', 'Último atendimento', 'Dias sem atendimento', 'Atendimentos', 'Valor histórico'].map(label => (
                                <th key={label} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, whiteSpace: 'nowrap' }}>{label}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {audience.members.slice(0, 100).map(member => (
                              <tr key={member.id} style={{ borderTop: '1px solid var(--border)' }}>
                                <td style={{ padding: '9px 12px', color: 'var(--text-dark)', fontWeight: 600 }}>{member.name}</td>
                                <td style={{ padding: '9px 12px', color: 'var(--text-muted)' }}>{fmtDate(member.lastVisit)}</td>
                                <td style={{ padding: '9px 12px', color: audience.color, fontWeight: 650 }}>{member.daysSinceVisit} dias</td>
                                <td style={{ padding: '9px 12px', color: 'var(--text-muted)' }}>{member.totalVisits}</td>
                                <td style={{ padding: '9px 12px', color: member.totalValue > 0 ? 'var(--text-dark)' : 'var(--text-muted)' }}>
                                  {member.totalValue > 0 ? fmtBRL(member.totalValue) : '—'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })()}
            </>
          ) : null}
        </div>
      )}

      {/* ── Sub-Aba: Públicos e Segmentos ── */}
      {subTab === 'segmentos' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <div>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>
                Segmentos versionados com critérios por serviço, frequência e recência.
              </p>
              <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--text-muted)' }}>
                Pertencer a um segmento não equivale a autorizar envio. Ações não disparam mensagens automaticamente.
              </p>
            </div>
            {canEdit('marketing') && (
              <button
                className="btn btn-primary"
                style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}
                onClick={() => { setEditingSeg(null); setShowSegEditor(true); setSegConflictError(null); }}
              >
                <Plus size={14} /> Criar Novo Público
              </button>
            )}
          </div>

          {segConflictError && (
            <div style={{ background: '#DC262618', border: '1px solid #DC262644', borderRadius: 8, padding: '10px 16px', color: '#DC2626', fontSize: 13 }}>
              {segConflictError}
            </div>
          )}

          {showSegEditor && (
            <SegmentEditor
              initial={editingSeg}
              onSave={async (seg) => {
                setSegConflictError(null);
                const authorName = user?.user_metadata?.full_name || user?.email || 'Gestão';
                let res;
                if (editingSeg?.id) {
                  res = await updateSegment(editingSeg.id, seg, editingSeg.version);
                } else {
                  res = await saveSegment(seg, user?.id, authorName);
                }

                if (res.error) {
                  if (res.error.code === 'CONFLICT') {
                    setSegConflictError(res.error.message);
                  } else {
                    alert('Erro ao salvar segmento: ' + res.error.message);
                  }
                  return;
                }
                loadSegments();
                setShowSegEditor(false);
                setEditingSeg(null);
              }}
              onClose={() => { setShowSegEditor(false); setEditingSeg(null); setSegConflictError(null); }}
            />
          )}

          {segLoading ? (
            <p style={{ color: 'var(--text-muted)', padding: '30px', textAlign: 'center' }}>Carregando segmentos…</p>
          ) : segments.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', padding: '30px', textAlign: 'center' }}>Nenhum segmento salvo ainda.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {segments.map(seg => (
                <div
                  key={seg.id}
                  style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    borderRadius: 12,
                    padding: '16px 20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 14,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 260 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Layers size={16} style={{ color: '#8B5CF6' }} />
                      <span style={{ fontWeight: 600, color: 'var(--text-dark)', fontSize: 14 }}>{seg.name}</span>
                      <span style={{
                        fontSize: 10, padding: '2px 8px', borderRadius: 10, fontWeight: 700,
                        background: seg.entity_base === 'lead' ? '#3B82F618' : '#10B98118',
                        color: seg.entity_base === 'lead' ? '#3B82F6' : '#10B981',
                        textTransform: 'uppercase',
                      }}>
                        {seg.entity_base === 'lead' ? 'Interessados' : 'Clientes'}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>v{seg.version}</span>
                    </div>

                    {seg.description && (
                      <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>{seg.description}</p>
                    )}

                    <div style={{ display: 'flex', gap: 12, marginTop: 6, fontSize: 11, color: 'var(--text-muted)' }}>
                      <span>{seg.conditions?.length || 0} critério(s)</span>
                      {seg.janela_dias && <span>Janela: {seg.janela_dias} dias</span>}
                      <span>Criado por {seg.author_name || 'Gestor'}</span>
                    </div>
                  </div>

                  {/* Ações do Segmento */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <button
                      className="btn btn-ghost"
                      style={{ fontSize: 12, padding: '5px 10px', display: 'flex', alignItems: 'center', gap: 4 }}
                      onClick={() => setIdeaModalSegment(seg)}
                    >
                      <BookOpen size={13} style={{ color: '#8B5CF6' }} /> Criar Ideia
                    </button>

                    <button
                      className="btn btn-ghost"
                      style={{ fontSize: 12, padding: '5px 10px', display: 'flex', alignItems: 'center', gap: 4 }}
                      onClick={() => setCampaignModalSegment(seg)}
                    >
                      <Link2 size={13} style={{ color: '#3B82F6' }} /> Vincular Campanha
                    </button>

                    {canEdit('marketing') && (
                      <>
                        <button
                          className="btn btn-ghost"
                          style={{ fontSize: 12, padding: '5px 10px' }}
                          onClick={() => { setEditingSeg(seg); setShowSegEditor(true); }}
                        >
                          <Edit3 size={13} />
                        </button>
                        <button
                          className="btn btn-ghost"
                          style={{ fontSize: 12, padding: '5px 10px', color: '#DC2626' }}
                          onClick={() => handleArchiveSeg(seg)}
                          title="Arquivar segmento"
                        >
                          <Archive size={13} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Modal de Criar Ideia */}
          {ideaModalSegment && (
            <CreateIdeaFromSegmentModal
              segment={ideaModalSegment}
              onClose={() => setIdeaModalSegment(null)}
              onSuccess={(novaIdeia) => {
                setFeedbackToast(`Ideia "${novaIdeia.titulo}" criada na lousa com sucesso!`);
                setTimeout(() => setFeedbackToast(null), 4000);
              }}
            />
          )}

          {/* Modal de Vincular Campanha */}
          {campaignModalSegment && (
            <LinkCampaignModal
              segment={campaignModalSegment}
              onClose={() => setCampaignModalSegment(null)}
              onSuccess={() => {
                setFeedbackToast(`Público vinculado à campanha com snapshot gravado com sucesso!`);
                setTimeout(() => setFeedbackToast(null), 4000);
              }}
            />
          )}

        </div>
      )}

      {/* ── Sub-Aba: Perfis ICP ── */}
      {subTab === 'icp' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <div>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>
                Perfis que queremos atender melhor. Sustentados por evidência de grupos reais e validação explícita.
              </p>
              <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--text-muted)' }}>
                Não inferimos diagnósticos ou capacidade financeira. O perfil apoia o foco do atendimento e campanhas.
              </p>
            </div>
            {canEdit('marketing') && (
              <button
                className="btn btn-primary"
                style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}
                onClick={() => {
                  setEditingIcp(null);
                  setIcpForm({ name: '', necessidades: '', servicos_interesse: '', regiao: '', criterios_relacionamento: '', responsavel: '', segment_id: '', status: 'hipotese' });
                  setShowIcpForm(true);
                }}
              >
                <Plus size={14} /> Novo Perfil ICP
              </button>
            )}
          </div>

          {showIcpForm && (
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <h4 style={{ margin: 0, color: 'var(--text-dark)' }}>{editingIcp ? 'Editar' : 'Novo'} Perfil ICP</h4>
                <button onClick={() => setShowIcpForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={18} /></button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Nome do Perfil *</label>
                  <input
                    className="form-input"
                    placeholder="Ex: Pacientes de Manutenção Facial"
                    value={icpForm.name}
                    onChange={e => setIcpForm(f => ({ ...f, name: e.target.value }))}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Região / Bairros</label>
                  <input
                    className="form-input"
                    placeholder="Ex: Pinheiros, Jardins, Itaim"
                    value={icpForm.regiao}
                    onChange={e => setIcpForm(f => ({ ...f, regiao: e.target.value }))}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Necessidades e Dores Declaradas</label>
                <textarea
                  className="form-input"
                  rows={2}
                  placeholder="Ex: Buscam rejuvenescimento natural sem alterar expressões faciais."
                  value={icpForm.necessidades}
                  onChange={e => setIcpForm(f => ({ ...f, necessidades: e.target.value }))}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Serviços de Interesse (separados por vírgula)</label>
                  <input
                    className="form-input"
                    placeholder="Botox, Limpeza, Bioestimulador"
                    value={typeof icpForm.servicos_interesse === 'string' ? icpForm.servicos_interesse : (icpForm.servicos_interesse || []).join(', ')}
                    onChange={e => setIcpForm(f => ({ ...f, servicos_interesse: e.target.value }))}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Público de Referência (Segmento)</label>
                  <select
                    className="form-select"
                    value={icpForm.segment_id}
                    onChange={e => setIcpForm(f => ({ ...f, segment_id: e.target.value }))}
                  >
                    <option value="">Nenhum (definição independente)</option>
                    {segments.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.entity_base})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
                <button className="btn btn-ghost" onClick={() => setShowIcpForm(false)}>Cancelar</button>
                <button className="btn btn-primary" onClick={handleSaveIcp}>Salvar Perfil</button>
              </div>
            </div>
          )}

          {icpLoading ? (
            <p style={{ color: 'var(--text-muted)', padding: '30px', textAlign: 'center' }}>Carregando perfis ICP…</p>
          ) : icpProfiles.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', padding: '30px', textAlign: 'center' }}>Nenhum perfil ICP cadastrado ainda.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {icpProfiles.map(p => {
                const isValidated = p.status === 'validado';
                return (
                  <div
                    key={p.id}
                    style={{
                      background: 'var(--bg-card)',
                      border: `1px solid ${isValidated ? '#10B98133' : '#D9770633'}`,
                      borderRadius: 12,
                      padding: '18px 20px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Star size={18} style={{ color: isValidated ? '#10B981' : '#D97706' }} />
                        <span style={{ fontWeight: 700, color: 'var(--text-dark)', fontSize: 15 }}>{p.name}</span>
                        <span style={{
                          fontSize: 11, padding: '2px 10px', borderRadius: 12, fontWeight: 700,
                          background: isValidated ? '#10B98118' : '#D9770618',
                          color: isValidated ? '#10B981' : '#D97706',
                          display: 'flex', alignItems: 'center', gap: 4,
                        }}>
                          {isValidated ? <><ShieldCheck size={12} /> Validado pela gestão</> : 'Hipótese'}
                        </span>
                      </div>

                      <div style={{ display: 'flex', gap: 8 }}>
                        {!isValidated && canEdit('marketing') && (
                          <button
                            className="btn btn-primary"
                            style={{ fontSize: 11, padding: '4px 10px', background: '#10B981', borderColor: '#10B981' }}
                            onClick={() => handleValidateIcp(p)}
                          >
                            <Check size={13} style={{ marginRight: 4 }} /> Validar pela Gestão
                          </button>
                        )}
                        {canEdit('marketing') && (
                          <button
                            className="btn btn-ghost"
                            style={{ fontSize: 11, padding: '4px 8px' }}
                            onClick={() => {
                              setEditingIcp(p);
                              setIcpForm({
                                name: p.name,
                                necessidades: p.necessidades || '',
                                servicos_interesse: (p.servicos_interesse || []).join(', '),
                                regiao: p.regiao || '',
                                criterios_relacionamento: p.criterios_relacionamento || '',
                                responsavel: p.responsavel || '',
                                segment_id: p.segment_id || '',
                                status: p.status || 'hipotese',
                              });
                              setShowIcpForm(true);
                            }}
                          >
                            Editar
                          </button>
                        )}
                      </div>
                    </div>

                    {p.necessidades && (
                      <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-dark)' }}>
                        <strong>Necessidades:</strong> {p.necessidades}
                      </p>
                    )}

                    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                      {p.regiao && <span><strong>Região:</strong> {p.regiao}</span>}
                      {p.servicos_interesse?.length > 0 && (
                        <span><strong>Serviços:</strong> {p.servicos_interesse.join(', ')}</span>
                      )}
                      {p.marketing_segments && (
                        <span><strong>Segmento base:</strong> {p.marketing_segments.name} (v{p.marketing_segments.version})</span>
                      )}
                    </div>

                    {isValidated && (
                      <p style={{ margin: '4px 0 0', fontSize: 11, color: '#10B981' }}>
                        Validado por {p.validator_name || 'Gestão'} em {fmtDate(p.validated_at)}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

    </div>
  );
}

// ─── Editor de Segmentos ──────────────────────────────────────────────────────

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
    const firstField = fields[0];
    const op = (OPERATORS_BY_TYPE[firstField.type] || OPERATORS_BY_TYPE.text)[0].value;
    setForm(f => ({
      ...f,
      conditions: [...f.conditions, { field: firstField.value, operator: op, value: '' }],
    }));
  };

  const updateCondition = (i, key, val) => {
    setForm(f => {
      const conds = [...f.conditions];
      if (key === 'field') {
        const fieldMeta = fields.find(fi => fi.value === val);
        const ops = OPERATORS_BY_TYPE[fieldMeta?.type] || OPERATORS_BY_TYPE.text;
        conds[i] = { field: val, operator: ops[0].value, value: '' };
      } else {
        conds[i] = { ...conds[i], [key]: val };
      }
      return { ...f, conditions: conds };
    });
  };

  const removeCondition = (i) => {
    setForm(f => ({ ...f, conditions: f.conditions.filter((_, idx) => idx !== i) }));
  };

  const runPreview = async () => {
    setPrevLoading(true);
    setPrevError(null);
    const { data, error } = await previewSegment(form.entity_base, form.conditions, 10, form.janela_dias);
    if (error) {
      setPrevError(error?.message || 'Erro ao calcular prévia');
    } else if (data?.error) {
      setPrevError(data.error);
    } else {
      setPreview(data);
    }
    setPrevLoading(false);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    await onSave({
      ...form,
      janela_dias: form.janela_dias ? Number(form.janela_dias) : null,
    });
    setSaving(false);
  };

  const getOperatorsForField = (fieldName) => {
    const meta = fields.find(f => f.value === fieldName);
    return OPERATORS_BY_TYPE[meta?.type] || OPERATORS_BY_TYPE.text;
  };

  const isFieldBoolean = (fieldName) => {
    const meta = fields.find(f => f.value === fieldName);
    return meta?.type === 'boolean';
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
        <h4 style={{ margin: 0, color: 'var(--text-dark)' }}>{initial ? 'Editar' : 'Novo'} Segmento de Público</h4>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={18} /></button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Nome do Segmento *</label>
          <input className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Pacientes de Botox sem retorno há 90 dias" />
        </div>
        <div>
          <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Entidade-base</label>
          <select className="form-select" value={form.entity_base} onChange={e => setForm(f => ({ ...f, entity_base: e.target.value, conditions: [] }))}>
            <option value="lead">Interessados (Leads do CRM)</option>
            <option value="cliente">Pacientes (Clientes da Clínica)</option>
          </select>
        </div>
        <div>
          <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Descrição / Finalidade</label>
          <input className="form-input" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Objetivo e hipótese deste público" />
        </div>
        <div>
          <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Janela Temporal de Acompanhamento (dias opcionais)</label>
          <input type="number" className="form-input" value={form.janela_dias} onChange={e => setForm(f => ({ ...f, janela_dias: e.target.value }))} placeholder="Ex: 30, 90, 365" />
        </div>
      </div>

      {/* Condições */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Critérios (combinados por E):</span>
          <button
            onClick={addCondition}
            className="btn btn-ghost"
            style={{ fontSize: 12, padding: '3px 10px' }}
          >
            + Adicionar Critério
          </button>
        </div>

        {form.conditions.length === 0 ? (
          <p style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic', margin: '4px 0' }}>
            Nenhum critério aplicado — o segmento englobará todos os registros da base.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {form.conditions.map((cond, i) => {
              const ops = getOperatorsForField(cond.field);
              const isBool = isFieldBoolean(cond.field);

              return (
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
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
                    {ops.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>

                  {needsValue(cond.operator) && (
                    isBool ? (
                      <select
                        className="form-select"
                        value={cond.value || 'true'}
                        onChange={e => updateCondition(i, 'value', e.target.value)}
                        style={{ flex: 1.5 }}
                      >
                        <option value="true">Sim (Verdadeiro)</option>
                        <option value="false">Não (Falso)</option>
                      </select>
                    ) : (
                      <input
                        className="form-input"
                        value={cond.value || ''}
                        onChange={e => updateCondition(i, 'value', e.target.value)}
                        placeholder="Valor do critério"
                        style={{ flex: 1.5 }}
                      />
                    )
                  )}

                  <button
                    onClick={() => removeCondition(i)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#DC2626', padding: '0 4px' }}
                    title="Remover critério"
                  >
                    <X size={16} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Prévia */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 4 }}>
        <button
          onClick={runPreview}
          disabled={prevLoading}
          className="btn btn-ghost"
          style={{ fontSize: 12, padding: '6px 14px', borderColor: '#8B5CF6', color: '#8B5CF6' }}
        >
          <Eye size={13} style={{ marginRight: 4 }} />
          {prevLoading ? 'Calculando…' : 'Calcular Prévia'}
        </button>

        {prevError && (
          <span style={{ fontSize: 12, color: '#DC2626' }}>{prevError}</span>
        )}

        {preview && !prevError && (
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            <strong style={{ color: 'var(--text-dark)' }}>{preview.count}</strong> registros satisfazem este segmento.
            {preview.sample?.length > 0 && (
              <span> (Ex: {preview.sample.slice(0, 3).map(s => s.nome || s.name || s.id).join(', ')}{preview.count > 3 ? '…' : ''})</span>
            )}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 10 }}>
        <button onClick={onClose} className="btn btn-ghost">Cancelar</button>
        <button onClick={handleSave} disabled={!form.name.trim() || saving} className="btn btn-primary">
          {saving ? 'Salvando…' : 'Salvar Segmento'}
        </button>
      </div>
    </div>
  );
}

// ─── Visão 3: Canais e Campanhas ──────────────────────────────────────────────

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
      orcamento_planejado: b.orcamento_planejado ?? '',
      investimento_realizado: b.investimento_realizado ?? '',
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
      alert('Brief analítico salvo com sucesso!');
    } else if (error) {
      alert('Erro ao salvar: ' + (error?.message || error));
    }
    setBriefSaving(false);
  };

  const CANAL_COLORS = ['#8B5CF6', '#3B82F6', '#10B981', '#D97706', '#DC2626', '#EC4899'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Desempenho por Canal */}
      <div>
        <h4 style={{ margin: '0 0 10px', color: 'var(--text-dark)', fontSize: 15 }}>
          Desempenho por Canal de Aquisição
        </h4>
        <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--text-muted)' }}>
          Leads registrados entre {fmtDate(from)} e {fmtDate(to)} agrupados por origem, com conversão em agendamentos válidos e receitas atribuídas.
        </p>

        {canalLoading ? (
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Carregando estatísticas…</p>
        ) : canalError ? (
          <p style={{ color: '#DC2626', fontSize: 13 }}>{canalError}</p>
        ) : canalStats.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Nenhum lead com origem registrada no período.</p>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {['Canal / Origem', 'Interessados', 'Com agendamento válido', 'Pacientes atendidos vinculados', 'Taxa de Conversão', 'Recebimentos atribuídos'].map(h => (
                      <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {canalStats.map((row, i) => {
                    const conv = row.interessados_total > 0
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
                          {conv !== null ? (
                            <span style={{ color: conv > 40 ? '#10B981' : conv > 15 ? '#D97706' : '#DC2626', fontWeight: 600 }}>{conv}%</span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Não calculável</span>
                          )}
                        </td>
                        <td style={{ padding: '8px 12px', color: Number(row.recebimentos_atribuidos) > 0 ? '#10B981' : 'var(--text-muted)', fontWeight: Number(row.recebimentos_atribuidos) > 0 ? 600 : 400 }}>
                          {Number(row.recebimentos_atribuidos) > 0 ? fmtBRL(row.recebimentos_atribuidos) : '—'}
                        </td>
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

      {/* Campanhas e Briefs */}
      <div>
        <h4 style={{ margin: '0 0 10px', color: 'var(--text-dark)', fontSize: 15 }}>
          Campanhas — Plano e Resultado Analítico
        </h4>
        <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--text-muted)' }}>
          Selecione uma campanha para visualizar e editar o brief analítico, objetivos e o público-alvo vinculado.
        </p>

        {(!campanhas || campanhas.length === 0) ? (
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Nenhuma campanha cadastrada no ERP.</p>
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
                <span style={{ fontWeight: 600, color: 'var(--text-dark)', flex: 1 }}>{c.nome}</span>
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

        {/* Formulário do Brief */}
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
              <div>
                <h4 style={{ margin: 0, color: 'var(--text-dark)' }}>
                  Brief — {selectedCampanha.nome}
                </h4>
                {brief?.snapshot_date && (
                  <p style={{ margin: '4px 0 0', fontSize: 11, color: '#10B981' }}>
                    Snapshot de público registrado em {fmtDate(brief.snapshot_date)} (amostra estimada: {brief.estimated_count ?? '—'})
                  </p>
                )}
              </div>
              <button onClick={() => setSelectedCampanha(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={18} /></button>
            </div>

            {briefLoading ? (
              <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Carregando brief…</p>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Objetivo Mensurável</label>
                    <input className="form-input" placeholder="Ex: Aumentar agendamentos de bioestimulador" value={briefForm.objetivo || ''} onChange={e => setBriefForm(p => ({ ...p, objetivo: e.target.value }))} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Meta</label>
                    <input className="form-input" placeholder="Ex: 25 agendamentos confirmados" value={briefForm.meta || ''} onChange={e => setBriefForm(p => ({ ...p, meta: e.target.value }))} />
                  </div>
                  <div style={{ gridColumn: '1/-1' }}>
                    <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Público-alvo / Critérios do Segmento</label>
                    <input className="form-input" placeholder="Descrição do público ou referência de segmento" value={briefForm.publico_descricao || ''} onChange={e => setBriefForm(p => ({ ...p, publico_descricao: e.target.value }))} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Orçamento Planejado (R$)</label>
                    <input className="form-input" type="number" placeholder="0,00" value={briefForm.orcamento_planejado || ''} onChange={e => setBriefForm(p => ({ ...p, orcamento_planejado: e.target.value }))} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Investimento Realizado Confirmado (R$)</label>
                    <input className="form-input" type="number" placeholder="0,00" value={briefForm.investimento_realizado || ''} onChange={e => setBriefForm(p => ({ ...p, investimento_realizado: e.target.value }))} />
                  </div>
                  <div style={{ gridColumn: '1/-1' }}>
                    <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Resultado Observado</label>
                    <textarea className="form-input" rows={2} value={briefForm.resultado_observado || ''} onChange={e => setBriefForm(p => ({ ...p, resultado_observado: e.target.value }))} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Decisão Final</label>
                    <select className="form-select" value={briefForm.decisao || ''} onChange={e => setBriefForm(p => ({ ...p, decisao: e.target.value }))}>
                      <option value="">Não definida</option>
                      <option value="repetir">Repetir ação</option>
                      <option value="ajustar">Ajustar parâmetros</option>
                      <option value="encerrar">Encerrar campanha</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Aprendizado para Próximas Campanhas</label>
                    <input className="form-input" placeholder="O que aprendemos com esta ação?" value={briefForm.aprendizado || ''} onChange={e => setBriefForm(p => ({ ...p, aprendizado: e.target.value }))} />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button
                    className="btn btn-primary"
                    onClick={saveBrief}
                    disabled={briefSaving}
                  >
                    {briefSaving ? 'Salvando…' : 'Salvar Brief da Campanha'}
                  </button>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    Os campos originais da campanha (mensagem, agendamento) são preservados integralmente.
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

// ─── Componente Principal Exportado ───────────────────────────────────────────

export default function InteligenicaComercial({ campanhas }) {
  const [subView, setSubView] = useState('visao-geral');
  const [setup, setSetup] = useState(null);
  const [periodPreset, setPeriodPreset] = useState('30d');
  const [initialRfmFilter, setInitialRfmFilter] = useState('atendidos_periodo');

  useEffect(() => {
    checkIntelligenceSetup().then(setSetup);
  }, []);

  const handleSwitchTab = (tabKey, rfmFilter = 'atendidos_periodo') => {
    setSubView(tabKey);
    if (rfmFilter) setInitialRfmFilter(rfmFilter);
  };

  if (!setup) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
        Verificando configuração de Inteligência Comercial…
      </div>
    );
  }

  if (!setup.ready) {
    return (
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid #D9770644',
        borderRadius: 12,
        padding: '32px',
        textAlign: 'center',
        maxWidth: 540,
        margin: '60px auto',
      }}>
        <AlertTriangle size={40} style={{ color: '#D97706', marginBottom: 16 }} />
        <h3 style={{ margin: '0 0 12px', color: 'var(--text-dark)', fontSize: 18 }}>
          Configuração do banco pendente
        </h3>
        <p style={{ margin: '0 0 20px', color: 'var(--text-muted)', fontSize: 14, lineHeight: 1.6 }}>
          Execute o arquivo <code style={{ background: 'var(--bg-main)', padding: '2px 6px', borderRadius: 4 }}>
            marketing_inteligencia_incremental.sql
          </code> no SQL Editor do Supabase e recarregue.
        </p>
        <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>
          O restante do ERP continua funcionando normalmente.
        </p>
      </div>
    );
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
            <h3 style={{ margin: 0, fontSize: 16, color: 'var(--text-dark)', fontWeight: 700 }}>Resultados do CRM</h3>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>Entenda de onde as clientes vêm, quem agenda e quem retorna.</p>
          </div>
        </div>
      </div>

      {/* Explica a ligação entre os módulos */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 8,
        padding: 12, borderRadius: 12, background: '#8B5CF60A', border: '1px solid #8B5CF626',
      }}>
        {[
          { step: '1', title: 'Interessados', text: 'Registra a origem e a conversa', icon: UserPlus },
          { step: '2', title: 'Agenda', text: 'Confirma agendamento, falta e atendimento', icon: Calendar },
          { step: '3', title: 'Resultados', text: 'Calcula conversão, retorno e canais', icon: BarChart2 },
        ].map(({ step, title, text, icon: Icon }, index) => (
          <div key={title} style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
            <div style={{
              width: 30, height: 30, borderRadius: 9, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: '#8B5CF618', color: '#6D28D9', fontSize: 11, fontWeight: 800,
            }}>
              <Icon size={14} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-dark)' }}>{step}. {title}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>{text}</div>
            </div>
            {index < 2 && <ArrowRight size={13} style={{ color: '#8B5CF6', marginLeft: 'auto', flexShrink: 0 }} />}
          </div>
        ))}
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => { window.location.href = '/crm'; }}
          style={{ fontSize: 11, justifySelf: 'end', alignSelf: 'center' }}
        >
          Abrir interessados <ExternalLink size={12} />
        </button>
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

      {/* Conteúdo da Sub-View ativa */}
      {subView === 'visao-geral' && (
        <VisaoGeral
          periodPreset={periodPreset}
          onPeriodChange={setPeriodPreset}
          onSwitchTab={handleSwitchTab}
        />
      )}
      {subView === 'clientes-publicos' && (
        <ClientesPublicos
          periodPreset={periodPreset}
          initialRfmFilter={initialRfmFilter}
        />
      )}
      {subView === 'canais-campanhas' && (
        <CanaisCampanhas
          campanhas={campanhas || []}
          periodPreset={periodPreset}
        />
      )}
    </div>
  );
}
