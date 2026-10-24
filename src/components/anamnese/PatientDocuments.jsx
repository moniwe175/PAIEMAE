/* eslint-disable react/prop-types */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ChevronRight,
  Eye,
  FileCheck2,
  FileSignature,
  Loader2,
  PenLine,
  Plus,
  Printer,
  RotateCcw,
  Search,
  Trash2,
  UserRound,
  X,
} from 'lucide-react';
import {
  deletePendingPatientDocument,
  fetchPatientDocuments,
  insertPatientDocument,
  updatePatientDocument,
} from '../../services/supabaseService';
import {
  buildPatientDocumentContent,
  IMAGE_USE_SCOPES,
  PATIENT_DOCUMENT_TYPES,
  patientDocumentStatus,
  patientDocumentType,
  validatePatientDocumentDraft,
} from '../../lib/patientDocuments';

const inputStyle = {
  width: '100%', boxSizing: 'border-box', border: '1px solid #E5DDD8', borderRadius: 9,
  padding: '9px 10px', outline: 'none', background: '#fff', color: '#332A27', fontSize: 12,
};
const labelStyle = { display: 'block', marginBottom: 5, fontSize: 10, fontWeight: 800, color: '#7C6560', textTransform: 'uppercase', letterSpacing: 0.4 };

function formatDate(value, withTime = false) {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString('pt-BR', withTime
    ? { dateStyle: 'short', timeStyle: 'short' }
    : { dateStyle: 'short' });
}

function printPatientDocument() {
  const printable = document.getElementById('patient-document-print');
  if (!printable) return;
  const popup = window.open('', '_blank', 'width=820,height=900');
  if (!popup) {
    alert('O navegador bloqueou a janela de impressão. Libere pop-ups e tente novamente.');
    return;
  }
  popup.document.write(`<!doctype html><html><head><title>Documento do paciente</title><style>body{font-family:Arial,sans-serif;color:#332a27;padding:28px}img{max-width:260px} @media print{body{padding:0}}</style></head><body>${printable.outerHTML}</body></html>`);
  popup.document.close();
  popup.focus();
  popup.setTimeout(() => popup.print(), 250);
}

function SignatureDialog({ document, patient, onClose, onSigned }) {
  const canvasRef = useRef(null);
  const lastPosition = useRef({ x: 0, y: 0 });
  const [drawing, setDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [readToEnd, setReadToEnd] = useState(false);
  const [signerName, setSignerName] = useState(patient?.nome || '');
  const [saving, setSaving] = useState(false);

  const positionFor = (event) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const pointer = event.touches?.[0] || event;
    return {
      x: (pointer.clientX - rect.left) * (canvas.width / rect.width),
      y: (pointer.clientY - rect.top) * (canvas.height / rect.height),
    };
  };

  const begin = (event) => {
    event.preventDefault();
    if (!readToEnd) return;
    const canvas = canvasRef.current;
    const point = positionFor(event);
    const context = canvas.getContext('2d');
    context.beginPath();
    context.moveTo(point.x, point.y);
    lastPosition.current = point;
    setDrawing(true);
  };

  const draw = (event) => {
    event.preventDefault();
    if (!drawing) return;
    const canvas = canvasRef.current;
    const point = positionFor(event);
    const context = canvas.getContext('2d');
    context.beginPath();
    context.moveTo(lastPosition.current.x, lastPosition.current.y);
    context.lineTo(point.x, point.y);
    context.strokeStyle = '#241C1A';
    context.lineWidth = 2.3;
    context.lineCap = 'round';
    context.stroke();
    lastPosition.current = point;
    setHasSignature(true);
  };

  const clear = () => {
    const canvas = canvasRef.current;
    canvas?.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  const confirm = async () => {
    if (!hasSignature || !readToEnd || !signerName.trim()) return;
    setSaving(true);
    const signature = canvasRef.current.toDataURL('image/png');
    const { data, error } = await updatePatientDocument(document.id, {
      status: 'signed',
      signed_by_name: signerName.trim(),
      signature_data_url: signature,
      signed_at: new Date().toISOString(),
    });
    setSaving(false);
    if (error) {
      alert(`Não foi possível assinar: ${error.message || error}`);
      return;
    }
    onSigned(data);
  };

  return (
    <div style={overlayStyle}>
      <div style={{ ...dialogStyle, maxWidth: 720 }}>
        <DialogHeader icon={PenLine} title="Ler e assinar documento" subtitle={`${patient?.nome || 'Paciente'} · versão ${document.template_version}`} onClose={onClose} />
        <div
          onScroll={(event) => {
            const node = event.currentTarget;
            if (node.scrollHeight - node.scrollTop - node.clientHeight < 20) setReadToEnd(true);
          }}
          style={{ padding: 22, overflowY: 'auto', flex: 1 }}
        >
          <DocumentPaper document={document} patient={patient} />
          <div style={{ marginTop: 18 }}>
            <label style={labelStyle}>Nome de quem está assinando *</label>
            <input value={signerName} onChange={(event) => setSignerName(event.target.value)} style={inputStyle} />
          </div>
          <div style={{ marginTop: 14, borderTop: '1px solid #EEE7E2', paddingTop: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: readToEnd ? '#3F4F45' : '#9A8C86' }}>
                {readToEnd ? 'Assine com o dedo ou mouse' : 'Leia até o final para liberar a assinatura'}
              </span>
              {hasSignature && <button type="button" onClick={clear} style={linkButtonStyle}><RotateCcw size={12} /> Limpar</button>}
            </div>
            <canvas
              ref={canvasRef}
              width={900}
              height={180}
              onMouseDown={begin}
              onMouseMove={draw}
              onMouseUp={() => setDrawing(false)}
              onMouseLeave={() => setDrawing(false)}
              onTouchStart={begin}
              onTouchMove={draw}
              onTouchEnd={() => setDrawing(false)}
              style={{ width: '100%', height: 130, border: `2px dashed ${hasSignature ? '#67A37A' : '#D9CEC8'}`, borderRadius: 10, background: readToEnd ? '#FFFEFD' : '#F5F3F1', pointerEvents: readToEnd ? 'auto' : 'none', touchAction: 'none' }}
            />
          </div>
        </div>
        <div style={dialogFooterStyle}>
          <button onClick={onClose} style={secondaryButtonStyle}>Cancelar</button>
          <button disabled={!readToEnd || !hasSignature || !signerName.trim() || saving} onClick={confirm} style={{ ...primaryButtonStyle, opacity: !readToEnd || !hasSignature || !signerName.trim() ? 0.5 : 1 }}>
            {saving ? <Loader2 size={14} className="spin" /> : <FileCheck2 size={14} />} Confirmar assinatura
          </button>
        </div>
      </div>
    </div>
  );
}

function DocumentPaper({ document, patient }) {
  return (
    <div id="patient-document-print" style={{ border: '1px solid #E8DFDA', borderRadius: 12, background: '#fff', padding: '26px 28px', color: '#332A27' }}>
      <div style={{ fontSize: 10, color: '#9A8179', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 800 }}>Evelyn Esthetic Center</div>
      <h2 style={{ margin: '7px 0 5px', fontSize: 18 }}>{document.title}</h2>
      <div style={{ fontSize: 10.5, color: '#8C7A73', marginBottom: 22 }}>
        Paciente: {patient?.nome || '—'} · Documento #{String(document.id || '').slice(0, 8)} · Versão {document.template_version || 1}
      </div>
      <div style={{ whiteSpace: 'pre-wrap', fontSize: 12.5, lineHeight: 1.72 }}>{document.content_snapshot}</div>
      {document.status === 'signed' && (
        <div style={{ marginTop: 28, paddingTop: 18, borderTop: '1px solid #E8DFDA' }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: '#688071', textTransform: 'uppercase' }}>Assinado eletronicamente</div>
          {document.signature_data_url && <img src={document.signature_data_url} alt="Assinatura" style={{ display: 'block', maxWidth: 260, maxHeight: 90, margin: '8px 0' }} />}
          <div style={{ fontSize: 11, color: '#665953' }}>{document.signed_by_name} · {formatDate(document.signed_at, true)}</div>
        </div>
      )}
      {document.status === 'revoked' && (
        <div style={{ marginTop: 22, padding: 12, borderRadius: 8, color: '#991B1B', background: '#FEF2F2', fontSize: 11 }}>
          Revogado em {formatDate(document.revoked_at, true)}. Motivo: {document.revocation_reason || 'não informado'}
        </div>
      )}
    </div>
  );
}

function ViewDialog({ document, patient, canEdit, onClose, onSign, onRevoke, onDelete }) {
  const status = patientDocumentStatus(document);
  return (
    <div style={overlayStyle}>
      <div style={{ ...dialogStyle, maxWidth: 760 }}>
        <DialogHeader icon={FileSignature} title={document.title} subtitle={`${status.label} · criado em ${formatDate(document.created_at, true)}`} onClose={onClose} />
        <div style={{ padding: 22, overflowY: 'auto', flex: 1 }}><DocumentPaper document={document} patient={patient} /></div>
        <div style={{ ...dialogFooterStyle, justifyContent: 'space-between' }}>
          <button onClick={printPatientDocument} style={secondaryButtonStyle}><Printer size={14} /> Imprimir</button>
          <div style={{ display: 'flex', gap: 8 }}>
            {canEdit && document.status === 'pending' && <button onClick={onDelete} style={dangerButtonStyle}><Trash2 size={14} /> Excluir pendente</button>}
            {canEdit && document.status === 'signed' && <button onClick={onRevoke} style={dangerButtonStyle}>Revogar</button>}
            {canEdit && document.status === 'pending' && <button onClick={onSign} style={primaryButtonStyle}><PenLine size={14} /> Assinar agora</button>}
            <button onClick={onClose} style={secondaryButtonStyle}>Fechar</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CreateDialog({ patient, onClose, onCreated }) {
  const [draft, setDraft] = useState({
    clientId: patient.id,
    type: 'procedure_consent',
    procedureName: '',
    professionalName: '',
    imageScopes: [],
    sessionCount: '',
    contractAmount: '',
    paymentTerms: '',
    content: '',
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const typeInfo = patientDocumentType(draft.type);

  const regenerate = useCallback((next = draft) => {
    setDraft((current) => ({
      ...current,
      ...next,
      content: buildPatientDocumentContent({ ...current, ...next, patientName: patient.nome }),
    }));
  }, [draft, patient.nome]);

  useEffect(() => {
    setDraft((current) => ({ ...current, content: buildPatientDocumentContent({ ...current, patientName: patient.nome }) }));
  }, [patient.nome]);

  const set = (key, value, updateContent = false) => {
    const next = { ...draft, [key]: value };
    if (updateContent) next.content = buildPatientDocumentContent({ ...next, patientName: patient.nome });
    setDraft(next);
  };

  const save = async (signAfter = false) => {
    const validation = validatePatientDocumentDraft(draft);
    if (validation) { setError(validation); return; }
    setSaving(true);
    setError('');
    const { data, error: saveError } = await insertPatientDocument({
      client_id: patient.id,
      document_type: draft.type,
      title: typeInfo.label,
      procedure_name: draft.procedureName.trim() || null,
      professional_name: draft.professionalName.trim() || null,
      content_snapshot: draft.content.trim(),
      template_version: 1,
      status: 'pending',
      image_use_scopes: draft.imageScopes,
      contract_amount: draft.contractAmount ? Number(draft.contractAmount) : null,
      contract_session_count: draft.sessionCount ? Number(draft.sessionCount) : null,
      payment_terms: draft.paymentTerms.trim() || null,
    });
    setSaving(false);
    if (saveError) {
      setError(saveError.message || String(saveError));
      return;
    }
    onCreated(data, signAfter);
  };

  return (
    <div style={overlayStyle}>
      <div style={{ ...dialogStyle, maxWidth: 780 }}>
        <DialogHeader icon={Plus} title="Novo documento" subtitle={patient.nome} onClose={onClose} />
        <div style={{ padding: 22, overflowY: 'auto', flex: 1 }}>
          {error && <div style={errorStyle}><AlertTriangle size={15} /> {error}</div>}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Tipo de documento *</label>
              <select value={draft.type} onChange={(event) => set('type', event.target.value, true)} style={inputStyle}>
                {PATIENT_DOCUMENT_TYPES.map((type) => <option key={type.id} value={type.id}>{type.label}</option>)}
              </select>
              <div style={{ marginTop: 5, fontSize: 10.5, color: '#8C7A73' }}>{typeInfo.description}</div>
            </div>
            {typeInfo.requiresProcedure && (
              <div>
                <label style={labelStyle}>Serviço ou procedimento *</label>
                <input value={draft.procedureName} onChange={(event) => set('procedureName', event.target.value, true)} style={inputStyle} placeholder="Ex.: Toxina botulínica" />
              </div>
            )}
            {draft.type !== 'image_authorization' && (
              <div>
                <label style={labelStyle}>Profissional responsável</label>
                <input value={draft.professionalName} onChange={(event) => set('professionalName', event.target.value, true)} style={inputStyle} placeholder="Nome do profissional" />
              </div>
            )}
            {draft.type === 'image_authorization' && (
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Finalidades autorizadas *</label>
                <div style={{ display: 'grid', gap: 7 }}>
                  {IMAGE_USE_SCOPES.map((scope) => (
                    <label key={scope.id} style={{ display: 'flex', gap: 8, alignItems: 'center', border: '1px solid #E9E0DB', padding: '9px 10px', borderRadius: 8, fontSize: 11.5, cursor: 'pointer' }}>
                      <input type="checkbox" checked={draft.imageScopes.includes(scope.id)} onChange={() => {
                        const scopes = draft.imageScopes.includes(scope.id) ? draft.imageScopes.filter((id) => id !== scope.id) : [...draft.imageScopes, scope.id];
                        set('imageScopes', scopes, true);
                      }} />
                      {scope.label}
                    </label>
                  ))}
                </div>
              </div>
            )}
            {draft.type === 'service_agreement' && (
              <>
                <div><label style={labelStyle}>Quantidade de sessões</label><input type="number" min="1" value={draft.sessionCount} onChange={(event) => set('sessionCount', event.target.value, true)} style={inputStyle} /></div>
                <div><label style={labelStyle}>Valor combinado (R$)</label><input type="number" min="0" step="0.01" value={draft.contractAmount} onChange={(event) => set('contractAmount', event.target.value, true)} style={inputStyle} /></div>
                <div style={{ gridColumn: '1 / -1' }}><label style={labelStyle}>Condições de pagamento</label><input value={draft.paymentTerms} onChange={(event) => set('paymentTerms', event.target.value, true)} style={inputStyle} placeholder="Ex.: 3 parcelas mensais" /></div>
              </>
            )}
            <div style={{ gridColumn: '1 / -1' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                <label style={{ ...labelStyle, margin: 0 }}>Texto que será apresentado e preservado *</label>
                <button type="button" onClick={() => regenerate()} style={linkButtonStyle}><RotateCcw size={11} /> Restaurar modelo</button>
              </div>
              <textarea value={draft.content} onChange={(event) => set('content', event.target.value)} style={{ ...inputStyle, minHeight: 220, resize: 'vertical', lineHeight: 1.55 }} />
              <div style={{ marginTop: 6, fontSize: 10, color: '#967D74' }}>Depois da assinatura, o texto e a assinatura não poderão ser alterados. Uma nova versão deve ser criada.</div>
            </div>
          </div>
        </div>
        <div style={dialogFooterStyle}>
          <button onClick={onClose} style={secondaryButtonStyle}>Cancelar</button>
          <button disabled={saving} onClick={() => save(false)} style={secondaryButtonStyle}>{saving ? 'Salvando...' : 'Salvar pendente'}</button>
          <button disabled={saving} onClick={() => save(true)} style={primaryButtonStyle}><PenLine size={14} /> Salvar e assinar</button>
        </div>
      </div>
    </div>
  );
}

function DialogHeader({ icon: Icon, title, subtitle, onClose }) {
  return (
    <div style={{ padding: '16px 20px', borderBottom: '1px solid #EEE7E2', display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ width: 34, height: 34, borderRadius: 9, display: 'grid', placeItems: 'center', background: '#F8ECEF', color: '#A53860' }}><Icon size={17} /></div>
      <div style={{ flex: 1 }}><div style={{ fontSize: 15, fontWeight: 800, color: '#352B28' }}>{title}</div><div style={{ fontSize: 10.5, color: '#927C75', marginTop: 2 }}>{subtitle}</div></div>
      <button onClick={onClose} style={closeButtonStyle}><X size={16} /></button>
    </div>
  );
}

export default function PatientDocuments({ pacientes, loadingPatients, canEdit }) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [creating, setCreating] = useState(false);
  const [viewing, setViewing] = useState(null);
  const [signing, setSigning] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await fetchPatientDocuments();
    setDocuments(data || []);
    setLoadError(error ? (error.message || String(error)) : '');
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filteredPatients = useMemo(() => {
    const normalized = search.trim().toLocaleLowerCase('pt-BR');
    if (!normalized) return pacientes;
    return pacientes.filter((patient) => `${patient.nome} ${patient.telefone}`.toLocaleLowerCase('pt-BR').includes(normalized));
  }, [pacientes, search]);

  const selectedDocuments = useMemo(() => selectedPatient
    ? documents.filter((document) => String(document.client_id) === String(selectedPatient.id))
    : [], [documents, selectedPatient]);
  const signedCount = documents.filter((item) => item.status === 'signed').length;
  const pendingCount = documents.filter((item) => item.status === 'pending').length;
  const patientsWithDocs = new Set(documents.map((item) => String(item.client_id))).size;

  const onCreated = (document, signAfter) => {
    setDocuments((current) => [document, ...current]);
    setCreating(false);
    if (signAfter) setSigning(document);
    else setViewing(document);
  };

  const onSigned = (document) => {
    setDocuments((current) => current.map((item) => item.id === document.id ? document : item));
    setSigning(null);
    setViewing(document);
  };

  const revoke = async (document) => {
    const reason = window.prompt('Informe o motivo da revogação. O documento continuará no histórico:');
    if (reason === null) return;
    const { data, error } = await updatePatientDocument(document.id, {
      status: 'revoked', revoked_at: new Date().toISOString(), revocation_reason: reason.trim() || 'Solicitação do titular',
    });
    if (error) { alert(`Não foi possível revogar: ${error.message || error}`); return; }
    setDocuments((current) => current.map((item) => item.id === data.id ? data : item));
    setViewing(data);
  };

  const removePending = async (document) => {
    if (!window.confirm('Excluir este documento pendente?')) return;
    const { error } = await deletePendingPatientDocument(document.id);
    if (error) { alert(`Não foi possível excluir: ${error.message || error}`); return; }
    setDocuments((current) => current.filter((item) => item.id !== document.id));
    setViewing(null);
  };

  return (
    <div style={{ minHeight: 0, flex: 1, display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10, marginBottom: 12 }}>
        <Metric value={signedCount} label="Documentos assinados" color="#047857" background="#ECFDF5" />
        <Metric value={pendingCount} label="Aguardando assinatura" color="#B45309" background="#FFFBEB" />
        <Metric value={patientsWithDocs} label="Pacientes com documentos" color="#9B2C50" background="#FDF4F7" />
      </div>

      {loadError && (
        <div style={{ ...errorStyle, marginBottom: 12, alignItems: 'flex-start' }}>
          <AlertTriangle size={16} style={{ marginTop: 1, flexShrink: 0 }} />
          <div><strong>Banco ainda não preparado para os documentos.</strong><div style={{ marginTop: 3 }}>Execute o arquivo patient_documents_migration.sql no SQL Editor do Supabase e clique em atualizar.</div></div>
          <button onClick={load} style={{ ...secondaryButtonStyle, marginLeft: 'auto' }}>Atualizar</button>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 0.8fr) minmax(420px, 1.6fr)', gap: 12, minHeight: 0, flex: 1 }}>
        <section style={panelStyle}>
          <div style={{ padding: 12, borderBottom: '1px solid #EEE7E2' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, border: '1px solid #E5DDD8', borderRadius: 9, padding: '8px 10px' }}>
              <Search size={14} color="#9A8780" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar paciente..." style={{ border: 0, outline: 0, flex: 1, fontSize: 12, minWidth: 0 }} />
            </div>
          </div>
          <div style={{ overflowY: 'auto', minHeight: 0 }}>
            {(loadingPatients || loading) ? <Loading /> : filteredPatients.map((patient) => {
              const patientDocs = documents.filter((document) => String(document.client_id) === String(patient.id));
              const pending = patientDocs.filter((document) => document.status === 'pending').length;
              const selected = selectedPatient?.id === patient.id;
              return (
                <button key={patient.id} onClick={() => setSelectedPatient(patient)} style={{ width: '100%', border: 0, borderBottom: '1px solid #F2ECE8', background: selected ? '#FDF4F7' : '#fff', padding: '11px 12px', display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer', textAlign: 'left' }}>
                  <div style={{ width: 34, height: 34, borderRadius: '50%', display: 'grid', placeItems: 'center', color: selected ? '#A4315A' : '#846D65', background: selected ? '#F6DCE5' : '#F3EFEC', fontWeight: 800, fontSize: 12 }}>{patient.avatar || patient.nome?.charAt(0)}</div>
                  <div style={{ minWidth: 0, flex: 1 }}><strong style={{ display: 'block', fontSize: 12, color: '#3C302C', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{patient.nome}</strong><small style={{ color: '#9A8780' }}>{patientDocs.length} documento(s){pending ? ` · ${pending} pendente(s)` : ''}</small></div>
                  <ChevronRight size={14} color="#B5A49E" />
                </button>
              );
            })}
          </div>
        </section>

        <section style={panelStyle}>
          {!selectedPatient ? (
            <div style={emptyStyle}><UserRound size={34} /><strong>Selecione um paciente</strong><span>Os documentos e consentimentos aparecerão aqui.</span></div>
          ) : (
            <>
              <div style={{ padding: '13px 15px', borderBottom: '1px solid #EEE7E2', display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ flex: 1 }}><strong style={{ display: 'block', fontSize: 14, color: '#3A2F2B' }}>{selectedPatient.nome}</strong><span style={{ fontSize: 10.5, color: '#927C75' }}>{selectedPatient.telefone || 'Sem telefone'}</span></div>
                {canEdit && <button onClick={() => setCreating(true)} style={primaryButtonStyle}><Plus size={14} /> Novo documento</button>}
              </div>
              <div style={{ padding: 12, overflowY: 'auto', minHeight: 0 }}>
                {selectedDocuments.length === 0 ? (
                  <div style={emptyStyle}><FileSignature size={34} /><strong>Nenhum documento criado</strong><span>Crie somente o documento necessário para este paciente.</span>{canEdit && <button onClick={() => setCreating(true)} style={primaryButtonStyle}><Plus size={14} /> Criar primeiro documento</button>}</div>
                ) : selectedDocuments.map((document) => {
                  const type = patientDocumentType(document.document_type);
                  const status = patientDocumentStatus(document);
                  return (
                    <div key={document.id} style={{ width: '100%', padding: '7px 8px 7px 12px', border: '1px solid #EAE2DD', borderRadius: 10, background: '#fff', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 7 }}>
                      <button onClick={() => setViewing(document)} style={{ minWidth: 0, flex: 1, padding: '4px 0', border: 0, background: 'transparent', display: 'flex', alignItems: 'center', gap: 11, textAlign: 'left', cursor: 'pointer' }}>
                        <div style={{ width: 36, height: 36, borderRadius: 9, display: 'grid', placeItems: 'center', background: '#F8F1ED', color: '#A55D45', flexShrink: 0 }}><FileCheck2 size={17} /></div>
                        <div style={{ flex: 1, minWidth: 0 }}><strong style={{ display: 'block', fontSize: 12, color: '#3D322E' }}>{type.label}</strong><span style={{ fontSize: 10.5, color: '#98827A' }}>{document.procedure_name || 'Documento geral'} · {formatDate(document.signed_at || document.created_at, true)}</span></div>
                        <span style={{ padding: '4px 8px', borderRadius: 20, background: status.background, color: status.color, fontSize: 9.5, fontWeight: 800, flexShrink: 0 }}>{status.label}</span>
                        <Eye size={14} color="#A8958D" style={{ flexShrink: 0 }} />
                      </button>
                      {canEdit && document.status === 'pending' && (
                        <button
                          type="button"
                          onClick={() => removePending(document)}
                          title="Excluir documento pendente"
                          aria-label={`Excluir ${type.label}`}
                          style={{ width: 32, height: 32, border: '1px solid #F1B8B2', borderRadius: 8, background: '#FFF7F6', color: '#C33A31', display: 'grid', placeItems: 'center', cursor: 'pointer', flexShrink: 0 }}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </section>
      </div>

      {creating && selectedPatient && <CreateDialog patient={selectedPatient} onClose={() => setCreating(false)} onCreated={onCreated} />}
      {viewing && selectedPatient && <ViewDialog document={viewing} patient={selectedPatient} canEdit={canEdit} onClose={() => setViewing(null)} onSign={() => { setSigning(viewing); setViewing(null); }} onRevoke={() => revoke(viewing)} onDelete={() => removePending(viewing)} />}
      {signing && selectedPatient && <SignatureDialog document={signing} patient={selectedPatient} onClose={() => setSigning(null)} onSigned={onSigned} />}
    </div>
  );
}

function Metric({ value, label, color, background }) {
  return <div style={{ ...panelStyle, padding: '11px 14px', display: 'flex', alignItems: 'center', gap: 11 }}><div style={{ width: 36, height: 36, borderRadius: 9, display: 'grid', placeItems: 'center', color, background, fontWeight: 900 }}>{value}</div><span style={{ fontSize: 11.5, color: '#715F58', fontWeight: 700 }}>{label}</span></div>;
}

function Loading() {
  return <div style={{ padding: 35, textAlign: 'center', color: '#9A8780', fontSize: 11 }}><Loader2 size={21} style={{ margin: '0 auto 8px', animation: 'spin 1s linear infinite' }} />Carregando...</div>;
}

const overlayStyle = { position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(35, 27, 24, 0.58)', backdropFilter: 'blur(3px)', display: 'grid', placeItems: 'center', padding: 16 };
const dialogStyle = { width: '100%', maxHeight: '92vh', background: '#FFFEFD', borderRadius: 16, boxShadow: '0 26px 80px rgba(35, 20, 15, 0.28)', overflow: 'hidden', display: 'flex', flexDirection: 'column' };
const dialogFooterStyle = { padding: '12px 18px', borderTop: '1px solid #EEE7E2', display: 'flex', justifyContent: 'flex-end', gap: 8, background: '#FCFAF8' };
const panelStyle = { background: '#fff', border: '1px solid #E9DFDA', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 3px rgba(70,45,35,0.04)' };
const primaryButtonStyle = { border: 0, borderRadius: 8, background: '#B7796B', color: '#fff', padding: '8px 11px', fontSize: 11, fontWeight: 800, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 };
const secondaryButtonStyle = { border: '1px solid #DCCFC9', borderRadius: 8, background: '#fff', color: '#705D56', padding: '8px 11px', fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 };
const dangerButtonStyle = { ...secondaryButtonStyle, color: '#B42318', borderColor: '#F1B8B2', background: '#FFF7F6' };
const linkButtonStyle = { border: 0, background: 'transparent', color: '#9B2C50', padding: 0, fontSize: 10.5, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 };
const closeButtonStyle = { width: 31, height: 31, borderRadius: 8, border: 0, background: '#F4EFEC', color: '#826E67', display: 'grid', placeItems: 'center', cursor: 'pointer' };
const emptyStyle = { minHeight: 260, height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 7, color: '#9C8880', fontSize: 11.5, padding: 24 };
const errorStyle = { display: 'flex', gap: 8, padding: '10px 12px', border: '1px solid #F3C7A6', borderRadius: 9, background: '#FFF8ED', color: '#9A4D16', fontSize: 11 };
