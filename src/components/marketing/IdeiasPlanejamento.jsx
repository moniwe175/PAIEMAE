/* eslint-disable react/prop-types */
import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Lightbulb, Plus, X, ChevronRight, Edit3, Trash2,
  CheckCircle, CheckSquare, Square, Calendar, RefreshCw,
  Sparkles, History, AlignLeft,
  Clock, AlertCircle, Archive, Search, LayoutGrid, List,
  Link as LinkIcon, Unlink, Copy, ShieldAlert,
  Send, MessageCircle, Play, CheckCircle2, User, StickyNote
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import MarketingWhiteboard from './whiteboard/MarketingWhiteboard';
import {
  fetchIdeas,
  fetchIdeaById,
  insertIdea,
  updateIdea,
  approveIdea,
  archiveIdea,
  duplicateIdea,
  convertIdeaToCampaign,
  linkIdeaCampaign,
  unlinkIdeaCampaign,
  fetchIdeaTasks,
  upsertIdeaTask,
  deleteIdeaTask,
  fetchIdeaEvents,
  addIdeaComment,
  fetchAuthorizedStaff,
  fetchWhiteboardLayout,
  saveWhiteboardLayout,
  formatDateTimeBR,
  formatDateBR,
} from '../../services/marketingIdeasService';

// ─── Constantes & Configurações ───────────────────────────────────────────────

const ETAPAS = [
  { value: 'ideia',           label: 'Ideia',           color: '#8B5CF6', bg: '#EDE9FE', border: '#DDD6FE' },
  { value: 'em_planejamento', label: 'Em planejamento', color: '#3B82F6', bg: '#EFF6FF', border: '#BFDBFE' },
  { value: 'agendada',        label: 'Agendada',        color: '#D97706', bg: '#FEF3C7', border: '#FDE68A' },
  { value: 'em_execucao',     label: 'Em execução',     color: '#2563EB', bg: '#DBEAFE', border: '#93C5FD' },
  { value: 'concluida',       label: 'Concluída',       color: '#059669', bg: '#D1FAE5', border: '#6EE7B7' },
];

const FORMATOS = [
  'Não definido',
  'Live',
  'Reel',
  'Story',
  'Post',
  'Evento presencial',
  'Parceria',
  'Promoção',
  'Outro',
];

const CANAIS_DIVULGACAO_OPCOES = [
  'Instagram orgânico',
  'Meta Ads',
  'Google',
  'Indicação',
  'Parceria',
  'Divulgação local',
  'Outro',
];

const CANAIS_CAMPANHA_OPCOES = ['Instagram', 'WhatsApp', 'Email', 'SMS'];

// Template fiel e educativo: Live da Evelyn (Seção 7 da especificação)
const MODELO_LIVE_EVELYN = {
  titulo: 'Botox sem mistério: experiências, expectativas e dúvidas',
  formato: 'Live',
  canal: 'Instagram',
  tipo: 'live',
  etapa: 'ideia',
  descricao:
    'Conversa ao vivo com Evelyn e clientes convidadas para compartilhar experiências individuais e esclarecer dúvidas frequentes. A profissional contextualiza expectativas, cuidados e limitações. O relato não pressupõe que todos os receios estavam errados nem promete o mesmo resultado para outras pessoas.',
  servico_tema: 'Toxina Botulínica (Botox)',
  objetivo: 'Gerar inscrições de pessoas da região e pedidos de avaliação.',
  publico: 'Pessoas interessadas no tema na região atendida pela clínica.',
  regiao: 'Região atendida pela clínica (bairros e cidades a definir)',
  canais_divulgacao: ['Instagram orgânico', 'Meta Ads', 'Parceria'],
  destino: 'Página de inscrição',
  cta: 'Inscreva-se na Live e envie suas dúvidas com antecedência',
  roteiro:
`1. Apresentação e objetivo educativo da conversa.
2. "O que você imaginava antes da experiência?".
3. "Como foi a experiência e o que gostaria de ter sabido antes?".
4. Esclarecimento de dúvidas pela profissional, sem orientação clínica individual pela Live.
5. Perguntas do público, com encaminhamento de situações individuais para avaliação.
6. Próximo passo para quem deseja conversar com a equipe.`,
  participantes: 'Evelyn + clientes convidadas para compartilhar relatos reais',
  materiais: '',
  orcamento_estimado: null,
  data_prevista: null,
  responsavel_id: null,
  responsavel_nome: '',
  tarefas_iniciais: [
    'Definir data e horário da transmissão',
    'Convidar participantes e confirmar disponibilidades',
    'Revisar roteiro e autorizações pertinentes (conselho profissional)',
    'Preparar arte e cronograma de divulgação',
    'Escolher formato de transmissão (Instagram Live)',
    'Preparar página/formulário de inscrição',
    'Testar equipamentos e acesso à transmissão',
    'Realizar a transmissão ao vivo',
    'Registrar aprendizados e encaminhar contatos',
  ],
};

function getEtapaCfg(val) {
  if (val === 'executada') return ETAPAS[4]; // compatibilidade
  return ETAPAS.find(e => e.value === val) || ETAPAS[0];
}

// ─── Modal de Captura Rápida ───────────────────────────────────────────────────

function ModalCapturaRapida({ onClose, onSave, onOpenFull }) {
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [formato, setFormato] = useState('Não definido');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const handleSalvar = async () => {
    const t = titulo.trim();
    if (!t) {
      setErr('O título da ideia é obrigatório.');
      return;
    }
    if (t.length > 120) {
      setErr('O título não pode exceder 120 caracteres.');
      return;
    }
    setSaving(true);
    setErr('');
    const res = await onSave({
      titulo: t,
      descricao: descricao.trim(),
      formato,
      etapa: 'ideia',
    });
    setSaving(false);
    if (res?.error) {
      setErr(res.error.message || 'Erro ao registrar ideia.');
      return;
    }
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: '#EDE9FE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Lightbulb style={{ width: 18, height: 18, color: '#8B5CF6' }} />
            </div>
            <span className="modal-title">Nova Ideia</span>
          </div>
          <button className="modal-close" onClick={onClose}><X style={{ width: 18, height: 18 }} /></button>
        </div>

        {err && (
          <div style={{ background: '#FEE2E2', border: '1px solid #FCA5A5', color: '#991B1B', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 14 }}>
            {err}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
              Título da Ideia <span style={{ color: '#DC2626' }}>*</span>
            </label>
            <input
              type="text"
              className="form-input"
              placeholder="Ex: Conversa ao vivo sobre cuidados pós-procedimento"
              value={titulo}
              maxLength={120}
              onChange={e => setTitulo(e.target.value)}
              autoFocus
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
              <span>Apenas o título já é suficiente para salvar na lousa.</span>
              <span>{titulo.length}/120</span>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
              O que pensei? <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-muted)' }}>(opcional)</span>
            </label>
            <textarea
              className="form-input"
              rows={3}
              placeholder="Descreva livremente o objetivo ou os detalhes iniciais..."
              value={descricao}
              onChange={e => setDescricao(e.target.value)}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
              Formato inicial <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-muted)' }}>(opcional)</span>
            </label>
            <select
              className="form-input"
              value={formato}
              onChange={e => setFormato(e.target.value)}
            >
              {FORMATOS.map(f => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 22, paddingTop: 14, borderTop: '1px solid var(--border-light)' }}>
          <button
            type="button"
            className="btn btn-ghost"
            style={{ fontSize: 12, color: 'var(--color-primary)' }}
            onClick={() => {
              onClose();
              onOpenFull({ titulo, descricao, formato });
            }}
          >
            Abrir planejamento completo <ChevronRight style={{ width: 14, height: 14 }} />
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancelar</button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSalvar}
              disabled={saving || !titulo.trim()}
              style={{ background: '#8B5CF6', borderColor: '#8B5CF6' }}
            >
              {saving ? 'Salvando...' : 'Salvar Ideia'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Modal Converter em Campanha (Rascunho Transacional) ──────────────────────

function ModalConverterCampanha({ ideia, onClose, onConverted }) {
  const [nome, setNome] = useState(ideia.titulo || '');
  const [canal, setCanal] = useState('Instagram');
  const [mensagem, setMensagem] = useState('');
  const [publico, setPublico] = useState(ideia.publico || '');
  const [orcamento, setOrcamento] = useState(ideia.orcamento_estimado || 0);
  const [dataInicio, setDataInicio] = useState(ideia.data_prevista ? ideia.data_prevista.split('T')[0] : '');
  const [converting, setConverting] = useState(false);
  const [err, setErr] = useState('');

  const handleConvert = async () => {
    if (!nome.trim()) {
      setErr('O nome da campanha é obrigatório.');
      return;
    }
    setConverting(true);
    setErr('');
    const res = await onConverted({
      ideiaId: ideia.id,
      nome: nome.trim(),
      canal,
      mensagem: mensagem.trim(),
      publico: publico.trim(),
      orcamento: parseFloat(orcamento) || 0,
      dataInicio,
    });
    setConverting(false);
    if (!res.ok) {
      setErr(res.error?.message || 'Falha ao transformar em campanha.');
      return;
    }
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: '#EDE9FE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Send style={{ width: 16, height: 16, color: '#8B5CF6' }} />
            </div>
            <div>
              <span className="modal-title">Transformar em Campanha</span>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Criação transacional com status: Rascunho</div>
            </div>
          </div>
          <button className="modal-close" onClick={onClose}><X style={{ width: 18, height: 18 }} /></button>
        </div>

        {err && (
          <div style={{ background: '#FEE2E2', border: '1px solid #FCA5A5', color: '#991B1B', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 14 }}>
            {err}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Nome da Campanha</label>
            <input
              type="text"
              className="form-input"
              value={nome}
              onChange={e => setNome(e.target.value)}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Canal Principal</label>
              <select className="form-input" value={canal} onChange={e => setCanal(e.target.value)}>
                {CANAIS_CAMPANHA_OPCOES.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Data Início Sugerida</label>
              <input
                type="date"
                className="form-input"
                value={dataInicio}
                onChange={e => setDataInicio(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Público-Alvo</label>
            <input
              type="text"
              className="form-input"
              value={publico}
              onChange={e => setPublico(e.target.value)}
              placeholder="Ex: Mulheres 25-45 interessadas na região"
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Orçamento Estimado (R$)</label>
            <input
              type="number"
              min="0"
              step="50"
              className="form-input"
              value={orcamento}
              onChange={e => setOrcamento(e.target.value)}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
              Mensagem de Divulgação <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-muted)' }}>(opcional)</span>
            </label>
            <textarea
              className="form-input"
              rows={3}
              placeholder="Texto comercial para a campanha..."
              value={mensagem}
              onChange={e => setMensagem(e.target.value)}
            />
          </div>

          <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, padding: 12, fontSize: 12, color: 'var(--text-medium)' }}>
            <strong>Nota de consistência:</strong> Criar o rascunho vincula a ideia atomicamente no banco. A campanha não iniciará disparos nem anúncios até que seja explicitamente ativada no módulo de campanhas.
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={converting}>Cancelar</button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleConvert}
            disabled={converting || !nome.trim()}
            style={{ background: '#8B5CF6', borderColor: '#8B5CF6' }}
          >
            {converting ? 'Criando Rascunho...' : 'Confirmar e Criar Campanha'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal Vincular Campanha Existente ─────────────────────────────────────────

function ModalVincularCampanha({ ideia, campanhas, onClose, onLinked }) {
  const [selectedId, setSelectedId] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const handleLink = async () => {
    if (!selectedId) {
      setErr('Selecione uma campanha.');
      return;
    }
    setSaving(true);
    setErr('');
    const res = await onLinked(ideia.id, parseInt(selectedId, 10));
    setSaving(false);
    if (!res.ok) {
      setErr(res.error?.message || 'Erro ao vincular campanha.');
      return;
    }
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 460 }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <LinkIcon style={{ width: 18, height: 18, color: 'var(--color-primary)' }} />
            <span className="modal-title">Vincular a Campanha Existente</span>
          </div>
          <button className="modal-close" onClick={onClose}><X style={{ width: 18, height: 18 }} /></button>
        </div>

        {err && (
          <div style={{ background: '#FEE2E2', border: '1px solid #FCA5A5', color: '#991B1B', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 14 }}>
            {err}
          </div>
        )}

        <p style={{ fontSize: 13, color: 'var(--text-medium)', marginBottom: 14 }}>
          Associe esta ideia a uma campanha já cadastrada no PAIEMAE. O vínculo ficará registrado no histórico.
        </p>

        <div>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Selecione a Campanha</label>
          <select className="form-input" value={selectedId} onChange={e => setSelectedId(e.target.value)}>
            <option value="">Selecione uma campanha...</option>
            {campanhas.map(c => (
              <option key={c.id} value={c.id}>
                {c.nome} ({c.canal} · {c.status})
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancelar</button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleLink}
            disabled={saving || !selectedId}
          >
            {saving ? 'Vinculando...' : 'Vincular'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Ficha Completa da Ideia (Drawer / Modal) ──────────────────────────────────

function FichaIdeiaModal({
  ideiaId,
  initialData = null,
  isReadOnly = false,
  staffList = [],
  campanhas = [],
  onClose,
  onUpdated,
  onArchived,
  onDuplicated,
  onApproveToggle,
  onConvertCampanha,
  onVincularCampanha,
  onDesvincularCampanha,
}) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(!initialData || !!initialData.id);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [activeTab, setActiveTab] = useState('resumo');

  // Modais secundários
  const [modalConvertOpen, setModalConvertOpen] = useState(false);
  const [modalLinkOpen, setModalLinkOpen] = useState(false);

  // Estado do formulário
  const [form, setForm] = useState({
    titulo: '',
    descricao: '',
    formato: 'Não definido',
    canal: 'Instagram',
    tipo: 'conteudo',
    etapa: 'ideia',
    aprovado: false,
    aprovado_em: null,
    aprovado_por: null,
    aprovador_nome: '',
    servico_tema: '',
    objetivo: '',
    publico: '',
    regiao: '',
    canais_divulgacao: [],
    destino: '',
    cta: '',
    responsavel_id: null,
    responsavel_nome: '',
    data_prevista: '',
    orcamento_estimado: '',
    roteiro: '',
    participantes: '',
    materiais: '',
    data_real: '',
    aprendizado: '',
    campanha_id: null,
    arquivada: false,
    versao: 1,
  });

  const [tasks, setTasks] = useState([]);
  const [events, setEvents] = useState([]);
  const [novoComentario, setNovoComentario] = useState('');
  const [addingComment, setAddingComment] = useState(false);

  // Nova tarefa inline
  const [novaTarefaTexto, setNovaTarefaTexto] = useState('');
  const [novaTarefaResp, setNovaTarefaResp] = useState('');
  const [novaTarefaPrazo, setNovaTarefaPrazo] = useState('');

  const setField = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  // Carregar dados completos
  const carregar = useCallback(async () => {
    if (!ideiaId) {
      if (initialData) {
        setForm(prev => ({
          ...prev,
          ...initialData,
          canais_divulgacao: initialData.canais_divulgacao || [],
        }));
        if (initialData.tarefas_iniciais) {
          setTasks(initialData.tarefas_iniciais.map((t, idx) => ({
            id: `temp-${idx}`,
            titulo: t,
            concluida: false,
            ordem: idx,
          })));
        }
      }
      setLoading(false);
      return;
    }

    setLoading(true);
    setErr('');
    const res = await fetchIdeaById(ideiaId);
    setLoading(false);
    if (res.error) {
      setErr(res.error.message || 'Erro ao carregar detalhes da ideia.');
      return;
    }

    if (res.data) {
      setForm({
        ...res.data,
        canais_divulgacao: Array.isArray(res.data.canais_divulgacao) ? res.data.canais_divulgacao : [],
        orcamento_estimado: res.data.orcamento_estimado != null ? String(res.data.orcamento_estimado) : '',
        data_prevista: res.data.data_prevista ? res.data.data_prevista.slice(0, 16) : '',
        data_real: res.data.data_real ? res.data.data_real.slice(0, 16) : '',
      });
      setTasks(res.tasks || []);
      setEvents(res.events || []);
    }
  }, [ideiaId, initialData]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // Salvar alterações principais
  const handleSave = async (extraPatch = {}) => {
    if (isReadOnly) return;
    const t = (extraPatch.titulo !== undefined ? extraPatch.titulo : form.titulo).trim();
    if (!t) {
      setErr('O título é obrigatório.');
      return;
    }
    setSaving(true);
    setErr('');

    const patch = {
      ...form,
      ...extraPatch,
      titulo: t,
      canais_divulgacao: form.canais_divulgacao,
      orcamento_estimado: form.orcamento_estimado !== '' ? parseFloat(form.orcamento_estimado) : null,
      data_prevista: form.data_prevista ? new Date(form.data_prevista).toISOString() : null,
      data_real: form.data_real ? new Date(form.data_real).toISOString() : null,
    };

    const author = user ? { id: user.id, email: user.email, name: user.user_metadata?.full_name } : null;

    if (!ideiaId) {
      const res = await insertIdea(patch, author);
      setSaving(false);
      if (res.error) {
        setErr(res.error.message || 'Erro ao criar ideia.');
        return;
      }
      if (tasks.length > 0 && res.data?.id) {
        for (const t of tasks) {
          await upsertIdeaTask({ ideia_id: res.data.id, titulo: t.titulo, ordem: t.ordem || 0 });
        }
      }
      onUpdated(res.data);
      onClose();
      return;
    }

    const res = await updateIdea(ideiaId, patch, author, form.versao);
    setSaving(false);
    if (res.error) {
      if (res.conflict) {
        setErr('Conflito de edição: este registro foi alterado em outra sessão. Recarregue a ficha para revisar.');
      } else {
        setErr(res.error.message || 'Erro ao salvar alterações.');
      }
      return;
    }

    onUpdated(res.data);
    await carregar();
  };

  // Alterar etapa com validação
  const handleChangeEtapa = async (novaEtapa) => {
    if (isReadOnly) return;
    if (novaEtapa === form.etapa) return;

    // Para transições a Agendada, Em execução ou Concluída, exigir aprovação
    if (['agendada', 'em_execucao', 'concluida'].includes(novaEtapa) && !form.aprovado) {
      setErr('Para agendar ou colocar a ideia em execução, ela deve ser aprovada primeiro.');
      return;
    }

    // Se for passar para agendada, confere requisitos
    if (novaEtapa === 'agendada') {
      const temResp = !!(form.responsavel_id || form.responsavel_nome);
      const temData = !!form.data_prevista;
      const temObj = !!form.objetivo?.trim();
      const temCanais = form.canais_divulgacao?.length > 0;
      if (!temResp || !temData || !temObj || !temCanais) {
        const faltantes = [];
        if (!temResp) faltantes.push('Responsável');
        if (!temData) faltantes.push('Data prevista');
        if (!temObj) faltantes.push('Objetivo');
        if (!temCanais) faltantes.push('Pelo menos um canal de divulgação');
        setErr(`Para agendar, informe: ${faltantes.join(', ')}.`);
        setActiveTab('planejamento');
        return;
      }
    }

    // Se for passar para concluída, exige data real
    if (novaEtapa === 'concluida') {
      if (!form.data_real) {
        setErr('Para marcar como Concluída, informe a data real da execução.');
        setActiveTab('execucao');
        return;
      }
    }

    setField('etapa', novaEtapa);
    await handleSave({ etapa: novaEtapa });
  };

  // Aprovar / Retirar Aprovação
  const handleToggleAprovacao = async () => {
    if (isReadOnly || !ideiaId) return;
    const proximoAprovado = !form.aprovado;
    let motivo = '';

    if (!proximoAprovado) {
      if (form.etapa === 'em_execucao' || form.etapa === 'concluida' || form.etapa === 'executada') {
        alert('Não é possível retirar a aprovação de uma ação já em execução ou concluída. Retorne a etapa para planejamento antes.');
        return;
      }
      const confirmRetirada = prompt('Confirma retirar a aprovação desta ideia? Motivo (opcional):');
      if (confirmRetirada === null) return;
      motivo = confirmRetirada;
    }

    const res = await onApproveToggle(ideiaId, proximoAprovado, motivo);
    if (res?.ok) {
      await carregar();
      onUpdated();
    } else {
      setErr(res?.error?.message || 'Erro ao alterar aprovação.');
    }
  };

  // Gerenciamento de tarefas
  const handleToggleTask = async (task) => {
    if (isReadOnly) return;
    if (!ideiaId) {
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, concluida: !t.concluida } : t));
      return;
    }
    const { error } = await upsertIdeaTask({
      id: task.id,
      ideia_id: ideiaId,
      titulo: task.titulo,
      concluida: !task.concluida,
      responsavel: task.responsavel,
      prazo: task.prazo,
      ordem: task.ordem,
    });
    if (error) {
      setErr('Erro ao atualizar tarefa.');
    } else {
      const updated = await fetchIdeaTasks(ideiaId);
      setTasks(updated);
    }
  };

  const handleAddTask = async () => {
    if (isReadOnly || !novaTarefaTexto.trim()) return;
    if (!ideiaId) {
      setTasks(prev => [
        ...prev,
        {
          id: `temp-${Date.now()}`,
          titulo: novaTarefaTexto.trim(),
          concluida: false,
          responsavel: novaTarefaResp || null,
          prazo: novaTarefaPrazo || null,
          ordem: tasks.length,
        },
      ]);
      setNovaTarefaTexto('');
      setNovaTarefaResp('');
      setNovaTarefaPrazo('');
      return;
    }

    const { error } = await upsertIdeaTask({
      ideia_id: ideiaId,
      titulo: novaTarefaTexto.trim(),
      responsavel: novaTarefaResp || null,
      prazo: novaTarefaPrazo || null,
      ordem: tasks.length,
    });
    if (error) {
      setErr('Erro ao adicionar tarefa.');
    } else {
      setNovaTarefaTexto('');
      setNovaTarefaResp('');
      setNovaTarefaPrazo('');
      const updated = await fetchIdeaTasks(ideiaId);
      setTasks(updated);
    }
  };

  const handleDeleteTask = async (taskId) => {
    if (isReadOnly) return;
    if (!ideiaId || taskId.startsWith('temp-')) {
      setTasks(prev => prev.filter(t => t.id !== taskId));
      return;
    }
    const { error } = await deleteIdeaTask(taskId);
    if (!error) {
      setTasks(prev => prev.filter(t => t.id !== taskId));
    }
  };

  // Comentários
  const handleAddComment = async () => {
    if (isReadOnly || !novoComentario.trim() || !ideiaId) return;
    setAddingComment(true);
    const author = user ? { id: user.id, email: user.email, name: user.user_metadata?.full_name } : null;
    const res = await addIdeaComment(ideiaId, novoComentario, author);
    setAddingComment(false);
    if (res.ok) {
      setNovoComentario('');
      const evts = await fetchIdeaEvents(ideiaId);
      setEvents(evts);
    } else {
      setErr('Erro ao adicionar comentário.');
    }
  };

  // Toggle canal de divulgação
  const toggleCanalDivulgacao = (c) => {
    if (isReadOnly) return;
    const cur = form.canais_divulgacao || [];
    if (cur.includes(c)) {
      setField('canais_divulgacao', cur.filter(x => x !== c));
    } else {
      setField('canais_divulgacao', [...cur, c]);
    }
  };

  // Campanha vinculada
  const campanhaVinculada = form.campanha_id
    ? campanhas.find(c => c.id === form.campanha_id)
    : null;

  const etapaCfg = getEtapaCfg(form.etapa);
  const tasksConcluidas = tasks.filter(t => t.concluida).length;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: 880, width: '95%', maxHeight: '92vh', display: 'flex', flexDirection: 'column', padding: 0 }}
      >
        {/* Header da Ficha */}
        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', background: '#FAFAF9' }}>
          <div style={{ flex: 1, marginRight: 16 }}>
            {/* Selos de Aprovação e Etapa */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
              {/* Selo Aprovação */}
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '3px 10px',
                  borderRadius: 12,
                  fontSize: 12,
                  fontWeight: 700,
                  color: form.aprovado ? '#065F46' : '#92400E',
                  background: form.aprovado ? '#D1FAE5' : '#FEF3C7',
                  border: `1px solid ${form.aprovado ? '#A7F3D0' : '#FDE68A'}`,
                }}
              >
                {form.aprovado ? (
                  <>
                    <CheckCircle style={{ width: 13, height: 13, color: '#059669' }} />
                    Aprovada
                  </>
                ) : (
                  <>
                    <Clock style={{ width: 13, height: 13, color: '#D97706' }} />
                    Pendente de aprovação
                  </>
                )}
              </span>

              {/* Selo Etapa */}
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '3px 10px',
                  borderRadius: 12,
                  fontSize: 12,
                  fontWeight: 700,
                  color: etapaCfg.color,
                  background: etapaCfg.bg,
                  border: `1px solid ${etapaCfg.border}`,
                }}
              >
                {form.etapa === 'em_execucao' ? (
                  <Play style={{ width: 12, height: 12 }} />
                ) : form.etapa === 'concluida' ? (
                  <CheckCircle2 style={{ width: 12, height: 12 }} />
                ) : (
                  <Sparkles style={{ width: 12, height: 12 }} />
                )}
                {etapaCfg.label}
              </span>

              <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 6, background: '#F3F4F6', color: '#4B5563', fontWeight: 600 }}>
                {form.formato}
              </span>

              {form.arquivada && (
                <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: '#E5E7EB', color: '#374151', fontWeight: 600 }}>
                  <Archive style={{ width: 11, height: 11, display: 'inline', marginRight: 3 }} /> Arquivada
                </span>
              )}

              {campanhaVinculada && (
                <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: '#EDE9FE', color: '#7C3AED', fontWeight: 600 }}>
                  <LinkIcon style={{ width: 11, height: 11, display: 'inline', marginRight: 3 }} /> Campanha #{campanhaVinculada.id}
                </span>
              )}

              {isReadOnly && (
                <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: '#FEF3C7', color: '#B45309', fontWeight: 700 }}>
                  <ShieldAlert style={{ width: 11, height: 11, display: 'inline', marginRight: 3 }} /> Somente Leitura
                </span>
              )}
            </div>

            <input
              type="text"
              value={form.titulo}
              disabled={isReadOnly}
              onChange={e => setField('titulo', e.target.value)}
              placeholder="Título da ideia..."
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: 'var(--text-dark)',
                width: '100%',
                border: 'none',
                background: 'transparent',
                outline: 'none',
                padding: '2px 0',
              }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {ideiaId && !isReadOnly && (
              <>
                <button
                  type="button"
                  className="btn btn-ghost"
                  title="Duplicar ideia"
                  onClick={() => onDuplicated(ideiaId)}
                  style={{ padding: 8 }}
                >
                  <Copy style={{ width: 16, height: 16 }} />
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  title={form.arquivada ? 'Restaurar ideia' : 'Arquivar ideia'}
                  onClick={() => onArchived(ideiaId, !form.arquivada)}
                  style={{ padding: 8, color: form.arquivada ? '#10B981' : '#6B7280' }}
                >
                  <Archive style={{ width: 16, height: 16 }} />
                </button>
              </>
            )}
            <button className="modal-close" onClick={onClose} style={{ marginLeft: 6 }}>
              <X style={{ width: 20, height: 20 }} />
            </button>
          </div>
        </div>

        {/* Notificação de Erro */}
        {err && (
          <div style={{ margin: '12px 24px 0', background: '#FEE2E2', border: '1px solid #FCA5A5', color: '#991B1B', borderRadius: 8, padding: '10px 14px', fontSize: 13, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>{err}</span>
            <button onClick={() => setErr('')} style={{ background: 'none', border: 'none', color: '#991B1B', cursor: 'pointer' }}>×</button>
          </div>
        )}

        {/* Barra de Ação de Aprovação e Pipeline de Etapa */}
        <div style={{ padding: '10px 24px', borderBottom: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, background: '#FFFFFF', flexWrap: 'wrap' }}>
          {/* Botão de Aprovar / Retirar Aprovação */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {!isReadOnly && ideiaId && (
              <button
                type="button"
                onClick={handleToggleAprovacao}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '5px 12px',
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  border: form.aprovado ? '1px solid #FDE68A' : '1px solid #6EE7B7',
                  background: form.aprovado ? '#FEF3C7' : '#D1FAE5',
                  color: form.aprovado ? '#92400E' : '#065F46',
                }}
              >
                {form.aprovado ? (
                  <>Retirar aprovação</>
                ) : (
                  <><CheckCircle style={{ width: 13, height: 13 }} /> Aprovar ideia</>
                )}
              </button>
            )}
            {form.aprovado && form.aprovado_em && (
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                Aprovada em {formatDateTimeBR(form.aprovado_em)} {form.aprovador_nome ? `por ${form.aprovador_nome}` : ''}
              </span>
            )}
          </div>

          {/* Pipeline de Etapas */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflowX: 'auto' }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginRight: 2 }}>Etapa:</span>
            {ETAPAS.map((et, idx) => {
              const isCurrent = form.etapa === et.value;
              return (
                <button
                  key={et.value}
                  type="button"
                  disabled={isReadOnly}
                  onClick={() => handleChangeEtapa(et.value)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    padding: '4px 10px',
                    borderRadius: 16,
                    border: `1px solid ${isCurrent ? et.color : 'var(--border-light)'}`,
                    background: isCurrent ? et.bg : '#FFFFFF',
                    color: isCurrent ? et.color : 'var(--text-medium)',
                    fontSize: 11,
                    fontWeight: isCurrent ? 700 : 500,
                    cursor: isReadOnly ? 'not-allowed' : 'pointer',
                  }}
                >
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: et.color }} />
                  {et.label}
                  {idx < ETAPAS.length - 1 && <span style={{ color: '#D1D5DB', marginLeft: 2 }}>›</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tabs de Seções */}
        <div className="tabs" style={{ padding: '0 24px', margin: 0, borderBottom: '1px solid var(--border-light)', background: '#FAFAF9' }}>
          {[
            { id: 'resumo',       label: '1. Resumo',       icon: Lightbulb },
            { id: 'planejamento', label: '2. Planejamento', icon: Calendar },
            { id: 'conteudo',     label: '3. Conteúdo',     icon: AlignLeft },
            { id: 'tarefas',      label: `4. Tarefas (${tasksConcluidas}/${tasks.length})`, icon: CheckSquare },
            { id: 'campanha',     label: '5. Campanha',     icon: Send },
            { id: 'historico',    label: '6. Histórico',    icon: History },
            { id: 'execucao',     label: '7. Execução Real', icon: CheckCircle },
          ].map(tab => (
            <button
              key={tab.id}
              className={`tab-item${activeTab === tab.id ? ' active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
              style={{ fontSize: 13, padding: '10px 14px' }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Conteúdo das Seções (Scrollável) */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
              <RefreshCw className="spin" style={{ width: 24, height: 24, margin: '0 auto 10px' }} />
              Carregando dados da ideia...
            </div>
          ) : (
            <>
              {/* SEÇÃO 1: RESUMO */}
              {activeTab === 'resumo' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                      Título <span style={{ color: '#DC2626' }}>*</span>
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      disabled={isReadOnly}
                      value={form.titulo}
                      maxLength={120}
                      onChange={e => setField('titulo', e.target.value)}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Formato da Ação</label>
                      <select
                        className="form-input"
                        disabled={isReadOnly}
                        value={form.formato}
                        onChange={e => setField('formato', e.target.value)}
                      >
                        {FORMATOS.map(f => (
                          <option key={f} value={f}>{f}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Serviço / Tema</label>
                      <input
                        type="text"
                        className="form-input"
                        disabled={isReadOnly}
                        placeholder="Ex: Toxina Botulínica, Harmonização..."
                        value={form.servico_tema}
                        onChange={e => setField('servico_tema', e.target.value)}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Descrição / Ideia Inicial</label>
                    <textarea
                      className="form-input"
                      rows={4}
                      disabled={isReadOnly}
                      placeholder="Descreva o propósito da ideia e o contexto..."
                      value={form.descricao}
                      onChange={e => setField('descricao', e.target.value)}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                      Objetivo da Ação
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      disabled={isReadOnly}
                      placeholder="Ex: Gerar inscrições de pessoas da região e pedidos de avaliação..."
                      value={form.objetivo}
                      onChange={e => setField('objetivo', e.target.value)}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Público-Alvo Estimado</label>
                    <input
                      type="text"
                      className="form-input"
                      disabled={isReadOnly}
                      placeholder="Ex: Pessoas interessadas no tema na região atendida pela clínica..."
                      value={form.publico}
                      onChange={e => setField('publico', e.target.value)}
                    />
                  </div>
                </div>
              )}

              {/* SEÇÃO 2: PLANEJAMENTO */}
              {activeTab === 'planejamento' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                        Responsável da Ação
                      </label>
                      <select
                        className="form-input"
                        disabled={isReadOnly}
                        value={form.responsavel_id || ''}
                        onChange={e => {
                          const uid = e.target.value || null;
                          const found = staffList.find(s => s.id === uid);
                          setField('responsavel_id', uid);
                          setField('responsavel_nome', found ? found.nome : '');
                        }}
                      >
                        <option value="">Não definido</option>
                        {staffList.map(s => (
                          <option key={s.id} value={s.id}>{s.nome} {s.cargo ? `(${s.cargo})` : ''}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                        Data / Hora Prevista (America/Sao_Paulo)
                      </label>
                      <input
                        type="datetime-local"
                        className="form-input"
                        disabled={isReadOnly}
                        value={form.data_prevista}
                        onChange={e => setField('data_prevista', e.target.value)}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Região Atendida</label>
                    <input
                      type="text"
                      className="form-input"
                      disabled={isReadOnly}
                      placeholder="Ex: Região metropolitana, bairros específicos da clínica..."
                      value={form.regiao}
                      onChange={e => setField('regiao', e.target.value)}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                      Canais de Divulgação Planejados (múltipla escolha)
                    </label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {CANAIS_DIVULGACAO_OPCOES.map(c => {
                        const checked = (form.canais_divulgacao || []).includes(c);
                        return (
                          <button
                            key={c}
                            type="button"
                            disabled={isReadOnly}
                            onClick={() => toggleCanalDivulgacao(c)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6,
                              padding: '6px 12px',
                              borderRadius: 8,
                              border: `1px solid ${checked ? '#8B5CF6' : 'var(--border-light)'}`,
                              background: checked ? '#EDE9FE' : '#FFFFFF',
                              color: checked ? '#6D28D9' : 'var(--text-medium)',
                              fontSize: 12,
                              fontWeight: checked ? 600 : 400,
                              cursor: isReadOnly ? 'not-allowed' : 'pointer',
                            }}
                          >
                            {checked ? <CheckSquare style={{ width: 14, height: 14 }} /> : <Square style={{ width: 14, height: 14 }} />}
                            {c}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Destino da Divulgação</label>
                      <input
                        type="text"
                        className="form-input"
                        disabled={isReadOnly}
                        placeholder="Ex: Página de inscrição, Direct, WhatsApp..."
                        value={form.destino}
                        onChange={e => setField('destino', e.target.value)}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Chamada para Ação (CTA)</label>
                      <input
                        type="text"
                        className="form-input"
                        disabled={isReadOnly}
                        placeholder="Ex: Inscreva-se na Live e garanta sua vaga..."
                        value={form.cta}
                        onChange={e => setField('cta', e.target.value)}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                      Orçamento Estimado (R$)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="50"
                      className="form-input"
                      disabled={isReadOnly}
                      placeholder="0.00"
                      value={form.orcamento_estimado}
                      onChange={e => setField('orcamento_estimado', e.target.value)}
                    />
                  </div>
                </div>
              )}

              {/* SEÇÃO 3: CONTEÚDO */}
              {activeTab === 'conteudo' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                      Roteiro / Estrutura da Apresentação
                    </label>
                    <textarea
                      className="form-input"
                      rows={8}
                      disabled={isReadOnly}
                      placeholder="Tópicos da conversa, perguntas e direcionamento do conteúdo..."
                      value={form.roteiro}
                      onChange={e => setField('roteiro', e.target.value)}
                      style={{ fontFamily: 'monospace', fontSize: 13, lineHeight: 1.5 }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Participantes Previstos</label>
                    <input
                      type="text"
                      className="form-input"
                      disabled={isReadOnly}
                      placeholder="Ex: Evelyn (profissional) + 2 clientes convidadas..."
                      value={form.participantes}
                      onChange={e => setField('participantes', e.target.value)}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Links de Materiais & Apoio</label>
                    <textarea
                      className="form-input"
                      rows={3}
                      disabled={isReadOnly}
                      placeholder="https://drive.google.com/... (um por linha)"
                      value={form.materiais}
                      onChange={e => setField('materiais', e.target.value)}
                    />
                  </div>
                </div>
              )}

              {/* SEÇÃO 4: TAREFAS */}
              {activeTab === 'tarefas' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>Checklist de Preparação</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {tasksConcluidas} de {tasks.length} concluídas
                    </div>
                  </div>

                  {!isReadOnly && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: 8, background: '#F8FAFC', padding: 10, borderRadius: 8, border: '1px solid var(--border-light)' }}>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Nova tarefa (ex: Convidar participantes)..."
                        value={novaTarefaTexto}
                        onChange={e => setNovaTarefaTexto(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleAddTask(); }}
                      />
                      <select
                        className="form-input"
                        style={{ width: 140 }}
                        value={novaTarefaResp}
                        onChange={e => setNovaTarefaResp(e.target.value)}
                      >
                        <option value="">Sem resp.</option>
                        {staffList.map(s => (
                          <option key={s.id} value={s.nome}>{s.nome}</option>
                        ))}
                      </select>
                      <input
                        type="date"
                        className="form-input"
                        style={{ width: 130 }}
                        value={novaTarefaPrazo}
                        onChange={e => setNovaTarefaPrazo(e.target.value)}
                      />
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={handleAddTask}
                        disabled={!novaTarefaTexto.trim()}
                        style={{ background: '#8B5CF6', borderColor: '#8B5CF6' }}
                      >
                        <Plus style={{ width: 14, height: 14 }} /> Adicionar
                      </button>
                    </div>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {tasks.length === 0 ? (
                      <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                        Nenhuma tarefa registrada para esta ideia.
                      </div>
                    ) : (
                      tasks.map(t => (
                        <div
                          key={t.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '8px 12px',
                            borderRadius: 8,
                            background: t.concluida ? '#F3F4F6' : '#FFFFFF',
                            border: '1px solid var(--border-light)',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
                            <button
                              type="button"
                              disabled={isReadOnly}
                              onClick={() => handleToggleTask(t)}
                              style={{ background: 'none', border: 'none', cursor: isReadOnly ? 'default' : 'pointer', padding: 0 }}
                            >
                              {t.concluida ? (
                                <CheckSquare style={{ width: 18, height: 18, color: '#10B981' }} />
                              ) : (
                                <Square style={{ width: 18, height: 18, color: '#9CA3AF' }} />
                              )}
                            </button>
                            <span
                              style={{
                                fontSize: 13,
                                textDecoration: t.concluida ? 'line-through' : 'none',
                                color: t.concluida ? '#6B7280' : 'var(--text-dark)',
                              }}
                            >
                              {t.titulo}
                            </span>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            {t.responsavel && (
                              <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: '#EDE9FE', color: '#6D28D9' }}>
                                {t.responsavel}
                              </span>
                            )}
                            {t.prazo && (
                              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                <Clock style={{ width: 11, height: 11, display: 'inline', marginRight: 3 }} />
                                {formatDateBR(t.prazo)}
                              </span>
                            )}
                            {!isReadOnly && (
                              <button
                                type="button"
                                onClick={() => handleDeleteTask(t.id)}
                                style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', padding: 4 }}
                              >
                                <Trash2 style={{ width: 14, height: 14 }} />
                              </button>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* SEÇÃO 5: CAMPANHA */}
              {activeTab === 'campanha' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {campanhaVinculada ? (
                    <div style={{ background: '#F5F3FF', border: '1px solid #DDD6FE', borderRadius: 10, padding: 18 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 32, height: 32, borderRadius: 8, background: '#8B5CF6', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Send style={{ width: 16, height: 16 }} />
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 15 }}>{campanhaVinculada.nome}</div>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                              Canal: {campanhaVinculada.canal} · Status: <span style={{ fontWeight: 600 }}>{campanhaVinculada.status}</span>
                            </div>
                          </div>
                        </div>

                        {!isReadOnly && (
                          <button
                            type="button"
                            className="btn btn-ghost"
                            style={{ color: '#DC2626', fontSize: 12 }}
                            onClick={() => onDesvincularCampanha(ideiaId, campanhaVinculada.id)}
                          >
                            <Unlink style={{ width: 14, height: 14 }} /> Desvincular
                          </button>
                        )}
                      </div>

                      <p style={{ fontSize: 12, color: 'var(--text-medium)', margin: 0 }}>
                        Esta ideia está vinculada à campanha acima. O planejamento e os dados de roteiro são preservados de forma independente.
                      </p>
                    </div>
                  ) : (
                    <div style={{ background: '#F8FAFC', border: '1px dashed #CBD5E1', borderRadius: 10, padding: 24, textAlign: 'center' }}>
                      <Send style={{ width: 32, height: 32, color: '#8B5CF6', margin: '0 auto 10px' }} />
                      <h4 style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 700 }}>Nenhuma Campanha Vinculada</h4>
                      <p style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 440, margin: '0 auto 16px' }}>
                        Transforme esta ideia em um rascunho de campanha para execução comercial ou vincule-a a uma campanha já existente.
                      </p>

                      {!isReadOnly && (
                        <div style={{ display: 'flex', justifyContent: 'center', gap: 10 }}>
                          <button
                            type="button"
                            className="btn btn-primary"
                            onClick={() => setModalConvertOpen(true)}
                            style={{ background: '#8B5CF6', borderColor: '#8B5CF6' }}
                          >
                            <Sparkles style={{ width: 14, height: 14 }} /> Transformar em Campanha (Rascunho)
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost"
                            onClick={() => setModalLinkOpen(true)}
                          >
                            <LinkIcon style={{ width: 14, height: 14 }} /> Vincular Existente
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* SEÇÃO 6: HISTÓRICO & COMENTÁRIOS */}
              {activeTab === 'historico' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {!isReadOnly && (
                    <div style={{ display: 'flex', gap: 8, background: '#F8FAFC', padding: 12, borderRadius: 8, border: '1px solid var(--border-light)' }}>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Escreva uma observação ou comentário interno..."
                        value={novoComentario}
                        onChange={e => setNovoComentario(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleAddComment(); }}
                      />
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={handleAddComment}
                        disabled={addingComment || !novoComentario.trim()}
                        style={{ background: '#8B5CF6', borderColor: '#8B5CF6' }}
                      >
                        <MessageCircle style={{ width: 14, height: 14 }} /> Comentar
                      </button>
                    </div>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {events.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)', fontSize: 13 }}>
                        Nenhum evento registrado ainda.
                      </div>
                    ) : (
                      events.map(ev => (
                        <div
                          key={ev.id}
                          style={{
                            padding: '10px 14px',
                            borderRadius: 8,
                            background: '#FFFFFF',
                            border: '1px solid var(--border-light)',
                            fontSize: 13,
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                            <span style={{ fontWeight: 600, color: 'var(--text-dark)' }}>
                              {ev.tipo === 'criacao' && 'Ideia criada'}
                              {ev.tipo === 'aprovacao' && (ev.dados?.aprovado ? 'Ideia aprovada' : 'Aprovação retirada')}
                              {ev.tipo === 'status' && 'Mudança de etapa'}
                              {ev.tipo === 'campo' && 'Alteração de campo'}
                              {ev.tipo === 'comentario' && 'Comentário interno'}
                              {ev.tipo === 'vinculo' && 'Vínculo de campanha'}
                              {ev.tipo === 'arquivamento' && 'Arquivamento'}
                              {ev.tipo === 'duplicacao' && 'Duplicação'}
                            </span>
                            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                              {formatDateTimeBR(ev.created_at)}
                            </span>
                          </div>

                          <div style={{ color: 'var(--text-medium)', fontSize: 12 }}>
                            {ev.tipo === 'aprovacao' && (
                              <span>
                                {ev.dados?.aprovado ? 'Proposta aprovada para planejamento e execução.' : `Aprovação retirada. Motivo: ${ev.dados?.motivo || 'não informado'}`}
                              </span>
                            )}
                            {ev.tipo === 'status' && (
                              <span>
                                Etapa alterada de <strong>{ev.dados?.etapa_de || '—'}</strong> para <strong>{ev.dados?.etapa_para || '—'}</strong>
                              </span>
                            )}
                            {ev.tipo === 'comentario' && (
                              <span>{ev.dados?.comentario}</span>
                            )}
                            {ev.tipo === 'vinculo' && (
                              <span>{ev.dados?.acao === 'desvinculada' ? 'Campanha desvinculada' : `Vinculada à campanha: ${ev.dados?.campanha_nome || '#' + ev.dados?.campanha_id}`}</span>
                            )}
                            {ev.tipo === 'arquivamento' && (
                              <span>Ideia {ev.dados?.arquivada ? 'arquivada' : 'restaurada'}</span>
                            )}
                            {ev.tipo === 'campo' && (
                              <span>Campo <strong>{ev.dados?.campo}</strong> atualizado de &quot;{ev.dados?.de || '—'}&quot; para &quot;{ev.dados?.para || '—'}&quot;</span>
                            )}
                            {ev.tipo === 'criacao' && (
                              <span>Registro inicial da ideia</span>
                            )}
                          </div>

                          {ev.autor_nome && (
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                              Por: {ev.autor_nome}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* SEÇÃO 7: EXECUÇÃO REAL */}
              {activeTab === 'execucao' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 8, padding: 12, fontSize: 13, color: '#166534' }}>
                    <strong>Registro pós-ação:</strong> Preencha estas informações após a realização efetiva da iniciativa para alimentar o aprendizado da equipe.
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                      Data / Hora Real da Realização
                    </label>
                    <input
                      type="datetime-local"
                      className="form-input"
                      disabled={isReadOnly}
                      value={form.data_real}
                      onChange={e => setField('data_real', e.target.value)}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                      Aprendizado, Observações e Próximos Passos
                    </label>
                    <textarea
                      className="form-input"
                      rows={6}
                      disabled={isReadOnly}
                      placeholder="O que deu certo? Quais dúvidas mais surgiram? O que ajustar para a próxima ação?..."
                      value={form.aprendizado}
                      onChange={e => setField('aprendizado', e.target.value)}
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer com Ações */}
        <div style={{ padding: '14px 24px', borderTop: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#FAFAF9' }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {form.updated_at && `Atualizado em: ${formatDateTimeBR(form.updated_at)}`}
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>
              {isReadOnly ? 'Fechar' : 'Cancelar'}
            </button>
            {!isReadOnly && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => handleSave()}
                disabled={saving || !form.titulo.trim()}
                style={{ background: '#8B5CF6', borderColor: '#8B5CF6' }}
              >
                {saving ? 'Salvando...' : 'Salvar Alterações'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Sub-modais de conversão e vínculo */}
      {modalConvertOpen && (
        <ModalConverterCampanha
          ideia={form}
          onClose={() => setModalConvertOpen(false)}
          onConverted={async (payload) => {
            const res = await onConvertCampanha(payload);
            if (res.ok) {
              await carregar();
            }
            return res;
          }}
        />
      )}

      {modalLinkOpen && (
        <ModalVincularCampanha
          ideia={form}
          campanhas={campanhas}
          onClose={() => setModalLinkOpen(false)}
          onLinked={async (id, cid) => {
            const res = await onVincularCampanha(id, cid);
            if (res.ok) {
              await carregar();
            }
            return res;
          }}
        />
      )}
    </div>
  );
}

// ─── Componente Principal da Sub-aba: Lousa Principal ─────────────────────────

export default function IdeiasPlanejamento({ campanhas = [], onCampanhaCreated }) {
  const { user, canView, canEdit } = useAuth();
  const hasMarketingView = canView('marketing');
  const hasMarketingEdit = canEdit('marketing');
  const isReadOnly = !hasMarketingEdit;

  // Estados de dados
  const [ideias, setIdeias] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [structureMissing, setStructureMissing] = useState(false);

  // Lousa Layout
  const [whiteboardLayout, setWhiteboardLayout] = useState({ nodes: [], edges: [] });
  const [whiteboardVersion, setWhiteboardVersion] = useState(1);

  // Visualização Principal: Lousa por padrão! Alternativa: Lista
  const [viewMode, setViewMode] = useState('lousa'); // 'lousa' | 'lista'
  const [busca, setBusca] = useState('');
  const [filtroEtapa, setFiltroEtapa] = useState('todas');
  const [filtroFormato, setFiltroFormato] = useState('todos');
  const [filtroResponsavel, setFiltroResponsavel] = useState('todos');
  const [filtroAprovacao, setFiltroAprovacao] = useState('todos'); // 'todos' | 'aprovadas' | 'pendentes'
  const [mostrarArquivadas, setMostrarArquivadas] = useState(false);

  // Modais
  const [modalRapidoOpen, setModalRapidoOpen] = useState(false);
  const [fichaModalData, setFichaModalData] = useState(null); // { id } ou { initialData }

  // Carregar lista de ideias e layout da lousa
  const carregarTudo = useCallback(async () => {
    if (!hasMarketingView) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setErr('');

    const [resIdeas, resLayout, staff] = await Promise.all([
      fetchIdeas({ arquivadas: mostrarArquivadas }),
      fetchWhiteboardLayout('default'),
      fetchAuthorizedStaff(),
    ]);

    setLoading(false);

    if (resIdeas.error) {
      if (resIdeas.structureMissing) {
        setStructureMissing(true);
      } else {
        setErr(resIdeas.error.message || 'Erro ao carregar ideias.');
      }
      return;
    }

    setStructureMissing(false);
    setIdeias(resIdeas.data || []);
    setWhiteboardLayout(resLayout.data || { nodes: [], edges: [] });
    setWhiteboardVersion(resLayout.versao || 1);
    setStaffList(staff || []);
  }, [hasMarketingView, mostrarArquivadas]);

  useEffect(() => {
    carregarTudo();
  }, [carregarTudo]);

  // Filtragem (aplica tanto para a Lousa quanto para a Lista)
  const ideiasFiltradas = useMemo(() => {
    return ideias.filter(i => {
      if (filtroEtapa !== 'todas' && i.etapa !== filtroEtapa) return false;
      if (filtroFormato !== 'todos' && i.formato !== filtroFormato) return false;
      if (filtroAprovacao === 'aprovadas' && !i.aprovado) return false;
      if (filtroAprovacao === 'pendentes' && i.aprovado) return false;
      if (filtroResponsavel !== 'todos') {
        if (i.responsavel_id !== filtroResponsavel && i.responsavel_nome !== filtroResponsavel) return false;
      }
      if (busca.trim()) {
        const q = busca.toLowerCase();
        const t = (i.titulo || '').toLowerCase();
        const d = (i.descricao || '').toLowerCase();
        const tema = (i.servico_tema || '').toLowerCase();
        if (!t.includes(q) && !d.includes(q) && !tema.includes(q)) return false;
      }
      return true;
    });
  }, [ideias, filtroEtapa, filtroFormato, filtroAprovacao, filtroResponsavel, busca]);

  const temFiltroAtivo =
    busca.trim() !== '' ||
    filtroEtapa !== 'todas' ||
    filtroFormato !== 'todos' ||
    filtroAprovacao !== 'todos' ||
    filtroResponsavel !== 'todos';

  const limparFiltros = () => {
    setBusca('');
    setFiltroEtapa('todas');
    setFiltroFormato('todos');
    setFiltroAprovacao('todos');
    setFiltroResponsavel('todos');
  };

  // Ações
  const handleQuickSave = async (payload) => {
    const author = user ? { id: user.id, email: user.email, name: user.user_metadata?.full_name } : null;
    const res = await insertIdea(payload, author);
    if (!res.error) {
      await carregarTudo();
    }
    return res;
  };

  const handleArchive = async (id, arquivar = true) => {
    const author = user ? { id: user.id, email: user.email, name: user.user_metadata?.full_name } : null;
    const res = await archiveIdea(id, arquivar, author);
    if (res.ok) {
      await carregarTudo();
    } else {
      alert(`Erro ao arquivar: ${res.error?.message || res.error}`);
    }
  };

  const handleApproveIdea = async (id, aprovado, motivo = '') => {
    const author = user ? { id: user.id, email: user.email, name: user.user_metadata?.full_name } : null;
    const res = await approveIdea(id, aprovado, motivo, author);
    if (res.ok) {
      await carregarTudo();
    } else {
      alert(`Erro na aprovação: ${res.error?.message || res.error}`);
    }
    return res;
  };

  const handleDuplicate = async (id) => {
    const author = user ? { id: user.id, email: user.email, name: user.user_metadata?.full_name } : null;
    const res = await duplicateIdea(id, author);
    if (!res.error && res.data) {
      await carregarTudo();
      setFichaModalData({ id: res.data.id });
    } else {
      alert(`Erro ao duplicar ideia: ${res.error?.message || res.error}`);
    }
  };

  const handleConvert = async (payload) => {
    const author = user ? { id: user.id, email: user.email, name: user.user_metadata?.full_name } : null;
    const res = await convertIdeaToCampaign({ ...payload, author });
    if (res.ok) {
      if (onCampanhaCreated && res.data) {
        onCampanhaCreated({
          id: res.campanhaId,
          name: res.campanhaNome || payload.nome,
          type: payload.canal,
          status: 'rascunho',
          message: payload.mensagem,
          target: payload.publico,
          notes: JSON.stringify({ orcamento: payload.orcamento, data_inicio: payload.dataInicio }),
        });
      }
      await carregarTudo();
    }
    return res;
  };

  const handleLink = async (ideiaId, campanhaId) => {
    const author = user ? { id: user.id, email: user.email, name: user.user_metadata?.full_name } : null;
    const res = await linkIdeaCampaign(ideiaId, campanhaId, author);
    if (res.ok) {
      await carregarTudo();
    }
    return res;
  };

  const handleUnlink = async (ideiaId, currentCampaignId) => {
    const author = user ? { id: user.id, email: user.email, name: user.user_metadata?.full_name } : null;
    const res = await unlinkIdeaCampaign(ideiaId, currentCampaignId, author);
    if (res.ok) {
      await carregarTudo();
    }
    return res;
  };

  const handleSaveLayout = async (layout, versaoEsperada) => {
    const author = user ? { id: user.id, email: user.email, name: user.user_metadata?.full_name } : null;
    return await saveWhiteboardLayout({
      contexto: 'default',
      layout,
      versaoEsperada,
      author,
    });
  };

  const handleUsarModeloLive = () => {
    setFichaModalData({ initialData: MODELO_LIVE_EVELYN });
  };

  // Bloqueio por permissão
  if (!hasMarketingView) {
    return (
      <div className="card" style={{ padding: 32, textAlign: 'center', maxWidth: 540, margin: '40px auto' }}>
        <ShieldAlert style={{ width: 44, height: 44, color: '#DC2626', margin: '0 auto 12px' }} />
        <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 700 }}>Acesso Restrito</h3>
        <p style={{ fontSize: 13, color: 'var(--text-medium)', margin: 0 }}>
          Seu perfil não possui permissão para visualizar a lousa de ideias de marketing.
        </p>
      </div>
    );
  }

  // Aviso de Estrutura Não Configurada
  if (structureMissing) {
    return (
      <div className="card" style={{ padding: 32, borderLeft: '4px solid #F59E0B', maxWidth: 720, margin: '20px auto' }}>
        <div style={{ display: 'flex', gap: 14 }}>
          <AlertCircle style={{ width: 32, height: 32, color: '#F59E0B', flexShrink: 0 }} />
          <div>
            <h3 style={{ margin: '0 0 8px', fontSize: 17, fontWeight: 700 }}>
              Estrutura de Ideias e Lousa ainda não configurada
            </h3>
            <p style={{ fontSize: 13, color: 'var(--text-medium)', lineHeight: 1.6, marginBottom: 14 }}>
              As tabelas e funções do módulo de Ideias e Lousa Digital não foram encontradas no Supabase. Execute os arquivos incrementais no SQL Editor:
            </p>
            <div style={{ background: '#1E293B', color: '#F8FAFC', padding: '10px 14px', borderRadius: 8, fontFamily: 'monospace', fontSize: 12, marginBottom: 14 }}>
              1. marketing_ideas_migration_v2.sql<br />
              2. marketing_ideas_migration_v3.sql
            </div>
            <button className="btn btn-primary" onClick={carregarTudo}>
              <RefreshCw style={{ width: 14, height: 14 }} /> Verificar novamente
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Barra Superior Compacta: Alternador de Visualização (Lousa / Lista) e Filtros */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Alternador Lousa vs Lista */}
          <div style={{ display: 'flex', background: 'var(--bg-main)', borderRadius: 8, padding: 3, border: '1px solid var(--border-light)' }}>
            <button
              className={`btn btn-ghost${viewMode === 'lousa' ? ' active' : ''}`}
              style={{
                padding: '6px 14px',
                fontSize: 12,
                background: viewMode === 'lousa' ? '#fff' : 'transparent',
                fontWeight: viewMode === 'lousa' ? 700 : 500,
                color: viewMode === 'lousa' ? '#8B5CF6' : 'var(--text-medium)',
              }}
              onClick={() => setViewMode('lousa')}
            >
              <LayoutGrid style={{ width: 14, height: 14 }} /> Lousa Digital
            </button>
            <button
              className={`btn btn-ghost${viewMode === 'lista' ? ' active' : ''}`}
              style={{
                padding: '6px 14px',
                fontSize: 12,
                background: viewMode === 'lista' ? '#fff' : 'transparent',
                fontWeight: viewMode === 'lista' ? 700 : 500,
              }}
              onClick={() => setViewMode('lista')}
            >
              <List style={{ width: 14, height: 14 }} /> Lista
            </button>
          </div>

          <button
            className="btn btn-ghost"
            style={{ fontSize: 12 }}
            onClick={() => setMostrarArquivadas(!mostrarArquivadas)}
          >
            <Archive style={{ width: 14, height: 14 }} />
            {mostrarArquivadas ? 'Ver Ativas' : 'Ver Arquivadas'}
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button className="btn btn-ghost" onClick={carregarTudo} title="Atualizar dados">
            <RefreshCw style={{ width: 14, height: 14 }} /> Atualizar
          </button>

          {!isReadOnly && (
            <button
              className="btn btn-primary"
              onClick={() => setModalRapidoOpen(true)}
              style={{ background: '#8B5CF6', borderColor: '#8B5CF6' }}
            >
              <Plus style={{ width: 14, height: 14 }} /> Nova Ideia
            </button>
          )}
        </div>
      </div>

      {/* Barra de Busca e Filtros Compacta */}
      <div className="card" style={{ padding: '8px 14px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: '1 1 180px', minWidth: 160 }}>
          <Search style={{ width: 15, height: 15, color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="form-input"
            placeholder="Buscar na lousa (título, tema)..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
            style={{ border: 'none', background: 'transparent', padding: '4px 0', fontSize: 12 }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <select
            className="form-input"
            style={{ width: 130, fontSize: 12, padding: '4px 8px' }}
            value={filtroAprovacao}
            onChange={e => setFiltroAprovacao(e.target.value)}
          >
            <option value="todos">Toda aprovação</option>
            <option value="aprovadas">Aprovadas</option>
            <option value="pendentes">Pendentes</option>
          </select>

          <select
            className="form-input"
            style={{ width: 140, fontSize: 12, padding: '4px 8px' }}
            value={filtroEtapa}
            onChange={e => setFiltroEtapa(e.target.value)}
          >
            <option value="todas">Todas as etapas</option>
            {ETAPAS.map(e => (
              <option key={e.value} value={e.value}>{e.label}</option>
            ))}
          </select>

          <select
            className="form-input"
            style={{ width: 130, fontSize: 12, padding: '4px 8px' }}
            value={filtroFormato}
            onChange={e => setFiltroFormato(e.target.value)}
          >
            <option value="todos">Todos formatos</option>
            {FORMATOS.map(f => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>

          <select
            className="form-input"
            style={{ width: 140, fontSize: 12, padding: '4px 8px' }}
            value={filtroResponsavel}
            onChange={e => setFiltroResponsavel(e.target.value)}
          >
            <option value="todos">Todos responsáveis</option>
            {staffList.map(s => (
              <option key={s.id} value={s.id}>{s.nome}</option>
            ))}
          </select>

          {temFiltroAtivo && (
            <button className="btn btn-ghost" style={{ fontSize: 11, padding: '4px 8px', color: 'var(--color-primary)' }} onClick={limparFiltros}>
              Limpar
            </button>
          )}
        </div>
      </div>

      {/* Estados de Carregamento e Erro */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
          <RefreshCw className="spin" style={{ width: 28, height: 28, margin: '0 auto 12px', color: '#8B5CF6' }} />
          Carregando lousa de ideias...
        </div>
      ) : err ? (
        <div className="card" style={{ padding: 24, textAlign: 'center', borderLeft: '4px solid #DC2626' }}>
          <AlertCircle style={{ width: 28, height: 28, color: '#DC2626', margin: '0 auto 8px' }} />
          <h4 style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 700 }}>Erro ao carregar dados</h4>
          <p style={{ fontSize: 13, color: 'var(--text-medium)', marginBottom: 14 }}>{err}</p>
          <button className="btn btn-ghost" onClick={carregarTudo}>Tentar novamente</button>
        </div>
      ) : viewMode === 'lousa' ? (
        /* ─── APRESENTAÇÃO PRINCIPAL: LOUSA DIGITAL ─── */
        <MarketingWhiteboard
          ideias={ideiasFiltradas}
          isReadOnly={isReadOnly}
          onOpenFicha={(id) => setFichaModalData({ id })}
          onNewIdeaQuick={() => setModalRapidoOpen(true)}
          onUsarModeloLive={handleUsarModeloLive}
          onArchiveIdea={handleArchive}
          onApproveIdea={handleApproveIdea}
          layoutData={whiteboardLayout}
          layoutVersion={whiteboardVersion}
          onSaveLayout={handleSaveLayout}
        />
      ) : (
        /* ─── APRESENTAÇÃO SECUNDÁRIA: LISTA (Útil para teclado e celular) ─── */
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {ideiasFiltradas.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
              Nenhuma ideia encontrada para os filtros aplicados.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#FAFAF9', borderBottom: '1px solid var(--border-light)', textAlign: 'left' }}>
                    <th style={{ padding: '12px 16px' }}>Título & Tema</th>
                    <th style={{ padding: '12px 16px' }}>Aprovação</th>
                    <th style={{ padding: '12px 16px' }}>Etapa</th>
                    <th style={{ padding: '12px 16px' }}>Responsável</th>
                    <th style={{ padding: '12px 16px' }}>Data Prevista</th>
                    <th style={{ padding: '12px 16px' }}>Campanha</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right' }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {ideiasFiltradas.map(ideia => {
                    const etCfg = getEtapaCfg(ideia.etapa);
                    return (
                      <tr
                        key={ideia.id}
                        style={{ borderBottom: '1px solid var(--border-light)', cursor: 'pointer' }}
                        onClick={() => setFichaModalData({ id: ideia.id })}
                      >
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ fontWeight: 600, color: 'var(--text-dark)' }}>{ideia.titulo}</div>
                          {ideia.servico_tema && (
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{ideia.servico_tema}</div>
                          )}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span
                            style={{
                              fontSize: 11,
                              padding: '3px 8px',
                              borderRadius: 6,
                              fontWeight: 700,
                              color: ideia.aprovado ? '#065F46' : '#92400E',
                              background: ideia.aprovado ? '#D1FAE5' : '#FEF3C7',
                              border: `1px solid ${ideia.aprovado ? '#A7F3D0' : '#FDE68A'}`,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                            }}
                          >
                            {ideia.aprovado ? (
                              <><CheckCircle style={{ width: 11, height: 11, color: '#059669' }} /> Aprovada</>
                            ) : (
                              <><Clock style={{ width: 11, height: 11, color: '#D97706' }} /> Pendente</>
                            )}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span
                            style={{
                              fontSize: 11,
                              padding: '3px 8px',
                              borderRadius: 12,
                              fontWeight: 700,
                              color: etCfg.color,
                              background: etCfg.bg,
                              border: `1px solid ${etCfg.border}`,
                            }}
                          >
                            {etCfg.label}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', color: 'var(--text-medium)' }}>
                          {ideia.responsavel_nome || '—'}
                        </td>
                        <td style={{ padding: '12px 16px', color: 'var(--text-medium)' }}>
                          {ideia.data_prevista ? formatDateBR(ideia.data_prevista) : '—'}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          {ideia.campanha_id ? (
                            <span style={{ fontSize: 11, padding: '2px 6px', borderRadius: 4, background: '#EDE9FE', color: '#7C3AED', fontWeight: 600 }}>
                              <LinkIcon style={{ width: 10, height: 10, display: 'inline', marginRight: 3 }} /> #{ideia.campanha_id}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>Sem vínculo</span>
                          )}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                          <button
                            className="btn btn-ghost"
                            style={{ padding: '4px 8px', fontSize: 12 }}
                            onClick={e => {
                              e.stopPropagation();
                              setFichaModalData({ id: ideia.id });
                            }}
                          >
                            <Edit3 style={{ width: 13, height: 13 }} /> Abrir
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal de Captura Rápida */}
      {modalRapidoOpen && (
        <ModalCapturaRapida
          onClose={() => setModalRapidoOpen(false)}
          onSave={handleQuickSave}
          onOpenFull={(initial) => {
            setFichaModalData({ initialData: initial });
          }}
        />
      )}

      {/* Modal da Ficha Completa */}
      {fichaModalData && (
        <FichaIdeiaModal
          ideiaId={fichaModalData.id}
          initialData={fichaModalData.initialData}
          isReadOnly={isReadOnly}
          staffList={staffList}
          campanhas={campanhas}
          onClose={() => setFichaModalData(null)}
          onUpdated={() => carregarTudo()}
          onArchived={async (id, arq) => {
            await handleArchive(id, arq);
            setFichaModalData(null);
          }}
          onDuplicated={async (id) => {
            await handleDuplicate(id);
          }}
          onApproveToggle={async (id, aprovado, motivo) => {
            return await handleApproveIdea(id, aprovado, motivo);
          }}
          onConvertCampanha={handleConvert}
          onVincularCampanha={handleLink}
          onDesvincularCampanha={handleUnlink}
        />
      )}
    </div>
  );
}
