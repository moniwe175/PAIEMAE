/* eslint-disable react/prop-types */
import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import {
  CheckCircle, Clock, Calendar, User, Link as LinkIcon,
  ExternalLink, Sparkles, Play, CheckCircle2, ChevronRight
} from 'lucide-react';
import { formatDateBR } from '../../../services/marketingIdeasService.js';

const ETAPA_CONFIG = {
  ideia:           { label: 'Ideia',           color: '#8B5CF6', bg: '#EDE9FE', border: '#DDD6FE' },
  em_planejamento: { label: 'Em planejamento', color: '#3B82F6', bg: '#EFF6FF', border: '#BFDBFE' },
  agendada:        { label: 'Agendada',        color: '#D97706', bg: '#FEF3C7', border: '#FDE68A' },
  em_execucao:     { label: 'Em execução',     color: '#2563EB', bg: '#DBEAFE', border: '#93C5FD' },
  concluida:       { label: 'Concluída',       color: '#059669', bg: '#D1FAE5', border: '#6EE7B7' },
  executada:       { label: 'Concluída',       color: '#059669', bg: '#D1FAE5', border: '#6EE7B7' },
};

function MarketingIdeaNodeComponent({ data, selected }) {
  const {
    idea,
    isReadOnly,
    onOpenFicha,
    onApproveToggle,
    isConnectingMode,
    isConnectionSource,
    onNodeSelectForConnect,
  } = data;

  if (!idea) return null;

  const etapaKey = idea.etapa || 'ideia';
  const etapa = ETAPA_CONFIG[etapaKey] || ETAPA_CONFIG.ideia;
  const isAprovada = !!idea.aprovado;

  return (
    <div
      onClick={(e) => {
        if (isConnectingMode && onNodeSelectForConnect) {
          e.stopPropagation();
          onNodeSelectForConnect(idea.id, 'idea');
        }
      }}
      style={{
        width: 270,
        background: '#FFFFFF',
        borderRadius: 12,
        border: selected
          ? '2px solid #8B5CF6'
          : isConnectionSource
          ? '2px solid #2563EB'
          : '1px solid #E2E8F0',
        boxShadow: selected
          ? '0 8px 24px rgba(139, 92, 246, 0.25)'
          : '0 4px 14px rgba(0, 0, 0, 0.06)',
        overflow: 'hidden',
        fontFamily: 'var(--font-sans)',
        transition: 'all 0.15s ease',
        cursor: isConnectingMode ? 'crosshair' : 'grab',
      }}
    >
      {/* Handles para conexões nos 4 lados */}
      <Handle type="target" position={Position.Top} id="top" style={{ background: '#8B5CF6', width: 8, height: 8 }} />
      <Handle type="source" position={Position.Bottom} id="bottom" style={{ background: '#8B5CF6', width: 8, height: 8 }} />
      <Handle type="target" position={Position.Left} id="left" style={{ background: '#8B5CF6', width: 8, height: 8 }} />
      <Handle type="source" position={Position.Right} id="right" style={{ background: '#8B5CF6', width: 8, height: 8 }} />

      {/* Faixa Superior de Destaque */}
      <div
        style={{
          height: 4,
          background: isAprovada
            ? 'linear-gradient(90deg, #10B981, #059669)'
            : 'linear-gradient(90deg, #F59E0B, #D97706)',
        }}
      />

      <div style={{ padding: 14 }}>
        {/* Selos de Aprovação e Etapa Separados */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10, alignItems: 'center' }}>
          {/* Selo de Aprovação */}
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '3px 8px',
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 700,
              color: isAprovada ? '#065F46' : '#92400E',
              background: isAprovada ? '#D1FAE5' : '#FEF3C7',
              border: `1px solid ${isAprovada ? '#A7F3D0' : '#FDE68A'}`,
            }}
          >
            {isAprovada ? (
              <>
                <CheckCircle style={{ width: 12, height: 12, color: '#059669' }} />
                Aprovada
              </>
            ) : (
              <>
                <Clock style={{ width: 12, height: 12, color: '#D97706' }} />
                Pendente de aprovação
              </>
            )}
          </span>

          {/* Selo de Etapa */}
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '3px 8px',
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 700,
              color: etapa.color,
              background: etapa.bg,
              border: `1px solid ${etapa.border}`,
            }}
          >
            {etapaKey === 'em_execucao' ? (
              <Play style={{ width: 11, height: 11 }} />
            ) : etapaKey === 'concluida' || etapaKey === 'executada' ? (
              <CheckCircle2 style={{ width: 11, height: 11 }} />
            ) : (
              <Sparkles style={{ width: 11, height: 11 }} />
            )}
            {etapa.label}
          </span>
        </div>

        {/* Título da Ideia */}
        <h4
          style={{
            margin: '0 0 8px 0',
            fontSize: 14,
            fontWeight: 700,
            color: 'var(--text-dark)',
            lineHeight: 1.4,
            wordBreak: 'break-word',
          }}
        >
          {idea.titulo}
        </h4>

        {/* Formato ou Tema */}
        {(idea.servico_tema || idea.formato) && (
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10, display: 'flex', gap: 6, alignItems: 'center' }}>
            {idea.formato && <span style={{ fontWeight: 600 }}>{idea.formato}</span>}
            {idea.servico_tema && <span>· {idea.servico_tema}</span>}
          </div>
        )}

        {/* Metadados: Responsável e Data Prevista */}
        <div style={{ background: '#F8FAFC', padding: '8px 10px', borderRadius: 8, fontSize: 11, color: 'var(--text-medium)', marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <User style={{ width: 12, height: 12, color: '#94A3B8' }} />
            <span>Responsável: <strong>{idea.responsavel_nome || 'a definir'}</strong></span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Calendar style={{ width: 12, height: 12, color: '#94A3B8' }} />
            <span>Data: <strong>{idea.data_prevista ? formatDateBR(idea.data_prevista) : 'a definir'}</strong></span>
          </div>
          {idea.campanha_id && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#7C3AED', fontWeight: 600 }}>
              <LinkIcon style={{ width: 12, height: 12 }} />
              <span>Campanha #{idea.campanha_id}</span>
            </div>
          )}
        </div>

        {/* Ações do Card */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 6, borderTop: '1px solid #F1F5F9' }}>
          {!isReadOnly && onApproveToggle ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onApproveToggle(idea);
              }}
              style={{
                background: 'none',
                border: 'none',
                fontSize: 11,
                fontWeight: 600,
                color: isAprovada ? '#D97706' : '#059669',
                cursor: 'pointer',
                padding: '4px 6px',
                borderRadius: 4,
              }}
              title={isAprovada ? 'Retirar aprovação' : 'Aprovar proposta'}
            >
              {isAprovada ? 'Retirar aprovação' : 'Aprovar ideia'}
            </button>
          ) : <span />}

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenFicha(idea.id);
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              background: '#F5F3FF',
              color: '#7C3AED',
              border: '1px solid #DDD6FE',
              borderRadius: 6,
              padding: '4px 10px',
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Abrir ficha <ChevronRight style={{ width: 12, height: 12 }} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default memo(MarketingIdeaNodeComponent);
