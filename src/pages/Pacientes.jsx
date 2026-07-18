import React, { useState, useEffect } from 'react';
import { Users, Plus, Search, Phone, Calendar, FileText, Star, XCircle, ChevronRight, Mail, Instagram, Upload, Trash2, AlertTriangle } from 'lucide-react';
import { fetchClients, insertClient, deleteClient, updateClient, fetchAppointments } from '../services/supabaseService';
import { getCurrentUser } from '../lib/supabase';

const defaultPacientes = [
  { id:1, nome:'Ana Beatriz Souza', telefone:'(11) 98765-4321', email:'ana@email.com', cidade:'São Paulo', nascimento:'15/03/1990', ultimaVisita:'10/05/2026', totalSessoes:8, totalGasto:2850, status:'ativo', avatar:'A' },
  { id:2, nome:'Carla Mendes Silva', telefone:'(11) 97654-3210', email:'carla@email.com', cidade:'São Paulo', nascimento:'22/07/1985', ultimaVisita:'08/05/2026', totalSessoes:12, totalGasto:4200, status:'ativo', avatar:'C' },
  { id:3, nome:'Fernanda Lima', telefone:'(11) 96543-2109', email:'fernanda@email.com', cidade:'Guarulhos', nascimento:'30/11/1992', ultimaVisita:'05/05/2026', totalSessoes:5, totalGasto:1750, status:'ativo', avatar:'F' },
  { id:4, nome:'Juliana Costa', telefone:'(11) 95432-1098', email:'juliana@email.com', cidade:'São Paulo', nascimento:'14/04/1988', ultimaVisita:'01/04/2026', totalSessoes:3, totalGasto:980, status:'inativo', avatar:'J' },
  { id:5, nome:'Mariana Alves', telefone:'(11) 94321-0987', email:'mariana@email.com', cidade:'São Bernardo', nascimento:'08/09/1995', ultimaVisita:'28/04/2026', totalSessoes:6, totalGasto:2100, status:'ativo', avatar:'M' },
  { id:6, nome:'Patrícia Rocha', telefone:'(11) 93210-9876', email:'patricia@email.com', cidade:'São Paulo', nascimento:'19/01/1982', ultimaVisita:'12/05/2026', totalSessoes:15, totalGasto:5800, status:'ativo', avatar:'P' },
];

const historicoDefault = [];

function PacienteModal({ onClose, onSave, initialData }) {
  const [form, setForm] = useState(initialData || { nome:'', telefone:'', email:'', instagram:'', nascimento:'', cidade:'', obs:'' });
  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  const handleSave = () => {
    if (!form.nome) {
      alert('Por favor, preencha o nome do paciente.');
      return;
    }
    onSave(form);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">{initialData ? 'Editar Paciente' : 'Novo Paciente'}</span>
          <button className="modal-close" onClick={onClose}><XCircle /></button>
        </div>
        <div className="form-grid-2">
          <div className="form-group" style={{gridColumn:'span 2'}}>
            <label className="form-label">Nome completo</label>
            <input className="form-input" placeholder="Nome do paciente" value={form.nome} onChange={e=>set('nome',e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Telefone</label>
            <input className="form-input" placeholder="(11) 99999-9999" value={form.telefone} onChange={e=>set('telefone',e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">E-mail</label>
            <input className="form-input" type="email" placeholder="email@exemplo.com" value={form.email} onChange={e=>set('email',e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Instagram</label>
            <input className="form-input" placeholder="@usuario" value={form.instagram} onChange={e=>set('instagram',e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Nascimento</label>
            <input className="form-input" type="date" value={form.nascimento} onChange={e=>set('nascimento',e.target.value)} />
          </div>
        </div>
        <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:8}}>
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSave}>Salvar</button>
        </div>
      </div>
    </div>
  );
}

export default function Pacientes() {
  const [pacientes, setPacientes] = useState([]);
  const [modal, setModal] = useState(false);
  const [editModal, setEditModal] = useState(null);
  const [deleteModal, setDeleteModal] = useState(null);
  const [busca, setBusca] = useState('');
  const [selected, setSelected] = useState(null);

  // Load fresh data from Supabase on mount
  useEffect(() => {
    async function load() {
      const [clientsRes, apptsRes] = await Promise.all([
        fetchClients(),
        fetchAppointments()
      ]);
      const data = clientsRes.data;
      const appts = apptsRes.data || [];

      if (data) {
        const mapped = data.map(item => {
          const clientAppts = appts.filter(a => a.client_name === item.name && a.status === 'finalizado');
          clientAppts.sort((a, b) => new Date(b.appointment_date) - new Date(a.appointment_date));

          let ultimaVisita = item.last_visit ? item.last_visit.split('-').reverse().join('/') : 'Nunca';
          if (clientAppts.length > 0) {
            ultimaVisita = clientAppts[0].appointment_date.split('-').reverse().join('/');
          }

          const totalSessoes = clientAppts.length > 0 ? clientAppts.length : (item.points || 0);

          let calculadoGasto = clientAppts.reduce((acc, a) => {
            let v = 0;
            try {
              if (a.notes && a.notes.startsWith('{')) {
                v = Number(JSON.parse(a.notes).valor) || 0;
              }
            } catch(e) {}
            return acc + v;
          }, 0);
          const totalGasto = clientAppts.length > 0 ? calculadoGasto : (Number(item.total_spent) || 0);

          const historicoPaciente = clientAppts.map(a => {
            let v = 0;
            try {
              if (a.notes && a.notes.startsWith('{')) {
                v = Number(JSON.parse(a.notes).valor) || 0;
              }
            } catch(e) {}
            return {
              data: a.appointment_date ? a.appointment_date.split('-').reverse().join('/') : '',
              servico: a.procedure || 'Sessão',
              valor: v
            };
          });

          return {
            id: item.id,
            nome: item.name || '',
            telefone: item.phone || '',
            email: item.email || '',
            instagram: item.instagram || '',
            cidade: 'Não informada',
            nascimento: item.birthdate ? item.birthdate.split('-').reverse().join('/') : '',
            ultimaVisita: ultimaVisita,
            totalSessoes: totalSessoes,
            totalGasto: totalGasto,
            status: item.status || 'ativo',
            avatar: item.avatar || (item.name ? item.name.charAt(0).toUpperCase() : 'U'),
            historico: historicoPaciente
          };
        });
        setPacientes(mapped);
      }
    }
    load();
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

  const handleImportCSV = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const currentUser = await getCurrentUser();

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target.result;
      const lines = text.split(/\r?\n/);
      if (lines.length === 0) return;

      // Detect delimiter
      let delimiter = ',';
      const sampleLines = lines.slice(0, 10).join('\n');
      const semicolons = (sampleLines.match(/;/g) || []).length;
      const commas = (sampleLines.match(/,/g) || []).length;
      if (semicolons > commas) delimiter = ';';

      // Find header row
      let headerIdx = -1;
      for (let i = 0; i < lines.length; i++) {
        const cleanLine = lines[i].toLowerCase();
        if (cleanLine.includes('nome') && (cleanLine.includes('telefone') || cleanLine.includes('email') || cleanLine.includes('e-mail') || cleanLine.includes('gênero') || cleanLine.includes('genero'))) {
          headerIdx = i;
          break;
        }
      }
      if (headerIdx === -1) headerIdx = 0;

      const headers = lines[headerIdx]
        .split(delimiter)
        .map(h => h.replace(/^["']|["']$/g, '').trim().toLowerCase());

      const nomeIdx = headers.findIndex(h => h.includes('nome'));
      const telIdx = headers.findIndex(h => h.includes('telefone') || h.includes('tel') || h.includes('fone'));
      const emailIdx = headers.findIndex(h => h.includes('email') || h.includes('e-mail'));
      const cidadeIdx = headers.findIndex(h => h.includes('cidade') || h.includes('município'));
      const nascimentoIdx = headers.findIndex(h => h.includes('nascimento') || h.includes('nasc'));

      const imported = [];
      for (let i = headerIdx + 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const cols = line.includes('"')
          ? (line.match(/(".*?"|[^";\s]+)(?=\s*;|\s*$)/g) || line.split(delimiter)).map(m => m.replace(/^["']|["']$/g, '').trim())
          : line.split(delimiter).map(c => c.trim());

        const rawNome = nomeIdx !== -1 && cols[nomeIdx] ? cols[nomeIdx] : '';
        if (!rawNome || rawNome.toLowerCase() === 'nome') continue;
        const nome = cleanAndTitleCaseName(rawNome);
        const telefone = telIdx !== -1 && cols[telIdx] ? cols[telIdx] : '(00) 00000-0000';
        const email = emailIdx !== -1 && cols[emailIdx] ? cols[emailIdx] : '';
        const cidade = cidadeIdx !== -1 && cols[cidadeIdx] ? cols[cidadeIdx] : 'Não informada';
        const nascimento = nascimentoIdx !== -1 && cols[nascimentoIdx] ? cols[nascimentoIdx] : null;

        const clientData = {
          name: nome,
          phone: telefone,
          email,
          birthdate: nascimento,
          status: 'ativo',
          avatar: nome.charAt(0).toUpperCase(),
          total_spent: 0,
          points: 0,
          user_id: currentUser?.id,
        };
        // Insert into Supabase
        const { data, error } = await insertClient(clientData);
        if (!error && data) imported.push(data);
      }

      if (imported.length > 0) {
        setPacientes(prev => [...prev, ...imported.map(item => ({
          id: item.id,
          nome: item.name,
          telefone: item.phone,
          email: item.email,
          cidade: 'Não informada',
          nascimento: item.birthdate ? item.birthdate.split('-').reverse().join('/') : '',
          ultimaVisita: 'Nunca',
          totalSessoes: item.points || 0,
          totalGasto: Number(item.total_spent) || 0,
          status: item.status || 'ativo',
          avatar: item.avatar || (item.name ? item.name.charAt(0).toUpperCase() : 'U')
        }))]);
        alert(`${imported.length} pacientes importados com sucesso!`);
      } else {
        alert('Nenhum paciente válido encontrado. Verifique as colunas de sua planilha.');
      }
    };
    reader.readAsText(file, 'UTF-8');
    e.target.value = '';
  };

  const handleSaveNovoPaciente = async (formData) => {
    const currentUser = await getCurrentUser();
    const clientData = {
      name: cleanAndTitleCaseName(formData.nome),
      phone: formData.telefone || '(00) 00000-0000',
      email: formData.email || '',
      instagram: formData.instagram || '',
      birthdate: formData.nascimento || null,
      status: 'ativo',
      avatar: formData.nome.charAt(0).toUpperCase(),
      total_spent: 0,
      points: 0,
      user_id: currentUser?.id,
    };

    const { data, error } = await insertClient(clientData);
    if (error) {
      alert('Erro ao salvar paciente no banco de dados: ' + (error.message || error));
      return;
    }

    if (data) {
      const novo = {
        id: data.id,
        nome: data.name,
        telefone: data.phone,
        email: data.email,
        instagram: data.instagram || '',
        cidade: 'Não informada',
        nascimento: data.birthdate ? data.birthdate.split('-').reverse().join('/') : '',
        ultimaVisita: 'Nunca',
        totalSessoes: data.points || 0,
        totalGasto: Number(data.total_spent) || 0,
        status: data.status,
        avatar: data.avatar,
        historico: []
      };
      setPacientes(prev => [...prev, novo]);
    }
    setModal(false);
  };

  const handleSaveEditPaciente = async (formData) => {
    const clientData = {
      name: cleanAndTitleCaseName(formData.nome),
      phone: formData.telefone || '(00) 00000-0000',
      email: formData.email || '',
      instagram: formData.instagram || '',
      birthdate: formData.nascimento || null,
      avatar: formData.nome.charAt(0).toUpperCase(),
    };

    const { data, error } = await updateClient(editModal.id, clientData);
    if (error) {
      alert('Erro ao atualizar paciente no banco de dados: ' + (error.message || error));
      return;
    }

    if (data) {
      setPacientes(prev => prev.map(p => {
        if (p.id === editModal.id) {
          const updated = {
            ...p,
            nome: data.name,
            telefone: data.phone,
            email: data.email,
            instagram: data.instagram || '',
            nascimento: data.birthdate ? data.birthdate.split('-').reverse().join('/') : '',
            avatar: data.avatar
          };
          if (selected && selected.id === updated.id) {
            setSelected(updated);
          }
          return updated;
        }
        return p;
      }));
    }
    setEditModal(null);
  };

  const handleDeletePaciente = async (id) => {
    const { error } = await deleteClient(id);
    if (error) {
      alert('Erro ao excluir paciente no banco de dados: ' + (error.message || error));
      return;
    }
    setPacientes(prev => prev.filter(p => p.id !== id));
    if (selected && selected.id === id) setSelected(null);
    setDeleteModal(null);
  };

  const filtrados = pacientes.filter(p =>
    p.nome.toLowerCase().includes(busca.toLowerCase()) || p.telefone.includes(busca)
  );

  return (
    <div>
      <div className="page-header" style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between'}}>
        <div>
          <div className="page-header-label"><Users />PACIENTES</div>
          <h1 className="page-title">Pacientes</h1>
          <p className="page-subtitle">{pacientes.length} pacientes cadastrados</p>
        </div>
        <div className="content-header">
          <button className="btn btn-secondary"><Upload />Importar Planilha</button>
          <input type="file" accept=".csv" style={{display:'none'}} id="import-csv" onChange={handleImportCSV} />
          <button className="btn btn-primary" onClick={()=>setModal(true)}><Plus />Novo Paciente</button>
        </div>

        {modal && <PacienteModal onClose={()=>setModal(false)} onSave={handleSaveNovoPaciente} />}
        {editModal && (
          <PacienteModal 
            onClose={()=>setEditModal(null)} 
            onSave={handleSaveEditPaciente} 
            initialData={{
              nome: editModal.nome,
              telefone: editModal.telefone,
              email: editModal.email,
              instagram: editModal.instagram,
              nascimento: editModal.nascimento ? editModal.nascimento.split('/').reverse().join('-') : '',
              cidade: editModal.cidade,
              obs: ''
            }} 
          />
        )}
        {deleteModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,20,30,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 11000, backdropFilter: 'blur(6px)', padding: 16 }} onClick={() => setDeleteModal(null)}>
            <div style={{ background: '#fff', borderRadius: 22, width: '100%', maxWidth: 400, boxShadow: '0 32px 80px rgba(0,0,0,0.25)', padding: '24px 24px' }} onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                  <AlertTriangle style={{ width: 28, height: 28, color: '#DC2626' }} />
                </div>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#111827', marginBottom: 12 }}>Excluir Paciente</div>
                <div style={{ fontSize: 14, color: '#4B5563', marginBottom: 24 }}>
                  Deseja realmente excluir o paciente <strong>"{deleteModal.nome}"</strong>?
                </div>
                <div style={{ display: 'flex', gap: 12, width: '100%' }}>
                  <button onClick={() => setDeleteModal(null)} style={{ flex: 1, padding: '12px 0', borderRadius: 12, border: '1.5px solid #E5E7EB', background: '#fff', fontSize: 14, fontWeight: 600, color: '#374151', cursor: 'pointer', transition: 'all 0.2s' }}>
                    Voltar
                  </button>
                  <button onClick={() => handleDeletePaciente(deleteModal.id)} style={{ flex: 1, padding: '12px 0', borderRadius: 12, border: 'none', background: '#DC2626', fontSize: 14, fontWeight: 600, color: '#fff', cursor: 'pointer', transition: 'all 0.2s' }}>
                    Excluir
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="grid-4 section-gap">
        {[
          {label:'Total',val:pacientes.length,cor:'var(--color-primary)'},
          {label:'Ativos',val:pacientes.filter(p=>p.status==='ativo').length,cor:'var(--success)'},
          {label:'Inativos',val:pacientes.filter(p=>p.status==='inativo').length,cor:'var(--warning)'},
          {label:'Novos este mês',val:2,cor:'var(--info)'},
        ].map(({label,val,cor})=>(
          <div key={label} className="stat-card" style={{textAlign:'center'}}>
            <div className="stat-value" style={{color:cor}}>{val}</div>
            <div className="stat-label">{label}</div>
          </div>
        ))}
      </div>

      <div style={{display:'flex',gap:16}}>
        <div style={{flex:1}}>
          <div className="card" style={{padding:0,overflow:'hidden'}}>
            <div style={{padding:'14px 20px',borderBottom:'1px solid var(--border-color)'}}>
              <div className="search-box">
                <Search />
                <input className="search-input" placeholder="Buscar paciente..." value={busca} onChange={e=>setBusca(e.target.value)} />
              </div>
            </div>
            <div className="table-wrapper">
              <table>
                <thead><tr>
                  <th>Paciente</th><th>Telefone</th><th>Última Visita</th><th>Sessões</th><th>Total Gasto</th><th>Status</th><th></th>
                </tr></thead>
                <tbody>
                  {filtrados.map(p=>(
                    <tr key={p.id} style={{cursor:'pointer',background:selected?.id===p.id?'var(--bg-card-hover)':''}} onClick={()=>setSelected(selected?.id===p.id?null:p)}>
                      <td>
                        <div style={{display:'flex',alignItems:'center',gap:10}}>
                          <div className="avatar">{p.avatar}</div>
                          <div>
                            <div style={{fontWeight:600,fontSize:13}}>{p.nome}</div>
                            <div style={{fontSize:11,color:'var(--text-muted)'}}>{p.email}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{fontSize:13,color:'var(--text-light)'}}>{p.telefone}</td>
                      <td style={{fontSize:13,color:'var(--text-light)'}}>{p.ultimaVisita}</td>
                      <td style={{fontWeight:600,textAlign:'center'}}>{p.totalSessoes}</td>
                      <td style={{fontWeight:600,color:'var(--success)'}}>R$ {p.totalGasto.toLocaleString('pt-BR')}</td>
                      <td><span className={`badge ${p.status==='ativo'?'badge-success':'badge-neutral'}`}>{p.status==='ativo'?'Ativo':'Inativo'}</span></td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteModal(p);
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
                            title="Excluir Paciente"
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
            </div>
          </div>
        </div>

        {selected && (
          <div style={{width:280}}>
            <div className="card">
              <div className="card-header">
                <span className="card-title"><FileText />Perfil</span>
                <button className="modal-close" onClick={()=>setSelected(null)}><XCircle /></button>
              </div>
              <div style={{textAlign:'center',marginBottom:16}}>
                <div className="avatar avatar-lg" style={{margin:'0 auto 8px'}}>{selected.avatar}</div>
                <div style={{fontWeight:700,fontSize:15,marginBottom:4}}>{selected.nome}</div>
                <span className={`badge ${selected.status==='ativo'?'badge-success':'badge-neutral'}`}>{selected.status==='ativo'?'Ativo':'Inativo'}</span>
              </div>
              <div className="divider"/>
              <div style={{display:'flex',flexDirection:'column',gap:9,fontSize:13}}>
                <div style={{display:'flex',gap:8,alignItems:'center',color:'var(--text-light)'}}><Phone style={{width:13,height:13}}/>{selected.telefone}</div>
                {selected.email && <div style={{display:'flex',gap:8,alignItems:'center',color:'var(--text-light)'}}><Mail style={{width:13,height:13}}/>{selected.email}</div>}
                {selected.instagram && <div style={{display:'flex',gap:8,alignItems:'center',color:'var(--text-light)'}}><Instagram style={{width:13,height:13}}/>{selected.instagram}</div>}
                {selected.nascimento && <div style={{display:'flex',gap:8,alignItems:'center',color:'var(--text-light)'}}><Calendar style={{width:13,height:13}}/>{selected.nascimento}</div>}
              </div>
              <div className="divider"/>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:12}}>
                <div style={{textAlign:'center',background:'var(--bg-main)',borderRadius:8,padding:'10px 6px'}}>
                  <div style={{fontSize:20,fontWeight:700,color:'var(--color-primary)'}}>{selected.totalSessoes}</div>
                  <div style={{fontSize:11,color:'var(--text-muted)'}}>Sessões</div>
                </div>
                <div style={{textAlign:'center',background:'var(--bg-main)',borderRadius:8,padding:'10px 6px'}}>
                  <div style={{fontSize:13,fontWeight:700,color:'var(--success)'}}>R${selected.totalGasto.toLocaleString('pt-BR')}</div>
                  <div style={{fontSize:11,color:'var(--text-muted)'}}>Gasto Total</div>
                </div>
              </div>
              <div style={{fontSize:12,fontWeight:600,color:'var(--text-medium)',marginBottom:8}}>Histórico de Sessões</div>
              {(selected.historico || historicoDefault).map((h,i)=>(
                <div key={i} className="alert-item">
                  <div>
                    <div className="alert-item-label">{h.servico}</div>
                    <div className="alert-item-sub">{h.data}</div>
                  </div>
                  <div style={{fontWeight:700,color:'var(--success)',fontSize:13}}>R$ {h.valor.toLocaleString('pt-BR')}</div>
                </div>
              ))}
              {(selected.historico || historicoDefault).length === 0 && (
                <div style={{fontSize:12, color:'var(--text-muted)', textAlign:'center', margin:'12px 0'}}>Nenhuma sessão finalizada.</div>
              )}
              <div style={{display:'flex',gap:6,marginTop:14}}>
                <button className="btn btn-secondary btn-sm" style={{flex:1}} onClick={() => setEditModal(selected)}>Editar</button>
                <button 
                  className="btn btn-ghost btn-sm" 
                  style={{flex:1,color:'#ef4444',borderColor:'rgba(239, 68, 68, 0.2)',display:'flex',alignItems:'center',justifyContent:'center',gap:4}}
                  onClick={() => setDeleteModal(selected)}
                >
                  <Trash2 style={{width:13,height:13}}/>Excluir
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
