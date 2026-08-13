import { useState, useEffect } from 'react';
import {
  Shield, Loader2, Lock, UserPlus, ExternalLink,
  Plus, Edit3, Trash2, X, Check, Save, RefreshCw, AlertTriangle, Briefcase, Users
} from 'lucide-react';

import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { INITIAL_ROLES } from '../lib/defaultRoles';

// Exact modules matching the user's clinic system:
const MODULE_LIST = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'agenda', label: 'Agenda' },
  { key: 'pacientes', label: 'Pacientes' },
  { key: 'anamnese', label: 'Anamnese' },
  { key: 'equipe', label: 'Equipe' },
  { key: 'servicos', label: 'Serviços' },
  { key: 'estoque', label: 'Estoque' },
  { key: 'pacotes', label: 'Pacotes' },
  { key: 'relatorios', label: 'Relatórios' },
  { key: 'estrategia', label: 'Estratégia' },
  { key: 'tarefas', label: 'Tarefas' },
  { key: 'marketing', label: 'Marketing' },
  { key: 'motor', label: 'Motor' },
  { key: 'comissoes', label: 'Comissões' },
  { key: 'financeiro', label: 'Financeiro' },
  { key: 'integracoes', label: 'Integrações' },
  { key: 'acessos', label: 'Acessos' },
];

export default function GerenciarAcessos() {
  const { user } = useAuth();
  const [members, setMembers] = useState([]);
  // Cargos vêm da tabela public.roles (fonte da verdade no banco)
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null);
  const [savedMemberId, setSavedMemberId] = useState(null);
  const [error, setError] = useState(null);
  const [isAdmin, setIsAdmin] = useState(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [roleFormName, setRoleFormName] = useState('');
  const [roleFormPerms, setRoleFormPerms] = useState({});

  // Carrega cargos da tabela roles (com fallback para seed local se a tabela ainda não existir)
  const loadRoles = async () => {
    const { data, error: rolesError } = await supabase
      .from('roles')
      .select('id, name, description, permissions');
    if (rolesError) {
      if (/roles/.test(rolesError.message)) {
        setRoles(INITIAL_ROLES);
        setError('Tabela "roles" não encontrada no banco. Execute cargos_permissions_schema.sql no SQL Editor do Supabase.');
      } else {
        setError(rolesError.message);
      }
      return;
    }
    setRoles((data || []).map(r => ({ id: r.id, name: r.name, description: r.description, permissions: r.permissions || {} })));
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();

        if (cancelled) return;

        if (profile?.role !== 'admin') {
          setIsAdmin(false);
          setLoading(false);
          return;
        }

        setIsAdmin(true);
        await loadRoles();
        const { data, error: rpcError } = await supabase.rpc('list_team_members');
        if (cancelled) return;

        if (rpcError) {
          setError(rpcError.message);
        } else {
          setMembers((data || []).map(m => ({
            ...m,
            assignedRole: m.role === 'admin' ? 'admin' : (m.cargo || 'Recepcionista')
          })));
        }
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  // Open Modal for Create or Edit
  const handleOpenModal = (roleToEdit = null) => {
    if (roleToEdit) {
      setEditingRole(roleToEdit);
      setRoleFormName(roleToEdit.name);
      setRoleFormPerms(roleToEdit.permissions || {});
    } else {
      setEditingRole(null);
      setRoleFormName('');
      setRoleFormPerms({});
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingRole(null);
    setRoleFormName('');
    setRoleFormPerms({});
  };

  // Toggle Modal Perms
  const handleTogglePerm = (modKey, type) => {
    setRoleFormPerms(prev => {
      const currentMod = prev[modKey] || { ver: false, edit: false };
      const nextMod = { ...currentMod, [type]: !currentMod[type] };

      // If disabling "ver", also disable "edit"
      if (type === 'ver' && !nextMod.ver) {
        nextMod.edit = false;
      }
      // If enabling "edit", auto enable "ver"
      if (type === 'edit' && nextMod.edit) {
        nextMod.ver = true;
      }

      return { ...prev, [modKey]: nextMod };
    });
  };

  const handleToggleVerTudo = (modKey) => {
    setRoleFormPerms(prev => {
      const currentMod = prev[modKey] || { ver: false, edit: false };
      const allActive = currentMod.ver && currentMod.edit;
      return {
        ...prev,
        [modKey]: { ver: !allActive, edit: !allActive }
      };
    });
  };

  const handleSaveRole = async () => {
    if (!roleFormName.trim()) {
      alert('Por favor, digite o nome do cargo.');
      return;
    }

    const updatedRoleName = roleFormName.trim();
    const updatedPerms = roleFormPerms;

    if (editingRole) {
      const { error: updError } = await supabase
        .from('roles')
        .update({ name: updatedRoleName, permissions: updatedPerms })
        .eq('id', editingRole.id);
      if (updError) {
        setError(updError.message);
        return;
      }
      setRoles(prev => prev.map(r => r.id === editingRole.id ? {
        ...r,
        name: updatedRoleName,
        permissions: updatedPerms
      } : r));

      // Atualizar no Supabase todos os colaboradores vinculados a este cargo
      const membersToUpdate = members.filter(m => m.assignedRole === editingRole.name || m.cargo === editingRole.name);
      for (const m of membersToUpdate) {
        if (m.role !== 'admin') {
          await supabase
            .from('profiles')
            .update({ cargo: updatedRoleName, permissions: updatedPerms })
            .eq('id', m.id);
        }
      }
      // Reflete o novo cargo/permissoes na lista local de membros
      setMembers(prev => prev.map(m =>
        (m.assignedRole === editingRole.name || m.cargo === editingRole.name) && m.role !== 'admin'
          ? { ...m, cargo: updatedRoleName, permissions: updatedPerms, assignedRole: updatedRoleName }
          : m
      ));
    } else {
      const newId = `role_${Date.now()}`;
      const { error: insError } = await supabase
        .from('roles')
        .insert({ id: newId, name: updatedRoleName, permissions: updatedPerms });
      if (insError) {
        setError(insError.message);
        return;
      }
      setRoles(prev => [...prev, { id: newId, name: updatedRoleName, permissions: updatedPerms }]);
    }
    handleCloseModal();
  };

  const handleDeleteRole = async (roleId) => {
    const role = roles.find(r => r.id === roleId);
    if (!role) return;
    const inUse = members.some(m => m.role !== 'admin' && (m.assignedRole === role.name || m.cargo === role.name));
    if (inUse) {
      alert('Este cargo não pode ser excluído: há colaboradores vinculados a ele.');
      return;
    }
    if (window.confirm('Tem certeza que deseja excluir este cargo?')) {
      const { error: delError } = await supabase.from('roles').delete().eq('id', roleId);
      if (delError) {
        setError(delError.message);
        return;
      }
      setRoles(prev => prev.filter(r => r.id !== roleId));
      handleCloseModal();
    }
  };

  const handleMemberRoleChange = (memberId, roleName) => {
    setMembers(prev => prev.map(m => {
      if (m.id !== memberId) return m;
      const isAdm = roleName === 'admin';
      return {
        ...m,
        role: isAdm ? 'admin' : roleName,
        assignedRole: roleName
      };
    }));
  };

  const handleSaveMember = async (member) => {
    setSaving(member.id);
    setError(null);
    setSavedMemberId(null);

    const isAdm = member.role === 'admin';
    const matchedRoleObj = roles.find(r => r.name === member.assignedRole);

    const updateData = {
      role: isAdm ? 'admin' : 'staff',
      cargo: isAdm ? 'Administrador' : (member.assignedRole || member.cargo || 'Recepcionista'),
      permissions: isAdm
        ? { admin: true }
        : matchedRoleObj ? matchedRoleObj.permissions : (member.permissions || {})
    };

    const { error: saveError } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', member.id);

    if (saveError) {
      setError(saveError.message);
    } else {
      setSavedMemberId(member.id);
      setTimeout(() => setSavedMemberId(null), 2500);
    }
    setSaving(null);
  };

  const reload = async () => {
    setLoading(true);
    setError(null);
    await loadRoles();
    const { data, error: rpcError } = await supabase.rpc('list_team_members');
    if (rpcError) setError(rpcError.message);
    else setMembers((data || []).map(m => ({
      ...m,
      assignedRole: m.role === 'admin' ? 'admin' : (m.cargo || 'Recepcionista')
    })));
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="page-header" style={{ textAlign: 'center', padding: '80px 0' }}>
        <Loader2 style={{ width: 32, height: 32, color: 'var(--color-primary)', animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
        <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Carregando permissões e equipe...</p>
      </div>
    );
  }

  if (isAdmin === false) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 24px' }}>
        <div style={{
          width: 64, height: 64, borderRadius: 16,
          background: 'var(--danger-bg)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
        }}>
          <Lock style={{ width: 28, height: 28, color: 'var(--danger)' }} />
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-dark)', marginBottom: 8 }}>
          Acesso Restrito
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 14, maxWidth: 400, margin: '0 auto' }}>
          Apenas administradores podem acessar as configurações de acesso da equipe.
        </p>
      </div>
    );
  }

  return (
    <div style={{ paddingBottom: 40 }}>
      {/* Header */}
      <div className="page-header" style={{ marginBottom: 24 }}>
        <div className="page-header-label" style={{ color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 12 }}>
          <Shield style={{ width: 14, height: 14 }} />
          CONFIGURAÇÕES
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h1 className="page-title" style={{ fontSize: 28, fontWeight: 800, margin: 0, color: 'var(--text-dark)' }}>Gestão de Cargos</h1>
            <p className="page-subtitle" style={{ margin: '4px 0 0', color: 'var(--text-muted)' }}>
              Cadastro de funções, cargos e permissões de acesso por setor do sistema
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-ghost btn-sm" onClick={reload} style={{ color: 'var(--text-medium)', borderColor: 'var(--border-color)' }}>
              <RefreshCw style={{ width: 14, height: 14 }} />
              Atualizar
            </button>
            <button
              onClick={() => handleOpenModal()}
              style={{
                background: 'var(--sidebar-bg)',
                color: '#fff',
                border: 'none',
                padding: '10px 18px',
                borderRadius: 'var(--radius-sm)',
                fontWeight: 600,
                fontSize: 14,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                cursor: 'pointer',
                boxShadow: 'var(--shadow-sm)',
                transition: 'opacity 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
              onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
            >
              <Plus style={{ width: 16, height: 16 }} />
              Novo Cargo
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div style={{
          background: 'var(--danger-bg)', border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-sm)', padding: '12px 16px', marginBottom: 20,
          display: 'flex', alignItems: 'center', gap: 10, color: 'var(--danger)'
        }}>
          <AlertTriangle style={{ width: 16, height: 16 }} />
          <span style={{ fontSize: 13, flex: 1 }}>{error}</span>
          <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}>Fechar</button>
        </div>
      )}

      {/* Roles Cards Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: 16,
        marginBottom: 36
      }}>
        {roles.map(role => (
          <div
            key={role.id}
            onClick={() => handleOpenModal(role)}
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              padding: 20,
              display: 'flex',
              flexDirection: 'column',
              justify: 'space-between',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              boxShadow: 'var(--shadow-sm)',
              position: 'relative'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--color-primary)';
              e.currentTarget.style.background = 'var(--bg-card-hover)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-color)';
              e.currentTarget.style.background = 'var(--bg-card)';
            }}
          >
            <div>
              <div style={{
                width: 44,
                height: 44,
                borderRadius: 'var(--radius-sm)',
                background: 'var(--color-accent-soft)',
                color: 'var(--sidebar-bg)',
                display: 'flex',
                alignItems: 'center',
                justify: 'center',
                marginBottom: 16
              }}>
                <Briefcase style={{ width: 22, height: 22 }} />
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-dark)', margin: '0 0 12px' }}>
                {role.name}
              </h3>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', fontSize: 13 }}>
              <Users style={{ width: 14, height: 14 }} />
              <span>
                {members.filter(m => m.role !== 'admin' && (m.assignedRole === role.name || m.cargo === role.name)).length}{' '}
                {members.filter(m => m.role !== 'admin' && (m.assignedRole === role.name || m.cargo === role.name)).length === 1 ? 'colaborador' : 'colaboradores'}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Team Member Roles Assignment Section */}
      <div className="card" style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', padding: 24, marginBottom: 24, boxShadow: 'var(--shadow-sm)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-dark)', margin: 0 }}>Gerenciar Acessos da Equipe</h2>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '4px 0 0' }}>Associe cada membro ao seu cargo para liberar ou restringir telas</p>
          </div>
          <span style={{ background: 'var(--color-accent-soft)', color: 'var(--text-dark)', borderRadius: 99, padding: '4px 12px', fontSize: 12, fontWeight: 600 }}>
            {members.length} {members.length === 1 ? 'usuário' : 'usuários'}
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {members.map(member => {
            const isCurrentUser = member.id === user.id;
            return (
              <div key={member.id} style={{
                display: 'flex',
                alignItems: 'center',
                justify: 'space-between',
                padding: '14px 18px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-color)',
                background: isCurrentUser ? 'var(--color-accent-soft)' : 'var(--bg-card)',
                flexWrap: 'wrap',
                gap: 12
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 240 }}>
                  <div style={{
                    width: 38, height: 38, borderRadius: 'var(--radius-sm)',
                    background: member.role === 'admin' ? 'var(--sidebar-bg)' : 'var(--border-color)',
                    color: member.role === 'admin' ? '#fff' : 'var(--text-dark)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 700, fontSize: 15
                  }}>
                    {(member.full_name || member.email || '?').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-dark)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      {member.full_name || member.email}
                      {isCurrentUser && (
                        <span style={{ fontSize: 10, background: 'var(--sidebar-bg)', color: '#fff', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>você</span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{member.email}</div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  {/* Select Cargo */}
                  <select
                    value={member.role === 'admin' ? 'admin' : (member.assignedRole || roles[0]?.name)}
                    onChange={(e) => handleMemberRoleChange(member.id, e.target.value)}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-color)',
                      fontSize: 13,
                      color: 'var(--text-dark)',
                      background: 'var(--bg-card)',
                      outline: 'none'
                    }}
                  >
                    <option value="admin">Administrador (Acesso Total)</option>
                    <optgroup label="Cargos Cadastrados">
                      {roles.map(r => (
                        <option key={r.id} value={r.name}>{r.name}</option>
                      ))}
                    </optgroup>
                  </select>

                  <button
                    onClick={() => handleSaveMember(member)}
                    disabled={saving === member.id}
                    style={{
                      background: savedMemberId === member.id ? 'var(--success)' : 'var(--sidebar-bg)',
                      color: '#fff',
                      border: 'none',
                      padding: '8px 16px',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6
                    }}
                  >
                    {saving === member.id ? (
                      <Loader2 style={{ width: 14, height: 14, animation: 'spin 1s linear infinite' }} />
                    ) : savedMemberId === member.id ? (
                      <Check style={{ width: 14, height: 14 }} />
                    ) : (
                      <Save style={{ width: 14, height: 14 }} />
                    )}
                    {savedMemberId === member.id ? 'Salvo' : 'Salvar'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Invite Box */}
      <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <UserPlus style={{ width: 20, height: 20, color: 'var(--sidebar-bg)', marginTop: 2 }} />
          <div>
            <h4 style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 700, color: 'var(--text-dark)' }}>Convidar Novo Acesso</h4>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>
              Para criar novos acessos, adicione os usuários no painel do Supabase e atribua o cargo correspondente nesta página.
            </p>
          </div>
        </div>
      </div>

      {/* ─── MODAL EDITAR / NOVO CARGO ─── */}
      {isModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(67, 47, 45, 0.4)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justify: 'center',
          zIndex: 9999,
          padding: 20
        }}>
          <div style={{
            background: '#fff',
            borderRadius: 'var(--radius-lg)',
            width: '100%',
            maxWidth: 760,
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: 'var(--shadow-lg)',
            overflow: 'hidden',
            border: '1px solid var(--border-color)'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '20px 24px',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justify: 'space-between',
              background: 'var(--bg-main)'
            }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-dark)', margin: 0 }}>
                {editingRole ? 'Editar Cargo' : 'Novo Cargo'}
              </h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {editingRole && (
                  <button
                    onClick={() => handleDeleteRole(editingRole.id)}
                    style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: 4 }}
                    title="Excluir cargo"
                  >
                    <Trash2 style={{ width: 18, height: 18 }} />
                  </button>
                )}
                <button
                  onClick={handleCloseModal}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }}
                >
                  <X style={{ width: 20, height: 20 }} />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div style={{ padding: 24, overflowY: 'auto', flex: 1 }}>
              {/* Nome do Cargo Input */}
              <div style={{ marginBottom: 24 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-dark)', marginBottom: 6 }}>
                  Nome do Cargo *
                </label>
                <input
                  type="text"
                  value={roleFormName}
                  onChange={(e) => setRoleFormName(e.target.value)}
                  placeholder="Ex: Recepcionista, Atendente, Gerente..."
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-color)',
                    fontSize: 14,
                    outline: 'none',
                    color: 'var(--text-dark)',
                    background: '#fff',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Title Permissões */}
              <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-dark)', margin: '0 0 16px' }}>
                Permissões de Acesso
              </h4>

              {/* Modules Grid (2 Columns) */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                gap: 12
              }}>
                {MODULE_LIST.map(mod => {
                  const perm = roleFormPerms[mod.key] || { ver: false, edit: false };
                  const isVerTudo = perm.ver && perm.edit;

                  return (
                    <div key={mod.key} style={{
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '12px 16px',
                      background: 'var(--bg-main)',
                      display: 'flex',
                      alignItems: 'center',
                      justify: 'space-between'
                    }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-dark)' }}>
                        {mod.label}
                      </span>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                        {/* Ver Checkbox */}
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12, fontWeight: 500, color: perm.ver ? 'var(--sidebar-bg)' : 'var(--text-muted)' }}>
                          <input
                            type="checkbox"
                            checked={perm.ver}
                            onChange={() => handleTogglePerm(mod.key, 'ver')}
                            style={{ accentColor: 'var(--sidebar-bg)', cursor: 'pointer' }}
                          />
                          Ver
                        </label>

                        {/* Edit Checkbox */}
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12, fontWeight: 500, color: perm.edit ? 'var(--sidebar-bg)' : 'var(--text-muted)' }}>
                          <input
                            type="checkbox"
                            checked={perm.edit}
                            onChange={() => handleTogglePerm(mod.key, 'edit')}
                            style={{ accentColor: 'var(--sidebar-bg)', cursor: 'pointer' }}
                          />
                          Edit
                        </label>

                        {/* Ver Tudo Special Action */}
                        <button
                          type="button"
                          onClick={() => handleToggleVerTudo(mod.key)}
                          style={{
                            background: 'none',
                            border: 'none',
                            fontSize: 11,
                            fontWeight: 700,
                            color: isVerTudo ? 'var(--danger)' : 'var(--text-light)',
                            cursor: 'pointer',
                            padding: 0
                          }}
                        >
                          {isVerTudo ? 'Ver Tudo' : ''}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '16px 24px',
              borderTop: '1px solid var(--border-color)',
              display: 'flex',
              justify: 'flex-end',
              gap: 12,
              background: '#fff'
            }}>
              <button
                onClick={handleCloseModal}
                style={{
                  background: 'var(--bg-main)',
                  color: 'var(--text-dark)',
                  border: '1px solid var(--border-color)',
                  padding: '10px 18px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveRole}
                style={{
                  background: 'var(--sidebar-bg)',
                  color: '#fff',
                  border: 'none',
                  padding: '10px 20px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: 'var(--shadow-sm)'
                }}
              >
                Salvar Cargo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
