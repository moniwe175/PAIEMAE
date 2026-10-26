/* eslint-disable react/prop-types */
import { useMemo, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Clock3,
  PackageCheck,
  Search,
  Signature,
} from 'lucide-react';
import {
  buildPackageSignatureDraft,
  buildPackageSessionGrid,
  packageProgress,
  patientsWithPackages,
  signatureAppointmentCandidates,
} from '../../lib/patientPackages';
import PackageSignatureDialog from './PackageSignatureDialog';

const formatDateTime = (value) => value
  ? new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
  : '—';

const patientName = (patient) => patient?.nome || patient?.name || 'Paciente removido';
const patientPhone = (patient) => patient?.telefone || patient?.phone || '';

export default function PackageSignaturesPanel({ patients = [], packages = [], sessions = [], appointments = [], loading, loadError, onSessionUpdated }) {
  const [search, setSearch] = useState('');
  const [selectedClientId, setSelectedClientId] = useState(null);
  const [signing, setSigning] = useState(null);

  const patientById = useMemo(() => new Map(patients.map((patient) => [String(patient.id), patient])), [patients]);
  const packageById = useMemo(() => new Map(packages.map((item) => [String(item.id), item])), [packages]);
  const packagePatients = useMemo(
    () => patientsWithPackages(patients, packages).sort((a, b) => patientName(a).localeCompare(patientName(b), 'pt-BR')),
    [patients, packages],
  );

  const visiblePatients = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('pt-BR');
    if (!term) return packagePatients;
    return packagePatients.filter((patient) => {
      const clientPackages = packages.filter((item) => String(item.client_id) === String(patient.id));
      const searchable = [patientName(patient), patientPhone(patient), ...clientPackages.map((item) => item.package_name)]
        .join(' ')
        .toLocaleLowerCase('pt-BR');
      return searchable.includes(term);
    });
  }, [packagePatients, packages, search]);

  const selectedPatient = patientById.get(String(selectedClientId));
  const selectedPackages = useMemo(
    () => packages.filter((item) => String(item.client_id) === String(selectedClientId)),
    [packages, selectedClientId],
  );
  const pendingCount = sessions.filter((session) => session.status === 'pending_signature').length;
  const signedCount = sessions.filter((session) => session.status === 'signed').length;

  if (loadError) return (
    <div style={errorBox}>
      <strong>Controle de pacotes ainda não preparado no banco.</strong>
      <div style={{ marginTop: 4 }}>Execute o arquivo <strong>patient_packages_migration.sql</strong> no SQL Editor do Supabase.</div>
    </div>
  );

  return (
    <div>
      <div style={metricsGrid}>
        <Metric icon={PackageCheck} value={packagePatients.length} label="Pacientes com pacote" color="#9B2C50" background="#FDF4F7"/>
        <Metric icon={Clock3} value={pendingCount} label="Aguardando assinatura" color="#B45309" background="#FFFBEB"/>
        <Metric icon={CheckCircle2} value={signedCount} label="Sessões assinadas" color="#047857" background="#ECFDF5"/>
      </div>

      {!selectedPatient ? (
        <PatientList
          loading={loading}
          patients={visiblePatients}
          packages={packages}
          sessions={sessions}
          search={search}
          onSearch={setSearch}
          onSelect={setSelectedClientId}
        />
      ) : (
        <PatientSignatureRecord
          patient={selectedPatient}
          packages={selectedPackages}
          sessions={sessions}
          appointments={appointments}
          onBack={() => setSelectedClientId(null)}
          onOpenSession={setSigning}
        />
      )}

      {signing && !signing.readOnly && (
        <PackageSignatureDialog
          session={signing}
          patientPackage={packageById.get(String(signing.patient_package_id))}
          patient={patientById.get(String(signing.client_id))}
          onClose={() => setSigning(null)}
          onSigned={(updated) => {
            onSessionUpdated?.(updated);
            setSigning(null);
          }}
        />
      )}
      {signing?.readOnly && (
        <SignatureView
          session={signing}
          patient={patientById.get(String(signing.client_id))}
          item={packageById.get(String(signing.patient_package_id))}
          onClose={() => setSigning(null)}
        />
      )}
    </div>
  );
}

function PatientList({ loading, patients, packages, sessions, search, onSearch, onSelect }) {
  return (
    <section style={panel}>
      <div style={listHeader}>
        <div>
          <strong style={sectionTitle}>Clientes com pacote</strong>
          <span style={sectionSubtitle}>Somente quem possui pacote aparece aqui. Selecione uma pessoa para abrir a ficha de sessões.</span>
        </div>
        <div style={searchBox}>
          <Search size={14} color="#9A8780"/>
          <input value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Buscar paciente ou pacote..." style={searchInput}/>
        </div>
      </div>

      {loading ? <div style={empty}>Carregando pacientes...</div> : patients.length === 0 ? (
        <div style={empty}>
          <PackageCheck size={36}/>
          <strong>Nenhum paciente com pacote encontrado</strong>
          <span>Quando um pacote for vinculado a um paciente, ele aparecerá nesta lista.</span>
        </div>
      ) : (
        <div style={patientList}>
          {patients.map((patient) => {
            const clientPackages = packages.filter((item) => String(item.client_id) === String(patient.id));
            const packageIds = new Set(clientPackages.map((item) => String(item.id)));
            const clientSessions = sessions.filter((item) => packageIds.has(String(item.patient_package_id)) && item.status !== 'reversed');
            const clientPending = clientSessions.filter((item) => item.status === 'pending_signature').length;
            const packageNames = clientPackages.map((item) => item.package_name).filter(Boolean).join(' • ');
            return (
              <button key={patient.id} onClick={() => onSelect(patient.id)} style={patientRow}>
                <span style={avatar}>{patientName(patient).charAt(0).toUpperCase()}</span>
                <span style={patientIdentity}>
                  <strong style={patientNameStyle}>{patientName(patient)}</strong>
                  <small style={patientContact}>{patientPhone(patient) || 'Telefone não informado'}</small>
                </span>
                <span style={packageSummary}>
                  <strong>{clientPackages.length} {clientPackages.length === 1 ? 'pacote' : 'pacotes'}</strong>
                  <small>{packageNames}</small>
                </span>
                <span style={signatureSummary}>
                  {clientPending > 0 ? <span style={pendingBadge}>{clientPending} para assinar</span> : <span style={upToDateBadge}>Em dia</span>}
                  <small>{clientSessions.length} {clientSessions.length === 1 ? 'sessão usada' : 'sessões usadas'}</small>
                </span>
                <span style={openLabel}>Abrir assinaturas <ChevronRight size={15}/></span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

function PatientSignatureRecord({ patient, packages, sessions, appointments, onBack, onOpenSession }) {
  const packageIds = new Set(packages.map((item) => String(item.id)));
  const patientSessions = sessions.filter((item) => packageIds.has(String(item.patient_package_id)));
  const pending = patientSessions.filter((item) => item.status === 'pending_signature').length;

  return (
    <section style={panel}>
      <div style={recordHeader}>
        <button onClick={onBack} style={backButton}><ArrowLeft size={15}/> Voltar para pacientes</button>
        <div style={recordIdentity}>
          <span style={{ ...avatar, width: 48, height: 48 }}>{patientName(patient).charAt(0).toUpperCase()}</span>
          <span>
            <strong style={{ display: 'block', fontSize: 17, color: '#432F2B' }}>{patientName(patient)}</strong>
            <small style={{ display: 'block', marginTop: 4, color: '#927C75', fontSize: 12 }}>{patientPhone(patient) || 'Telefone não informado'}</small>
          </span>
        </div>
        <div style={recordTotals}>
          <span><strong>{packages.length}</strong> {packages.length === 1 ? 'pacote' : 'pacotes'}</span>
          <span><strong>{pending}</strong> aguardando assinatura</span>
        </div>
      </div>

      <div style={legend}>
        <span><i style={{ ...legendDot, background: '#FFFFFF', borderColor: '#D9CBC4' }}/>Disponível</span>
        <span><i style={{ ...legendDot, background: '#FFF4D6', borderColor: '#E9B949' }}/>Aguardando assinatura</span>
        <span><i style={{ ...legendDot, background: '#DDF7EA', borderColor: '#64BE91' }}/>Assinada</span>
        <span><i style={{ ...legendDot, background: '#EFEAE7', borderColor: '#D7CCC7' }}/>Já utilizada / histórico</span>
      </div>

      <div style={packagesStack}>
        {packages.map((item) => (
          <PackageSessionGrid
            key={item.id}
            patientPackage={item}
            sessions={sessions}
            appointments={appointments}
            onOpenSession={onOpenSession}
          />
        ))}
      </div>
    </section>
  );
}

function PackageSessionGrid({ patientPackage, sessions, appointments, onOpenSession }) {
  const grid = buildPackageSessionGrid(patientPackage, sessions);
  const progress = packageProgress(patientPackage, sessions);
  const packageAvailable = progress.status === 'active';
  const candidatesByColumn = grid.columns.map((column) => (
    signatureAppointmentCandidates(patientPackage, sessions, appointments, column.name)
  ));

  return (
    <article style={packageCard}>
      <div style={packageHeader}>
        <div>
          <span style={eyebrow}>PACOTE</span>
          <strong style={packageTitle}>{patientPackage.package_name || 'Pacote sem nome'}</strong>
          <span style={packageMeta}>{progress.used} de {progress.total} sessões utilizadas • {progress.remaining} restantes</span>
        </div>
        <span style={{ ...statusBadge, ...packageStatusStyle(progress.status) }}>{packageStatusLabel(progress.status)}</span>
      </div>
      <div style={progressTrack}><span style={{ ...progressFill, width: `${progress.percent}%` }}/></div>

      <div style={gridScroll}>
        <table style={{ width: '100%', minWidth: Math.max(600, 180 + grid.columns.length * 235), borderCollapse: 'separate', borderSpacing: 0 }}>
          <thead>
            <tr>
              <th style={{ ...gridTh, width: 92, left: 0, zIndex: 3 }}>Sessão</th>
              {grid.columns.map((column) => (
                <th key={column.key} style={gridTh}>
                  <strong>{column.name}</strong>
                  <small>{column.quota} {column.quota === 1 ? 'sessão' : 'sessões'}</small>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grid.rows.map((row) => (
              <tr key={row.number}>
                <th style={{ ...rowNumber, left: 0 }}><span>{row.number}</span></th>
                {row.cells.map((cell, columnIndex) => {
                  const column = grid.columns[columnIndex];
                  const availableIndex = row.number - column.sessions.length - 1;
                  const appointment = cell.available && availableIndex >= 0
                    ? candidatesByColumn[columnIndex][availableIndex]
                    : null;
                  return (
                    <td key={`${row.number}-${column.key}`} style={gridTd}>
                      <SessionCell
                        cell={cell}
                        packageAvailable={packageAvailable}
                        appointment={appointment}
                        patientPackage={patientPackage}
                        sessions={sessions}
                        serviceName={column.name}
                        onOpenSession={onOpenSession}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  );
}

function SessionCell({ cell, packageAvailable, appointment, patientPackage, sessions, serviceName, onOpenSession }) {
  if (!cell.session && packageAvailable && appointment) return (
    <button
      onClick={() => {
        const draft = buildPackageSignatureDraft(patientPackage, sessions, appointment, serviceName);
        if (draft) onOpenSession(draft);
      }}
      style={availableSignatureCell}
    >
      <span>Disponível</span>
      <small>{formatDateTime(`${appointment.appointment_date}T${appointment.appointment_time || '12:00:00'}-03:00`)}</small>
      <strong><Signature size={12}/> Assinar sessão finalizada</strong>
    </button>
  );
  if (cell.disabled) return <div style={disabledCell}>—</div>;
  if (!cell.session) return <div style={availableCell}>{packageAvailable ? 'Disponível' : 'Indisponível'}</div>;

  const session = cell.session;
  if (session.status === 'pending_signature') return (
    <button onClick={() => onOpenSession(session)} style={pendingCell}>
      <span><Clock3 size={13}/>Aguardando assinatura</span>
      <small>{formatDateTime(session.performed_at)}{session.professional_name ? ` • ${session.professional_name}` : ''}</small>
      <strong><Signature size={12}/> Assinar agora</strong>
    </button>
  );
  if (session.status === 'signed') return (
    <button onClick={() => onOpenSession({ ...session, readOnly: true })} style={signedCell}>
      <span><CheckCircle2 size={13}/>Assinada</span>
      <small>{formatDateTime(session.performed_at)}</small>
      <strong>Ver assinatura</strong>
    </button>
  );
  return (
    <div style={legacyCell}>
      <span><CheckCircle2 size={13}/>Já utilizada</span>
      <small>{session.performed_at ? formatDateTime(session.performed_at) : 'Sessão anterior ao controle digital'}</small>
    </div>
  );
}

function packageStatusLabel(status) {
  return ({ active: 'Ativo', completed: 'Concluído', expired: 'Vencido', paused: 'Pausado', cancelled: 'Cancelado' })[status] || 'Ativo';
}

function packageStatusStyle(status) {
  if (status === 'active') return { background: '#ECFDF5', color: '#047857' };
  if (status === 'completed') return { background: '#EFF6FF', color: '#1D4ED8' };
  return { background: '#F5F0ED', color: '#7A635B' };
}

function SignatureView({ session, patient, item, onClose }) {
  return (
    <div style={overlay} onClick={onClose}>
      <div style={viewDialog} onClick={(event) => event.stopPropagation()}>
        <div style={{ padding: '16px 18px', borderBottom: '1px solid #EEE7E2' }}>
          <strong style={{ fontSize: 16 }}>Assinatura da sessão {session.session_number}/{item?.total_sessions || '—'}</strong>
          <div style={{ fontSize: 12, color: '#927C75', marginTop: 4 }}>{patientName(patient)} • {item?.package_name}</div>
        </div>
        <div style={{ padding: 18 }}>
          <div style={{ fontSize: 13, color: '#5E4D47', lineHeight: 1.55 }}>{session.acknowledgment_text}</div>
          <div style={signatureImageBox}><img src={session.signature_data_url} alt="Assinatura da paciente" style={{ maxWidth: '100%', maxHeight: 130 }}/></div>
          <div style={{ marginTop: 12, fontSize: 12, color: '#927C75' }}>Assinado por {session.signed_name || patientName(patient)} em {formatDateTime(session.signed_at)}</div>
        </div>
        <div style={{ padding: '11px 18px', borderTop: '1px solid #EEE7E2', textAlign: 'right' }}><button onClick={onClose} style={viewButton}>Fechar</button></div>
      </div>
    </div>
  );
}

function Metric({ icon: Icon, value, label, color, background }) {
  return <div style={metric}><div style={{ ...metricIcon, background, color }}><Icon size={19}/></div><div><strong style={{ display: 'block', fontSize: 21, color }}>{value}</strong><span style={{ fontSize: 12, color: '#715F58', fontWeight: 700 }}>{label}</span></div></div>;
}

const errorBox = { padding: 20, border: '1px solid #F3C7A6', borderRadius: 12, background: '#FFF8ED', color: '#9A4D16', fontSize: 12 };
const metricsGrid = { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12, marginBottom: 16 };
const metric = { padding: '15px 17px', background: '#fff', border: '1px solid #E9DFDA', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 12 };
const metricIcon = { width: 44, height: 44, borderRadius: 10, display: 'grid', placeItems: 'center' };
const panel = { background: '#fff', border: '1px solid #E9DFDA', borderRadius: 12, overflow: 'hidden' };
const listHeader = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 18, padding: '19px 20px', borderBottom: '1px solid #EEE7E2', flexWrap: 'wrap' };
const sectionTitle = { display: 'block', fontSize: 16, color: '#432F2B' };
const sectionSubtitle = { display: 'block', marginTop: 5, fontSize: 12, color: '#927C75' };
const searchBox = { width: 'min(340px, 100%)', display: 'flex', alignItems: 'center', gap: 8, border: '1px solid #E2D8D3', background: '#fff', borderRadius: 9, padding: '10px 12px' };
const searchInput = { border: 0, outline: 0, minWidth: 0, flex: 1, fontSize: 12, background: 'transparent' };
const patientList = { display: 'flex', flexDirection: 'column' };
const patientRow = { width: '100%', display: 'grid', gridTemplateColumns: '48px minmax(170px, 1fr) minmax(230px, 1.3fr) minmax(150px, .7fr) auto', alignItems: 'center', gap: 14, padding: '16px 20px', border: 0, borderBottom: '1px solid #F0E9E5', background: '#fff', color: '#4A3C37', textAlign: 'left', cursor: 'pointer' };
const avatar = { flex: '0 0 auto', width: 40, height: 40, borderRadius: '50%', display: 'grid', placeItems: 'center', background: '#F2DFD9', color: '#9B5548', fontSize: 14, fontWeight: 900 };
const patientIdentity = { minWidth: 0 };
const patientNameStyle = { display: 'block', fontSize: 13.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' };
const patientContact = { display: 'block', marginTop: 4, color: '#927C75', fontSize: 11 };
const packageSummary = { minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 };
const signatureSummary = { display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 5, fontSize: 11, color: '#927C75' };
const pendingBadge = { padding: '5px 9px', borderRadius: 20, background: '#FEF3C7', color: '#B45309', fontSize: 10.5, fontWeight: 900 };
const upToDateBadge = { ...pendingBadge, background: '#ECFDF5', color: '#047857' };
const openLabel = { display: 'flex', alignItems: 'center', gap: 5, color: '#9B5548', fontSize: 12, fontWeight: 800, whiteSpace: 'nowrap' };
const recordHeader = { minHeight: 90, display: 'flex', alignItems: 'center', gap: 20, padding: '17px 20px', borderBottom: '1px solid #EEE7E2', flexWrap: 'wrap' };
const backButton = { display: 'inline-flex', alignItems: 'center', gap: 7, border: '1px solid #DED1CB', background: '#fff', color: '#765F57', borderRadius: 9, padding: '10px 12px', fontSize: 12, fontWeight: 800, cursor: 'pointer' };
const recordIdentity = { display: 'flex', alignItems: 'center', gap: 10 };
const recordTotals = { marginLeft: 'auto', display: 'flex', gap: 9, flexWrap: 'wrap', fontSize: 12.5 };
const legend = { display: 'flex', alignItems: 'center', gap: 19, padding: '12px 20px', borderBottom: '1px solid #EEE7E2', background: '#FCFAF8', color: '#735F58', fontSize: 11, flexWrap: 'wrap' };
const legendDot = { display: 'inline-block', width: 10, height: 10, borderRadius: 3, border: '1px solid', marginRight: 6, verticalAlign: '-1px' };
const packagesStack = { display: 'flex', flexDirection: 'column', gap: 16, padding: 16, background: '#FAF7F5' };
const packageCard = { border: '1px solid #E5D9D3', borderRadius: 11, background: '#fff', overflow: 'hidden' };
const packageHeader = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14, padding: '18px 19px' };
const eyebrow = { display: 'block', color: '#B7796B', fontSize: 10, fontWeight: 900, letterSpacing: .9 };
const packageTitle = { display: 'block', marginTop: 4, color: '#432F2B', fontSize: 16 };
const packageMeta = { display: 'block', marginTop: 5, color: '#927C75', fontSize: 12 };
const statusBadge = { padding: '6px 10px', borderRadius: 20, fontSize: 10.5, fontWeight: 900, textTransform: 'uppercase' };
const progressTrack = { height: 5, margin: '0 19px 16px', borderRadius: 10, background: '#EEE7E2', overflow: 'hidden' };
const progressFill = { display: 'block', height: '100%', borderRadius: 10, background: '#B7796B' };
const gridScroll = { overflowX: 'auto', borderTop: '1px solid #EEE7E2' };
const gridTh = { position: 'sticky', top: 0, zIndex: 2, minWidth: 220, padding: '13px 14px', textAlign: 'center', color: '#604D46', background: '#F8F4F2', borderRight: '1px solid #E8DEDA', borderBottom: '1px solid #E1D5CF', fontSize: 12.5 };
const rowNumber = { position: 'sticky', zIndex: 1, width: 105, padding: 13, textAlign: 'center', background: '#FCFAF8', borderRight: '1px solid #E8DEDA', borderBottom: '1px solid #EEE7E2', color: '#8A7169', fontSize: 13, fontWeight: 800 };
const gridTd = { minWidth: 220, padding: 9, borderRight: '1px solid #EEE7E2', borderBottom: '1px solid #EEE7E2', verticalAlign: 'middle' };
const baseCell = { minHeight: 72, width: '100%', borderRadius: 9, padding: '11px 12px', fontSize: 11.5, textAlign: 'left' };
const disabledCell = { ...baseCell, display: 'grid', placeItems: 'center', background: '#F6F3F1', color: '#C1B6B1' };
const availableCell = { ...baseCell, display: 'grid', placeItems: 'center', border: '1px dashed #D9CBC4', background: '#FFFEFD', color: '#9A8780', textAlign: 'center' };
const availableSignatureCell = { ...baseCell, display: 'flex', flexDirection: 'column', gap: 4, border: '1px dashed #C68F80', background: '#FFF9F7', color: '#8F4E42', cursor: 'pointer' };
const pendingCell = { ...baseCell, display: 'flex', flexDirection: 'column', gap: 4, border: '1px solid #E9B949', background: '#FFF9E9', color: '#9A5A08', cursor: 'pointer' };
const signedCell = { ...baseCell, display: 'flex', flexDirection: 'column', gap: 4, border: '1px solid #8BD3AE', background: '#EDFBF4', color: '#047857', cursor: 'pointer' };
const legacyCell = { ...baseCell, display: 'flex', flexDirection: 'column', gap: 5, border: '1px solid #D7CCC7', background: '#F5F1EF', color: '#75635C' };
const empty = { minHeight: 280, padding: 34, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, textAlign: 'center', color: '#9C8880', fontSize: 12.5 };
const overlay = { position: 'fixed', inset: 0, zIndex: 13000, background: 'rgba(35,27,24,.62)', backdropFilter: 'blur(4px)', display: 'grid', placeItems: 'center', padding: 16 };
const viewDialog = { width: 'min(620px, 96vw)', background: '#FFFEFD', borderRadius: 16, boxShadow: '0 28px 80px rgba(35,20,15,.28)', overflow: 'hidden' };
const signatureImageBox = { border: '1px solid #E9DFDA', borderRadius: 10, minHeight: 150, display: 'grid', placeItems: 'center', marginTop: 14, background: '#fff' };
const viewButton = { border: '1px solid #DCCFC9', background: '#fff', color: '#705D56', borderRadius: 9, padding: '9px 13px', fontSize: 12, fontWeight: 700, cursor: 'pointer' };
