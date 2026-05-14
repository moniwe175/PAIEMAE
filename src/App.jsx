import React from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Calendar, Users, Scissors, Package,
  DollarSign, BarChart3, Settings, Star, Award, UserCheck,
  Megaphone, LogOut, ChevronRight, Zap, ShoppingBag
} from 'lucide-react';

// Import all pages
import Dashboard from './pages/Dashboard';
import Agenda from './pages/Agenda';
import Pacientes from './pages/Pacientes';
import Clients from './pages/Clients';
import Kanban from './pages/Kanban';
import Financial from './pages/Financial';
import Comissoes from './pages/Comissoes';
import Inventory from './pages/Inventory';
import Services from './pages/Services';
import Packages from './pages/Packages';
import Equipe from './pages/Equipe';
import Marketing from './pages/Marketing';
import Integration from './pages/Integration';
import Reports from './pages/Reports';
import ClientBooking from './pages/ClientBooking';

const menuTop = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
  { icon: Calendar, label: 'Agenda', path: '/agenda' },
  { icon: Users, label: 'Pacientes', path: '/pacientes' },
  { icon: UserCheck, label: 'Clientes', path: '/clients' },
  { icon: Scissors, label: 'Serviços', path: '/services' },
  { icon: ShoppingBag, label: 'Pacotes', path: '/packages' },
  { icon: Package, label: 'Estoque', path: '/inventory' },
  { icon: DollarSign, label: 'Financeiro', path: '/financial' },
  { icon: Award, label: 'Comissões', path: '/comissoes' },
  { icon: Star, label: 'Kanban', path: '/kanban' },
  { icon: BarChart3, label: 'Relatórios', path: '/reports' },
  { icon: Megaphone, label: 'Marketing', path: '/marketing' },
  { icon: Zap, label: 'Equipe', path: '/equipe' },
];

const menuBottom = [
  { icon: Settings, label: 'Integrações', path: '/integration' },
  { icon: ChevronRight, label: 'Agendamento Online', path: '/client-booking' },
];

function SidebarItem({ icon: Icon, label, path }) {
  return (
    <NavLink
      to={path}
      end={path === '/'}
      className={({ isActive }) => `sidebar-item${isActive ? ' active' : ''}`}
    >
      <Icon />
      <span className="sidebar-tooltip">{label}</span>
    </NavLink>
  );
}

function Sidebar() {
  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <Scissors />
      </div>

      {/* Navigation top */}
      <nav className="sidebar-nav">
        {menuTop.map((item) => (
          <SidebarItem key={item.path} {...item} />
        ))}
      </nav>

      {/* Navigation bottom */}
      <div className="sidebar-bottom">
        {menuBottom.map((item) => (
          <SidebarItem key={item.path} {...item} />
        ))}
      </div>
    </aside>
  );
}

function App() {
  return (
    <Router>
      <div className="app-layout">
        <Sidebar />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/agenda" element={<Agenda />} />
            <Route path="/pacientes" element={<Pacientes />} />
            <Route path="/clients" element={<Clients />} />
            <Route path="/kanban" element={<Kanban />} />
            <Route path="/financial" element={<Financial />} />
            <Route path="/comissoes" element={<Comissoes />} />
            <Route path="/inventory" element={<Inventory />} />
            <Route path="/services" element={<Services />} />
            <Route path="/packages" element={<Packages />} />
            <Route path="/equipe" element={<Equipe />} />
            <Route path="/marketing" element={<Marketing />} />
            <Route path="/integration" element={<Integration />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/client-booking" element={<ClientBooking />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
