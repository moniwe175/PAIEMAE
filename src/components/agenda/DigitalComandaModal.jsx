/* eslint-disable react/prop-types */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, CheckCircle2, PackageCheck, RefreshCw,
  Save, ScissorsLineDashed, Sparkles, Trash2, X,
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

function normalized(value) {
  return String(value || '').trim().toLocaleLowerCase('pt-BR');
}

function friendlyError(error) {
  if (isDigitalComandaSchemaMissing(error)) {
    return 'A estrutura da Comanda Digital ainda não foi instalada no Supabase. Execute o arquivo digital_comandas_migration.sql no SQL Editor.';
  }
  return error?.message || String(error || 'Não foi possível concluir esta ação.');
}

function emptyItem(appointment, professionals) {
  return {
    service_id: null,
    service_name: '',
    professional_name: appointment.profissional || professionals[0]?.nome || '',
    quantity: 1,
    unit_price: 0,
    discount: 0,
    is_package: false,
    patient_package_id: null,
    notes: '',
  };
}

export default function DigitalComandaModal({
  appointment,
  services = [],
  professionals = [],
  canEdit = true,
  onClose,
  onFinalized,
}) {
  const activeServices = useMemo(() => (
    services
      .filter((service) => service.ativo !== false)
      .sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR'))
  ), [services]);
  const initialItem = useMemo(() => buildInitialComandaItem(appointment, activeServices), [appointment, activeServices]);
  const [comanda, setComanda] = useState(null);
  const [items, setItems] = useState([initialItem]);
  const [notes, setNotes] = useState(appointment.observacoes || '');
  const [paymentMethod, setPaymentMethod] = useState('pix');
  const [payment, setPayment] = useState(() => normalizeSinglePayment(initialItem.is_package ? 0 : initialItem.unit_price, 'pix'));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const totals = useMemo(() => calculateComandaTotals(items), [items]);
  const readOnly = !canEdit || ['closed', 'cancelled'].includes(comanda?.status);
  const mainProfessional = items.find((item) => item.professional_name)?.professional_name || appointment.profissional || '';

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

  const itemIndexForService = (service) => items.findIndex((item) => (
    (service.id && item.service_id && String(service.id) === String(item.service_id))
    || normalized(item.service_name) === normalized(service.nome)
  ));

  const toggleService = (service) => {
    if (readOnly) return;
    const existingIndex = itemIndexForService(service);
    if (existingIndex >= 0) {
      setItems((current) => current.filter((_, index) => index !== existingIndex));
      return;
    }
    const next = emptyItem(appointment, professionals);
    next.service_id = service.id || null;
    next.service_name = service.nome || '';
    next.unit_price = Number(service.preco) || 0;
    setItems((current) => {
      const onlyBlank = current.length === 1 && !current[0].service_name;
      return onlyBlank ? [next] : [...current, next];
    });
  };

  const changeProfessional = (name) => {
    setItems((current) => current.map((item) => ({ ...item, professional_name: name })));
  };

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
      if (sheet.error) setError(`A comanda foi cancelada no ERP, mas a linha física da planilha ainda não foi removida: ${friendlyError(sheet.error)}`);
      else onClose();
    }
    setSaving(false);
  };

  const commandNumber = comanda?.command_number || 'GERADA AO SALVAR';

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={(event) => event.stopPropagation()}>
        <header style={toolbarStyle}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 850, color: '#362925' }}>Comanda digital</div>
            <div style={{ color: '#8A756E', fontSize: 12 }}>A mesma comanda da clínica, agora sem papel.</div>
          </div>
          {comanda?.status === 'closed' && <StatusBadge color="#157347" bg="#EAF8EF">FECHADA</StatusBadge>}
          {comanda?.status === 'cancelled' && <StatusBadge color="#B42318" bg="#FFF1F0">CANCELADA</StatusBadge>}
          <button type="button" onClick={onClose} style={closeButtonStyle} aria-label="Fechar"><X size={19} /></button>
        </header>

        <div style={{ padding: '18px 20px 22px' }}>
          {loading && <div style={{ padding: 54, textAlign: 'center', color: '#8C7570' }}><RefreshCw size={22} className="spin" /> Carregando comanda...</div>}
          {!loading && (
            <>
              {error && <Message color="#B42318" bg="#FFF1F0" icon={AlertTriangle}>{error}</Message>}
              {notice && <Message color="#176B43" bg="#ECFDF3" icon={CheckCircle2}>{notice}</Message>}

              <main style={paperStyle}>
                <section style={paperHeaderStyle}>
                  <div style={brandStyle}>
                    <Sparkles size={29} strokeWidth={1.35} color="#986D62" />
                    <div>
                      <div style={{ fontFamily: 'Georgia, serif', fontSize: 25, fontStyle: 'italic', color: '#735148', lineHeight: 1 }}>Evelyn Esthetic</div>
                      <div style={{ fontSize: 10, letterSpacing: 5.4, color: '#876A62', marginTop: 6 }}>CENTER</div>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gap: 5 }}>
                    <PaperLine label="Cliente" value={appointment.paciente || '—'} />
                    <PaperLine label="Data marcada" value={displayDate(appointment.data)} />
                    <PaperLine label="Tel." value={appointment.telefone || '—'} />
                    <label style={paperLineStyle}>
                      <strong style={paperLabelStyle}>Profissional:</strong>
                      <select disabled={readOnly} value={mainProfessional} onChange={(event) => changeProfessional(event.target.value)} style={paperSelectStyle}>
                        <option value="">Selecione</option>
                        {professionals.map((professional) => <option key={professional.id || professional.nome} value={professional.nome}>{professional.nome}</option>)}
                      </select>
                    </label>
                  </div>
                </section>

                <div style={procedureTitleStyle}>
                  <span>Procedimento(s):</span>
                  <span style={{ fontSize: 14, fontWeight: 700 }}>Nº <strong style={{ fontSize: 21, letterSpacing: 1 }}>{commandNumber}</strong></span>
                </div>

                <section style={procedureGridStyle}>
                  {activeServices.map((service) => {
                    const itemIndex = itemIndexForService(service);
                    const selected = itemIndex >= 0;
                    return (
                      <button
                        type="button"
                        key={service.id || service.nome}
                        disabled={readOnly}
                        onClick={() => toggleService(service)}
                        style={{ ...procedureRowStyle, background: selected ? '#F9EFEB' : '#FFFDF9', cursor: readOnly ? 'default' : 'pointer' }}
                      >
                        <span style={{ ...paperCheckboxStyle, background: selected ? '#8D6257' : 'transparent', color: '#fff' }}>{selected ? '✓' : ''}</span>
                        <span style={{ flex: 1, textAlign: 'left', fontWeight: selected ? 800 : 500 }}>{service.nome}</span>
                      </button>
                    );
                  })}
                  {!activeServices.length && <div style={{ gridColumn: '1 / -1', padding: 20, textAlign: 'center', color: '#8C7570' }}>Nenhum serviço ativo foi cadastrado.</div>}
                </section>

                <section style={selectedBlockStyle}>
                  <div style={{ fontSize: 11, fontWeight: 850, textTransform: 'uppercase', letterSpacing: .7, color: '#765B53', marginBottom: 8 }}>Itens marcados na comanda</div>
                  {!items.length && <div style={{ padding: '10px 0', color: '#A06D5F', fontSize: 13 }}>Marque pelo menos um procedimento acima.</div>}
                  {items.map((item, index) => (
                    <div key={item.id || `${item.service_id}-${index}`} style={{ ...selectedRowStyle, gridTemplateColumns: appointment.patient_package_id ? 'minmax(180px,1fr) 72px 105px auto 34px' : 'minmax(180px,1fr) 72px 105px 34px' }}>
                      <div style={{ minWidth: 0 }}>
                        <strong style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.service_name || 'Serviço não identificado'}</strong>
                        {item.is_package && <span style={{ color: '#157347', fontSize: 11, fontWeight: 800 }}>SESSÃO DE PACOTE / REPASSE</span>}
                      </div>
                      <label style={compactFieldStyle}><span>Qtd.</span><input type="number" min="1" step="1" disabled={readOnly} value={item.quantity} onChange={(event) => setItem(index, 'quantity', event.target.value)} style={paperInputStyle} /></label>
                      <label style={compactFieldStyle}><span>Valor</span><input type="number" min="0" step="0.01" disabled={readOnly || item.is_package} value={item.unit_price} onChange={(event) => setItem(index, 'unit_price', event.target.value)} style={paperInputStyle} /></label>
                      {appointment.patient_package_id && (
                        <button type="button" disabled={readOnly} onClick={() => setItem(index, 'is_package', !item.is_package)} style={{ ...packageButtonStyle, background: item.is_package ? '#E9F7EE' : '#FFFDF9', color: item.is_package ? '#157347' : '#735F58' }}>
                          <PackageCheck size={14} />{item.is_package ? 'Repasse' : 'Avulso'}
                        </button>
                      )}
                      {!readOnly && <button type="button" onClick={() => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))} title="Desmarcar procedimento" style={removeButtonStyle}><Trash2 size={15} /></button>}
                    </div>
                  ))}
                </section>

                <section style={{ marginTop: 16 }}>
                  <div style={sectionLabelStyle}>Observações:</div>
                  <textarea
                    rows="4"
                    value={notes}
                    disabled={readOnly}
                    onChange={(event) => setNotes(event.target.value)}
                    placeholder="Anotações do atendimento..."
                    style={observationsStyle}
                  />
                </section>

                <section style={paymentSectionStyle}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={sectionLabelStyle}>Forma de pagamento:</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 18px', marginTop: 10 }}>
                      {[...COMANDA_PAYMENT_METHODS, { key: 'misto', label: 'Misto' }].map((method) => (
                        <button type="button" key={method.key} disabled={readOnly} onClick={() => setPaymentMethod(method.key)} style={paymentChoiceStyle}>
                          <span style={{ ...paperCheckboxStyle, background: paymentMethod === method.key ? '#8D6257' : 'transparent', color: '#fff' }}>{paymentMethod === method.key ? '✓' : ''}</span>
                          {method.label}
                        </button>
                      ))}
                    </div>
                    {paymentMethod === 'misto' && (
                      <div style={mixedPaymentStyle}>
                        {COMANDA_PAYMENT_METHODS.map((method) => (
                          <label key={method.key} style={compactFieldStyle}>
                            <span>{method.label}</span>
                            <input type="number" min="0" step="0.01" disabled={readOnly} value={payment[method.key]} onChange={(event) => setPayment((current) => ({ ...current, [method.key]: Number(event.target.value) || 0 }))} style={paperInputStyle} />
                          </label>
                        ))}
                      </div>
                    )}
                    <div style={{ fontSize: 11, marginTop: 9, color: Math.abs(paymentTotal(payment) - totals.total) < .01 ? '#157347' : '#B42318' }}>Informado: <strong>{brl(paymentTotal(payment))}</strong></div>
                  </div>
                  <div style={totalBoxStyle}>
                    <span style={{ fontSize: 17 }}>Total:</span>
                    <strong style={{ fontSize: 25 }}>{brl(totals.total)}</strong>
                    {totals.packageItems > 0 && <small style={{ color: '#157347', fontWeight: 750 }}>{totals.packageItems} repasse(s) sem cobrança</small>}
                  </div>
                </section>

                <div style={perforationStyle}><ScissorsLineDashed size={20} /><span style={{ flex: 1, borderTop: '1.5px dashed #8C7A73' }} /></div>

                <section style={stubStyle}>
                  <div style={{ display: 'grid', gap: 8 }}>
                    <PaperLine label="Cliente" value={appointment.paciente || '—'} />
                    <PaperLine label="Data marcada" value={displayDate(appointment.data)} />
                    <PaperLine label="Profissional" value={mainProfessional || '—'} />
                  </div>
                  <div style={{ display: 'grid', alignContent: 'space-between', justifyItems: 'end', gap: 10 }}>
                    <div style={{ fontWeight: 700 }}>Total: <strong style={{ fontSize: 21 }}>{brl(totals.total)}</strong></div>
                    <div style={{ fontSize: 14 }}>Nº <strong style={{ fontSize: 19 }}>{commandNumber}</strong></div>
                  </div>
                </section>
              </main>

              {['closed', 'cancelled'].includes(comanda?.status) && (
                <div style={{ marginTop: 13, display: 'flex', alignItems: 'center', gap: 8, color: comanda.sheet_sync_status === 'synced' ? '#157347' : '#9A6700', fontSize: 12 }}>
                  {comanda.sheet_sync_status === 'synced' ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
                  {comanda.sheet_sync_status === 'synced' ? 'Comanda enviada para a planilha.' : 'Comanda salva no ERP; envio para a planilha pendente.'}
                </div>
              )}

              <footer style={footerStyle}>
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

function PaperLine({ label, value }) {
  return <div style={paperLineStyle}><strong style={paperLabelStyle}>{label}:</strong><span style={{ flex: 1, minWidth: 0, borderBottom: '1px solid #8D817C', padding: '2px 5px 3px', fontWeight: 650, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</span></div>;
}

function StatusBadge({ color, bg, children }) {
  return <span style={{ marginLeft: 'auto', borderRadius: 99, padding: '6px 11px', background: bg, color, fontSize: 11, fontWeight: 850 }}>{children}</span>;
}

function Message({ color, bg, icon: Icon, children }) {
  return <div style={{ display: 'flex', gap: 9, alignItems: 'flex-start', padding: '11px 13px', borderRadius: 11, background: bg, color, fontSize: 12, marginBottom: 11 }}><Icon size={16} style={{ flexShrink: 0 }} /><span>{children}</span></div>;
}

const overlayStyle = { position: 'fixed', inset: 0, zIndex: 13000, background: 'rgba(33,25,22,.68)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 };
const modalStyle = { width: 'min(1030px, 97vw)', maxHeight: '96vh', overflowY: 'auto', background: '#F6F0EC', borderRadius: 18, boxShadow: '0 28px 90px rgba(44,30,26,.32)' };
const toolbarStyle = { position: 'sticky', top: 0, zIndex: 5, background: 'rgba(255,253,252,.97)', borderBottom: '1px solid #E2D5CF', padding: '15px 20px', display: 'flex', alignItems: 'center', gap: 12, backdropFilter: 'blur(8px)' };
const closeButtonStyle = { marginLeft: 'auto', width: 36, height: 36, border: 0, borderRadius: 10, background: '#F1E8E4', color: '#6B5650', cursor: 'pointer', display: 'grid', placeItems: 'center' };
const paperStyle = { background: '#FFFDF9', color: '#302B29', border: '1.5px solid #857A75', borderRadius: 3, padding: '18px 20px 14px', boxShadow: '0 6px 20px rgba(70,50,43,.09), inset 0 0 45px rgba(147,107,88,.025)' };
const paperHeaderStyle = { display: 'grid', gridTemplateColumns: 'minmax(280px,.9fr) minmax(390px,1.15fr)', border: '1.5px solid #857A75', minHeight: 142 };
const brandStyle = { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 13, padding: 20, borderRight: '1px solid #A79B96' };
const paperLineStyle = { display: 'flex', alignItems: 'end', gap: 6, minWidth: 0, padding: '6px 10px 0', fontSize: 14 };
const paperLabelStyle = { flexShrink: 0, fontFamily: 'Georgia, serif', fontSize: 14, fontWeight: 500 };
const paperSelectStyle = { flex: 1, minWidth: 0, border: 0, borderBottom: '1px solid #8D817C', outline: 'none', background: 'transparent', padding: '2px 4px 3px', fontSize: 14, fontWeight: 650, color: '#302B29' };
const procedureTitleStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'end', gap: 12, fontFamily: 'Georgia, serif', fontSize: 23, padding: '13px 7px 7px' };
const procedureGridStyle = { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', borderTop: '1.5px solid #857A75', borderLeft: '1.5px solid #857A75' };
const procedureRowStyle = { minHeight: 39, display: 'flex', alignItems: 'center', gap: 10, border: 0, borderRight: '1.5px solid #857A75', borderBottom: '1.5px solid #857A75', padding: '6px 10px', color: '#302B29', fontSize: 13 };
const paperCheckboxStyle = { width: 18, height: 18, border: '1.5px solid #716762', display: 'inline-grid', placeItems: 'center', flexShrink: 0, fontSize: 12, fontWeight: 900 };
const selectedBlockStyle = { marginTop: 14, border: '1px solid #B4A7A1', background: '#FFFCF8', padding: 11 };
const selectedRowStyle = { display: 'grid', gap: 8, alignItems: 'end', padding: '8px 0', borderTop: '1px dashed #D6C9C3', fontSize: 12 };
const compactFieldStyle = { display: 'grid', gap: 3, fontSize: 10, fontWeight: 800, color: '#765F57' };
const paperInputStyle = { minWidth: 0, width: '100%', boxSizing: 'border-box', border: 0, borderBottom: '1px solid #8D817C', outline: 'none', background: 'transparent', padding: '4px 3px', fontSize: 12, color: '#302B29' };
const packageButtonStyle = { height: 30, border: '1px solid #B9ACA6', padding: '0 8px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5, fontSize: 11, fontWeight: 800, cursor: 'pointer' };
const removeButtonStyle = { width: 30, height: 30, border: '1px solid #E3B9B2', background: '#FFF7F5', color: '#B42318', display: 'grid', placeItems: 'center', cursor: 'pointer' };
const sectionLabelStyle = { fontFamily: 'Georgia, serif', fontSize: 19, color: '#302B29' };
const observationsStyle = { width: '100%', minHeight: 92, boxSizing: 'border-box', border: '1.5px solid #857A75', borderRadius: 0, outline: 'none', resize: 'vertical', background: '#FFFDF9', padding: 10, marginTop: 6, color: '#302B29', fontSize: 13 };
const paymentSectionStyle = { display: 'flex', gap: 24, alignItems: 'stretch', marginTop: 15 };
const paymentChoiceStyle = { border: 0, background: 'transparent', padding: 0, display: 'inline-flex', alignItems: 'center', gap: 6, color: '#302B29', fontFamily: 'Georgia, serif', fontSize: 14, cursor: 'pointer' };
const mixedPaymentStyle = { display: 'grid', gridTemplateColumns: 'repeat(4,minmax(78px,1fr))', gap: 10, marginTop: 10, maxWidth: 520 };
const totalBoxStyle = { minWidth: 245, border: '1.5px solid #857A75', padding: '12px 15px', display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '3px 10px', alignItems: 'center', alignContent: 'center', fontFamily: 'Georgia, serif' };
const perforationStyle = { display: 'flex', alignItems: 'center', gap: 7, margin: '19px -21px 13px', color: '#8C7A73' };
const stubStyle = { display: 'grid', gridTemplateColumns: '1.4fr .8fr', gap: 20, padding: '4px 7px 2px', minHeight: 104 };
const footerStyle = { display: 'flex', flexWrap: 'wrap', gap: 9, justifyContent: 'flex-end', borderTop: '1px solid #DECEC7', marginTop: 17, paddingTop: 15 };
const secondaryButton = { border: '1px solid #CDBBB4', borderRadius: 9, background: '#fff', color: '#604B44', padding: '9px 13px', fontSize: 12, fontWeight: 800, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 };
const primaryButton = { ...secondaryButton, border: 0, color: '#fff', background: 'linear-gradient(135deg,#C73B6D,#9B2C50)', padding: '10px 17px', boxShadow: '0 6px 16px rgba(169,49,91,.24)' };
