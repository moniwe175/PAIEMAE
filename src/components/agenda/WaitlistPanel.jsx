/* eslint-disable react/prop-types */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, CalendarPlus, Check, ChevronLeft, ChevronRight,
  ClipboardList, Clock3, Loader2, MessageCircle, Plus, Search, UserRound, X,
} from 'lucide-react';
import {
  fetchAppointmentWaitlist,
  fetchClients,
  insertAppointmentWaitlist,
  updateAppointmentWaitlist,
} from '../../services/supabaseService';
import {
  compatibleWaitlistEntries,
  isActiveWaitlistEntry,
  sortWaitlistEntries,
  WAITLIST_PERIODS,
  waitlistMatchesSlot,
} from '../../lib/agendaWaitlist';

const emptyForm = () => ({
  client_id: '', service: '', preferred_professional: '', preferred_period: 'qualquer',
  notes: '',
});

function formatDateBR(date) {
  if (!date) return '';
  return new Date(`${date}T12:00:00`).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

function clientFromEntry(entry) {
  return entry?.clients || {};
}

function waitingSince(value) {
  if (!value) return 'hoje';
  const created = new Date(value);
  const days = Math.max(0, Math.floor((Date.now() - created.getTime()) / 86400000));
  if (days === 0) return 'hoje';
  if (days === 1) return 'ha 1 dia';
  return `ha ${days} dias`;
}

function whatsappUrl(phone, name, service) {
  let digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (!digits.startsWith('55')) digits = `55${digits}`;
  const message = `Ola, ${name || ''}! Surgiu um horario para ${service || 'o procedimento desejado'}. Voce gostaria de reservar?`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

export default function WaitlistPanel({
  open,
  onToggle,
  professionals,
  selectedDate,
  vacancy,
  onClearVacancy,
  onSchedule,
  canEdit,
  refreshKey,
}) {
  const [entries, setEntries] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [clientQuery, setClientQuery] = useState('');
  const [saving, setSaving] = useState(false);

  const services = useMemo(() => [...new Set(
    (professionals || []).flatMap((professional) => professional.servicos || []).filter(Boolean),
  )].sort((a, b) => a.localeCompare(b, 'pt-BR')), [professionals]);

  const load = useCallback(async () => {
    setLoading(true);
    setEntries([]);
    const waitlistResult = await fetchAppointmentWaitlist({ date: selectedDate });

    if (waitlistResult.error) {
      setError(waitlistResult.error.message || 'Nao foi possivel carregar a lista de espera.');
      setEntries([]);
    } else {
      setEntries((waitlistResult.data || []).filter((entry) => isActiveWaitlistEntry(entry, selectedDate)));
      setError('');
    }
    setLoading(false);
  }, [selectedDate]);

  useEffect(() => { load(); }, [load, refreshKey]);
  useEffect(() => {
    fetchClients().then((result) => setClients(result.data || []));
  }, []);
  useEffect(() => {
    setFormOpen(false);
    setForm(emptyForm());
    setClientQuery('');
  }, [selectedDate]);

  const dayVacancy = vacancy?.date === selectedDate ? vacancy : null;
  const sortedEntries = useMemo(() => sortWaitlistEntries(entries), [entries]);
  const candidates = useMemo(() => (
    dayVacancy ? compatibleWaitlistEntries(entries, dayVacancy) : []
  ), [entries, dayVacancy]);
  const candidateIds = useMemo(() => new Set(candidates.map((entry) => entry.id)), [candidates]);

  const filteredClients = useMemo(() => {
    const query = clientQuery.trim().toLocaleLowerCase('pt-BR');
    if (!query) return clients.slice(0, 8);
    const digits = query.replace(/\D/g, '');
    return clients.filter((client) => (
      String(client.name || '').toLocaleLowerCase('pt-BR').includes(query)
      || (digits && String(client.phone || '').replace(/\D/g, '').includes(digits))
    )).slice(0, 8);
  }, [clients, clientQuery]);

  const selectedClient = clients.find((client) => String(client.id) === String(form.client_id));

  const handleAdd = async () => {
    if (!form.client_id || !form.service) return;
    setSaving(true);
    const result = await insertAppointmentWaitlist({
      ...form,
      waitlist_date: selectedDate,
    });
    setSaving(false);
    if (result.error) {
      const duplicate = result.error.code === '23505' || /duplicate|unique/i.test(result.error.message || '');
      setError(duplicate
        ? 'Este cliente ja esta aguardando o mesmo servico.'
        : result.error.message || 'Nao foi possivel adicionar a espera.');
      return;
    }
    setEntries((current) => sortWaitlistEntries([...current, result.data]));
    setForm(emptyForm());
    setClientQuery('');
    setFormOpen(false);
    setError('');
  };

  const handleContact = async (entry) => {
    const client = clientFromEntry(entry);
    const url = whatsappUrl(client.phone, client.name, entry.service);
    if (!url) {
      setError('Este paciente nao possui telefone cadastrado.');
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
    const result = await updateAppointmentWaitlist(entry.id, {
      status: 'contatada',
      contacted_at: new Date().toISOString(),
    });
    if (result.data) {
      setEntries((current) => current.map((item) => item.id === entry.id ? result.data : item));
    }
  };

  const handleGiveUp = async (entry) => {
    const result = await updateAppointmentWaitlist(entry.id, { status: 'desistiu' });
    if (result.data) setEntries((current) => current.filter((item) => item.id !== entry.id));
  };

  if (!open) {
    return (
      <aside style={{ width: 46, flexShrink: 0, border: '1px solid #E9DAD5', borderRadius: 14, background: '#fff', overflow: 'hidden' }}>
        <button type="button" onClick={onToggle} aria-label="Abrir lista de espera" style={{ width: '100%', height: '100%', minHeight: 220, border: 0, background: '#fff', color: '#9B2C50', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
          <ChevronLeft size={16} />
          <ClipboardList size={18} />
          <span style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', fontSize: 11, fontWeight: 800, letterSpacing: '.04em' }}>Lista de espera</span>
          <span style={{ minWidth: 20, height: 20, borderRadius: 99, background: '#FCE7F3', display: 'grid', placeItems: 'center', fontSize: 10, fontWeight: 800 }}>{entries.length}</span>
        </button>
      </aside>
    );
  }

  return (
    <aside style={{ width: 330, flexShrink: 0, border: '1px solid #E9DAD5', borderRadius: 16, background: '#fff', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 2px 8px rgba(0,0,0,.04)' }}>
      <header style={{ padding: '13px 14px', borderBottom: '1px solid #F0E5E1', display: 'flex', alignItems: 'center', gap: 9, background: '#FFFBFA' }}>
        <div style={{ width: 32, height: 32, borderRadius: 9, background: '#FCE7F3', color: '#9B2C50', display: 'grid', placeItems: 'center' }}><ClipboardList size={16} /></div>
        <div style={{ flex: 1 }}>
          <strong style={{ display: 'block', fontSize: 13 }}>Lista de espera</strong>
          <small style={{ color: '#927A74', fontSize: 10 }}>{formatDateBR(selectedDate)} · {entries.length} aguardando</small>
        </div>
        <button type="button" onClick={onToggle} aria-label="Fechar lista de espera" style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid #E9DAD5', background: '#fff', cursor: 'pointer', display: 'grid', placeItems: 'center' }}><ChevronRight size={15} /></button>
      </header>

      <div style={{ padding: 12, overflowY: 'auto', flex: 1 }}>
        {dayVacancy && (
          <section style={{ padding: 11, borderRadius: 11, border: '1px solid #F5C98C', background: '#FFF8EC', marginBottom: 11 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <div>
                <strong style={{ display: 'block', fontSize: 11.5, color: '#8A531D' }}>Horario liberado</strong>
                <span style={{ display: 'block', marginTop: 3, fontSize: 10, color: '#9A672F' }}>{dayVacancy.service} · {dayVacancy.time} · {dayVacancy.professional}</span>
                <span style={{ display: 'block', marginTop: 4, fontSize: 10, fontWeight: 700, color: '#8A531D' }}>{candidates.length} pessoa(s) compativel(is)</span>
              </div>
              <button type="button" onClick={onClearVacancy} aria-label="Dispensar sugestao" style={{ border: 0, background: 'transparent', color: '#9A672F', cursor: 'pointer', alignSelf: 'flex-start' }}><X size={14} /></button>
            </div>
          </section>
        )}

        {canEdit && (
          <button type="button" onClick={() => setFormOpen((value) => !value)} style={{ width: '100%', minHeight: 36, borderRadius: 9, border: '1px solid #C98B7D', background: formOpen ? '#FFF7F5' : '#B8796D', color: formOpen ? '#8E5146' : '#fff', fontSize: 11, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 10 }}>
            {formOpen ? <X size={14} /> : <Plus size={14} />}{formOpen ? 'Cancelar cadastro' : 'Adicionar cliente'}
          </button>
        )}

        {formOpen && (
          <section style={{ padding: 11, border: '1px solid #E9DAD5', borderRadius: 11, background: '#FCFAF9', marginBottom: 11 }}>
            <div style={{ padding: '7px 9px', marginBottom: 9, borderRadius: 8, background: '#FCE7F3', color: '#8E3458', fontSize: 10, fontWeight: 800 }}>
              Espera para {formatDateBR(selectedDate)}
            </div>
            <label style={labelStyle}>Paciente cadastrado *</label>
            {selectedClient ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 9, border: '1px solid #D8C3BC', borderRadius: 8, background: '#fff', marginBottom: 9 }}>
                <UserRound size={14} color="#9B2C50" />
                <div style={{ minWidth: 0, flex: 1 }}><strong style={{ display: 'block', fontSize: 11 }}>{selectedClient.name}</strong><small style={{ fontSize: 9, color: '#927A74' }}>{selectedClient.phone || 'Sem telefone'}</small></div>
                <button type="button" onClick={() => setForm((old) => ({ ...old, client_id: '' }))} style={iconButtonStyle}><X size={13} /></button>
              </div>
            ) : (
              <div style={{ position: 'relative', marginBottom: 9 }}>
                <Search size={13} style={{ position: 'absolute', left: 9, top: 10, color: '#9B8A84' }} />
                <input value={clientQuery} onChange={(event) => setClientQuery(event.target.value)} placeholder="Buscar em Pacientes..." style={{ ...inputStyle, paddingLeft: 28 }} />
                {clientQuery && (
                  <div style={{ marginTop: 4, border: '1px solid #E9DAD5', borderRadius: 8, background: '#fff', maxHeight: 150, overflowY: 'auto' }}>
                    {filteredClients.map((client) => <button type="button" key={client.id} onClick={() => { setForm((old) => ({ ...old, client_id: client.id })); setClientQuery(''); }} style={{ width: '100%', padding: '8px 9px', border: 0, borderBottom: '1px solid #F4ECE9', background: '#fff', textAlign: 'left', cursor: 'pointer' }}><strong style={{ display: 'block', fontSize: 10.5 }}>{client.name}</strong><small style={{ color: '#927A74', fontSize: 9 }}>{client.phone || 'Sem telefone'}</small></button>)}
                    {!filteredClients.length && <div style={{ padding: 10, fontSize: 10, color: '#927A74' }}>Nenhum paciente encontrado.</div>}
                  </div>
                )}
              </div>
            )}

            <label style={labelStyle}>Servico desejado *</label>
            <select value={form.service} onChange={(event) => setForm((old) => ({ ...old, service: event.target.value }))} style={inputStyle}>
              <option value="">Selecione...</option>
              {services.map((service) => <option value={service} key={service}>{service}</option>)}
            </select>

            <label style={labelStyle}>Profissional</label>
            <select value={form.preferred_professional} onChange={(event) => setForm((old) => ({ ...old, preferred_professional: event.target.value }))} style={inputStyle}>
              <option value="">Qualquer profissional</option>
              {(professionals || []).map((professional) => <option value={professional.nome} key={professional.id || professional.nome}>{professional.nome}</option>)}
            </select>

            <label style={labelStyle}>Periodo</label>
            <select value={form.preferred_period} onChange={(event) => setForm((old) => ({ ...old, preferred_period: event.target.value }))} style={inputStyle}>{WAITLIST_PERIODS.map((period) => <option value={period.value} key={period.value}>{period.label}</option>)}</select>

            <label style={labelStyle}>Observacao</label>
            <textarea value={form.notes} maxLength={240} onChange={(event) => setForm((old) => ({ ...old, notes: event.target.value }))} placeholder="Preferencias importantes..." style={{ ...inputStyle, resize: 'vertical', minHeight: 54 }} />

            <button type="button" disabled={!form.client_id || !form.service || saving} onClick={handleAdd} style={{ width: '100%', minHeight: 34, marginTop: 9, borderRadius: 8, border: 0, background: form.client_id && form.service ? '#9B2C50' : '#E5DCD9', color: form.client_id && form.service ? '#fff' : '#9B8A84', fontSize: 10.5, fontWeight: 800, cursor: form.client_id && form.service ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              {saving ? <Loader2 size={13} className="spin" /> : <Check size={13} />}Salvar na lista
            </button>
          </section>
        )}

        {error && <div style={{ display: 'flex', gap: 7, padding: 9, borderRadius: 9, background: '#FFF1F1', color: '#A53B3B', fontSize: 10, lineHeight: 1.4, marginBottom: 9 }}><AlertTriangle size={14} style={{ flexShrink: 0 }} /><span>{error.includes('appointment_waitlist') ? 'A lista de espera ainda precisa ser instalada no Supabase com agenda_waitlist_migration.sql.' : error}</span></div>}

        {loading ? (
          <div style={{ minHeight: 150, display: 'grid', placeItems: 'center', color: '#927A74' }}><Loader2 size={18} className="spin" /></div>
        ) : sortedEntries.length === 0 ? (
          <div style={{ minHeight: 150, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', color: '#927A74', padding: 20 }}><ClipboardList size={25} style={{ opacity: .5, marginBottom: 8 }} /><strong style={{ fontSize: 11 }}>Ninguem aguardando</strong><span style={{ fontSize: 9.5, marginTop: 4 }}>Adicione somente clientes ja cadastrados.</span></div>
        ) : (
          <div style={{ display: 'grid', gap: 8 }}>
            {sortedEntries.map((entry) => {
              const client = clientFromEntry(entry);
              const highlighted = dayVacancy && candidateIds.has(entry.id);
              const exactVacancy = dayVacancy && waitlistMatchesSlot(entry, dayVacancy);
              return (
                <article key={entry.id} style={{ padding: 10, borderRadius: 11, border: `1px solid ${highlighted ? '#E8A74B' : '#E9DAD5'}`, background: highlighted ? '#FFFBF1' : '#fff', boxShadow: highlighted ? '0 0 0 2px rgba(232,167,75,.12)' : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <div style={{ width: 29, height: 29, flexShrink: 0, borderRadius: 9, background: '#FCE7F3', color: '#9B2C50', display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 800 }}>{String(client.name || '?').charAt(0).toUpperCase()}</div>
                    <div style={{ minWidth: 0, flex: 1 }}><strong style={{ display: 'block', fontSize: 11.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{client.name || 'Paciente'}</strong><span style={{ display: 'block', color: '#9B2C50', fontSize: 10, fontWeight: 700, marginTop: 2 }}>{entry.service}</span></div>
                    {entry.status === 'contatada' && <span style={{ padding: '3px 6px', borderRadius: 99, background: '#EEF4FF', color: '#426A9D', fontSize: 8, fontWeight: 800 }}>CONTATADA</span>}
                  </div>
                  <div style={{ display: 'grid', gap: 4, marginTop: 8, padding: 7, borderRadius: 8, background: '#FAF7F6', color: '#806B65', fontSize: 9.5 }}>
                    <span style={{ display: 'flex', gap: 5, alignItems: 'center' }}><UserRound size={11} />{entry.preferred_professional || 'Qualquer profissional'}</span>
                    <span style={{ display: 'flex', gap: 5, alignItems: 'center' }}><Clock3 size={11} />{WAITLIST_PERIODS.find((period) => period.value === entry.preferred_period)?.label || 'Qualquer horario'} · esperando {waitingSince(entry.created_at)}</span>
                    {entry.notes && <span style={{ color: '#6F5A54' }}>{entry.notes}</span>}
                  </div>
                  {canEdit && <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 5, marginTop: 8 }}>
                    <button type="button" onClick={() => handleContact(entry)} style={smallButton('#EFF6FF', '#315E91')}><MessageCircle size={12} />Chamar</button>
                    <button type="button" onClick={() => onSchedule(entry, exactVacancy ? dayVacancy : null)} style={smallButton('#ECFDF3', '#28704A')}><CalendarPlus size={12} />Agendar</button>
                    <button type="button" onClick={() => handleGiveUp(entry)} title="Marcar como desistiu" aria-label={`Remover ${client.name || 'paciente'} da lista`} style={{ ...smallButton('#FFF1F1', '#A53B3B'), padding: 0, width: 31 }}><X size={13} /></button>
                  </div>}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
}

const inputStyle = { width: '100%', boxSizing: 'border-box', minHeight: 34, padding: '7px 9px', border: '1px solid #DED0CB', borderRadius: 8, background: '#fff', color: '#493630', font: 'inherit', fontSize: 10.5, outline: 'none', marginBottom: 8 };
const labelStyle = { display: 'block', margin: '1px 0 4px', color: '#806B65', fontSize: 9.5, fontWeight: 800 };
const iconButtonStyle = { width: 25, height: 25, border: 0, borderRadius: 7, background: '#F4ECE9', color: '#806B65', cursor: 'pointer', display: 'grid', placeItems: 'center' };
const smallButton = (background, color) => ({ minHeight: 31, padding: '0 7px', border: 0, borderRadius: 7, background, color, cursor: 'pointer', fontSize: 9, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 });
