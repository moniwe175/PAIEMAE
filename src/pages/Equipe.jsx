import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  Zap, Plus, XCircle, Phone, Mail, Award, Calendar,
  Edit3, Trash2, CheckCircle, Scissors, X, ChevronDown, UserCheck, Clock
} from 'lucide-react';
import { useProfissionais, CORES_AVATAR } from '../lib/profissionais';
import { useServicos } from '../lib/servicos';
import { fetchAccessRequests, updateAccessRequestStatus } from '../services/supabaseService';

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
    fotoBase64: profissional?.id ? profissional.fotoBase64 : null,
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
            <input className="form-input" type="number" min="0" max="100" value={form.comissao} onChange={e => {
              const value = Number(e.target.value);
              set('comissao', value > 100 ? 100 : (value < 0 ? 0 : value));
            }} />
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
          <label className="form-label">Foto do Profissional (Opcional)</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 64, height: 64, borderRadius: 8, background: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
              {form.fotoBase64 ? (
                <img src={form.fotoBase64} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              ) : (
                <span style={{ fontSize: 24, color: '#9CA3AF' }}>{form.nome ? form.nome.charAt(0).toUpperCase() : '?'}</span>
              )}
            </div>
            <div style={{ flex: 1 }}>
              <input 
                type="file" 
                accept="image/*"
                id="foto-upload"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.target.files[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onloadend = () => set('fotoBase64', reader.result);
                    reader.readAsDataURL(file);
                  }
                }}
              />
              <label htmlFor="foto-upload" className="btn btn-ghost" style={{ cursor: 'pointer', display: 'inline-flex', padding: '6px 12px', background: '#F3F4F6' }}>
                Escolher Foto
              </label>
              {form.fotoBase64 && (
                <button type="button" className="btn btn-ghost" style={{ color: '#DC2626', padding: '6px 12px', marginLeft: 8 }} onClick={() => set('fotoBase64', null)}>
                  Remover
                </button>
              )}
            </div>
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

// ─── Componente de Solicitações de Acesso (Aprovação de Login) ───
function AccessRequestsManager() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadRequests = async () => {
    setLoading(true);
    const { data } = await fetchAccessRequests();
    if (data) setRequests(data);
    setLoading(false);
  };

  useEffect(() => {
    loadRequests();
  }, []);

  const handleUpdateStatus = async (id, status) => {
    await updateAccessRequestStatus(id, status);
    loadRequests();
  };

  const pendingRequests = requests.filter(r => r.status === 'pending');

  if (requests.length === 0 && !loading) return null;

  return (
    <div className="card" style={{ marginBottom: 24, border: '1px solid #DFC8C3', background: '#FFFFFF' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 16, color: '#432F2D' }}>
            <UserCheck style={{ width: 20, height: 20, color: '#88594E' }} />
            Solicitações de Acesso ao Sistema
            {pendingRequests.length > 0 && (
              <span className="badge badge-warning" style={{ background: '#FDF3EB', color: '#D4956A', border: '1px solid #D4956A' }}>
                {pendingRequests.length} pendente(s)
              </span>
            )}
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
            Aprove ou rejeite o cadastro de novos usuários no ERP
          </p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={loadRequests}>
          <Clock style={{ width: 14, height: 14 }} />Atualizar
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {requests.map(req => (
          <div key={req.id} style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            borderRadius: 12,
            background: req.status === 'pending' ? '#FDFBF9' : 'var(--bg-main)',
            border: `1px solid ${req.status === 'pending' ? '#DFC8C3' : 'transparent'}`,
            flexWrap: 'wrap',
            gap: 12
          }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14, color: '#432F2D' }}>
                {req.full_name}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                <Mail style={{ width: 12, height: 12 }} />{req.email}
                <span>•</span>
                <span>Solicitado em: {new Date(req.created_at).toLocaleDateString('pt-BR')}</span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {req.status === 'pending' && (
                <span className="badge" style={{ background: '#FDF3EB', color: '#D4956A' }}>Aguardando aceite</span>
              )}
              {req.status === 'approved' && (
                <span className="badge badge-success">Aprovado</span>
              )}
              {req.status === 'rejected' && (
                <span className="badge badge-danger">Recusado</span>
              )}

              {req.status === 'pending' && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    className="btn btn-sm"
                    style={{ background: '#6B9B7A', color: '#fff', border: 'none' }}
                    onClick={() => handleUpdateStatus(req.id, 'approved')}
                  >
                    <CheckCircle style={{ width: 14, height: 14 }} /> Aceitar Acesso
                  </button>
                  <button
                    className="btn btn-sm"
                    style={{ background: '#FCEEF0', color: '#DC2828', border: '1px solid #F5C2C7' }}
                    onClick={() => handleUpdateStatus(req.id, 'rejected')}
                  >
                    <XCircle style={{ width: 14, height: 14 }} /> Recusar
                  </button>
                </div>
              )}

              {req.status !== 'pending' && (
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ fontSize: 11, color: 'var(--text-muted)' }}
                  onClick={() => handleUpdateStatus(req.id, req.status === 'approved' ? 'rejected' : 'approved')}
                >
                  Alterar para {req.status === 'approved' ? 'Recusado' : 'Aprovado'}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────
export default function Equipe() {
  const { canEdit } = useAuth();
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
          onSave={async (form) => {
            if (editModal === 'new') {
              await addProfissional(form);
            } else {
              await updateProfissional(editModal.id, form);
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
        {canEdit('equipe') && (
          <button className="btn btn-primary" onClick={() => setEditModal('new')}>
            <Plus />Novo Profissional
          </button>
        )}
      </div>

      {/* Gerenciador de Solicitações de Acesso Pendentes */}
      <AccessRequestsManager />

      {/* Cards grid */}
      <div className="grid-3 section-gap">
        {profissionais.map(prof => (
          <div key={prof.id} className="card">
            {/* Avatar + Name */}
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <div style={{
                width: 72, height: 72, margin: '0 auto 10px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 24, fontWeight: 700, position: 'relative',
              }}>
                <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9CA3AF', zIndex: 0 }}>
                  {prof.nome.charAt(0).toUpperCase()}
                </span>
                <img 
                  src={prof.fotoBase64 || `/${prof.nome.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()}.png`} 
                  alt={prof.nome} 
                  style={{ width: '100%', height: '100%', objectFit: 'contain', position: 'relative', zIndex: 1, backgroundColor: 'transparent' }} 
                  onError={(e) => { 
                    e.target.style.display = 'none'; 
                    e.target.previousSibling.style.color = prof.cor; 
                    e.target.previousSibling.style.background = prof.cor + '22'; 
                    e.target.previousSibling.style.borderRadius = '50%'; 
                  }} 
                />
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
          {canEdit('equipe') && (
            <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => setEditModal('new')}>
              <Plus />Cadastrar primeiro profissional
            </button>
          )}
        </div>
      )}
    </div>
  );
}
