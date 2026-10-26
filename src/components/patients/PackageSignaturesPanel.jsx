/* eslint-disable react/prop-types */
import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock3, FileSignature, PackageCheck, Search, Signature } from 'lucide-react';
import { patientsWithPackages } from '../../lib/patientPackages';
import PackageSignatureDialog from './PackageSignatureDialog';

const formatDateTime = (value) => value
  ? new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
  : '—';

const patientName = (patient) => patient?.nome || patient?.name || 'Paciente removido';
const patientPhone = (patient) => patient?.telefone || patient?.phone || '';

export default function PackageSignaturesPanel({ patients = [], packages = [], sessions = [], loading, loadError, onSessionUpdated }) {
  const [filter, setFilter] = useState('pending');
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
      const patientPackages = packages.filter((item) => String(item.client_id) === String(patient.id));
      const searchable = [patientName(patient), patientPhone(patient), ...patientPackages.map((item) => item.package_name)]
        .join(' ')
        .toLocaleLowerCase('pt-BR');
      return searchable.includes(term);
    });
  }, [packagePatients, packages, search]);

  useEffect(() => {
    if (visiblePatients.some((patient) => String(patient.id) === String(selectedClientId))) return;
    setSelectedClientId(visiblePatients[0]?.id ?? null);
  }, [visiblePatients, selectedClientId]);

  const selectedPatient = patientById.get(String(selectedClientId));
  const selectedPackages = useMemo(
    () => packages.filter((item) => String(item.client_id) === String(selectedClientId)),
    [packages, selectedClientId],
  );
  const selectedSessions = useMemo(() => sessions
    .filter((session) => String(session.client_id) === String(selectedClientId))
    .filter((session) => session.status !== 'reversed' && session.status !== 'legacy')
    .filter((session) => filter === 'all' || (filter === 'pending' ? session.status === 'pending_signature' : session.status === 'signed'))
    .sort((a, b) => new Date(b.performed_at || 0) - new Date(a.performed_at || 0)), [sessions, selectedClientId, filter]);

  const pendingCount = sessions.filter((session) => session.status === 'pending_signature').length;
  const signedCount = sessions.filter((session) => session.status === 'signed').length;

  if (loadError) return (
    <div style={{ padding: 20, border: '1px solid #F3C7A6', borderRadius: 12, background: '#FFF8ED', color: '#9A4D16', fontSize: 12 }}>
      <strong>Controle de pacotes ainda não preparado no banco.</strong>
      <div style={{ marginTop: 4 }}>Execute o arquivo <strong>patient_packages_migration.sql</strong> no SQL Editor do Supabase.</div>
    </div>
  );

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10, marginBottom: 14 }}>
        <Metric icon={PackageCheck} value={packagePatients.length} label="Pacientes com pacote" color="#9B2C50" background="#FDF4F7"/>
        <Metric icon={Clock3} value={pendingCount} label="Aguardando assinatura" color="#B45309" background="#FFFBEB"/>
        <Metric icon={CheckCircle2} value={signedCount} label="Sessões assinadas" color="#047857" background="#ECFDF5"/>
      </div>

      <div style={workspace}>
        <aside style={patientColumn}>
          <div style={{ padding: 14, borderBottom: '1px solid #EEE7E2' }}>
            <strong style={{ display: 'block', fontSize: 12.5, color: '#4A3530' }}>Pacientes com pacote</strong>
            <span style={{ display: 'block', marginTop: 3, fontSize: 10, color: '#927C75' }}>Somente quem possui pacote aparece aqui.</span>
            <div style={searchBox}>
              <Search size={13} color="#9A8780"/>
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar paciente ou pacote..." style={searchInput}/>
            </div>
          </div>

          <div style={{ maxHeight: 540, overflowY: 'auto' }}>
            {loading ? <div style={smallEmpty}>Carregando pacientes...</div> : visiblePatients.length === 0 ? (
              <div style={smallEmpty}>Nenhum paciente com pacote encontrado.</div>
            ) : visiblePatients.map((patient) => {
              const clientPackages = packages.filter((item) => String(item.client_id) === String(patient.id));
              const clientPending = sessions.filter((item) => String(item.client_id) === String(patient.id) && item.status === 'pending_signature').length;
              const selected = String(patient.id) === String(selectedClientId);
              return (
                <button key={patient.id} onClick={() => setSelectedClientId(patient.id)} style={{ ...patientButton, ...(selected ? selectedPatientButton : {}) }}>
                  <span style={avatar}>{patientName(patient).charAt(0).toUpperCase()}</span>
                  <span style={{ minWidth: 0, flex: 1 }}>
                    <strong style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{patientName(patient)}</strong>
                    <small style={{ display: 'block', marginTop: 2, color: selected ? '#F9EDE9' : '#927C75' }}>
                      {clientPackages.length} {clientPackages.length === 1 ? 'pacote' : 'pacotes'}{patientPhone(patient) ? ` · ${patientPhone(patient)}` : ''}
                    </small>
                  </span>
                  {clientPending > 0 && <span style={{ ...pendingBadge, ...(selected ? { background: '#fff', color: '#A35E50' } : {}) }}>{clientPending}</span>}
                </button>
              );
            })}
          </div>
        </aside>

        <section style={{ minWidth: 0 }}>
          {!selectedPatient ? (
            <div style={empty}><PackageCheck size={36}/><strong>Selecione um paciente com pacote</strong><span>Quando um pacote for vinculado a um paciente, ele aparecerá nesta lista.</span></div>
          ) : (
            <>
              <div style={selectedHeader}>
                <div>
                  <strong style={{ display: 'block', fontSize: 15, color: '#432F2B' }}>{patientName(selectedPatient)}</strong>
                  <span style={{ display: 'block', marginTop: 3, fontSize: 10.5, color: '#927C75' }}>{patientPhone(selectedPatient) || 'Telefone não informado'}</span>
                </div>
                <div style={{ display: 'flex', gap: 5, marginLeft: 'auto' }}>
                  {[['pending', 'Pendentes'], ['signed', 'Assinadas'], ['all', 'Todas']].map(([key, label]) => (
                    <button key={key} onClick={() => setFilter(key)} style={{ ...filterButton, ...(filter === key ? activeFilter : {}) }}>{label}</button>
                  ))}
                </div>
              </div>

              <div style={packageStrip}>
                {selectedPackages.map((item) => (
                  <div key={item.id} style={packageChip}>
                    <PackageCheck size={13}/>
                    <span><strong>{item.package_name}</strong><small>{item.total_sessions} sessões · {packageStatusLabel(item.status)}</small></span>
                  </div>
                ))}
              </div>

              {loading ? <div style={empty}>Carregando sessões...</div> : selectedSessions.length === 0 ? (
                <div style={empty}>
                  <FileSignature size={36}/>
                  <strong>{filter === 'pending' ? 'Nenhuma assinatura pendente' : 'Nenhuma sessão encontrada'}</strong>
                  <span>O paciente já possui pacote. A assinatura aparecerá quando uma sessão desse pacote for finalizada na Agenda.</span>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', minWidth: 690, borderCollapse: 'collapse' }}>
                    <thead><tr>{['Pacote', 'Sessão', 'Procedimento', 'Realizada em', 'Situação', ''].map((item) => <th key={item} style={th}>{item}</th>)}</tr></thead>
                    <tbody>{selectedSessions.map((session) => {
                      const item = packageById.get(String(session.patient_package_id));
                      const isPending = session.status === 'pending_signature';
                      return (
                        <tr key={session.id}>
                          <td style={td}>{item?.package_name || 'Pacote removido'}</td>
                          <td style={td}><strong>{session.session_number}/{item?.total_sessions || '—'}</strong></td>
                          <td style={td}>{session.service_name || '—'}<small style={small}>{session.professional_name || ''}</small></td>
                          <td style={td}>{formatDateTime(session.performed_at)}</td>
                          <td style={td}><span style={{ ...badge, background: isPending ? '#FFFBEB' : '#ECFDF5', color: isPending ? '#B45309' : '#047857' }}>{isPending ? 'Aguardando' : 'Assinada'}</span>{session.signed_at && <small style={small}>{formatDateTime(session.signed_at)}</small>}</td>
                          <td style={{ ...td, textAlign: 'right' }}>{isPending ? <button onClick={() => setSigning(session)} style={signButton}><Signature size={13}/> Assinar</button> : session.signature_data_url ? <button onClick={() => setSigning({ ...session, readOnly: true })} style={viewButton}>Ver assinatura</button> : null}</td>
                        </tr>
                      );
                    })}</tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </section>
      </div>

      {signing && !signing.readOnly && (
        <PackageSignatureDialog
          session={signing}
          patientPackage={packageById.get(String(signing.patient_package_id))}
          patient={patientById.get(String(signing.client_id))}
          onClose={() => setSigning(null)}
          onSigned={(updated) => { onSessionUpdated(updated); setSigning(null); }}
        />
      )}
      {signing?.readOnly && <SignatureView session={signing} patient={patientById.get(String(signing.client_id))} item={packageById.get(String(signing.patient_package_id))} onClose={() => setSigning(null)}/>} 
    </div>
  );
}

function packageStatusLabel(status) {
  return ({ active: 'ativo', completed: 'concluído', expired: 'vencido', paused: 'pausado', cancelled: 'cancelado' })[status] || 'ativo';
}

function SignatureView({ session, patient, item, onClose }) {
  return <div style={overlay} onClick={onClose}><div style={viewDialog} onClick={(event) => event.stopPropagation()}><div style={{ padding: '16px 18px', borderBottom: '1px solid #EEE7E2' }}><strong>Assinatura da sessão {session.session_number}/{item?.total_sessions || '—'}</strong><div style={{ fontSize: 10.5, color: '#927C75', marginTop: 3 }}>{patientName(patient)} · {item?.package_name}</div></div><div style={{ padding: 18 }}><div style={{ fontSize: 11.5, color: '#5E4D47', lineHeight: 1.5 }}>{session.acknowledgment_text}</div><div style={{ border: '1px solid #E9DFDA', borderRadius: 10, minHeight: 120, display: 'grid', placeItems: 'center', marginTop: 12, background: '#fff' }}><img src={session.signature_data_url} alt="Assinatura da paciente" style={{ maxWidth: '100%', maxHeight: 130 }}/></div><div style={{ marginTop: 10, fontSize: 10.5, color: '#927C75' }}>Assinado por {session.signed_name || patientName(patient)} em {formatDateTime(session.signed_at)}</div></div><div style={{ padding: '11px 18px', borderTop: '1px solid #EEE7E2', textAlign: 'right' }}><button onClick={onClose} style={viewButton}>Fechar</button></div></div></div>;
}

function Metric({ icon: Icon, value, label, color, background }) {
  return <div style={{ padding: '12px 14px', background: '#fff', border: '1px solid #E9DFDA', borderRadius: 11, display: 'flex', alignItems: 'center', gap: 10 }}><div style={{ width: 38, height: 38, borderRadius: 9, background, color, display: 'grid', placeItems: 'center' }}><Icon size={17}/></div><div><strong style={{ display: 'block', fontSize: 18, color }}>{value}</strong><span style={{ fontSize: 10.5, color: '#715F58', fontWeight: 700 }}>{label}</span></div></div>;
}

const workspace = { display: 'grid', gridTemplateColumns: 'minmax(260px, .72fr) minmax(540px, 1.8fr)', background: '#fff', border: '1px solid #E9DFDA', borderRadius: 12, overflow: 'hidden' };
const patientColumn = { borderRight: '1px solid #EEE7E2', background: '#FCFAF8', minWidth: 0 };
const searchBox = { marginTop: 11, display: 'flex', alignItems: 'center', gap: 7, border: '1px solid #E2D8D3', background: '#fff', borderRadius: 8, padding: '7px 9px' };
const searchInput = { border: 0, outline: 0, minWidth: 0, flex: 1, fontSize: 10.5, background: 'transparent' };
const patientButton = { width: '100%', display: 'flex', alignItems: 'center', gap: 9, border: 0, borderBottom: '1px solid #F0E9E5', background: 'transparent', color: '#4A3C37', padding: '11px 12px', textAlign: 'left', fontSize: 11, cursor: 'pointer' };
const selectedPatientButton = { background: '#B7796B', color: '#fff' };
const avatar = { flex: '0 0 auto', width: 31, height: 31, borderRadius: '50%', display: 'grid', placeItems: 'center', background: '#F2DFD9', color: '#9B5548', fontWeight: 900 };
const pendingBadge = { flex: '0 0 auto', minWidth: 22, height: 22, borderRadius: 20, display: 'grid', placeItems: 'center', padding: '0 6px', background: '#FEF3C7', color: '#B45309', fontSize: 9.5, fontWeight: 900 };
const selectedHeader = { minHeight: 65, display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderBottom: '1px solid #EEE7E2', flexWrap: 'wrap' };
const packageStrip = { display: 'flex', gap: 8, padding: '10px 14px', borderBottom: '1px solid #EEE7E2', overflowX: 'auto', background: '#FFFEFD' };
const packageChip = { flex: '0 0 auto', minWidth: 160, display: 'flex', alignItems: 'center', gap: 7, padding: '8px 10px', border: '1px solid #E8DCD6', borderRadius: 9, color: '#8E5145', background: '#FCF6F3', fontSize: 10.5 };
const th = { padding: '10px 12px', textAlign: 'left', fontSize: 9.5, color: '#927C75', textTransform: 'uppercase', letterSpacing: .4, borderBottom: '1px solid #EEE7E2', background: '#FCFAF8' };
const td = { padding: '11px 12px', fontSize: 11.5, color: '#4A3C37', borderBottom: '1px solid #F2ECE8', verticalAlign: 'middle' };
const small = { display: 'block', fontSize: 9.5, color: '#9A8780', marginTop: 2 };
const badge = { display: 'inline-block', padding: '4px 8px', borderRadius: 20, fontSize: 9.5, fontWeight: 800 };
const filterButton = { border: '1px solid #E2D8D3', background: '#fff', color: '#765F57', borderRadius: 8, padding: '7px 10px', fontSize: 10.5, fontWeight: 700, cursor: 'pointer' };
const activeFilter = { background: '#B7796B', borderColor: '#B7796B', color: '#fff' };
const signButton = { border: 0, background: '#B7796B', color: '#fff', borderRadius: 8, padding: '7px 10px', fontSize: 10.5, fontWeight: 800, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5 };
const viewButton = { border: '1px solid #DCCFC9', background: '#fff', color: '#705D56', borderRadius: 8, padding: '7px 10px', fontSize: 10.5, fontWeight: 700, cursor: 'pointer' };
const empty = { minHeight: 280, padding: 30, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 7, textAlign: 'center', color: '#9C8880', fontSize: 11.5 };
const smallEmpty = { minHeight: 150, padding: 22, display: 'grid', placeItems: 'center', textAlign: 'center', color: '#9C8880', fontSize: 10.5 };
const overlay = { position: 'fixed', inset: 0, zIndex: 13000, background: 'rgba(35,27,24,.62)', backdropFilter: 'blur(4px)', display: 'grid', placeItems: 'center', padding: 16 };
const viewDialog = { width: 'min(560px, 96vw)', background: '#FFFEFD', borderRadius: 16, boxShadow: '0 28px 80px rgba(35,20,15,.28)', overflow: 'hidden' };
