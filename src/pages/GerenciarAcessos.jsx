import { useState, useEffect } from 'react';
import {
  Shield, Loader2, Lock, UserPlus, ExternalLink,
  DollarSign, Zap, Settings, Save, CheckCircle, RefreshCw, AlertTriangle,
} from 'lucide-react';

import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

const MODULES = [
  { key: 'financeiro', label: 'Financeiro', icon: DollarSign, desc: 'Caixa, sangrias, comissões, despesas, faturamento, relatórios' },
  { key: 'integracoes', label: 'Integrações', icon: Zap, desc: 'Planilhas, WhatsApp, automações de marketing' },
  { key: 'operacional', label: 'Operacional', icon: Settings, desc: 'Clientes, agenda, anamneses, estoque, pacotes, profissionais, serviços' },
];

const DEFAULT_PERMS = { financeiro: false, integracoes: false, operacional: true };

// ─── Main Component ──────────────────────────────────────────
export default function GerenciarAcessos() {
  const { user } = useAuth();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null); // id of member being saved
  const [saved, setSaved] = useState(null);
  const [error, setError] = useState(null);
  const [isAdmin, setIsAdmin] = useState(null); // null = loading

  // Load current user's role + team list
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Check if current user is admin (own profile is always readable via RLS)
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

        // Fetch all team members via pre-existing RPC
        const { data, error: rpcError } = await supabase.rpc('list_team_members');
        if (cancelled) return;

        if (rpcError) {
          setError(rpcError.message);
        } else {
          setMembers(data || []);
        }
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  // Save role + permissions for a member
  const handleSave = async (member) => {
    setSaving(member.id);
    setError(null);
    setSaved(null);

    const updateData = {
      role: member.role,
      permissions: member.role === 'admin'
        ? { ...DEFAULT_PERMS, financeiro: true, integracoes: true, operacional: true }
        : member.permissions,
    };

    const { error: saveError } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', member.id);

    if (saveError) {
      setError(saveError.message);
    } else {
      setSaved(member.id);
      setTimeout(() => setSaved(null), 2500);
    }
    setSaving(null);
  };

  // Toggle admin role with self-demotion confirmation
  const handleAdminToggle = (memberId, checked) => {
    if (memberId === user.id && !checked) {
      if (!window.confirm(
        'Tem certeza que deseja remover seu próprio acesso de administrador?\n\n' +
        'Você perderá acesso a esta tela e não poderá reverter sem ajuda de outro administrador.'
      )) {
        return;
      }
    }

    setMembers(prev => prev.map(m => {
      if (m.id !== memberId) return m;
      return {
        ...m,
        role: checked ? 'admin' : 'staff',
        permissions: checked
          ? { financeiro: true, integracoes: true, operacional: true }
          : (m.permissions || { ...DEFAULT_PERMS }),
      };
    }));
  };

  // Toggle a module permission
  const handlePermToggle = (memberId, key, checked) => {
    setMembers(prev => prev.map(m => {
      if (m.id !== memberId) return m;
      return { ...m, permissions: { ...(m.permissions || {}), [key]: checked } };
    }));
  };

  const reload = async () => {
    setLoading(true);
    setError(null);
    const { data, error: rpcError } = await supabase.rpc('list_team_members');
    if (rpcError) setError(rpcError.message);
    else setMembers(data || []);
    setLoading(false);
  };

  // ─── Loading State ─────────────────────────────────────────
  if (loading) {
    return (
      <div className="page-header" style={{ textAlign: 'center', padding: '80px 0' }}>
        <Loader2 style={{ width: 32, height: 32, color: 'var(--color-primary)', animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
        <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Carregando equipe...</p>
      </div>
    );
  }

  // ─── Access Denied ─────────────────────────────────────────
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
          Entre em contato com o administrador do sistema se precisar de alterações.
        </p>
      </div>
    );
  }

  // ─── Main Render ───────────────────────────────────────────
  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <div className="page-header-label">
          <Shield style={{ width: 14, height: 14 }} />
          Configurações
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 className="page-title">Gerenciar Acessos</h1>
            <p className="page-subtitle">
              Configure as permissões de cada membro da equipe no sistema
            </p>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={reload}>
            <RefreshCw style={{ width: 14, height: 14 }} />
            Atualizar
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div style={{
          background: 'var(--danger-bg)', border: '1px solid #F5C2C7',
          borderRadius: 'var(--radius-md)', padding: '12px 16px',
          marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <AlertTriangle style={{ width: 16, height: 16, color: 'var(--danger)', flexShrink: 0 }} />
          <span style={{ fontSize: 13, color: 'var(--danger)', flex: 1 }}>{error}</span>
          <button
            onClick={() => setError(null)}
            style={{
              background: 'none', border: 'none', color: 'var(--danger)',
              cursor: 'pointer', fontSize: 12, fontWeight: 600,
            }}
          >
            Fechar
          </button>
        </div>
      )}

      {/* Team List */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <div className="card-title">
            Equipe Cadastrada
            <span style={{
              background: 'var(--color-accent-soft)', color: 'var(--color-accent)',
              borderRadius: 99, padding: '2px 10px', fontSize: 12, fontWeight: 600,
            }}>
              {members.length} {members.length === 1 ? 'usuário' : 'usuários'}
            </span>
          </div>
        </div>

        {members.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
            <p style={{ fontSize: 14, margin: 0 }}>
              Nenhum membro encontrado na equipe.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {members.map(member => (
              <MemberRow
                key={member.id}
                member={member}
                isCurrentUser={member.id === user.id}
                saving={saving === member.id}
                saved={saved === member.id}
                onAdminToggle={(checked) => handleAdminToggle(member.id, checked)}
                onPermToggle={(key, checked) => handlePermToggle(member.id, key, checked)}
                onSave={() => handleSave(member)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Invite Section */}
      <div className="card" style={{
        borderColor: 'var(--color-accent)',
        background: 'var(--info-bg)',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: 'var(--color-primary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <UserPlus style={{ width: 20, height: 20, color: '#fff' }} />
          </div>
          <div>
            <h3 style={{
              fontSize: 15, fontWeight: 700, color: 'var(--text-dark)',
              margin: '0 0 6px',
            }}>
              Convidar novo acesso
            </h3>
            <p style={{
              fontSize: 13, color: 'var(--text-medium)', margin: '0 0 12px',
              lineHeight: 1.6,
            }}>
              Para criar um novo login, acesse o painel do Supabase e envie um convite.
              O perfil será criado automaticamente como <strong>staff</strong> com permissões
              básicas, e você poderá configurar os acessos aqui depois.
            </p>
            <div style={{
              background: 'var(--bg-card)', borderRadius: 'var(--radius-sm)',
              padding: '12px 16px', border: '1px solid var(--border-color)',
              fontSize: 13, color: 'var(--text-medium)', lineHeight: 1.8,
            }}>
              <strong>Passo a passo:</strong>
              <ol style={{ margin: '6px 0 0', paddingLeft: 20 }}>
                <li>
                  Acesse o{' '}
                  <a
                    href="https://supabase.com/dashboard"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: 'var(--color-primary)', fontWeight: 600 }}
                  >
                    painel do Supabase <ExternalLink style={{ width: 11, height: 11, display: 'inline', verticalAlign: 'middle' }} />
                  </a>
                </li>
                <li>Vá em <strong>Authentication → Users → Add user → Send invitation</strong></li>
                <li>Insira o email da pessoa e envie o convite</li>
                <li>Volte aqui e clique em <strong>Atualizar</strong> para configurar as permissões</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Member Row ──────────────────────────────────────────────
function MemberRow({ member, isCurrentUser, saving, saved, onAdminToggle, onPermToggle, onSave }) {
  const isStaff = member.role !== 'admin';
  const perms = member.permissions || {};

  return (
    <div style={{
      padding: '18px 20px',
      borderRadius: 'var(--radius-md)',
      border: `1px solid ${isCurrentUser ? 'var(--color-primary)' : 'var(--border-color)'}`,
      background: isCurrentUser ? 'var(--color-accent-soft)' : 'var(--bg-card)',
      transition: 'all 0.15s ease',
    }}>
      {/* Header: name + admin toggle */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 14, flexWrap: 'wrap', gap: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: member.role === 'admin' ? 'var(--color-primary)' : 'var(--color-accent-soft)',
            color: member.role === 'admin' ? '#fff' : 'var(--color-primary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 700, fontSize: 14, flexShrink: 0,
          }}>
            {(member.full_name || member.email || '?').charAt(0).toUpperCase()}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{
              fontWeight: 600, fontSize: 14, color: 'var(--text-dark)',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {member.full_name || member.email || 'Sem nome'}
              </span>
              {isCurrentUser && (
                <span style={{
                  fontSize: 10, fontWeight: 700,
                  background: 'var(--color-primary)', color: '#fff',
                  padding: '2px 8px', borderRadius: 99,
                  textTransform: 'uppercase', letterSpacing: '0.04em',
                  flexShrink: 0,
                }}>
                  Você
                </span>
              )}
            </div>
            <div style={{
              fontSize: 12, color: 'var(--text-muted)',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              {member.email}
              {member.created_at && (
                <>
                  <span>•</span>
                  <span>Desde {new Date(member.created_at).toLocaleDateString('pt-BR')}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Admin toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            fontSize: 12, fontWeight: 600,
            color: member.role === 'admin' ? 'var(--color-primary)' : 'var(--text-muted)',
          }}>
            {member.role === 'admin' ? 'Administrador' : 'Staff'}
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={member.role === 'admin'}
            onClick={() => onAdminToggle(member.role !== 'admin')}
            style={{
              width: 42, height: 24,
              borderRadius: 99,
              border: 'none',
              cursor: 'pointer',
              position: 'relative',
              padding: 0,
              background: member.role === 'admin' ? 'var(--color-primary)' : 'var(--border-color)',
              transition: 'background 0.2s',
              flexShrink: 0,
            }}
          >
            <span style={{
              display: 'block',
              width: 18, height: 18,
              borderRadius: '50%',
              background: '#fff',
              transition: 'transform 0.2s',
              transform: member.role === 'admin' ? 'translateX(21px)' : 'translateX(3px)',
              boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
            }} />
          </button>
        </div>
      </div>

      {/* Module Permissions (disabled for admin) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 10,
        opacity: isStaff ? 1 : 0.35,
        pointerEvents: isStaff ? 'auto' : 'none',
        filter: isStaff ? 'none' : 'grayscale(0.5)',
        transition: 'opacity 0.2s',
      }}>
        {MODULES.map(({ key, label, icon: Icon, desc }) => (
          <label key={key} style={{
            display: 'flex', alignItems: 'flex-start', gap: 10,
            padding: '10px 14px', borderRadius: 'var(--radius-sm)',
            background: 'var(--bg-main)', cursor: 'pointer',
            border: `1px solid ${perms[key] ? 'var(--color-primary)' : 'transparent'}`,
            transition: 'all 0.15s',
          }}>
            <input
              type="checkbox"
              checked={!!perms[key]}
              onChange={(e) => onPermToggle(key, e.target.checked)}
              style={{ marginTop: 2, accentColor: 'var(--color-primary)', cursor: 'pointer' }}
            />
            <div>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                fontSize: 13, fontWeight: 600, color: 'var(--text-dark)',
              }}>
                <Icon style={{ width: 14, height: 14, color: 'var(--color-primary)' }} />
                {label}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, lineHeight: 1.4 }}>
                {desc}
              </div>
            </div>
          </label>
        ))}
      </div>

      {/* Save Button */}
      <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end' }}>
        <button
          className="btn btn-sm"
          onClick={onSave}
          disabled={saving}
          style={saved
            ? { background: 'var(--success)', color: '#fff', border: 'none' }
            : { background: 'var(--color-primary)', color: '#fff', border: 'none' }
          }
        >
          {saving ? (
            <><Loader2 style={{ width: 14, height: 14, animation: 'spin 1s linear infinite' }} /> Salvando...</>
          ) : saved ? (
            <><CheckCircle style={{ width: 14, height: 14 }} /> Salvo</>
          ) : (
            <><Save style={{ width: 14, height: 14 }} /> Salvar</>
          )}
        </button>
      </div>
    </div>
  );
}
