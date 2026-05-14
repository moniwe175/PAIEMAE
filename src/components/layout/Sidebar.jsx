import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  Calendar, Users, DollarSign, LayoutDashboard, 
  Package, Settings, BarChart3, Scissors
} from 'lucide-react';

const Sidebar = () => {
  const menuItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Agenda', path: '/agenda', icon: Calendar },
    { name: 'Pacientes', path: '/pacientes', icon: Users },
    { name: 'Financeiro', path: '/financial', icon: DollarSign },
    { name: 'Estoque', path: '/inventory', icon: Package },
    { name: 'Serviços', path: '/services', icon: Scissors },
    { name: 'Integrações', path: '/integration', icon: Settings },
    { name: 'Relatórios', path: '/reports', icon: BarChart3 },
  ];

  return (
    <aside className="w-64 border-r bg-card min-h-screen flex flex-col">
      <div className="p-6">
        <h1 className="text-xl font-bold tracking-tight text-foreground">Botox Clinic</h1>
      </div>
      
      <nav className="flex-1 px-4 space-y-1">
        {menuItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => `
                flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors
                ${isActive 
                  ? 'bg-primary text-primary-foreground' 
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'}
              `}
            >
              <Icon className="w-4 h-4" />
              {item.name}
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
};

export default Sidebar;
