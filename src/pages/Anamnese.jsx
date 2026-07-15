import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  ClipboardList, Search, Plus, ChevronRight, ChevronLeft, User,
  Heart, AlertTriangle, Leaf, Target, Printer, Save, CheckCircle,
  Circle, ArrowLeft, Eye, Edit3, Trash2, Calendar, Loader2,
  FileText, X, PenLine, RotateCcw
} from 'lucide-react';
import { fetchClients, fetchAnamneses, upsertAnamnese, deleteAnamnese } from '../services/supabaseService';
import { getCurrentUser } from '../lib/supabase';

// ─── Empty form ───────────────────────────────────────────────────────────────
function emptyForm() {
  return {
    tipoFicha: '',
    // ── Dados pessoais complementares ──
    dataNascimento: '', cpf: '', estadoCivil: '', profissao: '',
    endereco: '', cidade: '', email: '',

    // ── Condições especiais ──
    gestante: '', amamentando: '',

    // ── Saúde geral — condições (SIM/NÃO) ──
    sensibilidadeOlhos: '',
    alergias: '',
    alergiaPicadaAbelha: '',
    problemasCardiacos: '',
    alteracoesPressao: '',
    alteracoesVasculares: '',
    diabetes: '',
    hernia: '',
    doencaAutoimune: '',
    hivHepatite: '',
    doencaCronica: '',
    colesterol: '',
    problemaRenal: '',
    problemasNeurologicos: '',
    tumor: '',
    problemaDePele: '',
    fiosDeOuroOuPMMA: '',
    quelioide: '',
    proteseMetalica: '',
    alteracoesHormonais: '',
    problemaTireoide: '',
    ovarioPolicistico: '',
    mioma: '',
    endometriose: '',
    depressao: '',
    sindromeDopanico: '',
    procedimentosDefinitivos: '',
    // mantidos do form anterior
    usaMarcapasso: '', temEpilepsia: '', temCoagulopatia: '', temOncologico: '',
    fezCirurgia: '', qualCirurgia: '',
    outrasDoencas: '',
    // Medicamentos
    usaMedicamentos: '', quaisMedicamentos: '',
    // Alergias específicas
    temAlergia: '', quaisAlergias: '',
    alergiaLatex: false, alergiaIodo: false, alergiaAnestesico: false, alergiaQuelante: false,

    // ── Pele ──
    tipoPele: '', sensibilidadePele: '', oleosidadePele: '',
    problemasPele: [],
    fototipoCampo: '',
    usaProtetor: '', exposicaoSolar: '',
    usaAcidos: '',
    usaCosmeticos: '', quaisCosmeticos: '',

    // ── Histórico estético ──
    jaFezBotox: false, jaFezPreenchimento: false, jaFezPeeling: false, jaFezLaser: false,
    jaFezMicroagulhamento: false, jaFezLimpezaPele: false, jaFezOutro: false, outroHistorico: '',
    resultadoTratamentoAnterior: '',
    reacaoAnterior: '', detalhesReacao: '',

    // ── Hábitos clínicos ──
    emTratamentoMedico: '',
    possuiPlanoSaude: '',
    problemaSaudeAtual: '',
    usouAntibiotico7dias: '',
    usouRoacutan6meses: '',
    reacaoAlergicaAnestesia: '',
    tomouVacina6meses: '',
    historiFamiliarDoencas: '', qualHistoricoFamiliar: '',
    usaAnticoncepcional: '', qualAnticoncepcional: '',
    intestinoRegulado: '',
    usaSuplemento: '', quaisSuplemento: '',

    // ── Estilo de vida ──
    fuma: '', frequenciaFuma: '',
    bebidaAlcoolica: '', frequenciaBebe: '',
    atividade: '', frequenciaAtividade: '',
    alimentacao: '', ingereAgua: '',
    qualidadeSono: '',
    tomaSol: '',

    // ── Objetivos ──
    objetivosPrincipais: [],
    expectativas: '',
    comoConheceu: '',

    // ── Termo e assinatura ──
    leuTermos: false,
    dataPreenchimento: new Date().toISOString().split('T')[0],
    preenchidoPor: 'cliente',
    observacoesProfissional: '',
  };
}

// ─── Supabase mapping ─────────────────────────────────────────────────────────
function mapClientFromSupabase(client) {
  return {
    id: client.id,
    nome: client.name || '',
    telefone: client.phone || '',
    avatar: client.avatar || (client.name ? client.name.charAt(0).toUpperCase() : '?'),
  };
}

function mapAnamneseFromSupabase(row) {
  return {
    id: row.id,
    clientId: row.client_id,
    dataPreenchimento: row.data_preenchimento,
    preenchidoPor: row.preenchido_por,
    observacoesProfissional: row.observacoes_profissional,
    leuTermos: row.leu_termos,
    ...row.form_data,
  };
}

function mapAnamneseToSupabase(ficha, userId) {
  const {
    id, clientId, dataPreenchimento, preenchidoPor,
    observacoesProfissional, leuTermos, ...formData
  } = ficha;
  return {
    ...(id ? { id } : {}),
    client_id: clientId,
    data_preenchimento: dataPreenchimento,
    preenchido_por: preenchidoPor,
    observacoes_profissional: observacoesProfissional,
    leu_termos: leuTermos,
    form_data: formData,
    ...(userId ? { user_id: userId } : {}),
  };
}

function generateId() {
  return 'anam_' + crypto.randomUUID();
}

// ─── Checkbox helper ──────────────────────────────────────────────────────────
function CheckItem({ label, checked, onChange }) {
  return (
    <div
      onClick={() => onChange(!checked)}
      style={{
        display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
        padding: '6px 10px', borderRadius: 8, transition: 'background 0.12s',
        background: checked ? '#FDF4F7' : 'transparent',
        border: `1.5px solid ${checked ? '#C73B6D' : '#E5E7EB'}`,
        userSelect: 'none',
      }}
    >
      {checked
        ? <CheckCircle style={{ width: 14, height: 14, color: '#C73B6D', flexShrink: 0 }} />
        : <Circle style={{ width: 14, height: 14, color: '#D1D5DB', flexShrink: 0 }} />
      }
      <span style={{ fontSize: 12, fontWeight: 500, color: checked ? '#C73B6D' : '#4B5563' }}>{label}</span>
    </div>
  );
}

// ─── Radio helper ─────────────────────────────────────────────────────────────
function RadioGroup({ label, field, form, setForm, options }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {options.map(opt => {
          const selected = form[field] === opt;
          return (
            <button key={opt} type="button"
              onClick={() => setForm(f => ({ ...f, [field]: opt }))}
              style={{
                padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                border: `1.5px solid ${selected ? '#C73B6D' : '#E5E7EB'}`,
                background: selected ? '#C73B6D' : '#fff',
                color: selected ? '#fff' : '#6B7280',
                transition: 'all 0.15s',
              }}>
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Section header ───────────────────────────────────────────────────────────
function SectionHeader({ icon: Icon, title, color = '#C73B6D', bg = '#FDF4F7' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, paddingBottom: 10, borderBottom: '2px solid #F0EBE6' }}>
      <div style={{ width: 34, height: 34, borderRadius: 10, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon style={{ width: 16, height: 16, color }} />
      </div>
      <div style={{ fontSize: 14, fontWeight: 700, color: '#1F2937' }}>{title}</div>
    </div>
  );
}

// ─── Input helper ──────────────────────────────────────────────────────────────
function Field({ label, children, span = 1 }) {
  return (
    <div style={{ gridColumn: span > 1 ? `span ${span}` : 'auto' }}>
      {label && <div style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>}
      {children}
    </div>
  );
}

const inputSt = {
  width: '100%', padding: '9px 12px', border: '1.5px solid #E5E7EB',
  borderRadius: 10, fontSize: 13, outline: 'none', boxSizing: 'border-box',
  background: '#FAFAFA', fontFamily: 'inherit', color: '#1F2937',
};
const textareaSt = { ...inputSt, minHeight: 80, resize: 'vertical' };

// ─── FORM STEPS ───────────────────────────────────────────────────────────────
const STEPS = [
  { id: 'pessoal', label: 'Dados Pessoais', icon: User },
  { id: 'saude', label: 'Saúde Geral', icon: Heart },
  { id: 'pele', label: 'Pele & Histórico', icon: Leaf },
  { id: 'habitos', label: 'Hábitos de Vida', icon: Target },
  { id: 'objetivos', label: 'Objetivos & Termo', icon: CheckCircle },
];

// ─── Signature Modal Component ────────────────────────────────────────────────
function SignatureModal({ pacienteNome, onClose, onConfirm }) {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSigned, setHasSigned] = useState(false);
  const [termoScrolled, setTermoScrolled] = useState(false);
  const lastPos = useRef({ x: 0, y: 0 });

  const getPos = (e, canvas) => {
    const rect = canvas.getBoundingClientRect();
    if (e.touches) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const startDraw = useCallback((e) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    setIsDrawing(true);
    const pos = getPos(e, canvas);
    lastPos.current = pos;
    const ctx = canvas.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  }, []);

  const draw = useCallback((e) => {
    e.preventDefault();
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const pos = getPos(e, canvas);
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#1a1a2e';
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    lastPos.current = pos;
    setHasSigned(true);
  }, [isDrawing]);

  const stopDraw = useCallback(() => setIsDrawing(false), []);

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSigned(false);
  };

  const confirm = () => {
    if (!hasSigned) return;
    const canvas = canvasRef.current;
    const dataUrl = canvas.toDataURL('image/png');
    onConfirm(dataUrl);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(15,15,30,0.72)',
      backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16,
    }}>
      <div style={{
        background: '#fff', borderRadius: 20, width: '100%', maxWidth: 600,
        maxHeight: '92vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 24px 80px rgba(0,0,0,0.35)',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ padding: '18px 22px', borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: '#F5F3FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FileText style={{ width: 17, height: 17, color: '#7C3AED' }} />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>Termo de Consentimento</div>
              <div style={{ fontSize: 11, color: '#6B7280' }}>Leia, assine e confirme</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: '#F3F4F6', border: 'none', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X style={{ width: 15, height: 15, color: '#6B7280' }} />
          </button>
        </div>

        {/* Corpo do Termo — rolável */}
        <div
          onScroll={(e) => {
            const bottom = Math.abs(e.target.scrollHeight - e.target.scrollTop - e.target.clientHeight) < 18;
            if (bottom) setTermoScrolled(true);
          }}
          style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', fontSize: 12.5, color: '#374151', lineHeight: 1.75 }}
        >
          <p style={{ marginBottom: 14, color: '#6B7280', fontStyle: 'italic' }}>
            Paciente: <strong style={{ color: '#111827' }}>{pacienteNome}</strong> — {new Date().toLocaleDateString('pt-BR')}
          </p>

          <p style={{ marginBottom: 12 }}>
            Declaro ter sido informado(a) de forma clara e detalhada sobre o procedimento estético a ser realizado, incluindo os produtos, equipamentos e técnicas que serão utilizados. Fui devidamente instruído(a) sobre as indicações, contraindicações, resultados esperados e possíveis riscos inerentes ao procedimento.
          </p>
          <p style={{ marginBottom: 12 }}>
            <strong>1. RESPONSABILIDADES DO PACIENTE</strong><br />
            Comprometo-me a seguir estritamente todas as orientações pré e pós-procedimento fornecidas pela profissional responsável, estando ciente de que o não cumprimento dessas recomendações pode interferir diretamente no resultado final ou causar complicações e efeitos adversos.
          </p>
          <p style={{ marginBottom: 12 }}>
            <strong>2. RESULTADOS</strong><br />
            Estou ciente de que a estética não é uma ciência exata e que os resultados dependem de características anatômicas, biológicas e dos hábitos de vida individuais. Portanto, não é possível garantir resultados absolutos ou idênticos aos de outros pacientes.
          </p>
          <p style={{ marginBottom: 12 }}>
            <strong>3. INTERCORRÊNCIAS E REAÇÕES</strong><br />
            Compreendo que, embora as técnicas utilizadas sejam comprovadamente seguras, procedimentos estéticos estão sujeitos a intercorrências imprevistas, tais como inchaço, vermelhidão, hematomas temporários ou sensibilidade local. Em caso de reações anormais, comprometo-me a entrar em contato imediato com a profissional responsável.
          </p>
          <p style={{ marginBottom: 12 }}>
            <strong>4. VERACIDADE DAS INFORMAÇÕES</strong><br />
            Atesto que as informações fornecidas por mim nesta ficha de anamnese são verdadeiras e completas. Não omiti nenhuma doença pré-existente, uso de medicamentos ou histórico de alergias que pudessem contraindicar a realização do tratamento.
          </p>
          <p style={{ marginBottom: 20 }}>
            Por estar de acordo com o exposto acima e não restando dúvidas sobre o procedimento, autorizo a realização do mesmo pela profissional responsável.
          </p>

          {/* Área de Assinatura */}
          <div style={{ borderTop: '1px solid #E5E7EB', paddingTop: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: termoScrolled ? '#374151' : '#9CA3AF' }}>
                <PenLine style={{ width: 14, height: 14 }} />
                Assine abaixo com o mouse ou o dedo
              </div>
              {hasSigned && (
                <button onClick={clearCanvas} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#EF4444', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                  <RotateCcw style={{ width: 11, height: 11 }} /> Limpar
                </button>
              )}
            </div>
            <canvas
              ref={canvasRef}
              width={552}
              height={130}
              onMouseDown={startDraw}
              onMouseMove={draw}
              onMouseUp={stopDraw}
              onMouseLeave={stopDraw}
              onTouchStart={startDraw}
              onTouchMove={draw}
              onTouchEnd={stopDraw}
              style={{
                width: '100%', height: 130, display: 'block',
                border: `2px dashed ${hasSigned ? '#7C3AED' : termoScrolled ? '#D1D5DB' : '#E5E7EB'}`,
                borderRadius: 12, cursor: termoScrolled ? 'crosshair' : 'not-allowed',
                background: termoScrolled ? '#FAFAFA' : '#F9FAFB',
                touchAction: 'none',
                transition: 'border-color 0.2s, background 0.2s',
                pointerEvents: termoScrolled ? 'auto' : 'none',
              }}
            />
            {!termoScrolled && (
              <p style={{ fontSize: 11, color: '#9CA3AF', marginTop: 6, textAlign: 'center', fontStyle: 'italic' }}>
                ↑ Role o texto até o final para liberar a assinatura
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 22px', borderTop: '1px solid #F3F4F6', display: 'flex', gap: 10, flexShrink: 0 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '11px 0', borderRadius: 12, border: '1.5px solid #E5E7EB', background: '#fff', fontSize: 13, fontWeight: 600, color: '#6B7280', cursor: 'pointer' }}>
            Cancelar
          </button>
          <button
            onClick={confirm}
            disabled={!hasSigned}
            style={{
              flex: 2, padding: '11px 0', borderRadius: 12, border: 'none', cursor: hasSigned ? 'pointer' : 'not-allowed',
              background: hasSigned ? 'linear-gradient(135deg, #7C3AED, #5B21B6)' : '#E5E7EB',
              fontSize: 13, fontWeight: 700,
              color: hasSigned ? '#fff' : '#9CA3AF',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              transition: 'all 0.2s',
              boxShadow: hasSigned ? '0 4px 18px rgba(124,58,237,0.35)' : 'none',
            }}
          >
            <CheckCircle style={{ width: 16, height: 16 }} />
            Confirmar Assinatura e Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN FORM ─────────────────────────────────────────────────────────────────
function AnamneseForm({ paciente, initial, onSave, onCancel }) {
  const [form, setForm] = useState(() => initial || emptyForm());
  const [step, setStep] = useState(0);
  const [showPreview, setShowPreview] = useState(false);
  const [showTermoModal, setShowTermoModal] = useState(false);
  const [signatureData, setSignatureData] = useState(() => initial?.signatureDataUrl || null); // base64 png
  const [isSaving, setIsSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const toggleArr = (k, v) => setForm(f => {
    const arr = f[k] || [];
    return { ...f, [k]: arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v] };
  });

  const handleConfirmSignature = (dataUrl) => {
    setSignatureData(dataUrl);
    set('signatureDataUrl', dataUrl);
    set('leuTermos', true);
    setShowTermoModal(false);
  };

  // Envia para o pai: fichaData + signatureData (para o pai orquestrar Supabase + Drive)
  const handleSave = async () => {
    if (!form.leuTermos || !signatureData) return;
    setIsSaving(true);
    try {
      const saved = { ...form, dataPreenchimento: new Date().toISOString().split('T')[0] };
      await onSave(saved, signatureData);
    } finally {
      setIsSaving(false);
    }
  };

  const handlePrint = () => window.print();

  // Helper para linha SIM/NÃO compacta usada na aba de saúde
  const SaudeRow = ({ label, field }) => (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '8px 12px', borderRadius: 10, border: '1.5px solid #F0EBE6',
      background: '#FAFAFA', marginBottom: 6,
    }}>
      <span style={{ fontSize: 12, color: '#374151', fontWeight: 500, flex: 1 }}>{label}</span>
      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
        {['Sim', 'Não'].map(opt => {
          const sel = form[field] === opt;
          return (
            <button key={opt} type="button"
              onClick={() => setForm(f => ({ ...f, [field]: opt }))}
              style={{
                padding: '3px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                border: `1.5px solid ${sel ? (opt === 'Sim' ? '#EF4444' : '#059669') : '#E5E7EB'}`,
                background: sel ? (opt === 'Sim' ? '#FEF2F2' : '#ECFDF5') : '#fff',
                color: sel ? (opt === 'Sim' ? '#EF4444' : '#059669') : '#9CA3AF',
                transition: 'all 0.15s',
              }}>
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );

  const renderStep = () => {
    switch (STEPS[step].id) {

      // ── Pessoal ──────────────────────────────────────────────────────────────
      case 'pessoal':
        return (
          <div>
            <SectionHeader icon={User} title="Dados Pessoais Complementares" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Data de Nascimento">
                <input type="date" value={form.dataNascimento} onChange={e => set('dataNascimento', e.target.value)} style={inputSt} />
              </Field>
              <Field label="CPF">
                <input placeholder="000.000.000-00" value={form.cpf} onChange={e => set('cpf', e.target.value)} style={inputSt} />
              </Field>
              <Field label="E-mail">
                <input type="email" placeholder="exemplo@email.com" value={form.email} onChange={e => set('email', e.target.value)} style={inputSt} />
              </Field>
              <Field label="Estado Civil">
                <select value={form.estadoCivil} onChange={e => set('estadoCivil', e.target.value)} style={inputSt}>
                  <option value="">Selecione...</option>
                  {['Solteira', 'Casada', 'Divorciada', 'Viúva', 'União Estável', 'Outro'].map(o => <option key={o}>{o}</option>)}
                </select>
              </Field>
              <Field label="Profissão" span={2}>
                <input placeholder="Ex: Professora" value={form.profissao} onChange={e => set('profissao', e.target.value)} style={inputSt} />
              </Field>
              <Field label="Endereço Completo" span={2}>
                <input placeholder="Rua, número, bairro" value={form.endereco} onChange={e => set('endereco', e.target.value)} style={inputSt} />
              </Field>
              <Field label="Cidade">
                <input placeholder="Ex: São Paulo" value={form.cidade} onChange={e => set('cidade', e.target.value)} style={inputSt} />
              </Field>
            </div>

            <div style={{ marginTop: 20 }}>
              <SectionHeader icon={AlertTriangle} title="Condições Especiais" color="#D97706" bg="#FFFBEB" />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <RadioGroup label="Está gestante?" field="gestante" form={form} setForm={setForm} options={['Sim', 'Não', 'Não sei']} />
                <RadioGroup label="Está amamentando?" field="amamentando" form={form} setForm={setForm} options={['Sim', 'Não']} />
              </div>
            </div>
          </div>
        );

      // ── Saúde ─────────────────────────────────────────────────────────────
      case 'saude':
        return (
          <div>
            <SectionHeader icon={Heart} title="Histórico de Saúde" color="#EF4444" bg="#FFF5F5" />
            <p style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 12, fontStyle: 'italic' }}>Assinale SIM ou NÃO para cada condição:</p>

            {/* Coluna 1 e 2 em grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
              <div>
                <SaudeRow label="Sensibilidade nos olhos?" field="sensibilidadeOlhos" />
                <SaudeRow label="Alergias?" field="alergias" />
                <SaudeRow label="Alergia a picada de abelhas?" field="alergiaPicadaAbelha" />
                <SaudeRow label="Problemas cardíacos?" field="problemasCardiacos" />
                <SaudeRow label="Alterações de pressão?" field="alteracoesPressao" />
                <SaudeRow label="Alterações vasculares?" field="alteracoesVasculares" />
                <SaudeRow label="Diabetes?" field="diabetes" />
                <SaudeRow label="Hérnia?" field="hernia" />
                <SaudeRow label="Doença autoimune?" field="doencaAutoimune" />
                <SaudeRow label="HIV ou Hepatite?" field="hivHepatite" />
                <SaudeRow label="Doença crônica?" field="doencaCronica" />
                <SaudeRow label="Colesterol alterado?" field="colesterol" />
              </div>
              <div>
                <SaudeRow label="Problema renal?" field="problemaRenal" />
                <SaudeRow label="Problemas neurológicos?" field="problemasNeurologicos" />
                <SaudeRow label="Tumor?" field="tumor" />
                <SaudeRow label="Problema de pele?" field="problemaDePele" />
                <SaudeRow label="Fios de Ouro ou PMMA?" field="fiosDeOuroOuPMMA" />
                <SaudeRow label="Queloide?" field="quelioide" />
                <SaudeRow label="Prótese metálica?" field="proteseMetalica" />
                <SaudeRow label="Alterações hormonais?" field="alteracoesHormonais" />
                <SaudeRow label="Problemas na tireoide?" field="problemaTireoide" />
                <SaudeRow label="Ovário policístico?" field="ovarioPolicistico" />
                <SaudeRow label="Mioma?" field="mioma" />
                <SaudeRow label="Endometriose?" field="endometriose" />
              </div>
            </div>

            {/* Segunda linha de condições */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px', marginTop: 4 }}>
              <div>
                <SaudeRow label="Depressão?" field="depressao" />
                <SaudeRow label="Síndrome do pânico?" field="sindromeDopanico" />
              </div>
              <div>
                <SaudeRow label="Procedimentos definitivos?" field="procedimentosDefinitivos" />
                <SaudeRow label="Marcapasso?" field="usaMarcapasso" />
              </div>
            </div>

            {/* Cirurgias */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12, marginBottom: 8 }}>
              <RadioGroup label="Já fez cirurgia?" field="fezCirurgia" form={form} setForm={setForm} options={['Sim', 'Não']} />
              <RadioGroup label="Histórico oncológico?" field="temOncologico" form={form} setForm={setForm} options={['Sim', 'Não', 'Em tratamento']} />
            </div>
            {form.fezCirurgia === 'Sim' && (
              <Field label="Qual cirurgia?">
                <input placeholder="Descreva a cirurgia e quando foi realizada" value={form.qualCirurgia} onChange={e => set('qualCirurgia', e.target.value)} style={{ ...inputSt, marginBottom: 12 }} />
              </Field>
            )}

            <Field label="Outras doenças ou condições relevantes">
              <textarea placeholder="Descreva..." value={form.outrasDoencas} onChange={e => set('outrasDoencas', e.target.value)} style={textareaSt} />
            </Field>

            <div style={{ marginTop: 16 }}>
              <SectionHeader icon={AlertTriangle} title="Medicamentos e Alergias" color="#7C3AED" bg="#F5F3FF" />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                <RadioGroup label="Usa medicamentos regularmente?" field="usaMedicamentos" form={form} setForm={setForm} options={['Sim', 'Não']} />
                <RadioGroup label="Tem alguma alergia?" field="temAlergia" form={form} setForm={setForm} options={['Sim', 'Não']} />
              </div>

              {form.usaMedicamentos === 'Sim' && (
                <Field label="Quais medicamentos?">
                  <textarea placeholder="Liste os medicamentos em uso" value={form.quaisMedicamentos} onChange={e => set('quaisMedicamentos', e.target.value)} style={{ ...textareaSt, marginBottom: 12 }} />
                </Field>
              )}
              {form.temAlergia === 'Sim' && (
                <Field label="Quais alergias?">
                  <textarea placeholder="Descreva as alergias conhecidas" value={form.quaisAlergias} onChange={e => set('quaisAlergias', e.target.value)} style={{ ...textareaSt, marginBottom: 12 }} />
                </Field>
              )}

              <div style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Alergias específicas (marque as que se aplicam)</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                <CheckItem label="Látex" checked={form.alergiaLatex} onChange={v => set('alergiaLatex', v)} />
                <CheckItem label="Iodo" checked={form.alergiaIodo} onChange={v => set('alergiaIodo', v)} />
                <CheckItem label="Anestésico local" checked={form.alergiaAnestesico} onChange={v => set('alergiaAnestesico', v)} />
                <CheckItem label="Substâncias quelantes" checked={form.alergiaQuelante} onChange={v => set('alergiaQuelante', v)} />
              </div>
            </div>
          </div>
        );

      // ── Pele ──────────────────────────────────────────────────────────────
      case 'pele':
        return (
          <div>
            <SectionHeader icon={Leaf} title="Características da Pele" color="#059669" bg="#ECFDF5" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
              <RadioGroup label="Tipo de pele" field="tipoPele" form={form} setForm={setForm} options={['Seca', 'Normal', 'Mista', 'Oleosa']} />
              <RadioGroup label="Sensibilidade" field="sensibilidadePele" form={form} setForm={setForm} options={['Sensível', 'Pouco sensível', 'Normal']} />
              <RadioGroup label="Oleosidade" field="oleosidadePele" form={form} setForm={setForm} options={['Baixa', 'Moderada', 'Alta']} />
              <RadioGroup label="Usa protetor solar?" field="usaProtetor" form={form} setForm={setForm} options={['Sempre', 'Às vezes', 'Raramente', 'Nunca']} />
              <RadioGroup label="Exposição solar" field="exposicaoSolar" form={form} setForm={setForm} options={['Pouca', 'Moderada', 'Muita']} />
              <RadioGroup label="Usa ou já usou ácidos na pele?" field="usaAcidos" form={form} setForm={setForm} options={['Sim', 'Não']} />
            </div>

            <Field label="Fotótipo de pele (Fitzpatrick)">
              <select value={form.fototipoCampo} onChange={e => set('fototipoCampo', e.target.value)} style={{ ...inputSt, marginBottom: 16 }}>
                <option value="">Selecione...</option>
                <option value="I">I — Pele muito clara, sempre queima, nunca bronzeia</option>
                <option value="II">II — Pele clara, queima com facilidade, bronzeia pouco</option>
                <option value="III">III — Pele média, queima moderadamente, bronzeia gradualmente</option>
                <option value="IV">IV — Pele morena, queima pouco, bronzeia com facilidade</option>
                <option value="V">V — Pele morena escura, raramente queima, bronzeia muito</option>
                <option value="VI">VI — Pele negra, nunca queima</option>
              </select>
            </Field>

            {/* Cosméticos */}
            <div style={{ marginBottom: 16 }}>
              <RadioGroup label="Faz uso de cosméticos diariamente?" field="usaCosmeticos" form={form} setForm={setForm} options={['Sim', 'Não']} />
              {form.usaCosmeticos === 'Sim' && (
                <Field label="Quais cosméticos?">
                  <textarea placeholder="Ex: hidratante, sérum, vitamina C..." value={form.quaisCosmeticos} onChange={e => set('quaisCosmeticos', e.target.value)} style={{ ...textareaSt, marginBottom: 8 }} />
                </Field>
              )}
            </div>

            <div style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Problemas de pele (marque os que se aplicam)</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
              {['Acne', 'Rosácea', 'Melasma', 'Manchas', 'Cicatrizes', 'Rugas', 'Flacidez', 'Poros dilatados', 'Olheiras', 'Bolsas', 'Estrias', 'Herpes', 'Psoríase', 'Dermatite'].map(p => (
                <CheckItem key={p} label={p} checked={(form.problemasPele || []).includes(p)} onChange={() => toggleArr('problemasPele', p)} />
              ))}
            </div>

            <SectionHeader icon={CheckCircle} title="Histórico de Procedimentos Estéticos" color="#3498DB" bg="#EBF5FB" />
            <div style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Já realizou (marque os que se aplicam)</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
              {[
                { key: 'jaFezBotox', label: 'Botox / Toxina Botulínica' },
                { key: 'jaFezPreenchimento', label: 'Preenchimento Facial' },
                { key: 'jaFezPeeling', label: 'Peeling Químico' },
                { key: 'jaFezLaser', label: 'Laser / IPL' },
                { key: 'jaFezMicroagulhamento', label: 'Microagulhamento' },
                { key: 'jaFezLimpezaPele', label: 'Limpeza de Pele' },
              ].map(({ key, label }) => (
                <CheckItem key={key} label={label} checked={form[key]} onChange={v => set(key, v)} />
              ))}
              <CheckItem label="Outro" checked={form.jaFezOutro} onChange={v => set('jaFezOutro', v)} />
            </div>
            {form.jaFezOutro && (
              <Field label="Qual procedimento?">
                <input placeholder="Descreva o procedimento" value={form.outroHistorico} onChange={e => set('outroHistorico', e.target.value)} style={{ ...inputSt, marginBottom: 12 }} />
              </Field>
            )}

            {/* Resultado de tratamentos anteriores */}
            {(form.jaFezBotox || form.jaFezPreenchimento || form.jaFezPeeling || form.jaFezLaser || form.jaFezMicroagulhamento || form.jaFezLimpezaPele || form.jaFezOutro) && (
              <div style={{ marginBottom: 12 }}>
                <RadioGroup label="Como foram os resultados dos tratamentos anteriores?" field="resultadoTratamentoAnterior" form={form} setForm={setForm} options={['Bons', 'Regulares', 'Ruins']} />
              </div>
            )}

            <RadioGroup label="Teve alguma reação adversa a procedimento estético?" field="reacaoAnterior" form={form} setForm={setForm} options={['Sim', 'Não']} />
            {form.reacaoAnterior === 'Sim' && (
              <Field label="Descreva a reação">
                <textarea placeholder="O que aconteceu?" value={form.detalhesReacao} onChange={e => set('detalhesReacao', e.target.value)} style={textareaSt} />
              </Field>
            )}
          </div>
        );

      // ── Hábitos ──────────────────────────────────────────────────────────
      case 'habitos':
        return (
          <div>
            {/* Rotina clínica */}
            <SectionHeader icon={AlertTriangle} title="Rotina & Saúde Atual" color="#7C3AED" bg="#F5F3FF" />
            <div style={{ marginBottom: 16 }}>
              <SaudeRow label="Está em tratamento médico?" field="emTratamentoMedico" />
              <SaudeRow label="Possui plano de saúde?" field="possuiPlanoSaude" />
              <SaudeRow label="Tem algum problema de saúde atual?" field="problemaSaudeAtual" />
              <SaudeRow label="Usou antibiótico ou anti-inflamatório nos últimos 7 dias?" field="usouAntibiotico7dias" />
              <SaudeRow label="Usou isotretinoína (Roacutan) nos últimos 6 meses?" field="usouRoacutan6meses" />
              <SaudeRow label="Já teve reação alérgica à anestesia?" field="reacaoAlergicaAnestesia" />
              <SaudeRow label="Tomou vacina há menos de 6 meses?" field="tomouVacina6meses" />
              <SaudeRow label="O intestino é regulado?" field="intestinoRegulado" />
            </div>

            {/* Histórico familiar */}
            <div style={{ marginBottom: 14 }}>
              <RadioGroup label="Histórico familiar de doenças?" field="historiFamiliarDoencas" form={form} setForm={setForm} options={['Sim', 'Não']} />
              {form.historiFamiliarDoencas === 'Sim' && (
                <Field label="Qual doença familiar?">
                  <input placeholder="Ex: diabetes, câncer, hipertensão..." value={form.qualHistoricoFamiliar} onChange={e => set('qualHistoricoFamiliar', e.target.value)} style={{ ...inputSt, marginBottom: 8 }} />
                </Field>
              )}
            </div>

            {/* Anticoncepcional */}
            <div style={{ marginBottom: 14 }}>
              <RadioGroup label="Faz uso de método anticoncepcional?" field="usaAnticoncepcional" form={form} setForm={setForm} options={['Sim', 'Não']} />
              {form.usaAnticoncepcional === 'Sim' && (
                <Field label="Qual método?">
                  <input placeholder="Ex: pílula, DIU, implante..." value={form.qualAnticoncepcional} onChange={e => set('qualAnticoncepcional', e.target.value)} style={{ ...inputSt, marginBottom: 8 }} />
                </Field>
              )}
            </div>

            {/* Suplementos */}
            <div style={{ marginBottom: 16 }}>
              <RadioGroup label="Faz uso de suplementos alimentares?" field="usaSuplemento" form={form} setForm={setForm} options={['Sim', 'Não']} />
              {form.usaSuplemento === 'Sim' && (
                <Field label="Quais suplementos?">
                  <textarea placeholder="Ex: colágeno, vitamina C, ômega 3..." value={form.quaisSuplemento} onChange={e => set('quaisSuplemento', e.target.value)} style={{ ...textareaSt, marginBottom: 8 }} />
                </Field>
              )}
            </div>

            {/* Estilo de vida */}
            <SectionHeader icon={Target} title="Estilo de Vida" color="#D97706" bg="#FFFBEB" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
              <RadioGroup label="Fuma?" field="fuma" form={form} setForm={setForm} options={['Sim', 'Não', 'Ex-fumante']} />
              {form.fuma === 'Sim' && <RadioGroup label="Com que frequência?" field="frequenciaFuma" form={form} setForm={setForm} options={['Socialmente', 'Todo dia', 'Mais de 10/dia']} />}
              <RadioGroup label="Consome bebida alcoólica?" field="bebidaAlcoolica" form={form} setForm={setForm} options={['Sim', 'Não']} />
              {form.bebidaAlcoolica === 'Sim' && <RadioGroup label="Com que frequência?" field="frequenciaBebe" form={form} setForm={setForm} options={['Raramente', 'Fins de semana', 'Frequentemente']} />}
              <RadioGroup label="Pratica atividade física?" field="atividade" form={form} setForm={setForm} options={['Não pratico', '1-2x/semana', '3-5x/semana', 'Diariamente']} />
              <RadioGroup label="Costuma tomar sol?" field="tomaSol" form={form} setForm={setForm} options={['Sim', 'Não', 'Às vezes']} />
              <RadioGroup label="Consumo de água por dia" field="ingereAgua" form={form} setForm={setForm} options={['Menos de 1L', 'Entre 1 e 2L', 'Mais de 2L']} />
              <RadioGroup label="Qualidade do sono" field="qualidadeSono" form={form} setForm={setForm} options={['Boa', 'Regular', 'Ruim', 'Insônia']} />
              <RadioGroup
                label="Como descreveria sua alimentação?"
                field="alimentacao"
                form={form}
                setForm={setForm}
                options={['Equilibrada e saudável', 'Rica em açúcares/gorduras', 'Restritiva / Dieta específica']}
              />
            </div>
          </div>
        );

      // ── Objetivos + Termo ─────────────────────────────────────────────────
      case 'objetivos':
        return (
          <div>
            {/* ── Objetivos ── */}
            <SectionHeader icon={Target} title="Objetivos e Expectativas" color="#C73B6D" bg="#FDF4F7" />
            <div style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Principais objetivos (marque os que se aplicam)</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
              {['Rejuvenescimento', 'Redução de manchas', 'Tratar acne', 'Harmonização facial', 'Hidratação', 'Redução de rugas', 'Firmeza / flacidez', 'Limpeza de pele', 'Redução de gordura localizada', 'Tratamento de cicatrizes', 'Melhora da autoestima', 'Indicação médica'].map(o => (
                <CheckItem key={o} label={o} checked={(form.objetivosPrincipais || []).includes(o)} onChange={() => toggleArr('objetivosPrincipais', o)} />
              ))}
            </div>
            <Field label="Descreva suas expectativas com o tratamento">
              <textarea placeholder="O que você espera alcançar?" value={form.expectativas} onChange={e => set('expectativas', e.target.value)} style={{ ...textareaSt, marginBottom: 14 }} />
            </Field>

            {/* ── Termo de Consentimento ── */}
            <div style={{ marginBottom: 14 }}>
              <SectionHeader icon={FileText} title="Termo de Consentimento" color="#7C3AED" bg="#F5F3FF" />
            </div>

            {!signatureData ? (
              <div style={{
                border: '2px dashed #C4B5FD', borderRadius: 16, padding: '28px 24px',
                textAlign: 'center', background: '#FAFAFF', marginBottom: 20,
              }}>
                <div style={{ width: 52, height: 52, borderRadius: 14, background: '#F5F3FF', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
                  <FileText style={{ width: 24, height: 24, color: '#7C3AED' }} />
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#1F2937', marginBottom: 6 }}>
                  Termo de Consentimento Livre e Esclarecido
                </div>
                <div style={{ fontSize: 12.5, color: '#6B7280', marginBottom: 20, lineHeight: 1.5, maxWidth: 360, margin: '0 auto 20px' }}>
                  Clique no botão abaixo para ler o termo na íntegra e assinar digitalmente.
                </div>
                <button
                  onClick={() => setShowTermoModal(true)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 9,
                    padding: '12px 28px', borderRadius: 30, border: 'none', cursor: 'pointer',
                    background: 'linear-gradient(135deg, #7C3AED, #5B21B6)',
                    color: '#fff', fontSize: 14, fontWeight: 700,
                    boxShadow: '0 6px 20px rgba(124,58,237,0.35)',
                    transition: 'transform 0.15s, box-shadow 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 10px 28px rgba(124,58,237,0.45)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(124,58,237,0.35)'; }}
                >
                  <PenLine style={{ width: 17, height: 17 }} />
                  Ler e Assinar o Termo
                </button>
              </div>
            ) : (
              <div style={{ background: '#F5F3FF', border: '2px solid #C4B5FD', borderRadius: 16, padding: 16, marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                  <CheckCircle style={{ width: 18, height: 18, color: '#7C3AED' }} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#5B21B6' }}>Termo assinado com sucesso!</span>
                  <button
                    onClick={() => { setSignatureData(null); set('signatureDataUrl', null); set('leuTermos', false); }}
                    style={{ marginLeft: 'auto', fontSize: 11, color: '#7C3AED', background: 'none', border: '1px solid #C4B5FD', borderRadius: 20, padding: '3px 10px', cursor: 'pointer', fontWeight: 600 }}
                  >
                    Reassinar
                  </button>
                </div>
                <div style={{ background: '#fff', borderRadius: 10, padding: 10, border: '1px solid #E5E7EB', marginBottom: 12 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Assinatura digital de {paciente.nome}</div>
                  <img src={signatureData} alt="Assinatura" style={{ maxWidth: '100%', height: 80, objectFit: 'contain', display: 'block' }} />
                </div>
                <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: 10, padding: '10px 14px' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#166534', marginBottom: 3, textTransform: 'uppercase', letterSpacing: 0.5 }}>✅ Assinatura Digital Registrada</div>
                  <div style={{ fontSize: 12, color: '#1F2937' }}>
                    <strong>{paciente.nome}</strong> — confirmou ciência e consentimento em <strong>{new Date().toLocaleDateString('pt-BR')}</strong>
                  </div>
                </div>
              </div>
            )}

            {/* Observações */}

            <Field label="Observações do profissional">
              <textarea placeholder="Anotações internas (não visíveis ao cliente)..." value={form.observacoesProfissional} onChange={e => set('observacoesProfissional', e.target.value)} style={textareaSt} />
            </Field>
          </div>
        );

      default: return null;
    }
  };



  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Signature Modal */}
      {showTermoModal && (
        <SignatureModal
          pacienteNome={paciente.nome}
          onClose={() => setShowTermoModal(false)}
          onConfirm={handleConfirmSignature}
        />
      )}

      {/* Preview Modal */}
      {showPreview && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(15,15,30,0.72)',
          backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 16,
        }}>
          <div style={{
            background: '#fff', borderRadius: 20, width: '100%', maxWidth: 800,
            height: '92vh', display: 'flex', flexDirection: 'column',
            boxShadow: '0 24px 80px rgba(0,0,0,0.35)',
            overflow: 'hidden', padding: 24,
          }}>
            <ViewFicha
              paciente={paciente}
              ficha={form}
              onClose={() => setShowPreview(false)}
              onConfirmSave={handleSave}
              isSaving={isSaving}
            />
          </div>
        </div>
      )}
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={onCancel} style={{ background: '#F3F4F6', border: 'none', borderRadius: 10, width: 36, height: 36, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ArrowLeft style={{ width: 16, height: 16, color: '#6B7280' }} />
          </button>
          <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#C73B6D', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700 }}>
            {paciente.nome?.charAt(0) || '?'}
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#1F2937' }}>{paciente.nome}</div>
            <div style={{ fontSize: 11, color: '#9CA3AF' }}>Ficha de Anamnese</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handlePrint} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, border: '1px solid #E5E7EB', background: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', color: '#374151' }}>
            <Printer style={{ width: 14, height: 14 }} /> Imprimir
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 10, border: 'none', background: isSaving ? '#D1D5DB' : 'linear-gradient(135deg,#C73B6D,#9B2C50)', fontSize: 12, fontWeight: 700, cursor: isSaving ? 'not-allowed' : 'pointer', color: '#fff', boxShadow: isSaving ? 'none' : '0 3px 10px rgba(199,59,109,0.3)' }}
          >
            {isSaving ? <Loader2 style={{ width: 14, height: 14, animation: 'spin 1s linear infinite' }} /> : <Save style={{ width: 14, height: 14 }} />}
            {isSaving ? 'Salvando...' : 'Salvar Ficha'}
          </button>
        </div>
      </div>

      {/* Steps */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20 }}>
        {STEPS.map((s, i) => {
          const done = i < step;
          const current = i === step;
          const Icon = s.icon;
          return (
            <button key={s.id} onClick={() => setStep(i)} style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
              padding: '8px 4px', borderRadius: 10, border: 'none', cursor: 'pointer', transition: 'all 0.15s',
              background: current ? '#C73B6D' : done ? '#ECFDF5' : '#F3F4F6',
              color: current ? '#fff' : done ? '#059669' : '#6B7280',
              fontSize: 11, fontWeight: 700,
            }}>
              <Icon style={{ width: 13, height: 13, flexShrink: 0 }} />
              <span style={{ display: window.innerWidth < 600 ? 'none' : 'inline' }}>{s.label}</span>
            </button>
          );
        })}
      </div>

      {/* Form body */}
      <div style={{ flex: 1, overflowY: 'auto', background: '#fff', borderRadius: 16, padding: 24, border: '1px solid #F0EBE6', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
        {renderStep()}
      </div>

      {/* Navigation */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 14, gap: 8 }}>
        <button onClick={() => setStep(s => Math.max(0, s - 1))} disabled={step === 0}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', borderRadius: 10, border: '1px solid #E5E7EB', background: step === 0 ? '#F3F4F6' : '#fff', fontSize: 13, fontWeight: 600, cursor: step === 0 ? 'not-allowed' : 'pointer', color: step === 0 ? '#9CA3AF' : '#374151' }}>
          <ChevronLeft style={{ width: 15, height: 15 }} /> Anterior
        </button>
        <div style={{ fontSize: 12, color: '#9CA3AF', display: 'flex', alignItems: 'center' }}>
          {step + 1} de {STEPS.length}
        </div>
        {step < STEPS.length - 1
          ? <button onClick={() => setStep(s => s + 1)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#C73B6D,#9B2C50)', fontSize: 13, fontWeight: 700, cursor: 'pointer', color: '#fff' }}>
            Próximo <ChevronRight style={{ width: 15, height: 15 }} />
          </button>
          : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
              {!form.leuTermos && (
                <span style={{ fontSize: 11, color: '#EF4444', fontWeight: 600 }}>
                  ⚠️ Leia e confirme o termo para continuar
                </span>
              )}
              <button
                onClick={() => setShowPreview(true)}
                disabled={!form.leuTermos}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '9px 18px', borderRadius: 10, border: 'none',
                  background: form.leuTermos ? 'linear-gradient(135deg,#059669,#047857)' : '#D1D5DB',
                  fontSize: 13, fontWeight: 700,
                  cursor: form.leuTermos ? 'pointer' : 'not-allowed',
                  color: form.leuTermos ? '#fff' : '#9CA3AF',
                  transition: 'all 0.2s',
                  boxShadow: form.leuTermos ? '0 4px 14px rgba(5,150,105,0.35)' : 'none',
                }}
              >
                <Eye style={{ width: 15, height: 15 }} /> Visualizar Resumo
              </button>
            </div>
          )
        }
      </div>
    </div>
  );
}

// ─── VIEW FICHA ───────────────────────────────────────────────────────────────
function ViewFicha({ paciente, ficha, onEdit, onClose, onConfirmSave, isSaving }) {
  const Section = ({ title, children }) => (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, paddingBottom: 6, borderBottom: '1px solid #F0EBE6' }}>{title}</div>
      {children}
    </div>
  );
  const Row = ({ label, value }) => value ? (
    <div style={{ display: 'flex', gap: 8, fontSize: 13, marginBottom: 6 }}>
      <span style={{ color: '#9CA3AF', minWidth: 200 }}>{label}:</span>
      <span style={{ color: '#1F2937', fontWeight: 500 }}>{Array.isArray(value) ? value.join(', ') : value}</span>
    </div>
  ) : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={onClose} style={{ background: '#F3F4F6', border: 'none', borderRadius: 10, width: 36, height: 36, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ArrowLeft style={{ width: 16, height: 16, color: '#6B7280' }} />
          </button>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#1F2937' }}>{paciente.nome}</div>
            <div style={{ fontSize: 11, color: '#9CA3AF' }}>Preenchida em {ficha.dataPreenchimento || '—'}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => window.print()} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, border: '1px solid #E5E7EB', background: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', color: '#374151' }}>
            <Printer style={{ width: 14, height: 14 }} /> Imprimir
          </button>
          {onConfirmSave ? (
            <button
              onClick={onConfirmSave}
              disabled={isSaving}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 10, border: 'none',
                background: isSaving ? '#D1D5DB' : 'linear-gradient(135deg,#059669,#047857)',
                fontSize: 12, fontWeight: 700, cursor: isSaving ? 'not-allowed' : 'pointer', color: '#fff',
                boxShadow: isSaving ? 'none' : '0 3px 10px rgba(5,150,105,0.3)'
              }}
            >
              {isSaving ? <Loader2 style={{ width: 14, height: 14, animation: 'spin 1s linear infinite' }} /> : <Save style={{ width: 14, height: 14 }} />}
              {isSaving ? 'Salvando...' : 'Salvar Ficha'}
            </button>
          ) : (
            onEdit && (
              <button onClick={onEdit} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#C73B6D,#9B2C50)', fontSize: 12, fontWeight: 700, cursor: 'pointer', color: '#fff' }}>
                <Edit3 style={{ width: 14, height: 14 }} /> Editar
              </button>
            )
          )}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', background: '#fff', borderRadius: 16, padding: 24, border: '1px solid #F0EBE6' }}>
        <Section title="Dados Pessoais">
          <Row label="Nascimento" value={ficha.dataNascimento} />
          <Row label="CPF" value={ficha.cpf} />
          <Row label="E-mail" value={ficha.email} />
          <Row label="Estado Civil" value={ficha.estadoCivil} />
          <Row label="Profissão" value={ficha.profissao} />
          <Row label="Endereço" value={ficha.endereco} />
          <Row label="Cidade" value={ficha.cidade} />
          <Row label="Gestante" value={ficha.gestante} />
          <Row label="Amamentando" value={ficha.amamentando} />
        </Section>

        <Section title="Histórico de Saúde">
          <Row label="Sensibilidade nos olhos" value={ficha.sensibilidadeOlhos} />
          <Row label="Alergias" value={ficha.alergias} />
          <Row label="Alergia a picada de abelhas" value={ficha.alergiaPicadaAbelha} />
          <Row label="Problemas cardíacos" value={ficha.problemasCardiacos} />
          <Row label="Alterações de pressão" value={ficha.alteracoesPressao} />
          <Row label="Alterações vasculares" value={ficha.alteracoesVasculares} />
          <Row label="Diabetes" value={ficha.diabetes} />
          <Row label="Hérnia" value={ficha.hernia} />
          <Row label="Doença autoimune" value={ficha.doencaAutoimune} />
          <Row label="HIV ou Hepatite" value={ficha.hivHepatite} />
          <Row label="Doença crônica" value={ficha.doencaCronica} />
          <Row label="Colesterol alterado" value={ficha.colesterol} />
          <Row label="Problema renal" value={ficha.problemaRenal} />
          <Row label="Problemas neurológicos" value={ficha.problemasNeurologicos} />
          <Row label="Tumor" value={ficha.tumor} />
          <Row label="Problema de pele (histórico)" value={ficha.problemaDePele} />
          <Row label="Fios de Ouro ou PMMA" value={ficha.fiosDeOuroOuPMMA} />
          <Row label="Queloide" value={ficha.quelioide} />
          <Row label="Prótese metálica" value={ficha.proteseMetalica} />
          <Row label="Alterações hormonais" value={ficha.alteracoesHormonais} />
          <Row label="Problemas na tireoide" value={ficha.problemaTireoide} />
          <Row label="Ovário policístico" value={ficha.ovarioPolicistico} />
          <Row label="Mioma" value={ficha.mioma} />
          <Row label="Endometriose" value={ficha.endometriose} />
          <Row label="Depressão" value={ficha.depressao} />
          <Row label="Síndrome do pânico" value={ficha.sindromeDopanico} />
          <Row label="Procedimentos definitivos" value={ficha.procedimentosDefinitivos} />
          <Row label="Marcapasso" value={ficha.usaMarcapasso} />
          <Row label="Cirurgia prévia" value={ficha.fezCirurgia === 'Sim' ? `Sim — ${ficha.qualCirurgia}` : ficha.fezCirurgia} />
          <Row label="Histórico oncológico" value={ficha.temOncologico} />
          <Row label="Outras condições" value={ficha.outrasDoencas} />
          <Row label="Medicamentos" value={ficha.usaMedicamentos === 'Sim' ? ficha.quaisMedicamentos : ficha.usaMedicamentos} />
          <Row label="Alergias gerais" value={ficha.temAlergia === 'Sim' ? ficha.quaisAlergias : ficha.temAlergia} />
          {[ficha.alergiaLatex && 'Látex', ficha.alergiaIodo && 'Iodo', ficha.alergiaAnestesico && 'Anestésico', ficha.alergiaQuelante && 'Quelante'].filter(Boolean).length > 0 && (
            <Row label="Alergias específicas" value={[ficha.alergiaLatex && 'Látex', ficha.alergiaIodo && 'Iodo', ficha.alergiaAnestesico && 'Anestésico', ficha.alergiaQuelante && 'Quelante'].filter(Boolean)} />
          )}
        </Section>

        <Section title="Pele e Histórico Estético">
          <Row label="Tipo de pele" value={ficha.tipoPele} />
          <Row label="Sensibilidade" value={ficha.sensibilidadePele} />
          <Row label="Fotótipo" value={ficha.fototipoCampo} />
          <Row label="Usa protetor" value={ficha.usaProtetor} />
          <Row label="Usa ou já usou ácidos" value={ficha.usaAcidos} />
          <Row label="Usa cosméticos diariamente" value={ficha.usaCosmeticos === 'Sim' ? `Sim — ${ficha.quaisCosmeticos}` : ficha.usaCosmeticos} />
          <Row label="Problemas de pele" value={ficha.problemasPele} />
          <Row label="Procedimentos anteriores" value={[
            ficha.jaFezBotox && 'Botox', ficha.jaFezPreenchimento && 'Preenchimento',
            ficha.jaFezPeeling && 'Peeling', ficha.jaFezLaser && 'Laser',
            ficha.jaFezMicroagulhamento && 'Microagulhamento', ficha.jaFezLimpezaPele && 'Limpeza de Pele',
            ficha.jaFezOutro && ficha.outroHistorico
          ].filter(Boolean)} />
          <Row label="Resultado dos tratamentos" value={ficha.resultadoTratamentoAnterior} />
          <Row label="Reação adversa" value={ficha.reacaoAnterior === 'Sim' ? `Sim — ${ficha.detalhesReacao}` : ficha.reacaoAnterior} />
        </Section>

        <Section title="Rotina & Hábitos">
          <Row label="Em tratamento médico" value={ficha.emTratamentoMedico} />
          <Row label="Plano de saúde" value={ficha.possuiPlanoSaude} />
          <Row label="Problema de saúde atual" value={ficha.problemaSaudeAtual} />
          <Row label="Antibiótico/anti-inflam. (7 dias)" value={ficha.usouAntibiotico7dias} />
          <Row label="Roacutan (6 meses)" value={ficha.usouRoacutan6meses} />
          <Row label="Reação à anestesia" value={ficha.reacaoAlergicaAnestesia} />
          <Row label="Vacina (6 meses)" value={ficha.tomouVacina6meses} />
          <Row label="Intestino regulado" value={ficha.intestinoRegulado} />
          <Row label="Histórico familiar" value={ficha.historiFamiliarDoencas === 'Sim' ? `Sim — ${ficha.qualHistoricoFamiliar}` : ficha.historiFamiliarDoencas} />
          <Row label="Anticoncepcional" value={ficha.usaAnticoncepcional === 'Sim' ? `Sim — ${ficha.qualAnticoncepcional}` : ficha.usaAnticoncepcional} />
          <Row label="Suplementos" value={ficha.usaSuplemento === 'Sim' ? `Sim — ${ficha.quaisSuplemento}` : ficha.usaSuplemento} />
          <Row label="Fuma" value={ficha.fuma === 'Sim' ? `Sim — ${ficha.frequenciaFuma}` : ficha.fuma} />
          <Row label="Bebida alcoólica" value={ficha.bebidaAlcoolica === 'Sim' ? `Sim — ${ficha.frequenciaBebe}` : ficha.bebidaAlcoolica} />
          <Row label="Atividade física" value={ficha.atividade} />
          <Row label="Toma sol" value={ficha.tomaSol} />
          <Row label="Consumo de água" value={ficha.ingereAgua} />
          <Row label="Qualidade do sono" value={ficha.qualidadeSono} />
          <Row label="Alimentação" value={ficha.alimentacao} />
        </Section>

        <Section title="Objetivos e Expectativas">
          <Row label="Objetivos" value={ficha.objetivosPrincipais} />
          <Row label="Expectativas" value={ficha.expectativas} />
          <Row label="Assinou termo" value={ficha.leuTermos ? '✅ Sim' : '❌ Não'} />
          {ficha.signatureDataUrl && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', marginBottom: 4, textTransform: 'uppercase' }}>Assinatura do Paciente</div>
              <img src={ficha.signatureDataUrl} alt="Assinatura" style={{ maxWidth: '100%', height: 80, objectFit: 'contain', display: 'block', borderRadius: 8, border: '1px solid #E5E7EB', padding: 4, background: '#fff' }} />
            </div>
          )}
        </Section>

        {ficha.observacoesProfissional && (
          <Section title="Observações do Profissional">
            <div style={{ fontSize: 13, color: '#374151', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 10, padding: 12 }}>
              {ficha.observacoesProfissional}
            </div>
          </Section>
        )}
      </div>
    </div>
  );
}

// ─── MAIN PAGE ─────────────────────────────────────────────────────────────────
export default function Anamnese() {
  const [pacientes, setPacientes] = useState([]);
  const [anamneses, setAnamneses] = useState({}); // { clientId: { tipoFicha: fichaData } }
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [view, setView] = useState('list'); // 'list' | 'form' | 'view'
  const [selectedPaciente, setSelectedPaciente] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showTypeModal, setShowTypeModal] = useState(null);
  const [initialTipoFicha, setInitialTipoFicha] = useState('');

  // ── Carrega dados do Supabase ao montar (nenhum localStorage/sessionStorage) ──
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [{ data: clientsData }, { data: anamnesesData }] = await Promise.all([
        fetchClients(),
        fetchAnamneses(),
      ]);
      if (cancelled) return;
      setPacientes((clientsData || []).map(mapClientFromSupabase));
      const map = {};
      (anamnesesData || []).forEach(row => {
        const ficha = mapAnamneseFromSupabase(row);
        if (ficha.clientId) {
          const key = String(ficha.clientId);
          const tipoFicha = ficha.tipoFicha || 'Outros'; // Fallback para fichas antigas sem tipo
          if (!map[key]) map[key] = {};
          map[key][tipoFicha] = ficha;
        }
      });
      setAnamneses(map);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => pacientes.filter(p =>
    p.nome?.toLowerCase().includes(busca.toLowerCase()) ||
    p.telefone?.includes(busca)
  ), [pacientes, busca]);

  // handleSave recebe fichaData (form) + signatureData (base64) do AnamneseForm.
  // Responsabilidade: upsert no Supabase.
  // Nenhum dado é gravado em localStorage ou sessionStorage.
  const handleSave = async (fichaData, signatureData) => {
    try {
      if (!selectedPaciente) return;
      const user = await getCurrentUser();
      if (!user?.id) {
        alert('Erro: usuário não autenticado. Faça login novamente.');
        return;
      }
      
      const key = String(selectedPaciente.id);
      const tipoFicha = fichaData.tipoFicha;
      const existing = anamneses[key]?.[tipoFicha];
      const id = existing?.id;
      const payload = mapAnamneseToSupabase(
        { ...fichaData, id, clientId: selectedPaciente.id, signatureDataUrl: signatureData },
        user.id
      );

      const { data, error } = await upsertAnamnese(payload);
      if (error) {
        console.error('Supabase error:', error);
        alert('Erro ao salvar ficha: ' + (error.message || error));
        return;
      }
      if (data) {
        const saved = mapAnamneseFromSupabase(data);
        setAnamneses(prev => ({
          ...prev,
          [key]: { ...prev[key], [tipoFicha]: saved }
        }));
      }

      // Navega para a view imediatamente após salvar no Supabase
      setView('view');
      setIsEditing(false);
    } catch (err) {
      console.error('Catch error saving:', err);
      alert('Erro interno ao salvar: ' + err.message);
    }
  };

  const handleDelete = async (pacienteId, tipoFicha) => {
    if (!window.confirm('Deseja realmente excluir esta ficha de anamnese?')) return;
    const key = String(pacienteId);
    const existing = anamneses[key]?.[tipoFicha];
    if (existing?.id) {
      const { error } = await deleteAnamnese(existing.id);
      if (error) {
        alert('Erro ao excluir ficha: ' + (error.message || error));
        return;
      }
    }
    setAnamneses(prev => {
      const updated = { ...prev };
      if (updated[key]) {
        const clientFichas = { ...updated[key] };
        delete clientFichas[tipoFicha];
        if (Object.keys(clientFichas).length === 0) {
          delete updated[key];
        } else {
          updated[key] = clientFichas;
        }
      }
      return updated;
    });
  };

  const openForm = (p, editing = false, tipoFicha = '') => {
    setSelectedPaciente(p);
    setIsEditing(editing);
    setInitialTipoFicha(tipoFicha);
    setView('form');
  };

  const openView = (p, tipoFicha) => {
    setSelectedPaciente(p);
    setInitialTipoFicha(tipoFicha);
    setView('view');
  };

  const total = pacientes.length;
  const comFicha = Object.keys(anamneses).length;
  const semFicha = total - comFicha;

  if (view === 'form' && selectedPaciente) {
    const key = String(selectedPaciente.id);
    const ficha = anamneses[key]?.[initialTipoFicha];
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 40px)', gap: 0 }}>
        <AnamneseForm
          paciente={selectedPaciente}
          initial={isEditing ? ficha : { ...emptyForm(), tipoFicha: initialTipoFicha }}
          onSave={handleSave}
          onCancel={() => setView('list')}
        />
      </div>
    );
  }

  if (view === 'view' && selectedPaciente) {
    const key = String(selectedPaciente.id);
    const ficha = anamneses[key]?.[initialTipoFicha];
    if (!ficha) { setView('list'); return null; }
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 40px)', gap: 0 }}>
        <ViewFicha
          paciente={selectedPaciente}
          ficha={ficha}
          onEdit={() => openForm(selectedPaciente, true, initialTipoFicha)}
          onClose={() => setView('list')}
        />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 40px)' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 38, height: 38, borderRadius: 12, background: 'linear-gradient(135deg,#C73B6D,#9B2C50)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ClipboardList style={{ width: 18, height: 18, color: '#fff' }} />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: '#C73B6D', textTransform: 'uppercase' }}>Fichas</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#1F2937' }}>Anamnese</div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        {[
          { label: 'Total de pacientes', value: total, color: '#C73B6D', bg: '#FDF4F7' },
          { label: 'Com ficha preenchida', value: comFicha, color: '#059669', bg: '#ECFDF5' },
          { label: 'Sem ficha', value: semFicha, color: '#D97706', bg: '#FFFBEB' },
        ].map(({ label, value, color, bg }) => (
          <div key={label} style={{ flex: 1, background: '#fff', borderRadius: 14, padding: '12px 16px', border: '1px solid #F0EBE6', display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 16, fontWeight: 800, color }}>{value}</span>
            </div>
            <span style={{ fontSize: 12, color: '#6B7280', fontWeight: 600 }}>{label}</span>
          </div>
        ))}
      </div>

      {/* Search */}
      <div style={{ background: '#fff', borderRadius: 14, padding: '10px 14px', border: '1px solid #F0EBE6', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
        <Search style={{ width: 15, height: 15, color: '#9CA3AF', flexShrink: 0 }} />
        <input
          placeholder="Buscar paciente pelo nome ou telefone..."
          value={busca}
          onChange={e => setBusca(e.target.value)}
          style={{ border: 'none', outline: 'none', flex: 1, fontSize: 13, color: '#1F2937', background: 'transparent' }}
        />
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#9CA3AF', fontSize: 14 }}>
            <Loader2 style={{ width: 24, height: 24, animation: 'spin 1s linear infinite', margin: '0 auto 8px' }} />
            Carregando pacientes...
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#9CA3AF', fontSize: 14 }}>
            Nenhum paciente encontrado.
          </div>
        ) : filtered.map(p => {
          const key = String(p.id);
          const fichas = anamneses[key] || {};
          const tiposPossiveis = ['Ficha Facial', 'Ficha Corporal', 'Ficha Capilar', 'Outros'];
          const tiposPreenchidos = Object.keys(fichas);
          const tiposFaltantes = tiposPossiveis.filter(t => !tiposPreenchidos.includes(t));
          const temAlgumaFicha = tiposPreenchidos.length > 0;
          
          return (
            <div key={p.id} style={{
              display: 'flex', alignItems: 'flex-start', gap: 12,
              background: '#fff', borderRadius: 14, padding: '12px 16px',
              border: '1px solid #F0EBE6', boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
            }}>
              {/* Avatar */}
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: temAlgumaFicha ? '#ECFDF5' : '#FDF4F7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, color: temAlgumaFicha ? '#059669' : '#C73B6D', flexShrink: 0 }}>
                {p.avatar}
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#1F2937', marginBottom: 2 }}>{p.nome}</div>
                <div style={{ fontSize: 12, color: '#9CA3AF' }}>{p.telefone || '—'}</div>
                
                {/* Fichas preenchidas */}
                {tiposPreenchidos.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
                    {tiposPreenchidos.map(tipo => (
                      <div key={tipo} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 12, background: '#ECFDF5', border: '1px solid #A7F3D0' }}>
                        <CheckCircle style={{ width: 9, height: 9, color: '#059669' }} />
                        <span style={{ fontSize: 10, fontWeight: 600, color: '#059669' }}>{tipo}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end', flexShrink: 0 }}>
                {/* Ações por ficha */}
                {tiposPreenchidos.map(tipo => (
                  <div key={tipo} style={{ display: 'flex', gap: 4 }}>
                    <button onClick={() => openView(p, tipo)} title={`Visualizar ${tipo}`} style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid #E5E7EB', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Eye style={{ width: 12, height: 12, color: '#6B7280' }} />
                    </button>
                    <button onClick={() => openForm(p, true, tipo)} title={`Editar ${tipo}`} style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid #E5E7EB', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Edit3 style={{ width: 12, height: 12, color: '#6B7280' }} />
                    </button>
                    <button onClick={() => handleDelete(p.id, tipo)} title={`Excluir ${tipo}`} style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid #FCA5A5', background: '#FFF5F5', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Trash2 style={{ width: 12, height: 12, color: '#EF4444' }} />
                    </button>
                  </div>
                ))}
                
                {/* Botão adicionar outras fichas */}
                {tiposFaltantes.length > 0 && (
                  <button
                    onClick={() => setShowTypeModal(p)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      padding: '6px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600,
                      background: 'linear-gradient(135deg,#C73B6D,#9B2C50)',
                      color: '#fff',
                      boxShadow: '0 2px 6px rgba(199,59,109,0.25)',
                    }}>
                    <Plus style={{ width: 11, height: 11 }} />Adicionar fichas
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Type Selection Modal */}
      {showTypeModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 400, padding: 24, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#1F2937', marginBottom: 16 }}>Selecione o tipo de Ficha</div>
            <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 20 }}>Escolha o objetivo principal da ficha de anamnese para este paciente.</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {(() => {
                const key = String(showTypeModal.id);
                const fichas = anamneses[key] || {};
                const tiposPossiveis = ['Ficha Facial', 'Ficha Corporal', 'Ficha Capilar', 'Outros'];
                const tiposPreenchidos = Object.keys(fichas);
                const tiposDisponiveis = tiposPossiveis.filter(t => !tiposPreenchidos.includes(t));
                
                return tiposDisponiveis.map(tipo => (
                  <button
                    key={tipo}
                    onClick={() => {
                      openForm(showTypeModal, false, tipo);
                      setShowTypeModal(null);
                    }}
                    style={{ padding: '14px 16px', borderRadius: 12, border: '1px solid #E5E7EB', background: '#FAFAFA', fontSize: 14, fontWeight: 600, color: '#374151', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between', transition: 'all 0.2s' }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = '#C73B6D'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = '#E5E7EB'}
                  >
                    {tipo}
                    <ChevronRight style={{ width: 16, height: 16, color: '#9CA3AF' }} />
                  </button>
                ));
              })()}
            </div>

            <button onClick={() => setShowTypeModal(null)} style={{ marginTop: 20, width: '100%', padding: '12px', borderRadius: 12, border: 'none', background: '#F3F4F6', color: '#4B5563', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
