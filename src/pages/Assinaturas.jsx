import { useCallback, useEffect, useState } from 'react';
import { FileSignature, RefreshCw } from 'lucide-react';
import PackageSignaturesPanel from '../components/patients/PackageSignaturesPanel';
import {
  fetchAppointments,
  fetchClients,
  fetchPatientPackages,
  fetchPatientPackageSessions,
} from '../services/supabaseService';

export default function Assinaturas() {
  const [patients, setPatients] = useState([]);
  const [packages, setPackages] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    const [clientsResult, packagesResult, sessionsResult, appointmentsResult] = await Promise.all([
      fetchClients(),
      fetchPatientPackages(),
      fetchPatientPackageSessions(),
      fetchAppointments(),
    ]);

    setPatients(clientsResult.data || []);
    setPackages(packagesResult.data || []);
    setSessions(sessionsResult.data || []);
    setAppointments(appointmentsResult.data || []);

    const error = clientsResult.error || packagesResult.error || sessionsResult.error || appointmentsResult.error;
    setLoadError(error ? (error.message || String(error)) : '');
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div className="page-header-label"><FileSignature /> CONTROLE DE PACOTES</div>
          <h1 className="page-title">Assinaturas de sessões</h1>
          <p className="page-subtitle">Assinatura digital das sessões realizadas por clientes com pacote</p>
        </div>
        <button className="btn btn-secondary" onClick={loadData} disabled={loading}>
          <RefreshCw style={{ width: 15, height: 15 }} />
          {loading ? 'Atualizando...' : 'Atualizar'}
        </button>
      </div>

      <div style={{ marginBottom: 14, padding: '10px 13px', border: '1px solid #E8DCD6', borderRadius: 10, background: '#FCF6F3', color: '#765F57', fontSize: 11, lineHeight: 1.5 }}>
        Esta área mostra somente clientes que possuem pacote. A assinatura é liberada quando uma sessão vinculada ao pacote é finalizada na Agenda.
      </div>

      <PackageSignaturesPanel
        patients={patients}
        packages={packages}
        sessions={sessions}
        appointments={appointments}
        loading={loading}
        loadError={loadError}
        onSessionUpdated={(updated) => setSessions((current) => {
          const exists = current.some((item) => item.id === updated.id);
          return exists
            ? current.map((item) => item.id === updated.id ? updated : item)
            : [updated, ...current];
        })}
      />
    </div>
  );
}
