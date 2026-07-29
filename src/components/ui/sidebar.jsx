import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Calendar,
  Users,
  UserCheck,
  Scissors,
  Package,
  ShoppingBag,
  BarChart3,
  ClipboardList,
  Megaphone,
  Coins,
  Wallet,
  Zap,
  CalendarDays,
  LogOut,
  Sparkles,
  ClipboardCheck,
  Target
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { fetchQueuePendingCount } from '../../services/supabaseService';

const menuItems = [
  { name: 'Dashboard', path: '/', icon: LayoutDashboard },
  { name: 'Agenda', path: '/agenda', icon: Calendar },
  { name: 'Pacientes', path: '/pacientes', icon: Users },
  { name: 'Anamnese', path: '/anamnese', icon: ClipboardCheck },
  { name: 'Equipe', path: '/equipe', icon: UserCheck },
  { name: 'Serviços', path: '/services', icon: Scissors },
  { name: 'Estoque', path: '/inventory', icon: Package },
  { name: 'Pacotes', path: '/packages', icon: ShoppingBag },
  { name: 'Relatórios', path: '/reports', icon: BarChart3 },
  { name: 'Estratégia', path: '/estrategia', icon: Target },
  { name: 'Tarefas', path: '/kanban', icon: ClipboardList },
  { name: 'Marketing', path: '/marketing', icon: Megaphone },
  { name: 'Motor', path: '/motor-marketing', icon: Zap, badgeKey: 'pending' },
  { name: 'Comissões', path: '/comissoes', icon: Coins },
  { name: 'Financeiro', path: '/financial', icon: Wallet },
  { name: 'Integrações', path: '/integration', icon: Zap },
];

const Sidebar = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [pendingCount, setPendingCount] = useState(0);

  // Poll pending messages count every 30s
  useEffect(() => {
    let cancelled = false;
    const fetch = async () => {
      try {
        const { data } = await fetchQueuePendingCount();
        if (!cancelled) setPendingCount(data || 0);
      } catch { /* silent */ }
    };
    fetch();
    const interval = setInterval(fetch, 30000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  const handleLogout = async (e) => {
    e.preventDefault();
    if (window.confirm('Deseja realmente sair do sistema?')) {
      await signOut();
      navigate('/login');
    }
  };

  return (
    <aside className="sidebar">
      {/* Brand Header */}
      <NavLink to="/" className="sidebar-logo">
        <div className="sidebar-logo-icon">
          <Sparkles className="w-5 h-5" />
        </div>
        <div className="sidebar-logo-info">
          <span className="sidebar-logo-title">Evelyn</span>
          <span className="sidebar-logo-subtitle">Esthetic Center</span>
        </div>
      </NavLink>

      {/* Navigation Top Items */}
      <nav className="sidebar-nav">
        {menuItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) => `sidebar-item${isActive ? ' active' : ''}`}
          >
            <span className="sidebar-item-icon">
              <item.icon className="w-5 h-5" />
            </span>
            <span className="sidebar-item-label">{item.name}</span>
            {item.badgeKey === 'pending' && pendingCount > 0 && (
              <span style={{
                marginLeft: 'auto',
                minWidth: 18, height: 18,
                padding: '0 5px',
                borderRadius: 99,
                fontSize: 10,
                fontWeight: 800,
                background: '#F39C12',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                lineHeight: 1,
                flexShrink: 0,
              }}>
                {pendingCount > 99 ? '99+' : pendingCount}
              </span>
            )}
            <span className="sidebar-tooltip">{item.name}</span>
          </NavLink>
        ))}
      </nav>

      {/* Navigation Bottom Items */}
      <div className="sidebar-bottom">
        {user && (
          <div style={{
            padding: '8px 12px',
            marginBottom: 8,
            borderRadius: 8,
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            fontSize: 11,
            color: 'rgba(249, 241, 236, 0.8)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}>
            <div style={{ fontSize: 9, textTransform: 'uppercase', color: '#EC4899', fontWeight: 700, letterSpacing: 0.5 }}>Conectado como</div>
            <div style={{ fontWeight: 600, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.email}</div>
          </div>
        )}

        <NavLink
          to="/client-booking"
          className={({ isActive }) => `sidebar-item sidebar-item-featured${isActive ? ' active' : ''}`}
        >
          <span className="sidebar-item-icon">
            <CalendarDays className="w-5 h-5" />
          </span>
          <span className="sidebar-item-label">Portal do Cliente</span>
          <span className="sidebar-tooltip">Portal do Cliente</span>
        </NavLink>

        <button
          onClick={handleLogout}
          className="sidebar-item"
          style={{ 
            border: 'none', 
            background: 'transparent',
            textAlign: 'left',
            width: '100%',
            color: 'rgba(249, 241, 236, 0.65)'
          }}
        >
          <span className="sidebar-item-icon">
            <LogOut className="w-5 h-5" />
          </span>
          <span className="sidebar-item-label">Sair</span>
          <span className="sidebar-tooltip">Sair</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;

