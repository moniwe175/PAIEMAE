import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  User, Heart, Leaf, Target, CheckCircle, Circle,
  AlertTriangle, ArrowLeft, ArrowRight, PenLine, RotateCcw,
  Save, X, Tablet, Check, Loader2, FileText, Sparkles
} from 'lucide-react';
import { fetchClients, insertClient, upsertAnamnese } from '../../services/supabaseService';
import { getCurrentUser } from '../../lib/supabase';

// ─── Initial Empty Form ──────────────────────────────────────
function getInitialFormData(paciente, tipoFicha) {
  return {
    tipoFicha: tipoFicha || 'Ficha Facial',
    paciente: paciente?.nome || paciente?.name || '',
    telefone: paciente?.telefone || paciente?.phone || '',
    // ── Dados pessoais complementares ──
    dataNascimento: paciente?.data_nascimento || '',
    cpf: paciente?.cpf || '',
    estadoCivil: '',
    profissao: '',
    endereco: '',
    cidade: '',
    email: paciente?.email || '',

    // ── Condições especiais ──
    gestante: '',
    amamentando: '',

    // ── Saúde geral (SIM/NÃO) ──
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
    usaMarcapasso: '',
    temEpilepsia: '',
    temCoagulopatia: '',
    temOncologico: '',
    fezCirurgia: '',
    qualCirurgia: '',
    outrasDoencas: '',

    // Medicamentos & Alergias
    usaMedicamentos: '',
    quaisMedicamentos: '',
    temAlergia: '',
    quaisAlergias: '',
    alergiaLatex: false,
    alergiaIodo: false,
    alergiaAnestesico: false,
    alergiaQuelante: false,

    // ── Pele / Características ──
    tipoPele: '',
    sensibilidadePele: '',
    oleosidadePele: '',
    problemasPele: [],
    fototipoCampo: '',
    usaProtetor: '',
    exposicaoSolar: '',
    usaAcidos: '',
    usaCosmeticos: '',
    quaisCosmeticos: '',

    // ── Histórico estético ──
    jaFezBotox: false,
    jaFezPreenchimento: false,
    jaFezPeeling: false,
    jaFezLaser: false,
    jaFezMicroagulhamento: false,
    jaFezLimpezaPele: false,
    jaFezOutro: false,
    outroHistorico: '',
    resultadoTratamentoAnterior: '',
    reacaoAnterior: '',
    detalhesReacao: '',

    // ── Hábitos clínicos ──
    emTratamentoMedico: '',
    possuiPlanoSaude: '',
    problemaSaudeAtual: '',
    usouAntibiotico7dias: '',
    usouRoacutan6meses: '',
    reacaoAlergicaAnestesia: '',
    tomouVacina6meses: '',
    historiFamiliarDoencas: '',
    qualHistoricoFamiliar: '',
    usaAnticoncepcional: '',
    qualAnticoncepcional: '',
    intestinoRegulado: '',
    usaSuplemento: '',
    quaisSuplemento: '',

    // ── Estilo de vida ──
    fuma: '',
    frequenciaFuma: '',
    bebidaAlcoolica: '',
    frequenciaBebe: '',
    atividade: '',
    frequenciaAtividade: '',
    alimentacao: '',
    ingereAgua: '',
    qualidadeSono: '',
    tomaSol: '',

    // ── Objetivos & Termos ──
    objetivosPrincipais: [],
    expectativas: '',
    comoConheceu: '',
    leuTermos: false,
    dataPreenchimento: new Date().toISOString().split('T')[0],
    preenchidoPor: 'cliente_tablet',
    observacoesProfissional: '',
  };
}

const STEPS = [
  { id: 'pessoal', label: '1. Pessoal', title: 'Dados Pessoais', icon: User },
  { id: 'saude', label: '2. Saúde', title: 'Histórico de Saúde', icon: Heart },
  { id: 'pele', label: '3. Características', title: 'Pele & Procedimentos', icon: Leaf },
  { id: 'habitos', label: '4. Hábitos', title: 'Rotina & Estilo de Vida', icon: Target },
  { id: 'termo', label: '5. Assinatura', title: 'Termo de Consentimento', icon: CheckCircle },
];

export default function TabletAnamneseModal({ paciente, tipoFicha, apt, onClose, onSuccess }) {
  const [form, setForm] = useState(() => getInitialFormData(paciente, tipoFicha));
  const [stepIndex, setStepIndex] = useState(0);
  const [signatureData, setSignatureData] = useState(null);
  const [termoScrolled, setTermoScrolled] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const canvasRef = useRef(null);
  const lastPos = useRef({ x: 0, y: 0 });
  const termoContainerRef = useRef(null);

  const pacienteNome = form.paciente || paciente?.nome || paciente?.name || 'Cliente';
  const currentStep = STEPS[stepIndex];

  const set = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const toggleArrayItem = (field, item) => {
    setForm(prev => {
      const arr = prev[field] || [];
      return {
        ...prev,
        [field]: arr.includes(item) ? arr.filter(x => x !== item) : [...arr, item]
      };
    });
  };

  // Canvas drawing handlers (optimized for touch / stylus / mouse)
  const getCanvasPos = (e, canvas) => {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches && e.touches.length > 0 ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches && e.touches.length > 0 ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left) * (canvas.width / rect.width),
      y: (clientY - rect.top) * (canvas.height / rect.height)
    };
  };

  const startDraw = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setIsDrawing(true);
    const pos = getCanvasPos(e, canvas);
    lastPos.current = pos;
    const ctx = canvas.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  }, []);

  const draw = useCallback((e) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const pos = getCanvasPos(e, canvas);
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#1E1B4B';
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    lastPos.current = pos;
    setSignatureData(canvas.toDataURL('image/png'));
  }, [isDrawing]);

  const stopDraw = useCallback(() => {
    setIsDrawing(false);
  }, []);

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setSignatureData(null);
  };

  const handleScrollTermo = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    if (Math.abs(scrollHeight - scrollTop - clientHeight) < 40) {
      setTermoScrolled(true);
    }
  };

  // Submit and Save Ficha
  const handleSave = async () => {
    if (isSaving) return;
    setErrorMessage('');

    if (!signatureData) {
      setErrorMessage('Por favor, faça a assinatura digital no quadro abaixo antes de confirmar.');
      return;
    }

    setIsSaving(true);
    try {
      // 1. Ensure user authentication
      const user = await getCurrentUser();
      const userId = user?.id || null;

      // 2. Ensure client exists in clients table
      let resolvedClientId = paciente?.id || apt?.client_id || null;
      if (!resolvedClientId) {
        const { data: allClients } = await fetchClients();
        const found = (allClients || []).find(c =>
          (c.name && c.name.trim().toLowerCase() === pacienteNome.trim().toLowerCase()) ||
          (c.nome && c.nome.trim().toLowerCase() === pacienteNome.trim().toLowerCase())
        );
        if (found) {
          resolvedClientId = found.id;
        } else {
          const { data: newClient } = await insertClient({
            name: pacienteNome.trim(),
            phone: form.telefone || '',
            email: form.email || '',
          });
          if (newClient) {
            resolvedClientId = newClient.id;
          }
        }
      }

      // 3. Prepare Anamnese payload
      const { ...formData } = form;
      formData.paciente = pacienteNome;
      formData.tipoFicha = tipoFicha || form.tipoFicha || 'Ficha Facial';
      formData.signatureDataUrl = signatureData;
      formData.leuTermos = true;

      const anamnesePayload = {
        client_id: resolvedClientId || null,
        data_preenchimento: new Date().toISOString().split('T')[0],
        preenchido_por: 'cliente_tablet',
        observacoes_profissional: form.observacoesProfissional || '',
        leu_termos: true,
        form_data: formData,
        user_id: userId,
      };

      const { data: savedData, error: saveError } = await upsertAnamnese(anamnesePayload);
      if (saveError) {
        throw new Error(saveError.message || 'Erro ao salvar ficha no banco de dados');
      }

      if (onSuccess) {
        await onSuccess({
          anamnese: savedData || anamnesePayload,
          clientId: resolvedClientId,
          pacienteNome,
          tipoFicha: formData.tipoFicha,
          apt,
        });
      }
    } catch (err) {
      console.error('[TabletAnamneseModal] Erro ao salvar ficha:', err);
      setErrorMessage(err.message || 'Ocorreu um erro ao salvar. Tente novamente.');
      setIsSaving(false);
    }
  };

  // Tablet UI Helper Components
  const LargeRadioPill = ({ label, field, options, dangerOnSim = false }) => (
    <div style={{
      background: '#FFFFFF',
      borderRadius: 16,
      padding: '16px 18px',
      border: '1.5px solid #F1F5F9',
      boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
      marginBottom: 12,
    }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: '#1E293B', marginBottom: 12 }}>
        {label}
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {options.map(opt => {
          const isSelected = form[field] === opt;
          const isSim = opt === 'Sim' || opt === 'Muita' || opt === 'Alta' || opt === 'Sensível';
          const bgActive = dangerOnSim && isSim
            ? 'linear-gradient(135deg, #EF4444, #DC2626)'
            : 'linear-gradient(135deg, #C73B6D, #A83158)';
          return (
            <button
              key={opt}
              type="button"
              onClick={() => set(field, opt)}
              style={{
                flex: 1,
                minWidth: 100,
                minHeight: 48,
                padding: '12px 18px',
                borderRadius: 14,
                fontSize: 14,
                fontWeight: 700,
                cursor: 'pointer',
                border: isSelected ? 'none' : '1.5px solid #E2E8F0',
                background: isSelected ? bgActive : '#F8FAFC',
                color: isSelected ? '#FFFFFF' : '#475569',
                boxShadow: isSelected ? '0 4px 14px rgba(199,59,109,0.3)' : 'none',
                transition: 'all 0.15s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              {isSelected && <Check style={{ width: 16, height: 16 }} />}
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );

  const LargeTouchCheckbox = ({ label, checked, onChange }) => (
    <div
      onClick={() => onChange(!checked)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '14px 16px',
        borderRadius: 14,
        background: checked ? '#FDF2F8' : '#FFFFFF',
        border: `2px solid ${checked ? '#C73B6D' : '#E2E8F0'}`,
        cursor: 'pointer',
        userSelect: 'none',
        transition: 'all 0.15s ease',
        boxShadow: checked ? '0 4px 12px rgba(199,59,109,0.15)' : 'none',
      }}
    >
      <div style={{
        width: 24,
        height: 24,
        borderRadius: 7,
        background: checked ? '#C73B6D' : '#F1F5F9',
        border: `1.5px solid ${checked ? '#C73B6D' : '#CBD5E1'}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}>
        {checked && <Check style={{ width: 15, height: 15, color: '#fff', strokeWidth: 3 }} />}
      </div>
      <span style={{ fontSize: 13.5, fontWeight: checked ? 700 : 600, color: checked ? '#9D174D' : '#334155' }}>
        {label}
      </span>
    </div>
  );

  const LargeInput = ({ label, field, type = 'text', placeholder = '', multiline = false }) => (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#475569', marginBottom: 6 }}>
        {label}
      </label>
      {multiline ? (
        <textarea
          value={form[field] || ''}
          onChange={e => set(field, e.target.value)}
          placeholder={placeholder}
          style={{
            width: '100%',
            minHeight: 90,
            padding: '14px 16px',
            borderRadius: 14,
            border: '2px solid #E2E8F0',
            fontSize: 15,
            color: '#1E293B',
            background: '#FAFAFA',
            outline: 'none',
            boxSizing: 'border-box',
            fontFamily: 'inherit',
          }}
        />
      ) : (
        <input
          type={type}
          value={form[field] || ''}
          onChange={e => set(field, e.target.value)}
          placeholder={placeholder}
          style={{
            width: '100%',
            height: 52,
            padding: '0 16px',
            borderRadius: 14,
            border: '2px solid #E2E8F0',
            fontSize: 15,
            color: '#1E293B',
            background: '#FAFAFA',
            outline: 'none',
            boxSizing: 'border-box',
            fontFamily: 'inherit',
          }}
        />
      )}
    </div>
  );

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 13000,
      background: 'linear-gradient(135deg, #0F172A, #1E293B)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* ─── Tablet Topbar ─── */}
      <div style={{
        background: '#FFFFFF',
        padding: '16px 28px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid #E2E8F0',
        boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 44,
            height: 44,
            borderRadius: 14,
            background: 'linear-gradient(135deg,#C73B6D,#9B2C50)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            boxShadow: '0 4px 12px rgba(199,59,109,0.3)',
          }}>
            <Tablet style={{ width: 22, height: 22 }} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 18, fontWeight: 800, color: '#0F172A' }}>
                {pacienteNome}
              </span>
              <span style={{
                background: '#FDF2F8',
                color: '#C73B6D',
                border: '1px solid #FBCFE8',
                padding: '3px 10px',
                borderRadius: 20,
                fontSize: 12,
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}>
                {tipoFicha || form.tipoFicha || 'Ficha Facial'}
              </span>
            </div>
            <div style={{ fontSize: 12.5, color: '#64748B', fontWeight: 500 }}>
              Modo Recepção / Tablet — Preenchimento com assinatura do cliente
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: '#F1F5F9',
            border: 'none',
            padding: '10px 18px',
            borderRadius: 12,
            fontSize: 13,
            fontWeight: 700,
            color: '#475569',
            cursor: 'pointer',
          }}
        >
          <X style={{ width: 16, height: 16 }} /> Fechar
        </button>
      </div>

      {/* ─── Steps Tab Bar ─── */}
      <div style={{
        background: '#F8FAFC',
        padding: '12px 28px',
        display: 'flex',
        gap: 10,
        overflowX: 'auto',
        borderBottom: '1px solid #E2E8F0',
        flexShrink: 0,
      }}>
        {STEPS.map((s, idx) => {
          const Icon = s.icon;
          const isCurrent = stepIndex === idx;
          const isDone = stepIndex > idx;
          return (
            <button
              key={s.id}
              onClick={() => setStepIndex(idx)}
              style={{
                flex: 1,
                minWidth: 140,
                padding: '10px 14px',
                borderRadius: 12,
                border: `2px solid ${isCurrent ? '#C73B6D' : isDone ? '#CBD5E1' : '#E2E8F0'}`,
                background: isCurrent ? '#FFFFFF' : isDone ? '#F1F5F9' : '#FFFFFF',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                transition: 'all 0.15s',
                boxShadow: isCurrent ? '0 4px 12px rgba(199,59,109,0.15)' : 'none',
              }}
            >
              <div style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                background: isCurrent ? '#C73B6D' : isDone ? '#10B981' : '#E2E8F0',
                color: isCurrent || isDone ? '#fff' : '#64748B',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 12,
                fontWeight: 700,
                flexShrink: 0,
              }}>
                {isDone ? <Check style={{ width: 14, height: 14, strokeWidth: 3 }} /> : <Icon style={{ width: 14, height: 14 }} />}
              </div>
              <div style={{ textAlign: 'left', overflow: 'hidden' }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: isCurrent ? '#C73B6D' : '#334155', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                  {s.label}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* ─── Scrollable Step Content ─── */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '24px 28px',
        background: '#F1F5F9',
        display: 'flex',
        justifyContent: 'center',
      }}>
        <div style={{
          width: '100%',
          maxWidth: 820,
          background: '#FFFFFF',
          borderRadius: 24,
          padding: '32px 36px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.06)',
          border: '1px solid #E2E8F0',
        }}>
          {/* Section Header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            paddingBottom: 18,
            marginBottom: 24,
            borderBottom: '2px solid #F1F5F9',
          }}>
            <div style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              background: '#FDF2F8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#C73B6D',
            }}>
              {React.createElement(currentStep.icon, { style: { width: 22, height: 22 } })}
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#0F172A' }}>
                {currentStep.title}
              </div>
              <div style={{ fontSize: 13, color: '#64748B' }}>
                Etapa {stepIndex + 1} de {STEPS.length}
              </div>
            </div>
          </div>

          {/* ── STEP 0: DADOS PESSOAIS ── */}
          {stepIndex === 0 && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <LargeInput label="Nome Completo *" field="paciente" placeholder="Nome do cliente" />
                <LargeInput label="Telefone / WhatsApp *" field="telefone" placeholder="(11) 99999-9999" />
                <LargeInput label="Data de Nascimento" field="dataNascimento" type="date" />
                <LargeInput label="CPF" field="cpf" placeholder="000.000.000-00" />
                <LargeInput label="E-mail" field="email" type="email" placeholder="cliente@email.com" />
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#475569', marginBottom: 6 }}>
                    Estado Civil
                  </label>
                  <select
                    value={form.estadoCivil}
                    onChange={e => set('estadoCivil', e.target.value)}
                    style={{
                      width: '100%',
                      height: 52,
                      padding: '0 16px',
                      borderRadius: 14,
                      border: '2px solid #E2E8F0',
                      fontSize: 15,
                      color: '#1E293B',
                      background: '#FAFAFA',
                      outline: 'none',
                    }}
                  >
                    <option value="">Selecione...</option>
                    {['Solteira(o)', 'Casada(o)', 'Divorciada(o)', 'Viúva(o)', 'União Estável', 'Outro'].map(o => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </select>
                </div>
              </div>

              <LargeInput label="Profissão" field="profissao" placeholder="Ex: Advogada, Arquiteta, etc." />
              <LargeInput label="Endereço Completo" field="endereco" placeholder="Rua, número, bairro, cidade" />

              <div style={{ marginTop: 20 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#D97706', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <AlertTriangle style={{ width: 18, height: 18 }} /> Condições Especiais
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <LargeRadioPill label="Está gestante?" field="gestante" options={['Sim', 'Não', 'Não sei']} dangerOnSim />
                  <LargeRadioPill label="Está amamentando?" field="amamentando" options={['Sim', 'Não']} dangerOnSim />
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 1: HISTÓRICO DE SAÚDE ── */}
          {stepIndex === 1 && (
            <div>
              <div style={{ background: '#FEF3C7', borderRadius: 14, padding: '12px 16px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10, color: '#92400E', fontSize: 13, fontWeight: 600 }}>
                <AlertTriangle style={{ width: 20, height: 20, flexShrink: 0 }} />
                <span>Assinale SIM ou NÃO com atenção. Estas informações são fundamentais para sua segurança no procedimento.</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
                <div>
                  <LargeRadioPill label="Sensibilidade nos olhos?" field="sensibilidadeOlhos" options={['Sim', 'Não']} />
                  <LargeRadioPill label="Possui problemas cardíacos?" field="problemasCardiacos" options={['Sim', 'Não']} dangerOnSim />
                  <LargeRadioPill label="Alterações de pressão?" field="alteracoesPressao" options={['Sim', 'Não']} dangerOnSim />
                  <LargeRadioPill label="Diabetes?" field="diabetes" options={['Sim', 'Não']} dangerOnSim />
                  <LargeRadioPill label="Doença autoimune?" field="doencaAutoimune" options={['Sim', 'Não']} dangerOnSim />
                  <LargeRadioPill label="Problemas de tireoide?" field="problemaTireoide" options={['Sim', 'Não']} />
                  <LargeRadioPill label="Tendência a queloide?" field="quelioide" options={['Sim', 'Não']} dangerOnSim />
                  <LargeRadioPill label="Possui marcapasso?" field="usaMarcapasso" options={['Sim', 'Não']} dangerOnSim />
                </div>
                <div>
                  <LargeRadioPill label="Possui alergias conhecidas?" field="temAlergia" options={['Sim', 'Não']} dangerOnSim />
                  <LargeRadioPill label="Alergia a picada de abelha?" field="alergiaPicadaAbelha" options={['Sim', 'Não']} dangerOnSim />
                  <LargeRadioPill label="Usa medicamentos regulares?" field="usaMedicamentos" options={['Sim', 'Não']} />
                  <LargeRadioPill label="Fios de Ouro ou PMMA no corpo?" field="fiosDeOuroOuPMMA" options={['Sim', 'Não']} dangerOnSim />
                  <LargeRadioPill label="Possui prótese metálica?" field="proteseMetalica" options={['Sim', 'Não']} />
                  <LargeRadioPill label="Já fez cirurgia?" field="fezCirurgia" options={['Sim', 'Não']} />
                  <LargeRadioPill label="Histórico oncológico?" field="temOncologico" options={['Sim', 'Não', 'Em tratamento']} dangerOnSim />
                  <LargeRadioPill label="Procedimentos definitivos prévios?" field="procedimentosDefinitivos" options={['Sim', 'Não']} />
                </div>
              </div>

              {form.temAlergia === 'Sim' && (
                <div style={{ marginTop: 14 }}>
                  <LargeInput label="Quais alergias conhecidas?" field="quaisAlergias" placeholder="Ex: dipirona, iodo, esparadrapo..." multiline />
                </div>
              )}

              {form.usaMedicamentos === 'Sim' && (
                <div style={{ marginTop: 14 }}>
                  <LargeInput label="Quais medicamentos em uso?" field="quaisMedicamentos" placeholder="Ex: anticoagulantes, anti-hipertensivos, etc." multiline />
                </div>
              )}

              {form.fezCirurgia === 'Sim' && (
                <div style={{ marginTop: 14 }}>
                  <LargeInput label="Qual cirurgia e quando foi realizada?" field="qualCirurgia" placeholder="Descreva as cirurgias realizadas..." />
                </div>
              )}

              <div style={{ marginTop: 18 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#475569', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Alergias específicas importantes
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <LargeTouchCheckbox label="Alergia a Látex" checked={!!form.alergiaLatex} onChange={v => set('alergiaLatex', v)} />
                  <LargeTouchCheckbox label="Alergia a Iodo" checked={!!form.alergiaIodo} onChange={v => set('alergiaIodo', v)} />
                  <LargeTouchCheckbox label="Alergia a Anestésico local" checked={!!form.alergiaAnestesico} onChange={v => set('alergiaAnestesico', v)} />
                  <LargeTouchCheckbox label="Alergia a Quelantes" checked={!!form.alergiaQuelante} onChange={v => set('alergiaQuelante', v)} />
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 2: PELE & CARACTERÍSTICAS ── */}
          {stepIndex === 2 && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
                <LargeRadioPill label="Tipo de Pele" field="tipoPele" options={['Normal', 'Seca', 'Mista', 'Oleosa']} />
                <LargeRadioPill label="Sensibilidade da Pele" field="sensibilidadePele" options={['Normal', 'Pouco sensível', 'Sensível']} />
                <LargeRadioPill label="Oleosidade" field="oleosidadePele" options={['Baixa', 'Moderada', 'Alta']} />
                <LargeRadioPill label="Usa protetor solar?" field="usaProtetor" options={['Sempre', 'Às vezes', 'Raramente', 'Nunca']} />
                <LargeRadioPill label="Exposição Solar" field="exposicaoSolar" options={['Pouca', 'Moderada', 'Muita']} />
                <LargeRadioPill label="Usa ou já usou ácidos na pele?" field="usaAcidos" options={['Sim', 'Não']} />
              </div>

              {/* Fototipo */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#475569', marginBottom: 6 }}>
                  Fototipo de Pele (Fitzpatrick)
                </label>
                <select
                  value={form.fototipoCampo}
                  onChange={e => set('fototipoCampo', e.target.value)}
                  style={{
                    width: '100%',
                    height: 52,
                    padding: '0 16px',
                    borderRadius: 14,
                    border: '2px solid #E2E8F0',
                    fontSize: 15,
                    color: '#1E293B',
                    background: '#FAFAFA',
                    outline: 'none',
                  }}
                >
                  <option value="">Selecione o tom de pele...</option>
                  <option value="I">I — Pele muito clara (sempre queima, nunca bronzeia)</option>
                  <option value="II">II — Pele clara (queima com facilidade, bronzeia pouco)</option>
                  <option value="III">III — Pele média (queima moderadamente, bronzeia gradualmente)</option>
                  <option value="IV">IV — Pele morena moderada (queima pouco, bronzeia com facilidade)</option>
                  <option value="V">V — Pele morena escura (raramente queima, bronzeia muito)</option>
                  <option value="VI">VI — Pele negra (nunca queima)</option>
                </select>
              </div>

              {/* Histórico de Procedimentos */}
              <div style={{ marginTop: 22 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#1E293B', marginBottom: 12 }}>
                  Procedimentos Estéticos Anteriores (marque os já realizados):
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                  <LargeTouchCheckbox label="Botox / Toxina Botulínica" checked={!!form.jaFezBotox} onChange={v => set('jaFezBotox', v)} />
                  <LargeTouchCheckbox label="Preenchimento Facial" checked={!!form.jaFezPreenchimento} onChange={v => set('jaFezPreenchimento', v)} />
                  <LargeTouchCheckbox label="Peeling Químico" checked={!!form.jaFezPeeling} onChange={v => set('jaFezPeeling', v)} />
                  <LargeTouchCheckbox label="Laser / Luz Pulsada" checked={!!form.jaFezLaser} onChange={v => set('jaFezLaser', v)} />
                  <LargeTouchCheckbox label="Microagulhamento" checked={!!form.jaFezMicroagulhamento} onChange={v => set('jaFezMicroagulhamento', v)} />
                  <LargeTouchCheckbox label="Limpeza de Pele Profunda" checked={!!form.jaFezLimpezaPele} onChange={v => set('jaFezLimpezaPele', v)} />
                </div>
              </div>

              <LargeRadioPill
                label="Já teve alguma reação adversa a procedimento estético anterior?"
                field="reacaoAnterior"
                options={['Sim', 'Não']}
                dangerOnSim
              />

              {form.reacaoAnterior === 'Sim' && (
                <LargeInput
                  label="Descreva qual foi a reação adversa:"
                  field="detalhesReacao"
                  placeholder="Ex: inchaço excessivo, alergia, manchas..."
                  multiline
                />
              )}
            </div>
          )}

          {/* ── STEP 3: HÁBITOS & ROTINA ── */}
          {stepIndex === 3 && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <LargeRadioPill label="Usou antibiótico nos últimos 7 dias?" field="usouAntibiotico7dias" options={['Sim', 'Não']} dangerOnSim />
                <LargeRadioPill label="Usou Roacutan nos últimos 6 meses?" field="usouRoacutan6meses" options={['Sim', 'Não']} dangerOnSim />
                <LargeRadioPill label="Reação alérgica a anestesia?" field="reacaoAlergicaAnestesia" options={['Sim', 'Não']} dangerOnSim />
                <LargeRadioPill label="Tomou vacina há menos de 6 meses?" field="tomouVacina6meses" options={['Sim', 'Não']} />
                <LargeRadioPill label="Fuma tabaco ou eletrônico?" field="fuma" options={['Sim', 'Não']} />
                <LargeRadioPill label="Consome bebida alcoólica?" field="bebidaAlcoolica" options={['Sim', 'Não']} />
                <LargeRadioPill label="Pratica atividade física?" field="atividade" options={['Sim', 'Não']} />
                <LargeRadioPill label="Ingere água frequentemente?" field="ingereAgua" options={['Mais de 2L/dia', '1 a 2L/dia', 'Menos de 1L/dia']} />
              </div>

              <div style={{ marginTop: 14 }}>
                <LargeInput
                  label="Quais suas expectativas principais com o atendimento de hoje?"
                  field="expectativas"
                  placeholder="Ex: melhorar linhas de expressão, hidratação, contorno facial, etc."
                  multiline
                />
              </div>
            </div>
          )}

          {/* ── STEP 4: TERMO & ASSINATURA DIGITAL ── */}
          {stepIndex === 4 && (
            <div>
              <div style={{
                background: '#F8FAFC',
                border: '2px solid #E2E8F0',
                borderRadius: 18,
                padding: '20px 24px',
                maxHeight: 220,
                overflowY: 'auto',
                fontSize: 13,
                color: '#334155',
                lineHeight: 1.7,
                marginBottom: 20,
              }}
                ref={termoContainerRef}
                onScroll={handleScrollTermo}
              >
                <div style={{ fontWeight: 800, color: '#0F172A', marginBottom: 8, fontSize: 14 }}>
                  TERMO DE CONSENTIMENTO LIVRE E ESCLARECIDO
                </div>
                <p style={{ marginBottom: 8 }}>
                  Eu, <strong>{pacienteNome}</strong>, declaro ter sido devidamente orientada(o) quanto à natureza, indicações, benefícios e possíveis contraindicações do procedimento a ser realizado.
                </p>
                <p style={{ marginBottom: 8 }}>
                  1. Atesto que todas as informações declaradas nesta ficha são verdadeiras, não tendo omitido qualquer dado referente à minha saúde, uso de medicamentos ou alergias.
                </p>
                <p style={{ marginBottom: 8 }}>
                  2. Comprometo-me a seguir todas as orientações pré e pós-procedimento repassadas pela equipe profissional.
                </p>
                <p style={{ marginBottom: 8 }}>
                  3. Autorizo a realização do procedimento estético e estou ciente de que cada organismo possui tempo de cicatrização e resposta biológica individual.
                </p>
                <div style={{ textAlign: 'center', color: '#94A3B8', fontSize: 11, fontStyle: 'italic', marginTop: 10 }}>
                  — Fim do Termo —
                </div>
              </div>

              {/* Quadro de Assinatura */}
              <div style={{
                background: '#FFFFFF',
                borderRadius: 18,
                padding: '20px',
                border: `2px dashed ${signatureData ? '#C73B6D' : '#94A3B8'}`,
                boxShadow: '0 4px 16px rgba(0,0,0,0.04)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 800, color: '#0F172A' }}>
                    <PenLine style={{ width: 18, height: 18, color: '#C73B6D' }} />
                    Assinatura Digital no Tablet (use o dedo ou a caneta)
                  </div>
                  {signatureData && (
                    <button
                      type="button"
                      onClick={clearSignature}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        background: '#FEE2E2',
                        border: 'none',
                        color: '#DC2626',
                        padding: '6px 14px',
                        borderRadius: 10,
                        fontSize: 12.5,
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      <RotateCcw style={{ width: 14, height: 14 }} /> Limpar Assinatura
                    </button>
                  )}
                </div>

                <canvas
                  ref={canvasRef}
                  width={750}
                  height={180}
                  onMouseDown={startDraw}
                  onMouseMove={draw}
                  onMouseUp={stopDraw}
                  onMouseLeave={stopDraw}
                  onTouchStart={startDraw}
                  onTouchMove={draw}
                  onTouchEnd={stopDraw}
                  style={{
                    width: '100%',
                    height: 180,
                    borderRadius: 12,
                    background: '#F8FAFC',
                    cursor: 'crosshair',
                    touchAction: 'none',
                    display: 'block',
                    border: '1px solid #E2E8F0',
                  }}
                />

                {!signatureData ? (
                  <div style={{ textAlign: 'center', fontSize: 12, color: '#64748B', marginTop: 10 }}>
                    ✍️ Por favor, assine dentro do quadro acima para validar o preenchimento.
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#16A34A', fontSize: 13, fontWeight: 700, marginTop: 10 }}>
                    <CheckCircle style={{ width: 16, height: 16 }} /> Assinatura digital registrada com sucesso!
                  </div>
                )}
              </div>

              {errorMessage && (
                <div style={{
                  marginTop: 16,
                  padding: '12px 16px',
                  borderRadius: 12,
                  background: '#FEF2F2',
                  border: '1.5px solid #FCA5A5',
                  color: '#B91C1C',
                  fontSize: 13.5,
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                }}>
                  <AlertTriangle style={{ width: 18, height: 18, flexShrink: 0 }} />
                  <span>{errorMessage}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ─── Bottom Navigation Bar ─── */}
      <div style={{
        background: '#FFFFFF',
        padding: '16px 28px',
        borderTop: '1px solid #E2E8F0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
        boxShadow: '0 -4px 20px rgba(0,0,0,0.05)',
      }}>
        <button
          type="button"
          onClick={() => setStepIndex(prev => Math.max(0, prev - 1))}
          disabled={stepIndex === 0 || isSaving}
          style={{
            padding: '12px 24px',
            borderRadius: 14,
            border: '2px solid #E2E8F0',
            background: '#FFFFFF',
            fontSize: 14,
            fontWeight: 700,
            color: stepIndex === 0 ? '#CBD5E1' : '#475569',
            cursor: stepIndex === 0 ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <ArrowLeft style={{ width: 16, height: 16 }} /> Voltar Etapa
        </button>

        <div style={{ fontSize: 13, fontWeight: 700, color: '#64748B' }}>
          Passo {stepIndex + 1} de {STEPS.length}
        </div>

        {stepIndex < STEPS.length - 1 ? (
          <button
            type="button"
            onClick={() => setStepIndex(prev => Math.min(STEPS.length - 1, prev + 1))}
            style={{
              padding: '12px 28px',
              borderRadius: 14,
              border: 'none',
              background: 'linear-gradient(135deg,#C73B6D,#9B2C50)',
              color: '#FFFFFF',
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              boxShadow: '0 4px 14px rgba(199,59,109,0.3)',
            }}
          >
            Próxima Etapa <ArrowRight style={{ width: 16, height: 16 }} />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || !signatureData}
            style={{
              padding: '14px 32px',
              borderRadius: 14,
              border: 'none',
              background: !signatureData || isSaving ? '#CBD5E1' : 'linear-gradient(135deg,#10B981,#059669)',
              color: '#FFFFFF',
              fontSize: 15,
              fontWeight: 800,
              cursor: !signatureData || isSaving ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              boxShadow: signatureData && !isSaving ? '0 6px 20px rgba(16,185,129,0.35)' : 'none',
              transition: 'all 0.2s ease',
            }}
          >
            {isSaving ? (
              <>
                <Loader2 style={{ width: 18, height: 18, animation: 'spin 1s linear infinite' }} />
                Salvando e Liberando Atendimento...
              </>
            ) : (
              <>
                <CheckCircle style={{ width: 18, height: 18 }} />
                Concluir Ficha & Iniciar Atendimento
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
