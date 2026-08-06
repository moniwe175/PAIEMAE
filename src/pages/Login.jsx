import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Sparkles, Mail, Lock, User, LogIn, UserPlus, AlertCircle, Clock, CheckCircle2, Loader2, ShieldAlert } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { requestAccess, checkUserAccessStatus } from '../services/supabaseService';

export default function Login() {
  const { signIn, signUp, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [mode, setMode] = useState('signin'); // 'signin', 'signup', 'pending_notice'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const from = location.state?.from?.pathname || '/';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!email.trim() || !password.trim()) {
      setErrorMsg('Preencha todos os campos obrigatórios.');
      return;
    }

    if (mode === 'signup') {
      if (!fullName.trim()) {
        setErrorMsg('Informe o seu nome completo.');
        return;
      }
      if (password.length < 6) {
        setErrorMsg('A senha deve ter no mínimo 6 caracteres.');
        return;
      }
    }

    setLoading(true);

    try {
      if (mode === 'signin') {
        // 1. Tenta fazer login com Supabase Auth
        const { data: authData, error: authError } = await signIn(email.trim(), password);
        
        if (authError) {
          if (authError.message.includes('Invalid login credentials')) {
            setErrorMsg('E-mail ou senha incorretos.');
          } else {
            setErrorMsg(authError.message || 'Falha ao realizar login.');
          }
          setLoading(false);
          return;
        }

        // 2. Verifica se o usuário tem aprovação do responsável no banco
        const { data: accessStatus } = await checkUserAccessStatus(email.trim());

        if (accessStatus?.status === 'pending') {
          await signOut();
          setErrorMsg('Aguardando o responsável aceitar a sua solicitação de acesso.');
          setLoading(false);
          return;
        }

        if (accessStatus?.status === 'rejected') {
          await signOut();
          setErrorMsg('Sua solicitação de acesso foi recusada pelo administrador.');
          setLoading(false);
          return;
        }

        // Login autorizado com sucesso!
        navigate(from, { replace: true });

      } else if (mode === 'signup') {
        // 1. Cria a conta no Supabase Auth
        const { data: authData, error: authError } = await signUp(email.trim(), password, fullName.trim());

        if (authError) {
          setErrorMsg(authError.message || 'Falha ao enviar solicitação.');
          setLoading(false);
          return;
        }

        if (authData?.user?.identities?.length === 0) {
          setErrorMsg('Este e-mail já possui cadastro. Tente entrar com sua senha.');
          setLoading(false);
          return;
        }

        // 2. Registra a solicitação com status 'pending'
        await requestAccess({
          userId: authData?.user?.id,
          email: email.trim(),
          fullName: fullName.trim()
        });

        // 3. Efetua logout imediato para forçar espera pela aprovação do gestor
        await signOut();

        // 4. Exibe tela de "Aguardando o responsável aceitar"
        setMode('pending_notice');
      }
    } catch (err) {
      setErrorMsg('Ocorreu um erro inesperado. Tente novamente.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'radial-gradient(circle at 50% 30%, #FDFBF9 0%, #F6F1EE 60%, #EFE7E2 100%)',
      padding: '24px 20px',
      color: '#432F2D',
      fontFamily: "'Inter', system-ui, -apple-system, sans-serif"
    }}>
      {/* Container Card */}
      <div style={{
        width: '100%',
        maxWidth: 440,
        background: '#FFFFFF',
        border: '1px solid #DFC8C3',
        borderRadius: 24,
        padding: '40px 36px',
        boxShadow: '0 20px 50px rgba(136, 89, 78, 0.12), 0 4px 12px rgba(67, 47, 45, 0.04)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Top Decorative Line */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 4,
          background: 'linear-gradient(90deg, #88594E 0%, #B3857A 50%, #C8A26A 100%)'
        }} />

        {/* Logo / Header */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            width: 56,
            height: 56,
            borderRadius: 16,
            background: 'linear-gradient(135deg, #88594E 0%, #B3857A 100%)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 14,
            boxShadow: '0 8px 20px rgba(136, 89, 78, 0.28)'
          }}>
            <Sparkles style={{ width: 28, height: 28, color: '#F9F1EC' }} />
          </div>
          
          <h1 style={{
            fontSize: 26,
            fontWeight: 400,
            fontFamily: "'Italiana', Georgia, serif",
            margin: 0,
            color: '#432F2D',
            letterSpacing: '0.5px'
          }}>
            Evelyn
          </h1>
          <div style={{
            fontSize: 11,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '2px',
            color: '#C8A26A',
            marginTop: 2
          }}>
            Esthetic Center
          </div>

          <p style={{ fontSize: 13, color: '#8C7573', marginTop: 8 }}>
            Sistema Integrado de Gestão & Financeiro
          </p>
        </div>

        {/* MODO 3: TELA DE AVISO "AGUARDANDO O RESPONSÁVEL ACEITAR" */}
        {mode === 'pending_notice' ? (
          <div style={{ textAlign: 'center', padding: '10px 0' }}>
            <div style={{
              width: 64,
              height: 64,
              borderRadius: 50,
              background: '#FDF3EB',
              border: '2px solid #D4956A',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16
            }}>
              <Clock style={{ width: 32, height: 32, color: '#D4956A' }} />
            </div>

            <h3 style={{ fontSize: 18, fontWeight: 700, color: '#432F2D', margin: '0 0 10px 0' }}>
              Solicitação Enviada!
            </h3>

            <div style={{
              background: '#FDF3EB',
              border: '1px solid #DFC8C3',
              borderRadius: 14,
              padding: '16px',
              marginBottom: 24,
              textAlign: 'left'
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <Clock style={{ width: 18, height: 18, color: '#D4956A', flexShrink: 0, marginTop: 2 }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#432F2D', marginBottom: 4 }}>
                    Aguardando o responsável aceitar
                  </div>
                  <div style={{ fontSize: 12, color: '#584341', lineHeight: 1.5 }}>
                    Sua solicitação de cadastro foi registrada com sucesso. Assim que o responsável aprovar seu acesso, você poderá entrar com o e-mail <strong>{email}</strong>.
                  </div>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => { setMode('signin'); setErrorMsg(''); setSuccessMsg(''); }}
              style={{
                width: '100%',
                padding: '12px 16px',
                borderRadius: 10,
                border: '1px solid #DFC8C3',
                background: '#F6F1EE',
                color: '#432F2D',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Voltar para a Tela de Login
            </button>
          </div>
        ) : (
          <>
            {/* Tab Toggle */}
            <div style={{
              display: 'flex',
              background: '#F6F1EE',
              padding: 4,
              borderRadius: 12,
              marginBottom: 24,
              border: '1px solid #DFC8C3'
            }}>
              <button
                type="button"
                onClick={() => { setMode('signin'); setErrorMsg(''); setSuccessMsg(''); }}
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  borderRadius: 8,
                  border: 'none',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  background: mode === 'signin' ? '#88594E' : 'transparent',
                  color: mode === 'signin' ? '#FFFFFF' : '#8C7573',
                  boxShadow: mode === 'signin' ? '0 2px 8px rgba(136, 89, 78, 0.25)' : 'none'
                }}
              >
                Entrar
              </button>
              <button
                type="button"
                onClick={() => { setMode('signup'); setErrorMsg(''); setSuccessMsg(''); }}
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  borderRadius: 8,
                  border: 'none',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  background: mode === 'signup' ? '#88594E' : 'transparent',
                  color: mode === 'signup' ? '#FFFFFF' : '#8C7573',
                  boxShadow: mode === 'signup' ? '0 2px 8px rgba(136, 89, 78, 0.25)' : 'none'
                }}
              >
                Solicitar Acesso
              </button>
            </div>

            {/* Feedback Messages */}
            {errorMsg && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                background: '#FCEEF0',
                border: '1px solid #F5C2C7',
                borderRadius: 10,
                padding: '12px 14px',
                marginBottom: 20,
                color: '#DC2828',
                fontSize: 13
              }}>
                <AlertCircle style={{ width: 18, height: 18, flexShrink: 0 }} />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {mode === 'signup' && (
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#584341', marginBottom: 6 }}>
                    Nome Completo
                  </label>
                  <div style={{ position: 'relative' }}>
                    <User style={{ position: 'absolute', left: 14, top: 13, width: 16, height: 16, color: '#B3857A' }} />
                    <input
                      type="text"
                      required
                      placeholder="Seu nome completo"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '11px 12px 11px 40px',
                        borderRadius: 10,
                        border: '1px solid #DFC8C3',
                        background: '#FFFFFF',
                        color: '#432F2D',
                        fontSize: 14,
                        outline: 'none',
                        boxSizing: 'border-box',
                        transition: 'border-color 0.2s'
                      }}
                      onFocus={(e) => e.target.style.borderColor = '#88594E'}
                      onBlur={(e) => e.target.style.borderColor = '#DFC8C3'}
                    />
                  </div>
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#584341', marginBottom: 6 }}>
                  E-mail
                </label>
                <div style={{ position: 'relative' }}>
                  <Mail style={{ position: 'absolute', left: 14, top: 13, width: 16, height: 16, color: '#B3857A' }} />
                  <input
                    type="email"
                    required
                    placeholder="seu.email@exemplo.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '11px 12px 11px 40px',
                      borderRadius: 10,
                      border: '1px solid #DFC8C3',
                      background: '#FFFFFF',
                      color: '#432F2D',
                      fontSize: 14,
                      outline: 'none',
                      boxSizing: 'border-box',
                      transition: 'border-color 0.2s'
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#88594E'}
                    onBlur={(e) => e.target.style.borderColor = '#DFC8C3'}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#584341', marginBottom: 6 }}>
                  Senha
                </label>
                <div style={{ position: 'relative' }}>
                  <Lock style={{ position: 'absolute', left: 14, top: 13, width: 16, height: 16, color: '#B3857A' }} />
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '11px 12px 11px 40px',
                      borderRadius: 10,
                      border: '1px solid #DFC8C3',
                      background: '#FFFFFF',
                      color: '#432F2D',
                      fontSize: 14,
                      outline: 'none',
                      boxSizing: 'border-box',
                      transition: 'border-color 0.2s'
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#88594E'}
                    onBlur={(e) => e.target.style.borderColor = '#DFC8C3'}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  marginTop: 6,
                  padding: '13px 16px',
                  borderRadius: 10,
                  border: 'none',
                  background: 'linear-gradient(135deg, #88594E 0%, #B3857A 100%)',
                  color: '#FFFFFF',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  boxShadow: '0 6px 18px rgba(136, 89, 78, 0.28)',
                  transition: 'all 0.2s'
                }}
              >
                {loading ? (
                  <>
                    <Loader2 style={{ width: 18, height: 18, animation: 'spin 1s linear infinite' }} />
                    <span>Processando...</span>
                  </>
                ) : mode === 'signin' ? (
                  <>
                    <LogIn style={{ width: 18, height: 18 }} />
                    <span>Acessar Painel</span>
                  </>
                ) : (
                  <>
                    <UserPlus style={{ width: 18, height: 18 }} />
                    <span>Enviar Solicitação de Cadastro</span>
                  </>
                )}
              </button>
            </form>

            <div style={{ marginTop: 24, textAlign: 'center', fontSize: 11, color: '#8C7573' }}>
              Ambiente Seguro — Evelyn Esthetic Center
            </div>
          </>
        )}
      </div>
    </div>
  );
}
