/* eslint-disable react/prop-types */
import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Eraser, Loader2, PenLine, X } from 'lucide-react';
import { updatePatientPackageSession } from '../../services/supabaseService';

export default function PackageSignatureDialog({ session, patientPackage, patient, onClose, onSigned }) {
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  const hasInkRef = useRef(false);
  const [accepted, setAccepted] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    const ctx = canvas.getContext('2d');
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#352B28';
  }, []);

  const point = (event) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const start = (event) => {
    event.preventDefault();
    drawingRef.current = true;
    const ctx = canvasRef.current.getContext('2d');
    const p = point(event);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    canvasRef.current.setPointerCapture?.(event.pointerId);
  };

  const move = (event) => {
    if (!drawingRef.current) return;
    event.preventDefault();
    const ctx = canvasRef.current.getContext('2d');
    const p = point(event);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    hasInkRef.current = true;
  };

  const stop = () => { drawingRef.current = false; };
  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    hasInkRef.current = false;
  };

  const save = async () => {
    if (!hasInkRef.current) { alert('Peça para a paciente assinar no campo indicado.'); return; }
    if (!accepted) { alert('Confirme a declaração antes de salvar a assinatura.'); return; }
    setSaving(true);
    const signedAt = new Date().toISOString();
    const { data, error } = await updatePatientPackageSession(session.id, {
      status: 'signed',
      signed_name: patient?.nome || patient?.name || 'Paciente',
      signature_data_url: canvasRef.current.toDataURL('image/png'),
      signed_at: signedAt,
      acknowledgment_text: session.acknowledgment_text || `Confirmo a realização desta sessão do pacote ${patientPackage?.package_name || ''}.`,
    });
    setSaving(false);
    if (error) { alert(`Não foi possível salvar a assinatura: ${error.message || error}`); return; }
    onSigned(data);
  };

  return (
    <div style={overlay} onClick={onClose}>
      <div style={dialog} onClick={(event) => event.stopPropagation()}>
        <header style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 18px', borderBottom: '1px solid #EEE7E2' }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, display: 'grid', placeItems: 'center', background: '#FDF4F7', color: '#A4315A' }}><PenLine size={18}/></div>
          <div style={{ flex: 1 }}>
            <strong style={{ display: 'block', fontSize: 15 }}>Assinatura da sessão {session.session_number}/{patientPackage?.total_sessions || '—'}</strong>
            <span style={{ fontSize: 11, color: '#927C75' }}>{patient?.nome || patient?.name} · {patientPackage?.package_name}</span>
          </div>
          <button onClick={onClose} style={iconButton}><X size={16}/></button>
        </header>

        <div style={{ padding: 18 }}>
          <div style={{ padding: 12, borderRadius: 10, background: '#F8F5F3', color: '#554640', fontSize: 12, lineHeight: 1.55, marginBottom: 14 }}>
            {session.acknowledgment_text || `Confirmo a realização desta sessão do pacote ${patientPackage?.package_name || ''}.`}
            <div style={{ marginTop: 5, color: '#8A756D', fontSize: 10.5 }}>
              Procedimento: {session.service_name || 'não informado'} · Profissional: {session.professional_name || 'não informado'}
            </div>
          </div>

          <div style={{ position: 'relative', border: '1.5px dashed #CDBDB6', borderRadius: 12, background: '#fff', overflow: 'hidden' }}>
            <canvas
              ref={canvasRef}
              onPointerDown={start}
              onPointerMove={move}
              onPointerUp={stop}
              onPointerCancel={stop}
              onPointerLeave={stop}
              style={{ display: 'block', width: '100%', height: 190, touchAction: 'none', cursor: 'crosshair' }}
            />
            <span style={{ position: 'absolute', left: 14, bottom: 9, fontSize: 10, color: '#B09E97', pointerEvents: 'none' }}>Assine com o dedo, caneta ou mouse</span>
          </div>
          <button onClick={clear} style={{ ...secondaryButton, marginTop: 8 }}><Eraser size={13}/> Limpar assinatura</button>

          <label style={{ display: 'flex', gap: 9, alignItems: 'flex-start', marginTop: 15, fontSize: 11.5, color: '#5E4D47', cursor: 'pointer', lineHeight: 1.45 }}>
            <input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} style={{ marginTop: 2 }}/>
            Confirmo que os dados acima estão corretos e que a assinatura pertence à paciente identificada.
          </label>
        </div>

        <footer style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 18px', borderTop: '1px solid #EEE7E2', background: '#FCFAF8' }}>
          <button onClick={onClose} style={secondaryButton}>Cancelar</button>
          <button onClick={save} disabled={saving} style={{ ...primaryButton, opacity: saving ? 0.65 : 1 }}>
            {saving ? <Loader2 size={14} className="spin"/> : <CheckCircle2 size={14}/>} Salvar assinatura
          </button>
        </footer>
      </div>
    </div>
  );
}

const overlay = { position: 'fixed', inset: 0, zIndex: 13000, background: 'rgba(35,27,24,.62)', backdropFilter: 'blur(4px)', display: 'grid', placeItems: 'center', padding: 16 };
const dialog = { width: 'min(620px, 96vw)', maxHeight: '94vh', overflowY: 'auto', background: '#FFFEFD', borderRadius: 16, boxShadow: '0 28px 80px rgba(35,20,15,.28)' };
const primaryButton = { border: 0, borderRadius: 8, background: '#B7796B', color: '#fff', padding: '9px 12px', fontSize: 11.5, fontWeight: 800, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 };
const secondaryButton = { border: '1px solid #DCCFC9', borderRadius: 8, background: '#fff', color: '#705D56', padding: '8px 11px', fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 };
const iconButton = { width: 32, height: 32, borderRadius: 8, border: 0, background: '#F4EFEC', color: '#826E67', display: 'grid', placeItems: 'center', cursor: 'pointer' };
