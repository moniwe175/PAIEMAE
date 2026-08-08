import { useState, useEffect } from 'react';
import {
  Scissors, Plus, Search, XCircle, Clock, DollarSign,
  Edit3, Trash2, CheckCircle, Users, X, UserPlus, UserMinus, FileText, AlertTriangle
} from 'lucide-react';
import { useServicos, CATEGORIAS, CAT_COLORS, TIPOS_FICHA_OPCOES } from '../lib/servicos';
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
    fichasObrigatorias: servico?.fichasObrigatorias || (servico?.fichaObrigatoria ? [servico.fichaObrigatoria] : []),
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
            <label className="form-label">Fichas de Anamnese Obrigatórias</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
              {TIPOS_FICHA_OPCOES.map(f => {
                const isSelected = (form.fichasObrigatorias || []).includes(f);
                return (
                  <button
                    key={f}
                    type="button"
                    onClick={() => {
                      setForm(prev => {
                        const current = prev.fichasObrigatorias || [];
                        const next = current.includes(f) ? current.filter(x => x !== f) : [...current, f];
                        return { ...prev, fichasObrigatorias: next };
                      });
                    }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                      border: `1.5px solid ${isSelected ? '#E11D48' : '#E5E7EB'}`,
                      background: isSelected ? '#FFF1F2' : '#fff',
                      color: isSelected ? '#E11D48' : '#6B7280',
                      transition: 'all 0.15s',
                    }}
                  >
                    <FileText style={{ width: 12, height: 12 }} />
                    {f}
                    {isSelected && <CheckCircle style={{ width: 12, height: 12 }} />}
                  </button>
                );
              })}
            </div>
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
            maxHeight: 150, overflowY: 'auto', zIndex: 5, position: 'relative',
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

// ─── Anamnesis Ficha Linking Panel ─────────────────────────
function FichaPanel({ servico, onSaveFichas }) {
  const currentFichas = servico.fichasObrigatorias || (servico.fichaObrigatoria ? [servico.fichaObrigatoria] : []);
  const [draft, setDraft] = useState(currentFichas);

  // Sync draft when servico.fichasObrigatorias changes
  useEffect(() => {
    setDraft(servico.fichasObrigatorias || (servico.fichaObrigatoria ? [servico.fichaObrigatoria] : []));
  }, [servico.fichasObrigatorias, servico.fichaObrigatoria]);

  const handleToggle = (tipo) => {
    setDraft(prev => {
      if (prev.includes(tipo)) return prev.filter(t => t !== tipo);
      return [...prev, tipo];
    });
  };

  const handleRemoveSingle = (tipo) => {
    const updated = currentFichas.filter(t => t !== tipo);
    setDraft(updated);
    onSaveFichas(servico.id, updated);
  };

  const handleConfirm = (e) => {
    onSaveFichas(servico.id, draft);
    const det = e.currentTarget.closest('details');
    if (det) det.removeAttribute('open');
  };

  return (
    <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px dashed #F0EBE6' }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.5, color: '#9CA3AF', textTransform: 'uppercase', marginBottom: 6 }}>
        Fichas de Anamnese Obrigatórias
      </div>

      {currentFichas.length > 0 ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8 }}>
          {currentFichas.map(f => (
            <span key={f} style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              background: '#FFF1F2', color: '#E11D48', border: '1px solid #FECDD3',
              padding: '3px 8px', borderRadius: 99, fontSize: 11, fontWeight: 600,
            }}>
              <FileText style={{ width: 11, height: 11 }} />
              {f}
              <button
                onClick={() => handleRemoveSingle(f)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', marginLeft: 2 }}
                title={`Remover obrigatoriedade de ${f}`}
              >
                <X style={{ width: 11, height: 11, color: '#E11D48' }} />
              </button>
            </span>
          ))}
        </div>
      ) : (
        <span style={{ fontSize: 11, color: '#D1D5DB', fontStyle: 'italic', display: 'block', marginBottom: 4 }}>
          Nenhuma ficha vinculada
        </span>
      )}

      {/* Link dropdown */}
      <details style={{ position: 'relative' }}>
        <summary style={{
          fontSize: 11, fontWeight: 600, color: '#C73B6D', cursor: 'pointer',
          listStyle: 'none', display: 'flex', alignItems: 'center', gap: 4,
        }}>
          <FileText style={{ width: 12, height: 12 }} />+ Vincular ficha de anamnese
        </summary>
        <div style={{
          marginTop: 6, background: '#fff', border: '1px solid #E5E7EB',
          borderRadius: 10, padding: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          maxHeight: 260, overflowY: 'auto', zIndex: 20, position: 'relative',
        }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', marginBottom: 6, paddingLeft: 4 }}>
            Selecione as fichas desejadas:
          </div>

          {TIPOS_FICHA_OPCOES.map(tipo => {
            const isSelected = draft.includes(tipo);
            return (
              <div
                key={tipo}
                onClick={() => handleToggle(tipo)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  width: '100%', textAlign: 'left', background: isSelected ? '#FDF2F8' : 'transparent',
                  border: 'none', cursor: 'pointer', padding: '7px 10px',
                  borderRadius: 8, fontSize: 12, color: isSelected ? '#C73B6D' : '#374151',
                  fontWeight: isSelected ? 700 : 500, marginBottom: 2,
                  transition: 'background 0.1s', userSelect: 'none',
                }}
                onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = '#F9FAFB'; }}
                onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <FileText style={{ width: 13, height: 13, color: isSelected ? '#C73B6D' : '#9CA3AF' }} />
                  {tipo}
                </span>
                {isSelected && <CheckCircle style={{ width: 14, height: 14, color: '#C73B6D' }} />}
              </div>
            );
          })}

          <div style={{ borderTop: '1px solid #F3F4F6', marginTop: 8, paddingTop: 8 }}>
            <button
              type="button"
              onClick={handleConfirm}
              style={{
                width: '100%', padding: '7px 12px', borderRadius: 8, border: 'none',
                background: 'linear-gradient(135deg,#C73B6D,#A83158)',
                color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                boxShadow: '0 2px 6px rgba(199,59,109,0.25)',
              }}
            >
              <CheckCircle style={{ width: 13, height: 13 }} /> Salvar Fichas
            </button>
          </div>
        </div>
      </details>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────
export default function Services() {
  const { servicos, addServico, updateServico, removeServico, toggleAtivo, setFichasObrigatorias } = useServicos();
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
        {filtrados.map(s => {
          const fichas = s.fichasObrigatorias || (s.fichaObrigatoria ? [s.fichaObrigatoria] : []);
          return (
            <div key={s.id} className="card" style={{ opacity: s.ativo ? 1 : 0.6 }}>
              {/* Top badges */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', marginBottom: 12 }}>
                <span className={`badge ${CAT_COLORS[s.categoria] || 'badge-neutral'}`}>{s.categoria}</span>
                {fichas.map(f => (
                  <span key={f} className="badge badge-danger" style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }} title={`Requer ${f}`}>
                    <FileText style={{ width: 10, height: 10 }} />
                    {f}
                  </span>
                ))}
                <span
                  className={`badge ${s.ativo ? 'badge-success' : 'badge-neutral'}`}
                  style={{ cursor: 'pointer', marginLeft: 'auto' }}
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

              {/* Anamnesis Ficha linking */}
              <FichaPanel
                servico={s}
                onSaveFichas={setFichasObrigatorias}
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
          );
        })}
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

