import React, { useState, useEffect } from 'react';
import { UserCheck, Plus, Search, Phone, XCircle, ChevronRight, Mail, Star, Upload, Trash2, Loader2 } from 'lucide-react';
import { fetchClients, insertClient, deleteClient } from '../services/supabaseService';
import { getCurrentUser } from '../lib/supabase';

function mapFromSupabase(client) {
  return {
    id: client.id,
    nome: client.name || '',
    telefone: client.phone || '(00) 00000-0000',
    email: client.email || '',
    origem: client.source || 'Instagram',
    totalCompras: client.total_purchases || 0,
    totalGasto: Number(client.total_spent) || 0,
    status: client.status || 'ativo',
    avatar: client.avatar || (client.name ? client.name.charAt(0).toUpperCase() : 'U'),
  };
}

function mapToSupabase(client) {
  return {
    name: client.nome,
    phone: client.telefone,
    email: client.email,
    source: client.origem,
    total_purchases: client.totalCompras || 0,
    total_spent: client.totalGasto || 0,
    status: client.status || 'ativo',
    avatar: client.avatar,
  };
}

export default function Clients() {
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busca, setBusca] = useState('');
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ nome: '', telefone: '', email: '', origem: '' });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const loadClients = async () => {
    setLoading(true);
    const { data, error } = await fetchClients();
    if (!error && data) {
      setClientes(data.map(mapFromSupabase));
    }
    setLoading(false);
  };

  useEffect(() => {
    loadClients();
  }, []);

  const cleanAndTitleCaseName = (name) => {
    if (!name) return '';
    const cleaned = name.replace(/^["']|["']$/g, '').trim();
    return cleaned
      .toLowerCase()
      .split(' ')
      .filter(word => word.length > 0)
      .map(word => {
        const lowercases = ['de', 'da', 'do', 'dos', 'das', 'e'];
        if (lowercases.includes(word)) return word;
        return word.charAt(0).toUpperCase() + word.slice(1);
      })
      .join(' ');
  };

  const handleImportCSV = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target.result;
      const lines = text.split(/\r?\n/);
      if (lines.length === 0) return;

      let delimiter = ',';
      const sampleLines = lines.slice(0, 10).join('\n');
      const semicolons = (sampleLines.match(/;/g) || []).length;
      const commas = (sampleLines.match(/,/g) || []).length;
      if (semicolons > commas) {
        delimiter = ';';
      }

      let headerIdx = -1;
      for (let i = 0; i < lines.length; i++) {
        const cleanLine = lines[i].toLowerCase();
        if (cleanLine.includes('nome') && (cleanLine.includes('telefone') || cleanLine.includes('email') || cleanLine.includes('e-mail') || cleanLine.includes('genero'))) {
          headerIdx = i;
          break;
        }
      }

      if (headerIdx === -1) {
        headerIdx = 0;
      }

      const headers = lines[headerIdx]
        .split(delimiter)
        .map(h => h.replace(/^["']|["']$/g, '').trim().toLowerCase());

      const nomeIdx = headers.findIndex(h => h.includes('nome'));
      const telIdx = headers.findIndex(h => h.includes('telefone') || h.includes('tel') || h.includes('fone'));
      const emailIdx = headers.findIndex(h => h.includes('email') || h.includes('e-mail'));
      const origemIdx = headers.findIndex(h => h.includes('origem') || h.includes('canal'));

      const importedClients = [];
      for (let i = headerIdx + 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        let cols = [];
        if (line.includes('"')) {
          const matches = line.match(/(".*?"|[^";\s]+)(?=\s*;|\s*$)/g) || line.split(delimiter);
          cols = matches.map(m => m.replace(/^["']|["']$/g, '').trim());
        } else {
          cols = line.split(delimiter).map(c => c.trim());
        }

        const rawNome = nomeIdx !== -1 && cols[nomeIdx] ? cols[nomeIdx] : '';
        if (!rawNome || rawNome.toLowerCase() === 'nome') continue;

        const nome = cleanAndTitleCaseName(rawNome);
        const telefone = telIdx !== -1 && cols[telIdx] ? cols[telIdx].replace(/^["']|["']$/g, '').trim() : '';
        const email = emailIdx !== -1 && cols[emailIdx] ? cols[emailIdx].replace(/^["']|["']$/g, '').trim() : '';
        const origem = origemIdx !== -1 && cols[origemIdx] ? cols[origemIdx].replace(/^["']|["']$/g, '').trim() : 'Planilha';

        importedClients.push({
          nome,
          telefone: telefone || '(00) 00000-0000',
          email: email || '',
          origem: origem || 'Planilha',
          totalCompras: 0,
          totalGasto: 0,
          status: 'ativo',
          avatar: nome.charAt(0).toUpperCase() || 'U'
        });
      }

      if (importedClients.length > 0) {
        setSaving(true);
        const user = await getCurrentUser();
        for (const c of importedClients) {
          const payload = { ...mapToSupabase(c), user_id: user?.id };
          await insertClient(payload);
        }
        await loadClients();
        setSaving(false);
        alert(`${importedClients.length} clientes importados com sucesso!`);
      } else {
        alert('Nenhum cliente válido encontrado. Verifique as colunas de sua planilha.');
      }
    };

    reader.readAsText(file, 'UTF-8');
    e.target.value = '';
  };

  const handleSaveNovoCliente = async () => {
    if (!form.nome) {
      alert('Por favor, preencha o nome do cliente.');
      return;
    }
    const nome = cleanAndTitleCaseName(form.nome);
    const novo = {
      nome,
      telefone: form.telefone || '(00) 00000-0000',
      email: form.email || '',
      origem: form.origem || 'Instagram',
      totalCompras: 0,
      totalGasto: 0,
      status: 'ativo',
      avatar: nome.charAt(0).toUpperCase()
    };

    setSaving(true);
    const user = await getCurrentUser();
    const { data, error } = await insertClient({ ...mapToSupabase(novo), user_id: user?.id });
    setSaving(false);

    if (!error && data) {
      setClientes(prev => [mapFromSupabase(data), ...prev]);
    }

    setForm({ nome: '', telefone: '', email: '', origem: '' });
    setModal(false);
  };

  const handleDeleteCliente = async (id) => {
    const { error } = await deleteClient(id);
    if (!error) {
      setClientes(prev => prev.filter(c => c.id !== id));
    }
  };

  const filtrados = clientes.filter(c =>
    c.nome.toLowerCase().includes(busca.toLowerCase()) || c.telefone.includes(busca)
  );

  return (
    <div>
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Novo Cliente</span>
              <button className="modal-close" onClick={() => setModal(false)}><XCircle /></button>
            </div>
            <div className="form-grid-2">
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Nome completo</label>
                <input className="form-input" placeholder="Nome do cliente" value={form.nome} onChange={e => set('nome', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Telefone</label>
                <input className="form-input" placeholder="(11) 99999-9999" value={form.telefone} onChange={e => set('telefone', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">E-mail</label>
                <input className="form-input" type="email" placeholder="email@exemplo.com" value={form.email} onChange={e => set('email', e.target.value)} />
              </div>
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Origem / Canal</label>
                <select className="form-select" value={form.origem} onChange={e => set('origem', e.target.value)}>
                  <option value="">Selecione...</option>
                  {['Instagram', 'Google', 'Indicação', 'Facebook', 'WhatsApp', 'Outro'].map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
              <button className="btn btn-ghost" onClick={() => setModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSaveNovoCliente} disabled={saving}>
                {saving ? <Loader2 style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} /> : <Star />}
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div className="page-header-label"><UserCheck />CLIENTES</div>
          <h1 className="page-title">Clientes</h1>
          <p className="page-subtitle">{clientes.length} clientes cadastrados</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <label className="btn btn-secondary" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Upload style={{ width: 16, height: 16 }} />
            Importar Planilha
            <input type="file" accept=".csv" style={{ display: 'none' }} onChange={handleImportCSV} />
          </label>
          <button className="btn btn-primary" onClick={() => setModal(true)} disabled={saving}><Plus />Novo Cliente</button>
        </div>
      </div>

      <div className="grid-4 section-gap">
        {[
          { label: 'Total', val: clientes.length, cor: 'var(--color-primary)' },
          { label: 'Ativos', val: clientes.filter(c => c.status === 'ativo').length, cor: 'var(--success)' },
          { label: 'Via Instagram', val: clientes.filter(c => c.origem === 'Instagram').length, cor: 'var(--warning)' },
          { label: 'Por Indicação', val: clientes.filter(c => c.origem === 'Indicação').length, cor: 'var(--info)' },
        ].map(({ label, val, cor }) => (
          <div key={label} className="stat-card" style={{ textAlign: 'center' }}>
            <div className="stat-value" style={{ color: cor }}>{val}</div>
            <div className="stat-label">{label}</div>
          </div>
        ))}
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-color)' }}>
          <div className="search-box">
            <Search />
            <input className="search-input" placeholder="Buscar cliente..." value={busca} onChange={e => setBusca(e.target.value)} />
          </div>
        </div>
        <div className="table-wrapper">
          {loading ? (
            <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
              <Loader2 style={{ width: 32, height: 32, animation: 'spin 1s linear infinite' }} />
              <p style={{ marginTop: 12 }}>Carregando clientes...</p>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Telefone</th>
                  <th>Origem</th>
                  <th>Compras</th>
                  <th>Total Gasto</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map(c => (
                  <tr key={c.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div className="avatar">{c.avatar}</div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{c.nome}</div>
                          {c.email && (
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                              <Mail style={{ width: 10, height: 10 }} />
                              {c.email}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td style={{ fontSize: 13, color: 'var(--text-light)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Phone style={{ width: 12, height: 12 }} />
                        {c.telefone}
                      </div>
                    </td>
                    <td><span className="badge badge-info">{c.origem}</span></td>
                    <td style={{ textAlign: 'center', fontWeight: 600 }}>{c.totalCompras}</td>
                    <td style={{ fontWeight: 600, color: 'var(--success)' }}>R$ {c.totalGasto.toLocaleString('pt-BR')}</td>
                    <td><span className={`badge ${c.status === 'ativo' ? 'badge-success' : 'badge-neutral'}`}>{c.status === 'ativo' ? 'Ativo' : 'Inativo'}</span></td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(`Deseja realmente excluir o cliente "${c.nome}"?`)) {
                              handleDeleteCliente(c.id);
                            }
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#ef4444',
                            cursor: 'pointer',
                            padding: '6px',
                            borderRadius: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'background-color 0.2s'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                          title="Excluir Cliente"
                        >
                          <Trash2 style={{ width: 15, height: 15 }} />
                        </button>
                        <ChevronRight style={{ width: 15, height: 15, color: 'var(--text-muted)' }} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
