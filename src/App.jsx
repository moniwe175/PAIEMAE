import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

// Import AuthContext provider and ProtectedRoute
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/auth/ProtectedRoute';
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
import Kanban from './pages/Kanban';
import Financial from './pages/Financial';
import Comissoes from './pages/Comissoes';
import Inventory from './pages/Inventory';
import Services from './pages/Services';
import Packages from './pages/Packages';
import Equipe from './pages/Equipe';
import Marketing from './pages/Marketing';
import MotorMarketing from './pages/MotorMarketing';
import Integration from './pages/Integration';
import Reports from './pages/Reports';
import ClientBooking from './pages/ClientBooking';
import Anamnese from './pages/Anamnese';
import Estrategia from './pages/Estrategia';

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
          <Route path="/motor-marketing" element={<MotorMarketing />} />
          <Route path="/integration" element={<Integration />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/anamnese" element={<Anamnese />} />
          <Route path="/estrategia" element={<Estrategia />} />
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
