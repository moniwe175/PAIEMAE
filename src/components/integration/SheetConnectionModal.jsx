import { useState } from 'react';
import { XCircle, FileSpreadsheet, Table2, ArrowRight, ArrowLeft, Zap, Clock, Shield } from 'lucide-react';
import useSheetSync from '../../hooks/useSheetSync';

const POLLING_OPTIONS = [
  { value: 15, label: '15 segundos' },
  { value: 30, label: '30 segundos' },
  { value: 60, label: '1 minuto' },
  { value: 300, label: '5 minutos' },
];

export default function SheetConnectionModal({ onClose, onConnect }) {
  const { connect, authenticateGoogle, loadGoogleApi } = useSheetSync();
  const [step, setStep] = useState(1); // 1: provider, 2: credentials, 3: configure
  const [provider, setProvider] = useState(null); // 'google' | 'demo'
  const [googleClientId, setGoogleClientId] = useState('');
  const [googleApiKey, setGoogleApiKey] = useState('');
  const [sheetId, setSheetId] = useState('');
  const [sheetName, setSheetName] = useState('');
  const [range, setRange] = useState('A1:Z1000');
  const [pollingInterval, setPollingInterval] = useState(30);
  const [authStatus, setAuthStatus] = useState('idle'); // idle | loading | success | error
  const [authError, setAuthError] = useState('');

  const extractSheetId = (input) => {
    // Extract from URL: https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit
    const match = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (match) return match[1];
    return input.trim();
  };

  const handleGoogleAuth = async () => {
    if (!googleClientId || !googleApiKey) {
      setAuthError('Preencha o Client ID e a API Key');
      return;
    }

    setAuthStatus('loading');
    setAuthError('');

    try {
      await loadGoogleApi();
      await authenticateGoogle(googleClientId, googleApiKey);
      setAuthStatus('success');
    } catch (err) {
      setAuthStatus('error');
      setAuthError(err.message || 'Erro na autenticação');
    }
  };

  const handleConnect = () => {
    const finalSheetId = extractSheetId(sheetId);
    const config = {
      provider,
      sheetId: finalSheetId,
      sheetName: sheetName || finalSheetId,
      range,
      pollingInterval,
      googleClientId,
      googleApiKey,
    };

    if (provider === 'demo') {
      config.sheetName = 'Planilha Demo';
      config.sheetId = 'demo_sheet';
    }

    connect(config);
    onConnect(config);
    onClose();
  };

  const canProceed = () => {
    if (step === 1) return provider !== null;
    if (step === 2) {
      if (provider === 'demo') return true;
      return authStatus === 'success';
    }
    if (step === 3) {
      if (provider === 'demo') return true;
      return sheetId.trim().length > 0;
    }
    return false;
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 580 }}>
        <div className="modal-header">
          <span className="modal-title">Conectar Planilha</span>
          <button className="modal-close" onClick={onClose}><XCircle /></button>
        </div>

        {/* Step indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24 }}>
          {[
            { n: 1, label: 'Provedor' },
            { n: 2, label: 'Autenticação' },
            { n: 3, label: 'Configurar' },
          ].map((s, i) => (
            <React.Fragment key={s.n}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 700,
                  background: step >= s.n ? 'var(--color-primary)' : 'var(--border-color)',
                  color: step >= s.n ? '#fff' : 'var(--text-muted)',
                  transition: 'all 0.2s',
                }}>
                  {step > s.n ? '✓' : s.n}
                </div>
                <span style={{ fontSize: 12, fontWeight: 500, color: step >= s.n ? 'var(--text-dark)' : 'var(--text-muted)' }}>
                  {s.label}
                </span>
              </div>
              {i < 2 && (
                <div style={{
                  flex: 1, height: 2,
                  background: step > s.n ? 'var(--color-primary)' : 'var(--border-color)',
                  borderRadius: 1,
                }} />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Step 1: Provider selection */}
        {step === 1 && (
          <div>
            <p style={{ fontSize: 13, color: 'var(--text-light)', margin: '0 0 16px' }}>
              Escolha o provedor da sua planilha:
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* Google Sheets option */}
              <div
                onClick={() => setProvider('google')}
                style={{
                  padding: '16px 18px',
                  borderRadius: 'var(--radius-md)',
                  border: `2px solid ${provider === 'google' ? 'var(--color-primary)' : 'var(--border-color)'}`,
                  cursor: 'pointer',
                  background: provider === 'google' ? 'var(--color-accent-soft)' : 'var(--bg-card)',
                  transition: 'all 0.15s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                }}
              >
                <div style={{
                  width: 44, height: 44, borderRadius: 12,
                  background: '#4285F418',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <FileSpreadsheet style={{ width: 22, height: 22, color: '#4285F4' }} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-dark)' }}>Google Sheets</div>
                  <div style={{ fontSize: 12, color: 'var(--text-light)', marginTop: 2 }}>
                    Conecte sua conta Google e selecione uma planilha
                  </div>
                </div>
              </div>

              {/* Demo mode option */}
              <div
                onClick={() => setProvider('demo')}
                style={{
                  padding: '16px 18px',
                  borderRadius: 'var(--radius-md)',
                  border: `2px solid ${provider === 'demo' ? 'var(--success)' : 'var(--border-color)'}`,
                  cursor: 'pointer',
                  background: provider === 'demo' ? 'var(--success-bg)' : 'var(--bg-card)',
                  transition: 'all 0.15s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                }}
              >
                <div style={{
                  width: 44, height: 44, borderRadius: 12,
                  background: 'var(--success-bg)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <Zap style={{ width: 22, height: 22, color: 'var(--success)' }} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-dark)' }}>
                    Modo Demo
                    <span className="badge badge-success" style={{ marginLeft: 8, fontSize: 9 }}>RECOMENDADO PARA TESTE</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-light)', marginTop: 2 }}>
                    Simule dados em tempo real sem configurar API
                  </div>
                </div>
              </div>

              {/* Excel Online (disabled) */}
              <div style={{
                padding: '16px 18px',
                borderRadius: 'var(--radius-md)',
                border: '2px solid var(--border-color)',
                background: 'var(--bg-main)',
                opacity: 0.5,
                display: 'flex',
                alignItems: 'center',
                gap: 14,
              }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 12,
                  background: '#185ABD18',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <Table2 style={{ width: 22, height: 22, color: '#185ABD' }} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-muted)' }}>
                    Excel Online
                    <span className="badge badge-neutral" style={{ marginLeft: 8, fontSize: 9 }}>EM BREVE</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                    Integração com Microsoft 365 (em desenvolvimento)
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Authentication */}
        {step === 2 && (
          <div>
            {provider === 'demo' ? (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <div style={{
                  width: 64, height: 64, borderRadius: 16,
                  background: 'var(--success-bg)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 16px',
                }}>
                  <Zap style={{ width: 28, height: 28, color: 'var(--success)' }} />
                </div>
                <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>Modo Demo Ativado</div>
                <p style={{ fontSize: 13, color: 'var(--text-light)', lineHeight: 1.6, margin: 0 }}>
                  O modo demo simulará dados em tempo real, como se uma planilha estivesse enviando novos lançamentos a cada ciclo de sincronização. Nenhuma configuração adicional é necessária.
                </p>
              </div>
            ) : (
              <div>
                <p style={{ fontSize: 13, color: 'var(--text-light)', margin: '0 0 16px', lineHeight: 1.6 }}>
                  Para conectar ao Google Sheets, você precisa de um projeto no Google Cloud com a Sheets API habilitada. Insira suas credenciais abaixo:
                </p>

                <div className="form-group">
                  <label className="form-label">Google Client ID</label>
                  <input
                    className="form-input"
                    placeholder="xxxx.apps.googleusercontent.com"
                    value={googleClientId}
                    onChange={e => setGoogleClientId(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Google API Key</label>
                  <input
                    className="form-input"
                    placeholder="AIza..."
                    value={googleApiKey}
                    onChange={e => setGoogleApiKey(e.target.value)}
                  />
                </div>

                <div style={{
                  background: 'var(--info-bg)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '10px 14px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 8,
                  marginBottom: 14,
                }}>
                  <Shield style={{ width: 14, height: 14, color: 'var(--info)', flexShrink: 0, marginTop: 1 }} />
                  <span style={{ fontSize: 11, color: 'var(--info)', lineHeight: 1.5 }}>
                    Suas credenciais ficam salvas apenas no seu navegador (localStorage) e nunca são enviadas para nossos servidores.
                  </span>
                </div>

                {authError && (
                  <div style={{
                    background: 'var(--danger-bg)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '10px 14px',
                    color: 'var(--danger)',
                    fontSize: 12,
                    marginBottom: 14,
                  }}>
                    {authError}
                  </div>
                )}

                <button
                  className="btn btn-primary"
                  style={{ width: '100%', justifyContent: 'center' }}
                  onClick={handleGoogleAuth}
                  disabled={authStatus === 'loading'}
                >
                  {authStatus === 'loading' ? 'Autenticando...' : authStatus === 'success' ? 'Autenticado com Sucesso!' : 'Autenticar com Google'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Configure */}
        {step === 3 && (
          <div>
            {provider === 'demo' ? (
              <div>
                <div className="form-group">
                  <label className="form-label">
                    <Clock style={{ width: 12, height: 12, display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
                    Intervalo de Sincronização
                  </label>
                  <select
                    className="form-select"
                    value={pollingInterval}
                    onChange={e => setPollingInterval(parseInt(e.target.value, 10))}
                  >
                    {POLLING_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <p style={{ fontSize: 12, color: 'var(--text-light)', lineHeight: 1.6 }}>
                  A cada intervalo, o sistema simulará a leitura de novos dados de uma planilha e atualizará o financeiro e dashboard automaticamente.
                </p>
              </div>
            ) : (
              <div>
                <div className="form-group">
                  <label className="form-label">ID ou URL da Planilha</label>
                  <input
                    className="form-input"
                    placeholder="Cole a URL da planilha ou o ID"
                    value={sheetId}
                    onChange={e => setSheetId(e.target.value)}
                  />
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
                    Ex: https://docs.google.com/spreadsheets/d/1aBc.../edit
                  </span>
                </div>

                <div className="form-grid-2">
                  <div className="form-group">
                    <label className="form-label">Nome da Planilha</label>
                    <input
                      className="form-input"
                      placeholder="Minha Planilha"
                      value={sheetName}
                      onChange={e => setSheetName(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Intervalo</label>
                    <input
                      className="form-input"
                      placeholder="A1:Z1000"
                      value={range}
                      onChange={e => setRange(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">
                    <Clock style={{ width: 12, height: 12, display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
                    Intervalo de Polling
                  </label>
                  <select
                    className="form-select"
                    value={pollingInterval}
                    onChange={e => setPollingInterval(parseInt(e.target.value, 10))}
                  >
                    {POLLING_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Navigation buttons */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', marginTop: 20 }}>
          <div>
            {step > 1 && (
              <button className="btn btn-ghost" onClick={() => setStep(step - 1)}>
                <ArrowLeft style={{ width: 14, height: 14 }} />Voltar
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
            {step < 3 ? (
              <button
                className="btn btn-primary"
                disabled={!canProceed()}
                onClick={() => setStep(step + 1)}
              >
                Próximo<ArrowRight style={{ width: 14, height: 14 }} />
              </button>
            ) : (
              <button
                className="btn btn-primary"
                disabled={!canProceed()}
                onClick={handleConnect}
              >
                <Zap style={{ width: 14, height: 14 }} />Conectar e Sincronizar
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
