/* eslint-disable react/prop-types */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, CheckCircle2, CreditCard, PackageCheck,
  Plus, ReceiptText, RefreshCw, Save, Trash2, User, X,
} from 'lucide-react';
import {
  COMANDA_PAYMENT_METHODS,
  buildInitialComandaItem,
  calculateComandaTotals,
  normalizeSinglePayment,
  paymentTotal,
  validateDigitalComanda,
} from '../../lib/digitalComanda';
import {
  cancelDigitalComanda,
  closeDigitalComanda,
  fetchDigitalComandaByAppointment,
  isDigitalComandaSchemaMissing,
  markDigitalComandaSheetSync,
  saveDigitalComanda,
  syncDigitalComandaToSheet,
} from '../../services/digitalComandaService';

function brl(value) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function methodFromPayment(payment = {}) {
  const active = COMANDA_PAYMENT_METHODS.filter(({ key }) => Number(payment[key]) > 0);
  return active.length === 1 ? active[0].key : active.length > 1 ? 'misto' : 'pix';
}

function displayDate(value) {
  if (!value) return '—';
  return new Date(`${value}T12:00:00`).toLocaleDateString('pt-BR');
}

function friendlyError(error) {
  if (isDigitalComandaSchemaMissing(error)) {
    return 'A estrutura da Comanda Digital ainda não foi instalada no Supabase. Execute o arquivo digital_comandas_migration.sql no SQL Editor.';
  }
  return error?.message || String(error || 'Não foi possível concluir esta ação.');
}

export default function DigitalComandaModal({
  appointment,
  services = [],
  professionals = [],
  canEdit = true,
  onClose,
  onFinalized,
}) {
  const activeServices = useMemo(() => services.filter((service) => service.ativo !== false), [services]);
  const initialItem = useMemo(() => buildInitialComandaItem(appointment, activeServices), [appointment, activeServices]);
  const [comanda, setComanda] = useState(null);
  const [items, setItems] = useState([initialItem]);
  const [notes, setNotes] = useState(appointment.observacoes || '');
  const [paymentMethod, setPaymentMethod] = useState(initialItem.is_package ? 'pix' : 'pix');
  const [payment, setPayment] = useState(() => normalizeSinglePayment(initialItem.is_package ? 0 : initialItem.unit_price, 'pix'));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const totals = useMemo(() => calculateComandaTotals(items), [items]);
  const readOnly = !canEdit || ['closed', 'cancelled'].includes(comanda?.status);

  const hydrate = useCallback((data) => {
    if (!data) return;
    const loadedPayment = {
      pix: Number(data.pix) || 0,
      credito: Number(data.credito) || 0,
      debito: Number(data.debito) || 0,
      dinheiro: Number(data.dinheiro) || 0,
    };
    setComanda(data);
    setItems((data.digital_comanda_items || []).map((item) => ({
      ...item,
      quantity: Number(item.quantity) || 1,
      unit_price: Number(item.unit_price) || 0,
      discount: Number(item.discount) || 0,
      is_package: Boolean(item.is_package),
    })));
    setNotes(data.notes || '');
    setPayment(loadedPayment);
    setPaymentMethod(methodFromPayment(loadedPayment));
  }, []);

  const reload = useCallback(async () => {
    setLoading(true);
    setError('');
    const response = await fetchDigitalComandaByAppointment(appointment.id);
    if (response.error) setError(friendlyError(response.error));
    else if (response.data) hydrate(response.data);
    setLoading(false);
  }, [appointment.id, hydrate]);

  useEffect(() => { reload(); }, [reload]);

  useEffect(() => {
    if (readOnly || paymentMethod === 'misto') return;
    setPayment(normalizeSinglePayment(totals.total, paymentMethod));
  }, [totals.total, paymentMethod, readOnly]);

  const setItem = (index, field, value) => {
    setItems((current) => current.map((item, itemIndex) => {
      if (itemIndex !== index) return item;
      const next = { ...item, [field]: value };
      if (field === 'service_id') {
        const service = activeServices.find((candidate) => String(candidate.id) === String(value));
        next.service_id = service?.id || null;
        next.service_name = service?.nome || '';
        if (!next.is_package) next.unit_price = Number(service?.preco) || 0;
      }
      if (field === 'is_package') {
        next.is_package = Boolean(value);
        next.patient_package_id = value ? appointment.patient_package_id || null : null;
        if (value) next.unit_price = 0;
        else {
          const service = activeServices.find((candidate) => String(candidate.id) === String(next.service_id));
          next.unit_price = Number(service?.preco) || 0;
        }
      }
      return next;
    }));
  };

  const addItem = () => setItems((current) => [...current, {
    service_id: null,
    service_name: '',
    professional_name: appointment.profissional || professionals[0]?.nome || '',
    quantity: 1,
    unit_price: 0,
    discount: 0,
    is_package: false,
    patient_package_id: null,
    notes: '',
  }]);

  const removeItem = (index) => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index));

  const persist = async () => {
    const validation = validateDigitalComanda({ items, payment });
    if (validation) {
      setError(validation);
      return null;
    }
    const response = await saveDigitalComanda({
      comandaId: comanda?.id || null,
      appointmentId: appointment.id,
      header: {
        client_name: appointment.paciente,
        client_phone: appointment.telefone,
        notes,
        payment_method: paymentMethod === 'misto'
          ? 'Misto'
          : COMANDA_PAYMENT_METHODS.find((method) => method.key === paymentMethod)?.label || 'Pix',
        ...payment,
      },
      items,
    });
    if (response.error) {
      setError(friendlyError(response.error));
      return null;
    }
    setComanda((current) => ({ ...current, ...response.data }));
    return response.data;
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setNotice('');
    const saved = await persist();
    if (saved) {
      setNotice(`Comanda ${saved.command_number} salva como rascunho.`);
      await reload();
    }
    setSaving(false);
  };

  const handleCloseComanda = async () => {
    setSaving(true);
    setError('');
    setNotice('');
    const saved = await persist();
    if (!saved) {
      setSaving(false);
      return;
    }

    const closed = await closeDigitalComanda(saved.id);
    if (closed.error) {
      setError(friendlyError(closed.error));
      setSaving(false);
      return;
    }

    setComanda((current) => ({ ...current, ...closed.data }));
    onFinalized?.(appointment.id);
    const sheet = await syncDigitalComandaToSheet(saved.id);
    await markDigitalComandaSheetSync(saved.id, !sheet.error, sheet.error?.message || '');
    if (sheet.error) {
      setNotice(`Comanda ${closed.data.command_number} fechada e registrada no sistema. O envio para a planilha ficou pendente e pode ser tentado novamente.`);
    } else {
      setNotice(`Comanda ${closed.data.command_number} fechada. Atendimento, caixa, planilha e relatórios foram atualizados.`);
    }
    await reload();
    setSaving(false);
  };

  const handleRetrySheet = async () => {
    if (!comanda?.id) return;
    setSaving(true);
    setError('');
    const response = await syncDigitalComandaToSheet(comanda.id);
    await markDigitalComandaSheetSync(comanda.id, !response.error, response.error?.message || '');
    setComanda((current) => ({ ...current, sheet_sync_status: response.error ? 'error' : 'synced', sheet_sync_error: response.error?.message || null }));
    if (response.error) setError(`A comanda está salva no sistema, mas a planilha não respondeu: ${friendlyError(response.error)}`);
    else setNotice('Planilha atualizada com sucesso.');
    await reload();
    setSaving(false);
  };

  const handleCancel = async () => {
    if (!comanda?.id || !window.confirm(`Cancelar a comanda ${comanda.command_number}? Os lançamentos dela serão estornados dos relatórios.`)) return;
    const reason = window.prompt('Motivo do cancelamento (opcional):') || '';
    setSaving(true);
    const response = await cancelDigitalComanda(comanda.id, reason);
    if (response.error) setError(friendlyError(response.error));
    else {
      setComanda((current) => ({ ...current, ...response.data }));
      const sheet = await syncDigitalComandaToSheet(comanda.id);
      await markDigitalComandaSheetSync(comanda.id, !sheet.error, sheet.error?.message || '');
      setComanda((current) => ({ ...current, sheet_sync_status: sheet.error ? 'error' : 'synced', sheet_sync_error: sheet.error?.message || null }));
      if (sheet.error) {
        setError(`A comanda foi cancelada no ERP, mas a linha física da planilha ainda não foi removida: ${friendlyError(sheet.error)}`);
      } else onClose();
    }
    setSaving(false);
  };

  const inputStyle = {
    width: '100%', border: '1px solid #E8DDD8', borderRadius: 10, padding: '10px 11px',
    fontSize: 13, color: '#3D322E', background: readOnly ? '#F8F5F3' : '#fff', boxSizing: 'border-box',
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 13000, background: 'rgba(33,25,22,.64)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 18 }} onClick={onClose}>
      <div style={{ width: 'min(1120px, 96vw)', maxHeight: '94vh', overflowY: 'auto', background: '#FFFDFC', borderRadius: 22, boxShadow: '0 28px 90px rgba(44,30,26,.28)' }} onClick={(event) => event.stopPropagation()}>
        <header style={{ position: 'sticky', top: 0, zIndex: 5, background: '#FFFDFC', borderBottom: '1px solid #EADFD9', padding: '18px 22px', display: 'flex', alignItems: 'center', gap: 13 }}>
          <div style={{ width: 44, height: 44, borderRadius: 13, background: 'linear-gradient(135deg,#C73B6D,#9B2C50)', display: 'grid', placeItems: 'center' }}><ReceiptText size={21} color="#fff" /></div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 19, fontWeight: 800, color: '#302521' }}>Comanda digital {comanda?.command_number ? `· ${comanda.command_number}` : ''}</div>
            <div style={{ color: '#8C7570', fontSize: 12 }}>Uma comanda, serviços separados e números corretos nos relatórios</div>
          </div>
          {comanda?.status === 'closed' && <span style={{ marginLeft: 'auto', borderRadius: 99, padding: '6px 11px', background: '#EAF8EF', color: '#157347', fontSize: 11, fontWeight: 800 }}>FECHADA</span>}
          {comanda?.status === 'cancelled' && <span style={{ marginLeft: 'auto', borderRadius: 99, padding: '6px 11px', background: '#FFF1F0', color: '#B42318', fontSize: 11, fontWeight: 800 }}>CANCELADA</span>}
          <button onClick={onClose} style={{ marginLeft: comanda?.status === 'closed' ? 0 : 'auto', width: 36, height: 36, border: 0, borderRadius: 10, background: '#F4ECE8', cursor: 'pointer' }}><X size={18} /></button>
        </header>

        <div style={{ padding: 22 }}>
          <section style={{ display: 'grid', gridTemplateColumns: '1.5fr .8fr .8fr 1fr', gap: 10, padding: 16, border: '1px solid #EADFD9', borderRadius: 15, background: '#fff', marginBottom: 16 }}>
            <Info icon={User} label="Cliente" value={appointment.paciente} />
            <Info label="Data" value={displayDate(appointment.data)} />
            <Info label="Horário" value={appointment.hora || '—'} />
            <Info label="Profissional agendado" value={appointment.profissional || '—'} />
          </section>

          {loading && <div style={{ padding: 42, textAlign: 'center', color: '#8C7570' }}><RefreshCw size={22} className="spin" /> Carregando comanda...</div>}
          {!loading && (
            <>
              {error && <Message color="#B42318" bg="#FFF1F0" icon={AlertTriangle}>{error}</Message>}
              {notice && <Message color="#176B43" bg="#ECFDF3" icon={CheckCircle2}>{notice}</Message>}

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '18px 0 10px' }}>
                <div><strong style={{ color: '#3D322E', fontSize: 15 }}>Procedimentos realizados</strong><div style={{ color: '#9A8179', fontSize: 11 }}>Cada linha aparece separadamente no ranking.</div></div>
                {!readOnly && <button onClick={addItem} style={secondaryButton}><Plus size={14} />Adicionar serviço</button>}
              </div>

              <div style={{ display: 'grid', gap: 10 }}>
                {items.map((item, index) => (
                  <div key={item.id || index} style={{ display: 'grid', gridTemplateColumns: 'minmax(190px,1.7fr) minmax(150px,1.25fr) 82px 120px 112px 42px', gap: 9, alignItems: 'end', padding: 13, border: `1px solid ${item.is_package ? '#BFE8CE' : '#EADFD9'}`, borderRadius: 14, background: item.is_package ? '#F2FBF5' : '#fff' }}>
                    <Field label="Serviço / procedimento">
                      <select value={item.service_id || ''} disabled={readOnly} onChange={(event) => setItem(index, 'service_id', event.target.value)} style={inputStyle}>
                        <option value="">Selecione...</option>
                        {activeServices.map((service) => <option key={service.id || service.nome} value={service.id || ''}>{service.nome}</option>)}
                      </select>
                    </Field>
                    <Field label="Profissional">
                      <select value={item.professional_name || ''} disabled={readOnly} onChange={(event) => setItem(index, 'professional_name', event.target.value)} style={inputStyle}>
                        <option value="">Selecione...</option>
                        {professionals.map((professional) => <option key={professional.id || professional.nome} value={professional.nome}>{professional.nome}</option>)}
                      </select>
                    </Field>
                    <Field label="Qtd."><input type="number" min="1" step="1" value={item.quantity} disabled={readOnly} onChange={(event) => setItem(index, 'quantity', event.target.value)} style={inputStyle} /></Field>
                    <Field label="Valor unitário"><input type="number" min="0" step="0.01" value={item.unit_price} disabled={readOnly || item.is_package} onChange={(event) => setItem(index, 'unit_price', event.target.value)} style={inputStyle} /></Field>
                    <Field label="Tipo">
                      <button type="button" disabled={readOnly || !appointment.patient_package_id} onClick={() => setItem(index, 'is_package', !item.is_package)} style={{ ...inputStyle, cursor: readOnly || !appointment.patient_package_id ? 'default' : 'pointer', color: item.is_package ? '#147A48' : '#6F5A53', fontWeight: 700, display: 'flex', gap: 6, justifyContent: 'center', alignItems: 'center' }}>
                        {item.is_package ? <><PackageCheck size={14} />Repasse</> : 'Avulso'}
                      </button>
                    </Field>
                    <button disabled={readOnly || items.length === 1} onClick={() => removeItem(index)} title="Remover item" style={{ width: 40, height: 40, border: '1px solid #F0CBC7', borderRadius: 10, color: '#C33', background: '#FFF8F7', cursor: readOnly || items.length === 1 ? 'not-allowed' : 'pointer', opacity: readOnly || items.length === 1 ? .45 : 1 }}><Trash2 size={15} /></button>
                  </div>
                ))}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr .9fr', gap: 16, marginTop: 18 }}>
                <section style={panelStyle}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}><CreditCard size={17} color="#A34A68" /><strong>Forma de pagamento</strong></div>
                  <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 13 }}>
                    {[...COMANDA_PAYMENT_METHODS, { key: 'misto', label: 'Misto' }].map((method) => (
                      <button key={method.key} disabled={readOnly} onClick={() => setPaymentMethod(method.key)} style={{ border: `1px solid ${paymentMethod === method.key ? '#B95478' : '#E5D9D4'}`, color: paymentMethod === method.key ? '#9B2C50' : '#725E57', background: paymentMethod === method.key ? '#FFF0F5' : '#fff', borderRadius: 99, padding: '7px 12px', fontSize: 12, fontWeight: 700, cursor: readOnly ? 'default' : 'pointer' }}>{method.label}</button>
                    ))}
                  </div>
                  {paymentMethod === 'misto' && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8 }}>{COMANDA_PAYMENT_METHODS.map((method) => <Field key={method.key} label={method.label}><input type="number" min="0" step="0.01" disabled={readOnly} value={payment[method.key]} onChange={(event) => setPayment((current) => ({ ...current, [method.key]: Number(event.target.value) || 0 }))} style={inputStyle} /></Field>)}</div>}
                  <div style={{ marginTop: 12, fontSize: 12, color: Math.abs(paymentTotal(payment) - totals.total) < .01 ? '#157347' : '#B42318' }}>Pagamentos informados: <strong>{brl(paymentTotal(payment))}</strong></div>
                </section>

                <section style={{ ...panelStyle, background: '#3D2B27', color: '#fff' }}>
                  <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, opacity: .7 }}>Resumo da comanda</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 15 }}><span>Serviços</span><strong>{totals.services}</strong></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 9 }}><span>Sessões de pacote</span><strong>{totals.packageItems}</strong></div>
                  <div style={{ height: 1, background: 'rgba(255,255,255,.18)', margin: '14px 0' }} />
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}><span style={{ fontWeight: 700 }}>Total a receber</span><strong style={{ fontSize: 25 }}>{brl(totals.total)}</strong></div>
                </section>
              </div>

              <Field label="Observações da comanda"><textarea rows="3" value={notes} disabled={readOnly} onChange={(event) => setNotes(event.target.value)} placeholder="Observações do atendimento..." style={{ ...inputStyle, resize: 'vertical', marginTop: 6 }} /></Field>

              {['closed', 'cancelled'].includes(comanda?.status) && (
                <div style={{ marginTop: 15, display: 'flex', alignItems: 'center', gap: 8, color: comanda.sheet_sync_status === 'synced' ? '#157347' : '#9A6700', fontSize: 12 }}>
                  {comanda.sheet_sync_status === 'synced' ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
                  {comanda.sheet_sync_status === 'synced' ? 'Comanda enviada para a planilha.' : 'Comanda salva no ERP; envio para a planilha pendente.'}
                </div>
              )}

              <footer style={{ display: 'flex', gap: 9, justifyContent: 'flex-end', borderTop: '1px solid #EADFD9', marginTop: 18, paddingTop: 16 }}>
                {['closed', 'cancelled'].includes(comanda?.status) && comanda.sheet_sync_status !== 'synced' && <button disabled={saving} onClick={handleRetrySheet} style={secondaryButton}><RefreshCw size={14} />Sincronizar planilha</button>}
                {comanda?.status === 'closed' && canEdit && <button disabled={saving} onClick={handleCancel} style={{ ...secondaryButton, color: '#B42318', borderColor: '#F1B8B3' }}><Trash2 size={14} />Cancelar e estornar</button>}
                <button onClick={onClose} style={secondaryButton}>Fechar tela</button>
                {!readOnly && <button disabled={saving} onClick={handleSave} style={secondaryButton}><Save size={14} />Salvar rascunho</button>}
                {!readOnly && <button disabled={saving} onClick={handleCloseComanda} style={primaryButton}><CheckCircle2 size={15} />{saving ? 'Processando...' : 'Fechar comanda'}</button>}
              </footer>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return <label style={{ display: 'block', marginTop: 10 }}><span style={{ display: 'block', fontSize: 10.5, fontWeight: 800, color: '#826E66', marginBottom: 5 }}>{label}</span>{children}</label>;
}

function Info({ icon: Icon, label, value }) {
  return <div style={{ minWidth: 0 }}>{label && <div style={{ fontSize: 10, color: '#9A8179', fontWeight: 800, textTransform: 'uppercase', letterSpacing: .5 }}>{label}</div>}<div style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13, fontWeight: 700, color: '#3D322E', marginTop: 3 }}>{Icon && <Icon size={14} color="#B95478" />}<span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</span></div></div>;
}

function Message({ color, bg, icon: Icon, children }) {
  return <div style={{ display: 'flex', gap: 9, alignItems: 'flex-start', padding: '11px 13px', borderRadius: 11, background: bg, color, fontSize: 12, marginBottom: 11 }}><Icon size={16} style={{ flexShrink: 0 }} /><span>{children}</span></div>;
}

const panelStyle = { border: '1px solid #EADFD9', borderRadius: 15, background: '#fff', padding: 16 };
const secondaryButton = { border: '1px solid #DFCFC8', borderRadius: 10, background: '#fff', color: '#654F48', padding: '9px 13px', fontSize: 12, fontWeight: 800, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 };
const primaryButton = { ...secondaryButton, border: 0, color: '#fff', background: 'linear-gradient(135deg,#C73B6D,#9B2C50)', padding: '10px 17px', boxShadow: '0 6px 16px rgba(169,49,91,.24)' };
