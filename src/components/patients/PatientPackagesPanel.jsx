/* eslint-disable react/prop-types */
import { useMemo, useState } from 'react';
import { CalendarClock, CheckCircle2, Loader2, PackagePlus, Plus, Signature } from 'lucide-react';
import { addMonthsToDate, packageProgress, packageServiceNames } from '../../lib/patientPackages';
import { insertPatientPackage, insertPatientPackageSession } from '../../services/supabaseService';

const dateToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const dateBR = (value) => value ? new Date(`${String(value).slice(0, 10)}T12:00:00`).toLocaleDateString('pt-BR') : 'Sem vencimento';

export default function PatientPackagesPanel({ patient, catalog = [], packages = [], sessions = [], canEdit, loadError, onRefresh }) {
  const [creating, setCreating] = useState(false);
  const patientPackages = useMemo(() => packages.filter((item) => String(item.client_id) === String(patient.id)), [packages, patient.id]);

  return (
    <section style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-medium)' }}>Pacotes e sessões</div>
        {canEdit && <button onClick={() => setCreating(true)} title="Vincular pacote à paciente" style={smallButton}><Plus size={12}/> Pacote</button>}
      </div>

      {loadError ? (
        <div style={{ padding: 10, borderRadius: 8, background: '#FFFBEB', border: '1px solid #FDE68A', color: '#92400E', fontSize: 10.5 }}>
          Execute <strong>patient_packages_migration.sql</strong> no Supabase para ativar o controle.
        </div>
      ) : patientPackages.length === 0 ? (
        <div style={{ padding: 12, borderRadius: 9, background: '#FAF8F6', border: '1px dashed #DCCFC9', color: '#927C75', textAlign: 'center', fontSize: 10.5 }}>
          Nenhum pacote vinculado a esta paciente.
        </div>
      ) : patientPackages.map((item) => {
        const progress = packageProgress(item, sessions);
        const packageSessions = sessions.filter((session) => String(session.patient_package_id) === String(item.id) && session.status !== 'reversed');
        const unsigned = packageSessions.filter((session) => session.status === 'pending_signature').length;
        return (
          <div key={item.id} style={{ padding: 11, border: '1px solid #E9DFDA', borderRadius: 10, background: '#fff', marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
              <div style={{ minWidth: 0 }}><strong style={{ display: 'block', fontSize: 11.5, color: '#3D322E' }}>{item.package_name}</strong><span style={{ display: 'block', marginTop: 2, fontSize: 9.5, color: '#927C75' }}>{packageServiceNames(item).join(' · ') || 'Serviços conforme cadastro'}</span></div>
              <span style={{ ...statusBadge, background: statusColor[progress.status]?.bg, color: statusColor[progress.status]?.color }}>{statusLabel[progress.status]}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 10 }}>
              <span style={{ fontSize: 18, fontWeight: 900, color: '#A4315A' }}>{progress.remaining}</span>
              <span style={{ fontSize: 10, color: '#826E67' }}>{progress.used} realizadas de {progress.total}</span>
            </div>
            <div style={{ height: 6, background: '#F0E8E4', borderRadius: 99, overflow: 'hidden', marginTop: 5 }}><div style={{ width: `${progress.percent}%`, height: '100%', background: progress.remaining ? '#B7796B' : '#27966A', borderRadius: 99 }}/></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 7, marginTop: 8, fontSize: 9.5, color: '#927C75' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><CalendarClock size={11}/> até {dateBR(item.expires_at)}</span>
              {unsigned > 0 ? <span style={{ color: '#B45309', fontWeight: 700 }}><Signature size={10}/> {unsigned} aguardando assinatura</span> : progress.used > 0 ? <span style={{ color: '#047857', fontWeight: 700 }}><CheckCircle2 size={10}/> assinaturas em dia</span> : null}
            </div>
          </div>
        );
      })}

      {creating && <NewPackageDialog patient={patient} catalog={catalog} onClose={() => setCreating(false)} onSaved={async () => { setCreating(false); await onRefresh?.(); }}/>} 
    </section>
  );
}

function NewPackageDialog({ patient, catalog, onClose, onSaved }) {
  const first = catalog.find((item) => item.ativo !== false);
  const [form, setForm] = useState(() => ({ packageId: first?.id || '', purchasedAt: dateToday(), expiresAt: first ? addMonthsToDate(dateToday(), first.validade) : '', initialUsed: 0, notes: '' }));
  const [saving, setSaving] = useState(false);
  const selected = catalog.find((item) => String(item.id) === String(form.packageId));
  const updatePackage = (id) => {
    const item = catalog.find((pkg) => String(pkg.id) === String(id));
    setForm((current) => ({ ...current, packageId: id, expiresAt: item ? addMonthsToDate(current.purchasedAt, item.validade) : '' }));
  };
  const updateDate = (purchasedAt) => setForm((current) => ({ ...current, purchasedAt, expiresAt: selected ? addMonthsToDate(purchasedAt, selected.validade) : current.expiresAt }));

  const save = async () => {
    if (!selected) { alert('Selecione um pacote.'); return; }
    const initialUsed = Math.min(Number(form.initialUsed) || 0, Number(selected.sessoes) || 1);
    setSaving(true);
    const { data, error } = await insertPatientPackage({
      client_id: patient.id,
      package_id: selected.id,
      package_name: selected.nome,
      services: selected.servicos || [],
      total_sessions: Number(selected.sessoes) || 1,
      total_amount: Number(selected.preco) || 0,
      purchased_at: form.purchasedAt,
      expires_at: form.expiresAt || null,
      status: initialUsed >= Number(selected.sessoes || 1) ? 'completed' : 'active',
      notes: form.notes.trim() || null,
    });
    if (error) { setSaving(false); alert(`Não foi possível vincular o pacote: ${error.message || error}`); return; }

    for (let index = 1; index <= initialUsed; index += 1) {
      const legacy = await insertPatientPackageSession({
        patient_package_id: data.id,
        client_id: patient.id,
        session_number: index,
        service_name: 'Sessão anterior ao controle digital',
        performed_at: `${form.purchasedAt}T12:00:00`,
        status: 'legacy',
        acknowledgment_text: 'Sessão informada na implantação do controle digital; sem assinatura eletrônica.',
      });
      if (legacy.error) { setSaving(false); alert(`Pacote criado, mas não foi possível importar todas as sessões anteriores: ${legacy.error.message || legacy.error}`); await onSaved(); return; }
    }
    setSaving(false);
    await onSaved();
  };

  return (
    <div style={overlay} onClick={onClose}>
      <div style={{ ...dialog, width: 'min(520px, 96vw)' }} onClick={(event) => event.stopPropagation()}>
        <header style={dialogHeader}><div style={{ flex: 1 }}><strong>Vincular pacote à paciente</strong><div style={{ fontSize: 10.5, color: '#927C75', marginTop: 2 }}>{patient.nome}</div></div><button onClick={onClose} style={closeButton}>×</button></header>
        <div style={{ padding: 18 }}>
          <label style={label}>Pacote *</label>
          <select value={form.packageId} onChange={(event) => updatePackage(event.target.value)} style={input}>
            <option value="">Selecione...</option>
            {catalog.filter((item) => item.ativo !== false).map((item) => <option key={item.id} value={item.id}>{item.nome} · {item.sessoes} sessões</option>)}
          </select>
          {selected && <div style={{ padding: 10, marginTop: 8, borderRadius: 8, background: '#FDF4F7', color: '#76505E', fontSize: 10.5 }}>{packageServiceNames({ services: selected.servicos }).join(' · ') || 'Serviços não especificados'} · R$ {Number(selected.preco || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
            <div><label style={label}>Data da compra</label><input type="date" value={form.purchasedAt} onChange={(event) => updateDate(event.target.value)} style={input}/></div>
            <div><label style={label}>Validade</label><input type="date" value={form.expiresAt} onChange={(event) => setForm((current) => ({ ...current, expiresAt: event.target.value }))} style={input}/></div>
          </div>
          <div style={{ marginTop: 12 }}><label style={label}>Sessões já realizadas antes deste controle</label><input type="number" min="0" max={selected?.sessoes || 0} value={form.initialUsed} onChange={(event) => setForm((current) => ({ ...current, initialUsed: event.target.value }))} style={input}/><div style={{ fontSize: 9.5, color: '#927C75', marginTop: 4 }}>Essas sessões entram como histórico anterior e não exigirão assinatura retroativa.</div></div>
          <div style={{ marginTop: 12 }}><label style={label}>Observações</label><textarea value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} style={{ ...input, minHeight: 70, resize: 'vertical' }}/></div>
        </div>
        <footer style={dialogFooter}><button onClick={onClose} style={secondaryButton}>Cancelar</button><button onClick={save} disabled={saving || !selected} style={{ ...primaryButton, opacity: saving || !selected ? .6 : 1 }}>{saving ? <Loader2 size={14} className="spin"/> : <PackagePlus size={14}/>} Vincular pacote</button></footer>
      </div>
    </div>
  );
}

const statusLabel = { active: 'Ativo', completed: 'Concluído', expired: 'Vencido', paused: 'Pausado', cancelled: 'Cancelado' };
const statusColor = { active: { bg: '#ECFDF5', color: '#047857' }, completed: { bg: '#EFF6FF', color: '#1D4ED8' }, expired: { bg: '#FEF2F2', color: '#B91C1C' }, paused: { bg: '#FFFBEB', color: '#B45309' }, cancelled: { bg: '#F3F4F6', color: '#6B7280' } };
const statusBadge = { flexShrink: 0, padding: '3px 7px', borderRadius: 20, fontSize: 8.5, fontWeight: 800 };
const smallButton = { border: '1px solid #E1D2CC', background: '#fff', color: '#9B2C50', borderRadius: 7, padding: '4px 7px', fontSize: 9.5, fontWeight: 800, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 3 };
const overlay = { position: 'fixed', inset: 0, zIndex: 12500, background: 'rgba(35,27,24,.6)', backdropFilter: 'blur(4px)', display: 'grid', placeItems: 'center', padding: 16 };
const dialog = { background: '#FFFEFD', borderRadius: 16, boxShadow: '0 28px 80px rgba(35,20,15,.28)', overflow: 'hidden' };
const dialogHeader = { display: 'flex', alignItems: 'center', gap: 10, padding: '16px 18px', borderBottom: '1px solid #EEE7E2' };
const dialogFooter = { display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 18px', borderTop: '1px solid #EEE7E2', background: '#FCFAF8' };
const closeButton = { width: 30, height: 30, borderRadius: 8, border: 0, background: '#F4EFEC', color: '#826E67', fontSize: 18, cursor: 'pointer' };
const label = { display: 'block', fontSize: 10.5, fontWeight: 800, color: '#705D56', marginBottom: 5 };
const input = { width: '100%', boxSizing: 'border-box', border: '1px solid #DCCFC9', borderRadius: 8, background: '#fff', padding: '9px 10px', fontSize: 12, outline: 0 };
const primaryButton = { border: 0, borderRadius: 8, background: '#B7796B', color: '#fff', padding: '9px 12px', fontSize: 11.5, fontWeight: 800, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 };
const secondaryButton = { border: '1px solid #DCCFC9', borderRadius: 8, background: '#fff', color: '#705D56', padding: '8px 11px', fontSize: 11, fontWeight: 700, cursor: 'pointer' };
