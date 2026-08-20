import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

// Import AuthContext provider and ProtectedRoute
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/auth/ProtectedRoute';
import ModuleGate from './components/auth/ModuleGate';
import ErrorBoundary from './components/ErrorBoundary';

// Import SyncContext provider
import { SyncProvider } from './contexts/SyncContext';
import { OKRProvider } from './contexts/OKRContext';

// Import all pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Agenda from './pages/Agenda';
import Pacientes from './pages/Pacientes';
import Clients from './pages/Clients';
import Financial from './pages/Financial';
import Comissoes from './pages/Comissoes';
import Inventory from './pages/Inventory';
import Services from './pages/Services';
import Equipe from './pages/Equipe';
import Marketing from './pages/Marketing';
import MotorMarketing from './pages/MotorMarketing';
import GuiaMarketing from './pages/GuiaMarketing';
import Integration from './pages/Integration';
import Reports from './pages/Reports';
import ClientBooking from './pages/ClientBooking';
import Anamnese from './pages/Anamnese';
import Estrategia from './pages/Estrategia';

// Lazy-loaded pages (separate chunks, no main-bundle init impact)
const GerenciarAcessos = lazy(() => import('./pages/GerenciarAcessos'));

// Import Sidebar component
import Sidebar from './components/ui/sidebar';

// Import sheet sync hook for auto-connect
import useSheetSync from './hooks/useSheetSync';

// Global component that triggers Google Sheets auto-sync
function SheetAutoSync() {
  useSheetSync(); // auto-connect useEffect fires on mount
  return null;
}

function MainLayout() {
  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <Routes>
          <Route path="/" element={<ModuleGate module="dashboard"><Dashboard /></ModuleGate>} />
          <Route path="/agenda" element={<ModuleGate module="agenda"><Agenda /></ModuleGate>} />
          <Route path="/pacientes" element={<ModuleGate module="pacientes"><Pacientes /></ModuleGate>} />
          <Route path="/clients" element={<Clients />} />
          <Route path="/financial" element={<ModuleGate module="financeiro"><Financial /></ModuleGate>} />
          <Route path="/comissoes" element={<ModuleGate module="comissoes"><Comissoes /></ModuleGate>} />
          <Route path="/inventory" element={<ModuleGate module="estoque"><Inventory /></ModuleGate>} />
          <Route path="/services" element={<ModuleGate module="servicos"><Services /></ModuleGate>} />
          <Route path="/equipe" element={<ModuleGate module="equipe"><Equipe /></ModuleGate>} />
          <Route path="/marketing" element={<ModuleGate module="marketing"><Marketing /></ModuleGate>} />
          <Route path="/motor-marketing" element={<ModuleGate module="motor"><MotorMarketing /></ModuleGate>} />
          <Route path="/guia-marketing" element={<ModuleGate module="marketing"><GuiaMarketing /></ModuleGate>} />
          <Route path="/integration" element={<ModuleGate module="integracoes"><Integration /></ModuleGate>} />
          <Route path="/reports" element={<ModuleGate module="relatorios"><Reports /></ModuleGate>} />
          <Route path="/anamnese" element={<ModuleGate module="anamnese"><Anamnese /></ModuleGate>} />
          <Route path="/estrategia" element={<ModuleGate module="estrategia"><Estrategia /></ModuleGate>} />
          <Route path="/gerenciar-acessos" element={
            <ModuleGate adminOnly>
              <Suspense fallback={<div style={{padding:40,textAlign:'center',color:'#8C7573'}}>Carregando...</div>}>
                <GerenciarAcessos />
              </Suspense>
            </ModuleGate>
          } />
        </Routes>
      </main>
    </div>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <SyncProvider>
          <OKRProvider>
            <SheetAutoSync />
            <Routes>
              {/* Public Routes */}
              <Route path="/login" element={<Login />} />
              <Route path="/client-booking" element={<ClientBooking />} />

              {/* Protected ERP Routes */}
              <Route
                path="/*"
                element={
                  <ProtectedRoute>
                    <ErrorBoundary>
                      <MainLayout />
                    </ErrorBoundary>
                  </ProtectedRoute>
                }
              />
            </Routes>
          </OKRProvider>
        </SyncProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
