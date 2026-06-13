import { useState } from 'react';
import {
  Scissors, Plus, Search, XCircle, Clock, DollarSign,
  Edit3, Trash2, CheckCircle, Users, X, UserPlus, UserMinus
} from 'lucide-react';
import { useServicos, CATEGORIAS, CAT_COLORS } from '../lib/servicos';
import { useProfissionais } from '../lib/profissionais';

// ─── Edit / Create Modal ────────────────────────────────────
function ServicoModal({ onClose, onSave, servico }) {
  const isEdit = !!servico;
  const [form, setForm] = useState({
    nome: servico?.nome || '',
    categoria: servico?.categoria || '',
    duracao: servico?.duracao || '',
    preco: servico?.preco || '',
    comissao: servico?.comissao || '',
    descricao: servico?.descricao || '',
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = () => {
    if (!form.nome.trim()) return;
    onSave(form);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 500 }}>
        <div className="modal-header">
          <span className="modal-title">{isEdit ? 'Editar Serviço' : 'Novo Serviço'}</span>
          <button className="modal-close" onClick={onClose}><XCircle /></button>
        </div>
        <div className="form-grid-2">
          <div className="form-group" style={{ gridColumn: 'span 2' }}>
            <label className="form-label">Nome do Serviço</label>
            <input className="form-input" placeholder="Ex: Botox Facial" value={form.nome} onChange={e => set('nome', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Categoria</label>
            <select className="form-select" value={form.categoria} onChange={e => set('categoria', e.target.value)}>
              <option value="">Selecione...</option>
              {CATEGORIAS.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Duração (min)</label>
            <input className="form-input" type="number" placeholder="60" value={form.duracao} onChange={e => set('duracao', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Preço (R$)</label>
            <input className="form-input" type="number" placeholder="0" value={form.preco} onChange={e => set('preco', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Comissão (%)</label>
            <input className="form-input" type="number" placeholder="30" value={form.comissao} onChange={e => set('comissao', e.target.value)} />
          </div>
          <div className="form-group" style={{ gridColumn: 'span 2' }}>
            <label className="form-label">Descrição</label>
            <textarea className="form-textarea" placeholder="Descrição do serviço..." value={form.descricao} onChange={e => set('descricao', e.target.value)} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSubmit}><CheckCircle />{isEdit ? 'Salvar' : 'Criar'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Delete Confirm Modal ───────────────────────────────────
function DeleteConfirmModal({ onClose, onConfirm, nome }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 380 }}>
        <div className="modal-header">
          <span className="modal-title" style={{ color: '#DC2626' }}>Excluir Serviço</span>
          <button className="modal-close" onClick={onClose}><XCircle /></button>
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-medium)', lineHeight: 1.6, margin: '8px 0 16px' }}>
          Tem certeza que deseja excluir <strong>{nome}</strong>? Este serviço será removido de todos os profissionais vinculados.
        </p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn" style={{ background: '#DC2626', color: '#fff' }} onClick={() => { onConfirm(); onClose(); }}>
            <Trash2 style={{ width: 14, height: 14 }} />Excluir
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Professional Linking Panel ─────────────────────────────
function ProfissionaisPanel({ servicoNome, profissionais, onLink, onUnlink }) {
  const linked = profissionais.filter(p => p.servicos.includes(servicoNome));
  const unlinked = profissionais.filter(p => !p.servicos.includes(servicoNome));

  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.5, color: '#9CA3AF', textTransform: 'uppercase', marginBottom: 6 }}>
        Profissionais vinculados
      </div>

      {/* Linked professionals */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: linked.length > 0 ? 8 : 0 }}>
        {linked.map(p => (
          <span key={p.id} style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            background: '#F3E8FF', color: '#7C3AED',
            padding: '3px 8px', borderRadius: 99, fontSize: 11, fontWeight: 500,
          }}>
            {p.nome}
            <button
              onClick={() => onUnlink(p.id, servicoNome)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}
              title="Desvincular profissional"
            >
              <X style={{ width: 11, height: 11, color: '#9CA3AF' }} />
            </button>
          </span>
        ))}
        {linked.length === 0 && (
          <span style={{ fontSize: 11, color: '#D1D5DB', fontStyle: 'italic' }}>Nenhum profissional vinculado</span>
        )}
      </div>

      {/* Link button dropdown */}
      {unlinked.length > 0 && (
        <details style={{ position: 'relative' }}>
          <summary style={{
            fontSize: 11, fontWeight: 600, color: '#C73B6D', cursor: 'pointer',
            listStyle: 'none', display: 'flex', alignItems: 'center', gap: 4,
          }}>
            <UserPlus style={{ width: 12, height: 12 }} />Vincular profissional
          </summary>
          <div style={{
            marginTop: 6, background: '#fff', border: '1px solid #E5E7EB',
            borderRadius: 8, padding: 6, boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
            maxHeight: 150, overflowY: 'auto',
          }}>
            {unlinked.map(p => (
              <button
                key={p.id}
                onClick={() => onLink(p.id, servicoNome)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  width: '100%', textAlign: 'left', background: 'none',
                  border: 'none', cursor: 'pointer', padding: '6px 8px',
                  borderRadius: 6, fontSize: 12, color: '#374151',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#FDF2F8'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <div style={{
                  width: 24, height: 24, borderRadius: '50%', background: p.cor,
                  color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700, flexShrink: 0,
                }}>
                  {p.nome.charAt(0)}
                </div>
                <div>
                  <div style={{ fontWeight: 600 }}>{p.nome}</div>
                  <div style={{ fontSize: 10, color: '#9CA3AF' }}>{p.cargo}</div>
                </div>
              </button>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────
export default function Services() {
  const { servicos, addServico, updateServico, removeServico, toggleAtivo } = useServicos();
  const { profissionais, addServicoToProfissional, removeServicoFromProfissional } = useProfissionais();

  const [editModal, setEditModal] = useState(null); // null | 'new' | servico object
  const [deleteId, setDeleteId] = useState(null);
  const [busca, setBusca] = useState('');
  const [catFiltro, setCatFiltro] = useState('Todos');

  // Get unique categories from data
  const catsAtivas = [...new Set(servicos.map(s => s.categoria).filter(Boolean))];

  const filtrados = servicos.filter(s =>
    (catFiltro === 'Todos' || s.categoria === catFiltro) &&
    s.nome.toLowerCase().includes(busca.toLowerCase())
  );

  const ativos = servicos.filter(s => s.ativo);
  const ticketMedio = ativos.length > 0 ? Math.round(ativos.reduce((a, s) => a + s.preco, 0) / ativos.length) : 0;

  const handleLink = (profId, servicoNome) => {
    addServicoToProfissional(profId, servicoNome);
  };
  const handleUnlink = (profId, servicoNome) => {
    removeServicoFromProfissional(profId, servicoNome);
  };
  const handleDelete = (id) => {
    const svc = servicos.find(s => s.id === id);
    if (svc) {
      // Unlink from all professionals first
      profissionais.forEach(p => {
        if (p.servicos.includes(svc.nome)) {
          removeServicoFromProfissional(p.id, svc.nome);
        }
      });
    }
    removeServico(id);
  };

  return (
    <div>
      {/* Modals */}
      {editModal && (
        <ServicoModal
          servico={editModal === 'new' ? null : editModal}
          onClose={() => setEditModal(null)}
          onSave={(form) => {
            if (editModal === 'new') {
              addServico(form);
            } else {
              updateServico(editModal.id, form);
            }
          }}
        />
      )}
      {deleteId && (
        <DeleteConfirmModal
          nome={servicos.find(s => s.id === deleteId)?.nome || ''}
          onClose={() => setDeleteId(null)}
          onConfirm={() => handleDelete(deleteId)}
        />
      )}

      {/* Header */}
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div className="page-header-label"><Scissors />SERVIÇOS</div>
          <h1 className="page-title">Serviços</h1>
          <p className="page-subtitle">{servicos.length} serviços cadastrados</p>
        </div>
        <button className="btn btn-primary" onClick={() => setEditModal('new')}><Plus />Novo Serviço</button>
      </div>

      {/* Stats */}
      <div className="grid-4 section-gap">
        {[
          { label: 'Total', val: servicos.length, cor: 'var(--color-primary)' },
          { label: 'Ativos', val: ativos.length, cor: 'var(--success)' },
          { label: 'Inativos', val: servicos.filter(s => !s.ativo).length, cor: 'var(--warning)' },
          { label: 'Ticket Médio', val: `R$ ${ticketMedio.toLocaleString('pt-BR')}`, cor: 'var(--info)' },
        ].map(({ label, val, cor }) => (
          <div key={label} className="stat-card" style={{ textAlign: 'center' }}>
            <div className="stat-value" style={{ color: cor }}>{val}</div>
            <div className="stat-label">{label}</div>
          </div>
        ))}
      </div>

      {/* Filter tabs + search */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div className="tabs">
          {['Todos', ...catsAtivas].map(c => (
            <button key={c} className={`tab-item${catFiltro === c ? ' active' : ''}`} onClick={() => setCatFiltro(c)}>{c}</button>
          ))}
        </div>
        <div className="search-box">
          <Search />
          <input className="search-input" placeholder="Buscar serviço..." value={busca} onChange={e => setBusca(e.target.value)} />
        </div>
      </div>

      {/* Service cards */}
      <div className="grid-3">
        {filtrados.map(s => (
          <div key={s.id} className="card" style={{ opacity: s.ativo ? 1 : 0.6 }}>
            {/* Top badges */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
              <span className={`badge ${CAT_COLORS[s.categoria] || 'badge-neutral'}`}>{s.categoria}</span>
              <span
                className={`badge ${s.ativo ? 'badge-success' : 'badge-neutral'}`}
                style={{ cursor: 'pointer' }}
                onClick={() => toggleAtivo(s.id)}
                title={s.ativo ? 'Clique para desativar' : 'Clique para ativar'}
              >
                {s.ativo ? 'Ativo' : 'Inativo'}
              </span>
            </div>

            {/* Service name */}
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10, color: 'var(--text-dark)' }}>{s.nome}</div>

            <div className="divider" />

            {/* Info */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--text-muted)' }}><Clock style={{ width: 13, height: 13 }} />Duração</span>
                <span style={{ fontWeight: 600 }}>{s.duracao} min</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--text-muted)' }}><DollarSign style={{ width: 13, height: 13 }} />Preço</span>
                <span style={{ fontWeight: 700, color: 'var(--success)' }}>R$ {s.preco.toLocaleString('pt-BR')}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: 'var(--text-muted)' }}>Comissão</span>
                <span style={{ fontWeight: 600 }}>{s.comissao}%</span>
              </div>
            </div>

            {/* Professional linking */}
            <ProfissionaisPanel
              servicoNome={s.nome}
              profissionais={profissionais}
              onLink={handleLink}
              onUnlink={handleUnlink}
            />

            {/* Actions */}
            <div style={{ display: 'flex', gap: 6, marginTop: 14 }}>
              <button className="btn btn-ghost btn-sm" style={{ flex: 1 }} onClick={() => setEditModal(s)}>
                <Edit3 style={{ width: 12, height: 12 }} />Editar
              </button>
              <button className="btn btn-ghost btn-sm" style={{ flex: 0, color: '#DC2626', padding: '4px 10px' }} onClick={() => setDeleteId(s.id)}>
                <Trash2 style={{ width: 14, height: 14 }} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {filtrados.length === 0 && (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
          <Scissors style={{ width: 40, height: 40, marginBottom: 12, opacity: 0.3 }} />
          <p style={{ fontSize: 14 }}>Nenhum serviço encontrado</p>
        </div>
      )}
    </div>
  );
}
