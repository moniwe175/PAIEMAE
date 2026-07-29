import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Sparkles, Mail, Lock, User, LogIn, UserPlus, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function Login() {
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [mode, setMode] = useState('signin'); // 'signin' ou 'signup'
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

    if (mode === 'signup' && password.length < 6) {
      setErrorMsg('A senha deve ter no mínimo 6 caracteres.');
      return;
    }

    setLoading(true);

    try {
      if (mode === 'signin') {
        const { error } = await signIn(email.trim(), password);
        if (error) {
          if (error.message.includes('Invalid login credentials')) {
            setErrorMsg('E-mail ou senha incorretos.');
          } else {
            setErrorMsg(error.message || 'Falha ao realizar login.');
          }
        } else {
          navigate(from, { replace: true });
        }
      } else {
        const { data, error } = await signUp(email.trim(), password, fullName.trim());
        if (error) {
          setErrorMsg(error.message || 'Falha ao criar conta.');
        } else {
          if (data?.user?.identities?.length === 0) {
            setErrorMsg('Este e-mail já está cadastrado. Tente fazer login.');
          } else {
            setSuccessMsg('Conta criada com sucesso! Você já pode acessar o sistema.');
            setTimeout(() => {
              navigate(from, { replace: true });
            }, 1500);
          }
        }
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
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
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
            Criar Conta
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

        {successMsg && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            background: '#EFF7F2',
            border: '1px solid #C3E6CB',
            borderRadius: 10,
            padding: '12px 14px',
            marginBottom: 20,
            color: '#6B9B7A',
            fontSize: 13
          }}>
            <CheckCircle2 style={{ width: 18, height: 18, flexShrink: 0 }} />
            <span>{successMsg}</span>
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
                <span>Aguarde...</span>
              </>
            ) : mode === 'signin' ? (
              <>
                <LogIn style={{ width: 18, height: 18 }} />
                <span>Acessar Painel</span>
              </>
            ) : (
              <>
                <UserPlus style={{ width: 18, height: 18 }} />
                <span>Cadastrar Conta</span>
              </>
            )}
          </button>
        </form>

        <div style={{ marginTop: 28, textAlign: 'center', fontSize: 11, color: '#8C7573' }}>
          Ambiente Seguro — Evelyn Esthetic Center
        </div>
      </div>
    </div>
  );
}
