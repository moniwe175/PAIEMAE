import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import {
  ShoppingBag, Plus, Search, XCircle, Clock, DollarSign,
  Edit3, Trash2, CheckCircle, X, Tag, Layers,
} from 'lucide-react';
import { fetchPackages, insertPackage, updatePackage, deletePackage } from '../../services/supabaseService';
import { useServicos } from '../../lib/servicos';

const genId = () => 'pkg_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

// Aceita tanto o formato legado (["Depilação"]) quanto o atual ([{ nome, qtd }])
function normalizaServicos(arr) {
  if (!Array.isArray(arr)) return [];
  return arr
    .map(s => (typeof s === 'string' ? { nome: s, qtd: 1 } : { nome: s?.nome, qtd: Number(s?.qtd) || 1 }))
    .filter(s => s.nome);
}

// ─── Modal de criação/edição ────────────────────────────────
function PacoteFormModal({ pacote, catalogo, onClose, onSave }) {
  const isEdit = !!pacote;
  const [form, setForm] = useState(() => isEdit ? {
    nome: pacote.nome || '',
    preco: String(pacote.preco ?? ''),
    desconto: String(pacote.desconto ?? ''),
    sessoes: String(pacote.sessoes ?? ''),
    validade: pacote.validade || '',
    ativo: pacote.ativo !== false,
    servicos: normalizaServicos(pacote.servicos),
  } : { nome: '', preco: '', desconto: '', sessoes: '', validade: '', ativo: true, servicos: [] });
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

  const podeSalvar = form.nome.trim() && form.preco !== '';
  const salvar = () => {
    if (!podeSalvar) return;
    onSave({
      nome: form.nome.trim(),
      preco: Number(form.preco) || 0,
      desconto: Number(form.desconto) || 0,
      sessoes: Number(form.sessoes) || 1,
      validade: form.validade.trim() || '6 meses',
      servicos: form.servicos,
      ativo: form.ativo !== false,
    });
    onClose();
  };

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
            <input className="form-input" type="number" placeholder="0" value={form.preco} onChange={e => set('preco', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Desconto (%)</label>
            <input className="form-input" type="number" placeholder="0" value={form.desconto} onChange={e => set('desconto', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Nº de Sessões</label>
            <input className="form-input" type="number" placeholder="Ex: 10" value={form.sessoes} onChange={e => set('sessoes', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Validade</label>
            <input className="form-input" placeholder="Ex: 6 meses" value={form.validade} onChange={e => set('validade', e.target.value)} />
          </div>
          <div className="form-group" style={{ gridColumn: 'span 2' }}>
            <label className="form-label">Serviços Incluídos</label>
            <div style={{ border: '1px solid #E5E7EB', borderRadius: 10, maxHeight: 200, overflowY: 'auto', padding: 6 }}>
              {catalogo.length === 0 && (
                <span style={{ fontSize: 11, color: '#D1D5DB', fontStyle: 'italic', padding: '4px 6px', display: 'block' }}>
                  Nenhum serviço cadastrado ainda — crie na aba Serviços primeiro.
                </span>
              )}
              {catalogo.map(s => {
                const sel = form.servicos.find(x => x.nome === s.nome);
                return (
                  <div
                    key={s.id}
                    onClick={() => toggleServico(s.nome)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '7px 10px', borderRadius: 8, cursor: 'pointer', marginBottom: 2,
                      background: sel ? '#FDF2F8' : 'transparent', userSelect: 'none', transition: 'background 0.1s',
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: sel ? '#C73B6D' : '#374151', fontWeight: sel ? 700 : 500 }}>
                      <Layers style={{ width: 13, height: 13, color: sel ? '#C73B6D' : '#9CA3AF' }} />
                      {s.nome}
                      <span style={{ fontSize: 10.5, color: '#9CA3AF', fontWeight: 500 }}>R$ {Number(s.preco || 0).toLocaleString('pt-BR')}</span>
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
                <input type="checkbox" checked={form.ativo} onChange={e => set('ativo', e.target.checked)} />
                Pacote Ativo
              </label>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={salvar} style={{ opacity: podeSalvar ? 1 : 0.5 }} disabled={!podeSalvar}>
            <CheckCircle />{isEdit ? 'Salvar' : 'Criar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Confirmação de exclusão ────────────────────────────────
function ExcluirPacoteModal({ pacote, onClose, onConfirm }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 380 }}>
        <div className="modal-header">
          <span className="modal-title" style={{ color: '#DC2626' }}>Excluir Pacote</span>
          <button className="modal-close" onClick={onClose}><XCircle /></button>
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-medium)', lineHeight: 1.6, margin: '8px 0 16px' }}>
          Tem certeza que deseja excluir <strong>{pacote.nome}</strong>? Esta ação não pode ser desfeita.
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

// ─── Seção de Pacotes (dentro da página Serviços) ───────────
export default function PacotesSection() {
  const { canEdit } = useAuth();
  const { servicos: catalogo } = useServicos();
  const podeEditar = canEdit('servicos');

  const [pacotes, setPacotes] = useState([]);
  const [modal, setModal] = useState(null); // null | 'novo' | pacote
  const [excluir, setExcluir] = useState(null);
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState('Todos');

  useEffect(() => {
    async function carregar() {
      const { data, error } = await fetchPackages();
      if (error) {
        alert('Erro ao carregar pacotes: ' + (error.message || JSON.stringify(error)));
        return;
      }
      setPacotes((data || []).map(p => ({
        ...p,
        servicos: normalizaServicos(p.servicos),
        preco: Number(p.preco) || 0,
        desconto: Number(p.desconto) || 0,
        sessoes: Number(p.sessoes) || 1,
        vendidos: Number(p.vendidos) || 0,
        ativo: p.ativo !== false,
      })));
    }
    carregar();
  }, []);

  const filtrados = pacotes.filter(p =>
    (filtro === 'Todos' || (filtro === 'Ativos' ? p.ativo : !p.ativo)) &&
    (p.nome || '').toLowerCase().includes(busca.toLowerCase())
  );
  const ativos = pacotes.filter(p => p.ativo);
  const ticketMedio = ativos.length > 0 ? Math.round(ativos.reduce((a, p) => a + p.preco, 0) / ativos.length) : 0;

  const salvarPacote = async (dados) => {
    if (modal === 'novo') {
      const { data, error } = await insertPackage({ id: genId(), ...dados, vendidos: 0 });
      if (error) {
        alert('Erro ao criar pacote: ' + (error.message || JSON.stringify(error)));
        return;
      }
      if (data) setPacotes(prev => [{ ...data, servicos: normalizaServicos(data.servicos) }, ...prev]);
    } else {
      const { data, error } = await updatePackage(modal.id, dados);
      if (error) {
        alert('Erro ao salvar pacote: ' + (error.message || JSON.stringify(error)));
        return;
      }
      if (data) setPacotes(prev => prev.map(p => p.id === data.id ? { ...p, ...data, servicos: normalizaServicos(data.servicos) } : p));
    }
  };

  const alternarAtivo = async (p) => {
    const { data, error } = await updatePackage(p.id, { ativo: !p.ativo });
    if (error) return;
    if (data) setPacotes(prev => prev.map(x => x.id === p.id ? { ...x, ativo: data.ativo !== false } : x));
  };

  const removerPacote = async (id) => {
    const { error } = await deletePackage(id);
    if (error) {
      alert('Erro ao excluir pacote: ' + (error.message || JSON.stringify(error)));
      return;
    }
    setPacotes(prev => prev.filter(p => p.id !== id));
  };

  return (
    <div>
      {modal && (
        <PacoteFormModal
          pacote={modal === 'novo' ? null : modal}
          catalogo={catalogo}
          onClose={() => setModal(null)}
          onSave={salvarPacote}
        />
      )}
      {excluir && (
        <ExcluirPacoteModal pacote={excluir} onClose={() => setExcluir(null)} onConfirm={() => removerPacote(excluir.id)} />
      )}

      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <p className="page-subtitle" style={{ margin: 0 }}>{pacotes.length} pacote(s) cadastrado(s)</p>
        {podeEditar && (
          <button className="btn btn-primary" onClick={() => setModal('novo')}><Plus />Novo Pacote</button>
        )}
      </div>

      {/* Stats */}
      <div className="grid-4 section-gap">
        {[
          { label: 'Total', val: pacotes.length, cor: 'var(--color-primary)' },
          { label: 'Ativos', val: ativos.length, cor: 'var(--success)' },
          { label: 'Inativos', val: pacotes.length - ativos.length, cor: 'var(--warning)' },
          { label: 'Ticket Médio', val: `R$ ${ticketMedio.toLocaleString('pt-BR')}`, cor: 'var(--info)' },
        ].map(({ label, val, cor }) => (
          <div key={label} className="stat-card" style={{ textAlign: 'center' }}>
            <div className="stat-value" style={{ color: cor }}>{val}</div>
            <div className="stat-label">{label}</div>
          </div>
        ))}
      </div>

      {/* Filtros + busca */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div className="tabs">
          {['Todos', 'Ativos', 'Inativos'].map(c => (
            <button key={c} className={`tab-item${filtro === c ? ' active' : ''}`} onClick={() => setFiltro(c)}>{c}</button>
          ))}
        </div>
        <div className="search-box">
          <Search />
          <input className="search-input" placeholder="Buscar pacote..." value={busca} onChange={e => setBusca(e.target.value)} />
        </div>
      </div>

      {/* Cards */}
      <div className="grid-3">
        {filtrados.map(p => (
          <div key={p.id} className="card" style={{ opacity: p.ativo ? 1 : 0.6 }}>
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
                onClick={() => podeEditar && alternarAtivo(p)}
                title={p.ativo ? 'Clique para desativar' : 'Clique para ativar'}
              >
                {p.ativo ? 'Ativo' : 'Inativo'}
              </span>
            </div>

            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10, color: 'var(--text-dark)' }}>{p.nome}</div>

            <div className="divider" />

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

            {/* Serviços incluídos */}
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.5, color: '#9CA3AF', textTransform: 'uppercase', marginBottom: 6 }}>
                Serviços incluídos
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {p.servicos.map(s => (
                  <span key={s.nome} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    background: '#FFF1F2', color: '#E11D48', border: '1px solid #FECDD3',
                    padding: '3px 8px', borderRadius: 99, fontSize: 11, fontWeight: 600,
                  }}>
                    {s.qtd}x {s.nome}
                  </span>
                ))}
                {p.servicos.length === 0 && (
                  <span style={{ fontSize: 11, color: '#D1D5DB', fontStyle: 'italic' }}>Nenhum serviço vinculado</span>
                )}
              </div>
            </div>

            {/* Ações */}
            {podeEditar && (
              <div style={{ display: 'flex', gap: 6, marginTop: 14 }}>
                <button className="btn btn-ghost btn-sm" style={{ flex: 1 }} onClick={() => setModal(p)}>
                  <Edit3 style={{ width: 12, height: 12 }} />Editar
                </button>
                <button className="btn btn-ghost btn-sm" style={{ flex: 0, color: '#DC2626', padding: '4px 10px' }} onClick={() => setExcluir(p)}>
                  <Trash2 style={{ width: 14, height: 14 }} />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {filtrados.length === 0 && (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
          <ShoppingBag style={{ width: 40, height: 40, marginBottom: 12, opacity: 0.3 }} />
          <p style={{ fontSize: 14 }}>Nenhum pacote encontrado</p>
          {podeEditar && pacotes.length === 0 && (
            <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => setModal('novo')}>
              <Plus />Criar primeiro pacote
            </button>
          )}
        </div>
      )}
    </div>
  );
}
