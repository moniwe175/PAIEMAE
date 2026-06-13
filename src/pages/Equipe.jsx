import { useState } from 'react';
import {
  Zap, Plus, XCircle, Phone, Mail, Award, Calendar,
  Edit3, Trash2, CheckCircle, Scissors, X, ChevronDown
} from 'lucide-react';
import { useProfissionais, CORES_AVATAR } from '../lib/profissionais';
import { useServicos } from '../lib/servicos';

// ─── Edit / Create Modal ────────────────────────────────────
function ProfissionalModal({ onClose, onSave, profissional }) {
  const isEdit = !!profissional;
  const [form, setForm] = useState({
    nome: profissional?.nome || '',
    cargo: profissional?.cargo || '',
    telefone: profissional?.telefone || '',
    email: profissional?.email || '',
    comissao: profissional?.comissao || 0,
    cor: profissional?.cor || CORES_AVATAR[0],
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = () => {
    if (!form.nome.trim()) return;
    onSave(form);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
        <div className="modal-header">
          <span className="modal-title">{isEdit ? 'Editar Profissional' : 'Novo Profissional'}</span>
          <button className="modal-close" onClick={onClose}><XCircle /></button>
        </div>

        <div className="form-group">
          <label className="form-label">Nome</label>
          <input className="form-input" placeholder="Nome do profissional" value={form.nome} onChange={e => set('nome', e.target.value)} />
        </div>

        <div className="form-grid-2">
          <div className="form-group">
            <label className="form-label">Cargo</label>
            <input className="form-input" placeholder="Ex: Esteticista, Biomédica" value={form.cargo} onChange={e => set('cargo', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Comissão (%)</label>
            <input className="form-input" type="number" min="0" max="100" value={form.comissao} onChange={e => set('comissao', Number(e.target.value))} />
          </div>
        </div>

        <div className="form-grid-2">
          <div className="form-group">
            <label className="form-label">Telefone</label>
            <input className="form-input" placeholder="(11) 99999-9999" value={form.telefone} onChange={e => set('telefone', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">E-mail</label>
            <input className="form-input" type="email" placeholder="email@exemplo.com" value={form.email} onChange={e => set('email', e.target.value)} />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Cor do Avatar</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {CORES_AVATAR.map(c => (
              <button
                key={c}
                onClick={() => set('cor', c)}
                style={{
                  width: 32, height: 32, borderRadius: '50%', border: 'none', cursor: 'pointer',
                  background: c,
                  outline: form.cor === c ? '3px solid #1F2937' : '2px solid transparent',
                  outlineOffset: 2,
                  transition: 'outline 0.15s',
                }}
              />
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
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
          <span className="modal-title" style={{ color: '#DC2626' }}>Excluir Profissional</span>
          <button className="modal-close" onClick={onClose}><XCircle /></button>
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-medium)', lineHeight: 1.6, margin: '8px 0 16px' }}>
          Tem certeza que deseja excluir <strong>{nome}</strong>? Esta ação não pode ser desfeita. Todos os serviços vinculados serão removidos.
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

// ─── Service Manager (inline) ───────────────────────────────
function ServiceManager({ profissional, onAdd, onRemove, catalogoServicos }) {
  const [showPicker, setShowPicker] = useState(false);
  const availableServices = catalogoServicos.filter(s => !profissional.servicos.includes(s));

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.5, color: '#9CA3AF', textTransform: 'uppercase' }}>Serviços</span>
        {availableServices.length > 0 && (
          <button
            onClick={() => setShowPicker(!showPicker)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 11, fontWeight: 600, color: '#C73B6D',
              display: 'flex', alignItems: 'center', gap: 3,
            }}
          >
            <Plus style={{ width: 12, height: 12 }} />Adicionar
          </button>
        )}
      </div>

      {/* Current services */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
        {profissional.servicos.map(s => (
          <span key={s} style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            background: '#F3F4F6', color: '#374151',
            padding: '3px 8px', borderRadius: 99, fontSize: 11, fontWeight: 500,
          }}>
            {s}
            <button
              onClick={() => onRemove(profissional.id, s)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}
              title="Remover serviço"
            >
              <X style={{ width: 11, height: 11, color: '#9CA3AF' }} />
            </button>
          </span>
        ))}
        {profissional.servicos.length === 0 && (
          <span style={{ fontSize: 11, color: '#D1D5DB', fontStyle: 'italic' }}>Nenhum serviço vinculado</span>
        )}
      </div>

      {/* Service picker dropdown */}
      {showPicker && availableServices.length > 0 && (
        <div style={{
          marginTop: 8, background: '#fff', border: '1px solid #E5E7EB',
          borderRadius: 10, padding: 8, maxHeight: 200, overflowY: 'auto',
          boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
        }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', marginBottom: 6, textTransform: 'uppercase' }}>
            Serviços disponíveis
          </div>
          {availableServices.map(s => (
            <button
              key={s}
              onClick={() => { onAdd(profissional.id, s); setShowPicker(false); }}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                background: 'none', border: 'none', cursor: 'pointer',
                padding: '6px 8px', borderRadius: 6, fontSize: 12, color: '#374151',
                transition: 'background 0.1s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#FDF2F8'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <Plus style={{ width: 11, height: 11, display: 'inline', marginRight: 6, color: '#C73B6D' }} />
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────
export default function Equipe() {
  const {
    profissionais,
    addProfissional,
    updateProfissional,
    removeProfissional,
    addServicoToProfissional,
    removeServicoFromProfissional,
  } = useProfissionais();
  const { servicos } = useServicos();
  const catalogoNomes = servicos.filter(s => s.ativo).map(s => s.nome);

  const [editModal, setEditModal] = useState(null); // null | 'new' | profissional object
  const [deleteId, setDeleteId] = useState(null);

  return (
    <div>
      {/* Modals */}
      {editModal && (
        <ProfissionalModal
          profissional={editModal === 'new' ? null : editModal}
          onClose={() => setEditModal(null)}
          onSave={(form) => {
            if (editModal === 'new') {
              addProfissional(form);
            } else {
              updateProfissional(editModal.id, form);
            }
          }}
        />
      )}
      {deleteId && (
        <DeleteConfirmModal
          nome={profissionais.find(p => p.id === deleteId)?.nome || ''}
          onClose={() => setDeleteId(null)}
          onConfirm={() => removeProfissional(deleteId)}
        />
      )}

      {/* Header */}
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div className="page-header-label"><Zap />EQUIPE</div>
          <h1 className="page-title">Equipe</h1>
          <p className="page-subtitle">{profissionais.length} profissionais cadastrados</p>
        </div>
        <button className="btn btn-primary" onClick={() => setEditModal('new')}>
          <Plus />Novo Profissional
        </button>
      </div>

      {/* Cards grid */}
      <div className="grid-3 section-gap">
        {profissionais.map(prof => (
          <div key={prof.id} className="card">
            {/* Avatar + Name */}
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <div style={{
                width: 56, height: 56, borderRadius: '50%', margin: '0 auto 10px',
                background: `linear-gradient(135deg, ${prof.cor}, ${prof.cor}66)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 20, fontWeight: 700, color: '#fff',
              }}>
                {prof.nome.charAt(0).toUpperCase()}
              </div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{prof.nome}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{prof.cargo}</div>
              <span className="badge badge-success" style={{ marginTop: 6 }}>Ativo</span>
            </div>

            <div className="divider" />

            {/* Services */}
            <ServiceManager
              profissional={prof}
              onAdd={addServicoToProfissional}
              onRemove={removeServicoFromProfissional}
              catalogoServicos={catalogoNomes}
            />

            <div className="divider" style={{ marginTop: 12 }} />

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14, textAlign: 'center' }}>
              <div style={{ background: 'var(--bg-main)', borderRadius: 8, padding: '8px 4px' }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--info)' }}>{prof.comissao}%</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Comissão</div>
              </div>
              <div style={{ background: 'var(--bg-main)', borderRadius: 8, padding: '8px 4px' }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-primary)' }}>{prof.servicos.length}</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Serviços</div>
              </div>
            </div>

            {/* Contact info */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7, fontSize: 12 }}>
              {prof.telefone && (
                <div style={{ display: 'flex', gap: 7, alignItems: 'center', color: 'var(--text-light)' }}>
                  <Phone style={{ width: 12, height: 12 }} />{prof.telefone}
                </div>
              )}
              {prof.email && (
                <div style={{ display: 'flex', gap: 7, alignItems: 'center', color: 'var(--text-light)' }}>
                  <Mail style={{ width: 12, height: 12 }} />{prof.email}
                </div>
              )}
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 6, marginTop: 14 }}>
              <button className="btn btn-ghost btn-sm" style={{ flex: 1 }} onClick={() => setEditModal(prof)}>
                <Edit3 style={{ width: 12, height: 12 }} />Editar
              </button>
              <button className="btn btn-ghost btn-sm" style={{ flex: 0, color: '#DC2626', padding: '4px 10px' }} onClick={() => setDeleteId(prof.id)}>
                <Trash2 style={{ width: 14, height: 14 }} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {profissionais.length === 0 && (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
          <Scissors style={{ width: 40, height: 40, marginBottom: 12, opacity: 0.3 }} />
          <p style={{ fontSize: 14 }}>Nenhum profissional cadastrado</p>
          <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => setEditModal('new')}>
            <Plus />Cadastrar primeiro profissional
          </button>
        </div>
      )}
    </div>
  );
}
