/* eslint-disable react/prop-types */
import { useState } from 'react';
import {
  FlaskConical, XCircle, Send, Users, RefreshCw, Play, Sparkles
} from 'lucide-react';
import { testInstagramComment } from '../../services/instagramService';

export default function InstagramTestModal({
  post,
  rule,
  onClose,
  onTestComplete,
}) {
  const [username, setUsername] = useState('paciente_teste');
  const [commentText, setCommentText] = useState(rule?.palavra_chave || 'QUERO');
  const [forceDuplicate, setForceDuplicate] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const applyScenario = (type) => {
    setForceDuplicate(false);
    setTestResult(null);
    if (type === 'match') {
      setUsername('paciente_interessado');
      setCommentText(`Olá! ${rule?.palavra_chave || 'QUERO'} saber os valores!`);
    } else if (type === 'mismatch') {
      setUsername('seguidora_curiosa');
      setCommentText('Lindo resultado! Parabéns pelo atendimento!');
    } else if (type === 'duplicate') {
      setUsername('paciente_repetido');
      setCommentText(rule?.palavra_chave || 'QUERO');
      setForceDuplicate(true);
    }
  };

  const handleRunTest = async () => {
    if (!post?.id) return;
    setTesting(true);
    setTestResult(null);

    const payload = {
      media_id: post.id,
      media_caption: post.caption || '',
      media_permalink: post.permalink || '',
      username: username.replace('@', ''),
      text: commentText,
      force_duplicate: forceDuplicate,
      comment_id: forceDuplicate ? 'fixed_duplicate_comment_id_101' : `test_cmt_${Date.now()}`,
      rule: rule ? {
        id: rule.id,
        palavra_chave: rule.palavra_chave,
        resposta_privada: rule.resposta_privada,
        responder_comentario: rule.responder_comentario,
        resposta_publica: rule.resposta_publica,
        status: rule.status,
        encaminhar_crm: rule.encaminhar_crm,
        campanha_nome: rule.campanha_nome,
      } : null,
    };

    const res = await testInstagramComment(payload);
    setTesting(false);
    if (res.data) {
      setTestResult(res.data);
      if (onTestComplete) onTestComplete(res.data);
    } else {
      setTestResult({ ok: false, error: res.error || 'Falha ao executar teste.' });
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 620, maxHeight: '90vh', overflowY: 'auto' }}
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: 'rgba(139, 92, 246, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <FlaskConical style={{ width: 18, height: 18, color: '#8B5CF6' }} />
            </div>
            <div>
              <span className="modal-title">Simulador de Comentário</span>
              <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)' }}>
                Pré-visualize a regra. O teste não envia Direct, não publica comentários e não grava no CRM.
              </p>
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>
            <XCircle />
          </button>
        </div>

        {/* Scenarios Quick Pick */}
        <div style={{ marginBottom: 16 }}>
          <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
            Cenários de Teste Rápidos:
          </span>
          <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => applyScenario('match')}
              style={{ fontSize: 11, background: '#ECFDF5', color: '#059669', borderColor: '#A7F3D0' }}
            >
              ✓ Comentário com Palavra-chave
            </button>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => applyScenario('mismatch')}
              style={{ fontSize: 11, background: '#F3F4F6', color: '#4B5563', borderColor: '#E5E7EB' }}
            >
              ✗ Comentário sem Palavra-chave
            </button>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => applyScenario('duplicate')}
              style={{ fontSize: 11, background: '#FFFBEB', color: '#D97706', borderColor: '#FDE68A' }}
            >
              🔁 Evento Duplicado (Idempotência)
            </button>
          </div>
        </div>

        {/* Inputs */}
        <div className="form-grid-2">
          <div className="form-group">
            <label className="form-label">Usuário Instagram do Comentário *</label>
            <input
              className="form-input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="ex: paciente_teste"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Palavra-chave Ativa na Regra</label>
            <div
              style={{
                height: 38,
                display: 'flex',
                alignItems: 'center',
                padding: '0 12px',
                background: 'var(--bg-main, #F9FAFB)',
                border: '1px solid var(--border-color)',
                borderRadius: 8,
                fontWeight: 700,
                color: rule?.palavra_chave ? '#059669' : '#DC2626',
                fontSize: 13,
              }}
            >
              {rule?.palavra_chave ? `"${rule.palavra_chave}" (${rule.status || 'ativo'})` : 'Nenhuma regra salva'}
            </div>
          </div>

          <div className="form-group" style={{ gridColumn: 'span 2' }}>
            <label className="form-label">Texto do Comentário Simulado *</label>
            <textarea
              className="form-textarea"
              style={{ minHeight: 60 }}
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Digite o comentário que o paciente faria no post..."
            />
          </div>

          <div className="form-group" style={{ gridColumn: 'span 2' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={forceDuplicate}
                onChange={(e) => setForceDuplicate(e.target.checked)}
                style={{ accentColor: '#D97706' }}
              />
              <span style={{ fontWeight: 600 }}>Repetir ID na simulação (execute duas vezes para ver o descarte)</span>
            </label>
          </div>
        </div>

        {/* Action Button */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10, marginBottom: 16 }}>
          <button
            className="btn btn-primary"
            onClick={handleRunTest}
            disabled={testing || !commentText.trim()}
            style={{
              background: 'linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%)',
              borderColor: 'transparent',
              color: '#fff',
            }}
          >
            {testing ? (
              <RefreshCw style={{ width: 14, height: 14, animation: 'spin 1s linear infinite' }} />
            ) : (
              <Play style={{ width: 14, height: 14 }} />
            )}
            Executar Teste de Automação
          </button>
        </div>

        {/* Step-by-Step Diagnostic Result */}
        {testResult && (
          <div
            style={{
              marginTop: 16,
              background: 'var(--bg-main, #F9FAFB)',
              borderRadius: 12,
              padding: 16,
              border: '1px solid var(--border-color, #E5E7EB)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-dark)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Sparkles style={{ width: 14, height: 14, color: '#8B5CF6' }} />
                Resultado da Execução:
              </span>
              <span
                className={`badge ${
                  testResult.duplicate
                    ? 'badge-warning'
                    : testResult.status === 'sucesso'
                    ? 'badge-success'
                    : testResult.status === 'pausado'
                    ? 'badge-warning'
                    : 'badge-neutral'
                }`}
              >
                Status: {testResult.status || (testResult.ok ? 'Sucesso' : 'Falha')}
              </span>
            </div>

            {/* Steps Timeline */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(testResult.steps || []).map((s, idx) => {
                const isFail = s.step.includes('error') || s.step.includes('mismatch') || s.step.includes('no_rule');
                const isSuccess = s.step.includes('success') || s.step.includes('matched');
                const isWarning = s.step.includes('paused') || s.step.includes('duplicate');

                const color = isFail ? '#DC2626' : isSuccess ? '#059669' : isWarning ? '#D97706' : 'var(--text-medium)';

                return (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 8,
                      fontSize: 12,
                      padding: '4px 0',
                      borderBottom: '1px solid var(--border-light, #F3F4F6)',
                    }}
                  >
                    <span style={{ fontWeight: 700, color, minWidth: 20 }}>
                      {idx + 1}.
                    </span>
                    <span style={{ color: 'var(--text-dark)' }}>{s.message}</span>
                  </div>
                );
              })}
            </div>

            {/* Direct Message Dispatched Preview */}
            {testResult.response_text && (
              <div style={{ marginTop: 14, padding: 12, background: '#111827', borderRadius: 8, color: '#fff' }}>
                <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Send style={{ width: 11, height: 11, color: '#10B981' }} />
                  Resposta Privada Formatada para o Direct:
                </div>
                <div style={{ fontSize: 13, lineHeight: 1.5, color: '#E5E7EB' }}>
                  {testResult.response_text}
                </div>
              </div>
            )}

            {testResult.public_reply?.status === 'simulado' && (
              <div style={{ marginTop: 10, padding: 12, background: '#F3F4F6', borderRadius: 8, fontSize: 12 }}>
                <strong>Resposta pública após o sucesso da DM (simulação):</strong>
                <p style={{ margin: '6px 0 0' }}>{testResult.public_reply.text}</p>
              </div>
            )}

            {/* CRM Lead Info */}
            {testResult.crm_lead_id && (
              <div
                style={{
                  marginTop: 10,
                  padding: '8px 12px',
                  background: '#ECFDF5',
                  border: '1px solid #A7F3D0',
                  borderRadius: 8,
                  fontSize: 12,
                  color: '#065F46',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <Users style={{ width: 14, height: 14, flexShrink: 0 }} />
                <span>
                  <strong>CRM Atualizado:</strong> Lead vinculado com sucesso ({testResult.is_new_lead ? 'Novo interessado criado' : 'Interessado existente atualizado'}). Fila: <em>Responder</em>.
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
