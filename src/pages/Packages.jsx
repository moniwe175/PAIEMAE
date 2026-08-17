import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  ShoppingBag, Plus, Search, XCircle, Clock, DollarSign,
  Edit3, Trash2, CheckCircle, X, Tag,
} from 'lucide-react';
import { fetchPackages, insertPackage, updatePackage, deletePackage } from '../services/supabaseService';
import { getCurrentUser } from '../lib/supabase';
import { useServicos } from '../lib/servicos';

function genId() {
  return 'pkg_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// Aceita formato antigo (["Depilação"]) e novo ([{nome, qtd}])
function normalizeServicos(arr) {
  if (!Array.isArray(arr)) return [];
  return arr
    .map(s => (typeof s === 'string' ? { nome: s, qtd: 1 } : { nome: s?.nome, qtd: Number(s?.qtd) || 1 }))
    .filter(s => s.nome);
}

// ─── Edit / Create Modal ────────────────────────────────────
function PacoteModal({ onClose, onSave, pacote, catalogo }) {
  const isEdit = !!pacote;
  const [form, setForm] = useState(() => isEdit ? {
    nome: pacote.nome,
    preco: String(pacote.preco),
    desconto: String(pacote.desconto),
    validade: pacote.validade,
    sessoes: String(pacote.sessoes),
    ativo: pacote.ativo,
    servicos: normalizeServicos(pacote.servicos),
  } : { nome: '', preco: '', desconto: '', validade: '', sessoes: '', servicos: [] });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const toggleServico = (nome) => setForm(f => ({
    ...f,
    servicos: f.servicos.some(x => x.nome === nome)
      ? f.servicos.filter(x => x.nome !== nome)
      : [...f.servicos, { nome, qtd: 1 }],
  }));
  const setQtd = (nome, qtd) => setForm(f => ({
    ...f,
    servicos: f.servicos.map(x => x.nome === nome ? { ...x, qtd: Math.max(1, Number(qtd) || 1) } : x),
  }));

  const canSave = form.nome && form.preco !== '';
  const handleSubmit = () => {
    if (!canSave) return;
    onSave({
      ...(isEdit ? pacote : {}),
      nome: form.nome,
      preco: Number(form.preco) || 0,
      desconto: Number(form.desconto) || 0,
      validade: form.validade || '6 meses',
      sessoes: Number(form.sessoes) || 1,
      servicos: form.servicos,
      vendidos: isEdit ? pacote.vendidos : 0,
      ativo: isEdit ? (form.ativo !== false) : true,
    });
    onClose();
  };

  // União: catálogo + serviços já selecionados que não existem mais no catálogo
  const nomesCatalogo = catalogo.map(s => s.nome);
  const linhas = [
    ...catalogo.map(s => ({ nome: s.nome, preco: s.preco })),
    ...form.servicos.filter(x => !nomesCatalogo.includes(x.nome)).map(x => ({ nome: x.nome, preco: null })),
  ];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
        <div className="modal-header">
          <span className="modal-title">{isEdit ? 'Editar Pacote' : 'Novo Pacote'}</span>
          <button className="modal-close" onClick={onClose}><XCircle /></button>
        </div>
        <div className="form-grid-2">
          <div className="form-group" style={{ gridColumn: 'span 2' }}>
            <label className="form-label">Nome do Pacote</label>
            <input className="form-input" placeholder="Ex: Pacote Prata" value={form.nome} onChange={e => set('nome', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Preço (R$)</label>
            <input className="form-input" type="number" placeholder="0,00" value={form.preco} onChange={e => set('preco', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Desconto (%)</label>
            <input className="form-input" type="number" placeholder="0" value={form.desconto} onChange={e => set('desconto', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Nº de Sessões</label>
            <input className="form-input" type="number" placeholder="0" value={form.sessoes} onChange={e => set('sessoes', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Validade</label>
            <input className="form-input" placeholder="Ex: 6 meses" value={form.validade} onChange={e => set('validade', e.target.value)} />
          </div>
          <div className="form-group" style={{ gridColumn: 'span 2' }}>
            <label className="form-label">Serviços do Pacote</label>
            <div style={{ border: '1px solid #E5E7EB', borderRadius: 10, maxHeight: 200, overflowY: 'auto', padding: 6 }}>
              {linhas.length === 0 && (
                <span style={{ fontSize: 11, color: '#D1D5DB', fontStyle: 'italic', padding: '4px 6px', display: 'block' }}>
                  Nenhum serviço cadastrado — crie serviços na aba Serviços primeiro.
                </span>
              )}
              {linhas.map(s => {
                const sel = form.servicos.find(x => x.nome === s.nome);
                return (
                  <div
                    key={s.nome}
                    onClick={() => toggleServico(s.nome)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '7px 10px', borderRadius: 8, cursor: 'pointer', marginBottom: 2,
                      background: sel ? '#FDF2F8' : 'transparent', userSelect: 'none',
                      transition: 'background 0.1s',
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: sel ? '#C73B6D' : '#374151', fontWeight: sel ? 700 : 500 }}>
                      <ShoppingBag style={{ width: 13, height: 13, color: sel ? '#C73B6D' : '#9CA3AF' }} />
                      {s.nome}
                      {s.preco != null && <span style={{ fontSize: 10.5, color: '#9CA3AF', fontWeight: 500 }}>R$ {Number(s.preco).toLocaleString('pt-BR')}</span>}
                    </span>
                    {sel && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }} onClick={e => e.stopPropagation()}>
                        <input
                          type="number"
                          min="1"
                          value={sel.qtd}
                          onChange={e => setQtd(s.nome, e.target.value)}
                          style={{ width: 56, padding: '3px 6px', borderRadius: 6, border: '1px solid #FECDD3', fontSize: 12, textAlign: 'center' }}
                        />
                        <CheckCircle style={{ width: 14, height: 14, color: '#C73B6D' }} />
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
            <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4 }}>
              {form.servicos.length} serviço(s) incluído(s) — clique para adicionar/remover e ajuste a quantidade.
            </div>
          </div>
          {isEdit && (
            <div className="form-group" style={{ gridColumn: 'span 2', marginTop: 2 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, cursor: 'pointer' }}>
                <input type="checkbox" checked={form.ativo !== false} onChange={e => set('ativo', e.target.checked)} />
                Pacote Ativo
              </label>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSubmit} style={{ opacity: canSave ? 1 : 0.5 }} disabled={!canSave}>
            <CheckCircle />{isEdit ? 'Salvar' : 'Criar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Delete Confirm Modal ───────────────────────────────────
function DeleteConfirmModal({ onClose, onConfirm, pacote }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 380 }}>
        <div className="modal-header">
          <span className="modal-title" style={{ color: '#DC2626' }}>Excluir Pacote</span>
          <button className="modal-close" onClick={onClose}><XCircle /></button>
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-medium)', lineHeight: 1.6, margin: '8px 0 16px' }}>
          Tem certeza que deseja excluir <strong>{pacote.nome}</strong>? Esta ação não pode ser desfeita.
          {pacote.vendidos > 0 && (
            <span style={{ display: 'block', marginTop: 6, color: 'var(--warning)', fontWeight: 600 }}>
              Atenção: {pacote.vendidos} unidade(s) já vendida(s).
            </span>
          )}
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

// ─── Package Services Linking Panel (igual ao de profissionais nos serviços) ───
function ServicosPanel({ pacote, catalogo, canEditPacotes, onLink, onUnlink }) {
  const itens = normalizeServicos(pacote.servicos);
  const vinculados = itens.map(i => i.nome);
  const disponiveis = catalogo.filter(s => !vinculados.includes(s.nome));

  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.5, color: '#9CA3AF', textTransform: 'uppercase', marginBottom: 6 }}>
        Serviços do pacote
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: itens.length > 0 ? 8 : 0 }}>
        {itens.map(i => (
          <span key={i.nome} style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            background: '#FFF1F2', color: '#E11D48', border: '1px solid #FECDD3',
            padding: '3px 8px', borderRadius: 99, fontSize: 11, fontWeight: 600,
          }}>
            {i.qtd}x {i.nome}
            {canEditPacotes && (
              <button
                onClick={() => onUnlink(pacote.id, i.nome)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}
                title="Remover serviço do pacote"
              >
                <X style={{ width: 11, height: 11, color: '#E11D48' }} />
              </button>
            )}
          </span>
        ))}
        {itens.length === 0 && (
          <span style={{ fontSize: 11, color: '#D1D5DB', fontStyle: 'italic' }}>Nenhum serviço vinculado</span>
        )}
      </div>

      {canEditPacotes && disponiveis.length > 0 && (
        <details style={{ position: 'relative' }}>
          <summary style={{
            fontSize: 11, fontWeight: 600, color: '#C73B6D', cursor: 'pointer',
            listStyle: 'none', display: 'flex', alignItems: 'center', gap: 4,
          }}>
            <Plus style={{ width: 12, height: 12 }} />Vincular serviço
          </summary>
          <div style={{
            marginTop: 6, background: '#fff', border: '1px solid #E5E7EB',
            borderRadius: 8, padding: 6, boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
            maxHeight: 150, overflowY: 'auto', zIndex: 5, position: 'relative',
          }}>
            {disponiveis.map(s => (
              <button
                key={s.id}
                onClick={() => onLink(pacote.id, s.nome)}
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
                <div style={{ fontWeight: 600 }}>{s.nome}</div>
                <div style={{ fontSize: 10, color: '#9CA3AF', marginLeft: 'auto' }}>R$ {Number(s.preco || 0).toLocaleString('pt-BR')}</div>
              </button>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────
export default function Packages() {
  const { canEdit } = useAuth();
  const { servicos: catalogo } = useServicos();

  const [editModal, setEditModal] = useState(null); // null | 'new' | pacote
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [pacotes, setPacotes] = useState([]);
  const [busca, setBusca] = useState('');
  const [tabFiltro, setTabFiltro] = useState('Todos');

  useEffect(() => {
    async function load() {
      const { data, error } = await fetchPackages();
      if (error) {
        console.error('Erro ao carregar pacotes:', error);
        alert('Erro ao carregar pacotes: ' + (error.message || JSON.stringify(error)));
      }
      if (data) {
        setPacotes(data.map(p => ({
          ...p,
          servicos: normalizeServicos(p.servicos),
          preco: Number(p.preco) || 0,
          desconto: Number(p.desconto) || 0,
          sessoes: Number(p.sessoes) || 1,
          vendidos: Number(p.vendidos) || 0,
          ativo: p.ativo !== false,
        })));
      }
    }
    load();
  }, []);

  const podeEditar = canEdit('pacotes');

  const filtrados = pacotes.filter(p =>
    (tabFiltro === 'Todos' || (tabFiltro === 'Ativos' ? p.ativo : !p.ativo)) &&
    p.nome.toLowerCase().includes(busca.toLowerCase())
  );

  const ativos = pacotes.filter(p => p.ativo);
  const ticketMedio = ativos.length > 0 ? Math.round(ativos.reduce((a, p) => a + p.preco, 0) / ativos.length) : 0;

  const persist = async (id, updates) => {
    const { data, error } = await updatePackage(id, updates);
    if (error) {
      alert('Erro ao salvar: ' + (error.message || JSON.stringify(error)));
      return null;
    }
    return data;
  };

  const handleSave = async (formData) => {
    if (editModal === 'new') {
      const user = await getCurrentUser();
      const newPkg = { id: genId(), ...formData, user_id: user?.id };
      const { data, error } = await insertPackage(newPkg);
      if (error) {
        alert('Erro ao salvar no banco: ' + (error.message || JSON.stringify(error)));
        return;
      }
      if (data) setPacotes(prev => [data, ...prev]);
    } else {
      const data = await persist(editModal.id, formData);
      if (data) setPacotes(prev => prev.map(p => p.id === data.id ? { ...p, ...data, servicos: normalizeServicos(data.servicos) } : p));
    }
  };

  const handleToggleAtivo = async (p) => {
    const data = await persist(p.id, { ativo: !p.ativo });
    if (data) setPacotes(prev => prev.map(x => x.id === p.id ? { ...x, ativo: data.ativo !== false } : x));
  };

  const handleLinkServico = async (pkgId, nome) => {
    const p = pacotes.find(x => x.id === pkgId);
    if (!p) return;
    const servicos = [...normalizeServicos(p.servicos), { nome, qtd: 1 }];
    const data = await persist(pkgId, { servicos });
    if (data) setPacotes(prev => prev.map(x => x.id === pkgId ? { ...x, servicos: normalizeServicos(data.servicos) } : x));
  };

  const handleUnlinkServico = async (pkgId, nome) => {
    const p = pacotes.find(x => x.id === pkgId);
    if (!p) return;
    const servicos = normalizeServicos(p.servicos).filter(i => i.nome !== nome);
    const data = await persist(pkgId, { servicos });
    if (data) setPacotes(prev => prev.map(x => x.id === pkgId ? { ...x, servicos: normalizeServicos(data.servicos) } : x));
  };

  const handleDelete = async (id) => {
    const { error } = await deletePackage(id);
    if (error) {
      alert('Erro ao excluir: ' + (error.message || JSON.stringify(error)));
      return;
    }
    setPacotes(prev => prev.filter(p => p.id !== id));
  };

  return (
    <div>
      {editModal && (
        <PacoteModal
          pacote={editModal === 'new' ? null : editModal}
          catalogo={catalogo}
          onClose={() => setEditModal(null)}
          onSave={handleSave}
        />
      )}
      {deleteTarget && (
        <DeleteConfirmModal
          pacote={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={() => handleDelete(deleteTarget.id)}
        />
      )}

      {/* Header */}
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div className="page-header-label"><ShoppingBag />PACOTES</div>
          <h1 className="page-title">Pacotes</h1>
          <p className="page-subtitle">{pacotes.length} pacote(s) cadastrado(s)</p>
        </div>
        {podeEditar && (
          <button className="btn btn-primary" onClick={() => setEditModal('new')}><Plus />Novo Pacote</button>
        )}
      </div>

      {/* Stats */}
      <div className="grid-4 section-gap">
        {[
          { label: 'Total', val: pacotes.length, cor: 'var(--color-primary)' },
          { label: 'Ativos', val: ativos.length, cor: 'var(--success)' },
          { label: 'Inativos', val: pacotes.filter(p => !p.ativo).length, cor: 'var(--warning)' },
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
          {['Todos', 'Ativos', 'Inativos'].map(c => (
            <button key={c} className={`tab-item${tabFiltro === c ? ' active' : ''}`} onClick={() => setTabFiltro(c)}>{c}</button>
          ))}
        </div>
        <div className="search-box">
          <Search />
          <input className="search-input" placeholder="Buscar pacote..." value={busca} onChange={e => setBusca(e.target.value)} />
        </div>
      </div>

      {/* Package cards */}
      <div className="grid-3">
        {filtrados.map(p => (
          <div key={p.id} className="card" style={{ opacity: p.ativo ? 1 : 0.6 }}>
            {/* Top badges */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', marginBottom: 12 }}>
              <span className="badge badge-info">{p.sessoes} sessões</span>
              {p.desconto > 0 && (
                <span className="badge badge-warning" style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                  <Tag style={{ width: 10, height: 10 }} />{p.desconto}% off
                </span>
              )}
              <span
                className={`badge ${p.ativo ? 'badge-success' : 'badge-neutral'}`}
                style={{ cursor: podeEditar ? 'pointer' : 'default', marginLeft: 'auto' }}
                onClick={() => podeEditar && handleToggleAtivo(p)}
                title={p.ativo ? 'Clique para desativar' : 'Clique para ativar'}
              >
                {p.ativo ? 'Ativo' : 'Inativo'}
              </span>
            </div>

            {/* Package name */}
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10, color: 'var(--text-dark)' }}>{p.nome}</div>

            <div className="divider" />

            {/* Info */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--text-muted)' }}><DollarSign style={{ width: 13, height: 13 }} />Preço</span>
                <span style={{ fontWeight: 700, color: 'var(--success)' }}>R$ {p.preco.toLocaleString('pt-BR')}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--text-muted)' }}><Clock style={{ width: 13, height: 13 }} />Validade</span>
                <span style={{ fontWeight: 600 }}>{p.validade}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: 'var(--text-muted)' }}>Vendidos</span>
                <span style={{ fontWeight: 600, color: 'var(--success)' }}>{p.vendidos}</span>
              </div>
            </div>

            {/* Services linking */}
            <ServicosPanel
              pacote={p}
              catalogo={catalogo}
              canEditPacotes={podeEditar}
              onLink={handleLinkServico}
              onUnlink={handleUnlinkServico}
            />

            {/* Actions */}
            <div style={{ display: 'flex', gap: 6, marginTop: 14 }}>
              <button className="btn btn-ghost btn-sm" style={{ flex: 1 }} onClick={() => setEditModal(p)}>
                <Edit3 style={{ width: 12, height: 12 }} />Editar
              </button>
              <button className="btn btn-ghost btn-sm" style={{ flex: 0, color: '#DC2626', padding: '4px 10px' }} onClick={() => setDeleteTarget(p)}>
                <Trash2 style={{ width: 14, height: 14 }} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {filtrados.length === 0 && (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
          <ShoppingBag style={{ width: 40, height: 40, marginBottom: 12, opacity: 0.3 }} />
          <p style={{ fontSize: 14 }}>Nenhum pacote encontrado</p>
          {podeEditar && pacotes.length === 0 && (
            <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => setEditModal('new')}>
              <Plus />Criar primeiro pacote
            </button>
          )}
        </div>
      )}
    </div>
  );
}
