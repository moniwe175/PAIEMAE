import React from 'react';
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
  ClipboardCheck
} from 'lucide-react';

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
  { name: 'Tarefas', path: '/kanban', icon: ClipboardList },
  { name: 'Marketing', path: '/marketing', icon: Megaphone },
  { name: 'Comissões', path: '/comissoes', icon: Coins },
  { name: 'Financeiro', path: '/financial', icon: Wallet },
  { name: 'Integrações', path: '/integration', icon: Zap },
];

const Sidebar = () => {
  const navigate = useNavigate();

  const handleLogout = (e) => {
    e.preventDefault();
    if (window.confirm('Deseja realmente sair do sistema?')) {
      // Aqui ficaria a lógica de logout. Por enquanto, apenas redireciona para a home
      navigate('/');
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
            <span className="sidebar-tooltip">{item.name}</span>
          </NavLink>
        ))}
      </nav>

      {/* Navigation Bottom Items */}
      <div className="sidebar-bottom">
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
