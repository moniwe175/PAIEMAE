import { useState, useMemo } from 'react';
import {
  ClipboardList, Search, Plus, X, ChevronRight, ChevronLeft, User,
  Heart, AlertTriangle, Leaf, Target, Printer, Save, CheckCircle,
  Circle, ArrowLeft, Eye, Edit3, Trash2, Calendar
} from 'lucide-react';

// ─── Storage ──────────────────────────────────────────────────────────────────
const ANAMNESE_KEY = 'erp_anamnese_v1';
const PACIENTES_KEY = 'erp_pacientes';

function loadAnamneses() {
  try { const r = localStorage.getItem(ANAMNESE_KEY); if (r) return JSON.parse(r); } catch {}
  return {};
}
function saveAnamneses(data) { localStorage.setItem(ANAMNESE_KEY, JSON.stringify(data)); }

function loadPacientes() {
  try { const r = localStorage.getItem(PACIENTES_KEY); if (r) { const p = JSON.parse(r); if (Array.isArray(p)) return p; } } catch {}
  return [
    { id: 1, nome: 'Ana Beatriz Souza', telefone: '(11) 98765-4321', avatar: 'A' },
    { id: 2, nome: 'Carla Mendes Silva', telefone: '(11) 97654-3210', avatar: 'C' },
    { id: 3, nome: 'Fernanda Lima', telefone: '(11) 96543-2109', avatar: 'F' },
  ];
}

// ─── Empty form ───────────────────────────────────────────────────────────────
function emptyForm() {
  return {
    // Dados pessoais complementares
    dataNascimento: '', cpf: '', estadoCivil: '', profissao: '', endereco: '',
    // Saúde geral
    gestante: '', amamentando: '', fezCirurgia: '', qualCirurgia: '',
    usaMarcapasso: '', temDiabetes: '', temHipertensao: '', temCardiopatia: '',
    temEpilepsia: '', temCoagulopatia: '', temOncologico: '',
    outrasDoencas: '',
    // Medicamentos
    usaMedicamentos: '', quaisMedicamentos: '',
    // Alergias
    temAlergia: '', quaisAlergias: '',
    alergiaLatex: false, alergiaIodo: false, alergiaAnestesico: false, alergiaQuelante: false,
    // Pele
    tipoPele: '', sensibilidadePele: '', oleosidadePele: '',
    problemasPele: [],
    fototipoCampo: '',
    usaProtetor: '', exposicaoSolar: '',
    // Histórico estético
    jaFezBotox: false, jaFezPreenchimento: false, jaFezPeeling: false, jaFezLaser: false,
    jaFezMicroagulhamento: false, jaFezLimpezaPele: false, jaFezOutro: false, outroHistorico: '',
    reacaoAnterior: '', detalhesReacao: '',
    // Hábitos e estilo de vida
    fuma: '', frequenciaFuma: '', bebidaAlcoolica: '', frequenciaBebe: '',
    atividade: '', frequenciaAtividade: '',
    alimentacao: '', ingereAgua: '',
    qualidadeSono: '',
    // Objetivos
    objetivosPrincipais: [],
    expectativas: '',
    comoConheceu: '',
    // Termo e assinatura
    leuTermos: false,
    dataPreenchimento: new Date().toISOString().split('T')[0],
    preenchidoPor: 'cliente',
    observacoesProfissional: '',
  };
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

// ─── MAIN FORM ─────────────────────────────────────────────────────────────────
function AnamneseForm({ paciente, initial, onSave, onCancel }) {
  const [form, setForm] = useState(() => initial || emptyForm());
  const [step, setStep] = useState(0);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const toggleArr = (k, v) => setForm(f => {
    const arr = f[k] || [];
    return { ...f, [k]: arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v] };
  });

  const handleSave = () => {
    const saved = { ...form, dataPreenchimento: new Date().toISOString().split('T')[0] };
    onSave(saved);
  };

  const handlePrint = () => window.print();

  const renderStep = () => {
    switch (STEPS[step].id) {
      // ── Pessoal ───────────────────────────────────────────────────────────
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
              <Field label="Estado Civil">
                <select value={form.estadoCivil} onChange={e => set('estadoCivil', e.target.value)} style={inputSt}>
                  <option value="">Selecione...</option>
                  {['Solteira', 'Casada', 'Divorciada', 'Viúva', 'União Estável', 'Outro'].map(o => <option key={o}>{o}</option>)}
                </select>
              </Field>
              <Field label="Profissão">
                <input placeholder="Ex: Professora" value={form.profissao} onChange={e => set('profissao', e.target.value)} style={inputSt} />
              </Field>
              <Field label="Endereço Completo" span={2}>
                <input placeholder="Rua, número, bairro, cidade" value={form.endereco} onChange={e => set('endereco', e.target.value)} style={inputSt} />
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
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
              <RadioGroup label="Já fez cirurgia?" field="fezCirurgia" form={form} setForm={setForm} options={['Sim', 'Não']} />
              <RadioGroup label="Usa marcapasso?" field="usaMarcapasso" form={form} setForm={setForm} options={['Sim', 'Não']} />
              <RadioGroup label="Tem diabetes?" field="temDiabetes" form={form} setForm={setForm} options={['Sim', 'Não']} />
              <RadioGroup label="Hipertensão?" field="temHipertensao" form={form} setForm={setForm} options={['Sim', 'Não']} />
              <RadioGroup label="Cardiopatia?" field="temCardiopatia" form={form} setForm={setForm} options={['Sim', 'Não']} />
              <RadioGroup label="Epilepsia?" field="temEpilepsia" form={form} setForm={setForm} options={['Sim', 'Não']} />
              <RadioGroup label="Coagulopatia?" field="temCoagulopatia" form={form} setForm={setForm} options={['Sim', 'Não']} />
              <RadioGroup label="Histórico oncológico?" field="temOncologico" form={form} setForm={setForm} options={['Sim', 'Não', 'Em tratamento']} />
            </div>

            {form.fezCirurgia === 'Sim' && (
              <Field label="Qual cirurgia?" span={2}>
                <input placeholder="Descreva a cirurgia e quando foi realizada" value={form.qualCirurgia} onChange={e => set('qualCirurgia', e.target.value)} style={{ ...inputSt, marginBottom: 12 }} />
              </Field>
            )}

            <Field label="Outras doenças ou condições relevantes" span={2}>
              <textarea placeholder="Descreva..." value={form.outrasDoencas} onChange={e => set('outrasDoencas', e.target.value)} style={textareaSt} />
            </Field>

            <div style={{ marginTop: 16 }}>
              <SectionHeader icon={AlertTriangle} title="Medicamentos e Alergias" color="#7C3AED" bg="#F5F3FF" />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                <RadioGroup label="Usa medicamentos regularmente?" field="usaMedicamentos" form={form} setForm={setForm} options={['Sim', 'Não']} />
                <RadioGroup label="Tem alguma alergia?" field="temAlergia" form={form} setForm={setForm} options={['Sim', 'Não']} />
              </div>

              {form.usaMedicamentos === 'Sim' && (
                <Field label="Quais medicamentos?" span={2}>
                  <textarea placeholder="Liste os medicamentos em uso" value={form.quaisMedicamentos} onChange={e => set('quaisMedicamentos', e.target.value)} style={{ ...textareaSt, marginBottom: 12 }} />
                </Field>
              )}
              {form.temAlergia === 'Sim' && (
                <Field label="Quais alergias?" span={2}>
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
              <Field label="Qual procedimento?" span={2}>
                <input placeholder="Descreva o procedimento" value={form.outroHistorico} onChange={e => set('outroHistorico', e.target.value)} style={{ ...inputSt, marginBottom: 12 }} />
              </Field>
            )}
            <RadioGroup label="Teve alguma reação adversa a procedimento estético?" field="reacaoAnterior" form={form} setForm={setForm} options={['Sim', 'Não']} />
            {form.reacaoAnterior === 'Sim' && (
              <Field label="Descreva a reação" span={2}>
                <textarea placeholder="O que aconteceu?" value={form.detalhesReacao} onChange={e => set('detalhesReacao', e.target.value)} style={textareaSt} />
              </Field>
            )}
          </div>
        );

      // ── Hábitos ───────────────────────────────────────────────────────────
      case 'habitos':
        return (
          <div>
            <SectionHeader icon={Target} title="Hábitos e Estilo de Vida" color="#D97706" bg="#FFFBEB" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
              <RadioGroup label="Fuma?" field="fuma" form={form} setForm={setForm} options={['Sim', 'Não', 'Ex-fumante']} />
              {form.fuma === 'Sim' && <RadioGroup label="Com que frequência?" field="frequenciaFuma" form={form} setForm={setForm} options={['Socialmente', 'Todo dia', 'Mais de 10 por dia']} />}
              <RadioGroup label="Consome bebida alcoólica?" field="bebidaAlcoolica" form={form} setForm={setForm} options={['Sim', 'Não']} />
              {form.bebidaAlcoolica === 'Sim' && <RadioGroup label="Com que frequência?" field="frequenciaBebe" form={form} setForm={setForm} options={['Raramente', 'Fins de semana', 'Frequentemente']} />}
              <RadioGroup label="Pratica atividade física?" field="atividade" form={form} setForm={setForm} options={['Sim', 'Não']} />
              {form.atividade === 'Sim' && <RadioGroup label="Frequência" field="frequenciaAtividade" form={form} setForm={setForm} options={['1-2x/semana', '3-4x/semana', 'Todos os dias']} />}
              <RadioGroup label="Como é sua alimentação?" field="alimentacao" form={form} setForm={setForm} options={['Saudável', 'Regular', 'Ruim']} />
              <RadioGroup label="Ingere água suficiente?" field="ingereAgua" form={form} setForm={setForm} options={['Sim', 'Não', 'Às vezes']} />
              <RadioGroup label="Qualidade do sono" field="qualidadeSono" form={form} setForm={setForm} options={['Boa', 'Regular', 'Ruim', 'Insônia']} />
            </div>
          </div>
        );

      // ── Objetivos + Termo ──────────────────────────────────────────────────
      case 'objetivos':
        return (
          <div>
            <SectionHeader icon={Target} title="Objetivos e Expectativas" color="#C73B6D" bg="#FDF4F7" />
            <div style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Principais objetivos (marque os que se aplicam)</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
              {['Rejuvenescimento', 'Redução de manchas', 'Tratar acne', 'Harmonização facial', 'Hidratação', 'Redução de rugas', 'Firmeza / flacidez', 'Limpeza de pele', 'Redução de gordura localizada', 'Tratamento de cicatrizes', 'Melhora da autoestima', 'Indicação médica'].map(o => (
                <CheckItem key={o} label={o} checked={(form.objetivosPrincipais || []).includes(o)} onChange={() => toggleArr('objetivosPrincipais', o)} />
              ))}
            </div>
            <Field label="Descreva suas expectativas com o tratamento" span={2}>
              <textarea placeholder="O que você espera alcançar?" value={form.expectativas} onChange={e => set('expectativas', e.target.value)} style={{ ...textareaSt, marginBottom: 14 }} />
            </Field>
            <Field label="Como nos conheceu?">
              <select value={form.comoConheceu} onChange={e => set('comoConheceu', e.target.value)} style={{ ...inputSt, marginBottom: 20 }}>
                <option value="">Selecione...</option>
                {['Instagram', 'Facebook', 'Google', 'Indicação de amigo/familiar', 'WhatsApp', 'Outdoor / Panfleto', 'Outro'].map(o => <option key={o}>{o}</option>)}
              </select>
            </Field>

            <div style={{ background: '#F9FAFB', borderRadius: 12, padding: 16, border: '1px solid #E5E7EB', marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1F2937', marginBottom: 8 }}>Declaração e Consentimento</div>
              <p style={{ fontSize: 12, color: '#6B7280', lineHeight: 1.6, marginBottom: 12 }}>
                Declaro que as informações prestadas nesta ficha são verdadeiras e completas, e que fui devidamente orientada sobre os procedimentos a serem realizados, seus riscos, benefícios e cuidados pós-procedimento. Autorizo a realização dos serviços indicados pela profissional responsável, conforme meu conhecimento e consentimento.
              </p>
              <CheckItem
                label="Li e concordo com os termos acima"
                checked={form.leuTermos}
                onChange={v => set('leuTermos', v)}
              />
            </div>

            <Field label="Observações do profissional" span={2}>
              <textarea placeholder="Anotações internas (não visíveis ao cliente)..." value={form.observacoesProfissional} onChange={e => set('observacoesProfissional', e.target.value)} style={textareaSt} />
            </Field>
          </div>
        );

      default: return null;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
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
          <button onClick={handleSave} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#C73B6D,#9B2C50)', fontSize: 12, fontWeight: 700, cursor: 'pointer', color: '#fff', boxShadow: '0 3px 10px rgba(199,59,109,0.3)' }}>
            <Save style={{ width: 14, height: 14 }} /> Salvar Ficha
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
          : <button onClick={handleSave} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#059669,#047857)', fontSize: 13, fontWeight: 700, cursor: 'pointer', color: '#fff' }}>
            <Save style={{ width: 14, height: 14 }} /> Finalizar e Salvar
          </button>
        }
      </div>
    </div>
  );
}

// ─── VIEW FICHA ───────────────────────────────────────────────────────────────
function ViewFicha({ paciente, ficha, onEdit, onClose }) {
  const Section = ({ title, children }) => (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, paddingBottom: 6, borderBottom: '1px solid #F0EBE6' }}>{title}</div>
      {children}
    </div>
  );
  const Row = ({ label, value }) => value ? (
    <div style={{ display: 'flex', gap: 8, fontSize: 13, marginBottom: 6 }}>
      <span style={{ color: '#9CA3AF', minWidth: 160 }}>{label}:</span>
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
          <button onClick={onEdit} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#C73B6D,#9B2C50)', fontSize: 12, fontWeight: 700, cursor: 'pointer', color: '#fff' }}>
            <Edit3 style={{ width: 14, height: 14 }} /> Editar
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', background: '#fff', borderRadius: 16, padding: 24, border: '1px solid #F0EBE6' }}>
        <Section title="Dados Pessoais">
          <Row label="Nascimento" value={ficha.dataNascimento} />
          <Row label="CPF" value={ficha.cpf} />
          <Row label="Estado Civil" value={ficha.estadoCivil} />
          <Row label="Profissão" value={ficha.profissao} />
          <Row label="Endereço" value={ficha.endereco} />
          <Row label="Gestante" value={ficha.gestante} />
          <Row label="Amamentando" value={ficha.amamentando} />
        </Section>
        <Section title="Saúde Geral">
          <Row label="Cirurgia prévia" value={ficha.fezCirurgia === 'Sim' ? `Sim — ${ficha.qualCirurgia}` : ficha.fezCirurgia} />
          <Row label="Marcapasso" value={ficha.usaMarcapasso} />
          <Row label="Diabetes" value={ficha.temDiabetes} />
          <Row label="Hipertensão" value={ficha.temHipertensao} />
          <Row label="Cardiopatia" value={ficha.temCardiopatia} />
          <Row label="Epilepsia" value={ficha.temEpilepsia} />
          <Row label="Coagulopatia" value={ficha.temCoagulopatia} />
          <Row label="Histórico oncológico" value={ficha.temOncologico} />
          <Row label="Outras condições" value={ficha.outrasDoencas} />
          <Row label="Medicamentos" value={ficha.usaMedicamentos === 'Sim' ? ficha.quaisMedicamentos : ficha.usaMedicamentos} />
          <Row label="Alergias" value={ficha.temAlergia === 'Sim' ? ficha.quaisAlergias : ficha.temAlergia} />
          {[ficha.alergiaLatex && 'Látex', ficha.alergiaIodo && 'Iodo', ficha.alergiaAnestesico && 'Anestésico', ficha.alergiaQuelante && 'Quelante'].filter(Boolean).length > 0 && (
            <Row label="Alergias específicas" value={[ficha.alergiaLatex && 'Látex', ficha.alergiaIodo && 'Iodo', ficha.alergiaAnestesico && 'Anestésico', ficha.alergiaQuelante && 'Quelante'].filter(Boolean)} />
          )}
        </Section>
        <Section title="Pele e Histórico Estético">
          <Row label="Tipo de pele" value={ficha.tipoPele} />
          <Row label="Sensibilidade" value={ficha.sensibilidadePele} />
          <Row label="Fotótipo" value={ficha.fototipoCampo} />
          <Row label="Usa protetor" value={ficha.usaProtetor} />
          <Row label="Problemas de pele" value={ficha.problemasPele} />
          <Row label="Procedimentos anteriores" value={[
            ficha.jaFezBotox && 'Botox', ficha.jaFezPreenchimento && 'Preenchimento',
            ficha.jaFezPeeling && 'Peeling', ficha.jaFezLaser && 'Laser',
            ficha.jaFezMicroagulhamento && 'Microagulhamento', ficha.jaFezLimpezaPele && 'Limpeza de Pele',
            ficha.jaFezOutro && ficha.outroHistorico
          ].filter(Boolean)} />
          <Row label="Reação adversa" value={ficha.reacaoAnterior === 'Sim' ? `Sim — ${ficha.detalhesReacao}` : ficha.reacaoAnterior} />
        </Section>
        <Section title="Hábitos">
          <Row label="Fuma" value={ficha.fuma === 'Sim' ? `Sim — ${ficha.frequenciaFuma}` : ficha.fuma} />
          <Row label="Bebida alcoólica" value={ficha.bebidaAlcoolica === 'Sim' ? `Sim — ${ficha.frequenciaBebe}` : ficha.bebidaAlcoolica} />
          <Row label="Atividade física" value={ficha.atividade === 'Sim' ? `Sim — ${ficha.frequenciaAtividade}` : ficha.atividade} />
          <Row label="Alimentação" value={ficha.alimentacao} />
          <Row label="Ingere água" value={ficha.ingereAgua} />
          <Row label="Qualidade do sono" value={ficha.qualidadeSono} />
        </Section>
        <Section title="Objetivos e Expectativas">
          <Row label="Objetivos" value={ficha.objetivosPrincipais} />
          <Row label="Expectativas" value={ficha.expectativas} />
          <Row label="Como conheceu" value={ficha.comoConheceu} />
          <Row label="Assinou termo" value={ficha.leuTermos ? '✅ Sim' : '❌ Não'} />
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
  const [pacientes] = useState(loadPacientes);
  const [anamneses, setAnamneses] = useState(loadAnamneses);
  const [busca, setBusca] = useState('');
  const [view, setView] = useState('list'); // 'list' | 'form' | 'view'
  const [selectedPaciente, setSelectedPaciente] = useState(null);
  const [isEditing, setIsEditing] = useState(false);

  const filtered = useMemo(() => pacientes.filter(p =>
    p.nome?.toLowerCase().includes(busca.toLowerCase()) ||
    p.telefone?.includes(busca)
  ), [pacientes, busca]);

  const handleSave = (fichaData) => {
    const key = String(selectedPaciente.id);
    const updated = { ...anamneses, [key]: fichaData };
    setAnamneses(updated);
    saveAnamneses(updated);
    setView('view');
    setIsEditing(false);
  };

  const handleDelete = (pacienteId) => {
    if (!window.confirm('Deseja realmente excluir a ficha de anamnese deste paciente?')) return;
    const key = String(pacienteId);
    const updated = { ...anamneses };
    delete updated[key];
    setAnamneses(updated);
    saveAnamneses(updated);
  };

  const openForm = (p, editing = false) => {
    setSelectedPaciente(p);
    setIsEditing(editing);
    setView('form');
  };

  const openView = (p) => {
    setSelectedPaciente(p);
    setView('view');
  };

  const total = pacientes.length;
  const comFicha = Object.keys(anamneses).length;
  const semFicha = total - comFicha;

  if (view === 'form' && selectedPaciente) {
    const ficha = anamneses[String(selectedPaciente.id)];
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 40px)', gap: 0 }}>
        <AnamneseForm
          paciente={selectedPaciente}
          initial={isEditing ? ficha : null}
          onSave={handleSave}
          onCancel={() => setView('list')}
        />
      </div>
    );
  }

  if (view === 'view' && selectedPaciente) {
    const ficha = anamneses[String(selectedPaciente.id)];
    if (!ficha) { setView('list'); return null; }
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 40px)', gap: 0 }}>
        <ViewFicha
          paciente={selectedPaciente}
          ficha={ficha}
          onEdit={() => openForm(selectedPaciente, true)}
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
        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40, color: '#9CA3AF', fontSize: 14 }}>Nenhum paciente encontrado.</div>
        )}
        {filtered.map(p => {
          const key = String(p.id);
          const temFicha = !!anamneses[key];
          const ficha = anamneses[key];
          return (
            <div key={p.id} style={{ background: '#fff', borderRadius: 14, padding: '14px 18px', border: '1px solid #F0EBE6', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', display: 'flex', alignItems: 'center', gap: 14 }}>
              {/* Avatar */}
              <div style={{ width: 42, height: 42, borderRadius: '50%', background: 'linear-gradient(135deg,#C73B6D,#9B2C50)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, flexShrink: 0 }}>
                {(p.avatar || p.nome?.charAt(0) || '?')}
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#1F2937' }}>{p.nome}</div>
                <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 1 }}>{p.telefone}</div>
                {temFicha && ficha?.dataPreenchimento && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 3 }}>
                    <Calendar style={{ width: 10, height: 10, color: '#059669' }} />
                    <span style={{ fontSize: 10, color: '#059669', fontWeight: 600 }}>Preenchida em {ficha.dataPreenchimento}</span>
                  </div>
                )}
              </div>

              {/* Status badge */}
              <div style={{ flexShrink: 0 }}>
                {temFicha
                  ? <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 20, background: '#ECFDF5', border: '1px solid #A7F3D0' }}>
                    <CheckCircle style={{ width: 11, height: 11, color: '#059669' }} />
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#059669' }}>Ficha completa</span>
                  </div>
                  : <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 20, background: '#FFFBEB', border: '1px solid #FDE68A' }}>
                    <AlertTriangle style={{ width: 11, height: 11, color: '#D97706' }} />
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#D97706' }}>Sem ficha</span>
                  </div>
                }
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                {temFicha && (
                  <>
                    <button onClick={() => openView(p)} title="Visualizar ficha" style={{ width: 34, height: 34, borderRadius: 10, border: '1px solid #E5E7EB', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Eye style={{ width: 14, height: 14, color: '#6B7280' }} />
                    </button>
                    <button onClick={() => openForm(p, true)} title="Editar ficha" style={{ width: 34, height: 34, borderRadius: 10, border: '1px solid #E5E7EB', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Edit3 style={{ width: 14, height: 14, color: '#6B7280' }} />
                    </button>
                    <button onClick={() => handleDelete(p.id)} title="Excluir ficha" style={{ width: 34, height: 34, borderRadius: 10, border: '1px solid #FCA5A5', background: '#FFF5F5', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Trash2 style={{ width: 14, height: 14, color: '#EF4444' }} />
                    </button>
                  </>
                )}
                <button
                  onClick={() => openForm(p, temFicha)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    padding: '7px 14px', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700,
                    background: temFicha ? '#F3F4F6' : 'linear-gradient(135deg,#C73B6D,#9B2C50)',
                    color: temFicha ? '#374151' : '#fff',
                    boxShadow: temFicha ? 'none' : '0 2px 8px rgba(199,59,109,0.3)',
                  }}>
                  {temFicha ? <><Edit3 style={{ width: 12, height: 12 }} />Editar</> : <><Plus style={{ width: 12, height: 12 }} />Preencher</>}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
