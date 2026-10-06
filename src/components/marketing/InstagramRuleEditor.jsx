/* eslint-disable react/prop-types */
import { useState, useEffect } from 'react';
import {
  MessageSquare, Play, Pause, Trash2, CheckCircle, ExternalLink,
  Tag, Shield, Sparkles, FlaskConical, AlertCircle, RefreshCw
} from 'lucide-react';

export default function InstagramRuleEditor({
  selectedPost,
  existingRule,
  campaigns = [],
  onSaveRule,
  onToggleStatus,
  onDeleteRule,
  onOpenTest,
  saving,
}) {
  const [keyword, setKeyword] = useState('');
  const [resposta, setResposta] = useState('');
  const [status, setStatus] = useState('pausado');
  const [campanhaId, setCampanhaId] = useState('');
  const [encaminharCrm, setEncaminharCrm] = useState(true);
  const [responderComentario, setResponderComentario] = useState(false);
  const [respostaPublica, setRespostaPublica] = useState('Prontinho! Te enviei as informações no Direct 💜');
  const [error, setError] = useState('');

  // Sincroniza estado quando a publicação ou regra selecionada muda
  useEffect(() => {
    if (existingRule) {
      setKeyword(existingRule.palavra_chave || '');
      setResposta(existingRule.resposta_privada || '');
      setStatus(existingRule.status || 'pausado');
      setCampanhaId(existingRule.campanha_id || '');
      setEncaminharCrm(existingRule.encaminhar_crm !== false);
      setResponderComentario(existingRule.responder_comentario === true);
      setRespostaPublica(existingRule.resposta_publica || 'Prontinho! Te enviei as informações no Direct 💜');
    } else {
      setKeyword('');
      setResposta(
        'Olá {{usuario}}! Vi que você comentou na nossa publicação. Para te passar todas as informações e tirar suas dúvidas, qual é o seu WhatsApp de contato?'
      );
      setStatus('pausado');
      setCampanhaId('');
      setEncaminharCrm(true);
      setResponderComentario(false);
      setRespostaPublica('Prontinho! Te enviei as informações no Direct 💜');
    }
    setError('');
  }, [existingRule, selectedPost]);

  if (!selectedPost) {
    return (
      <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
        <MessageSquare style={{ width: 38, height: 38, margin: '0 auto 12px', opacity: 0.5 }} />
        <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-dark)' }}>Nenhuma publicação selecionada</h3>
        <p style={{ fontSize: 13, maxWidth: 360, margin: '6px auto 0' }}>
          Clique em uma das publicações ou Reels acima para configurar a palavra-chave e a resposta privada automatizada.
        </p>
      </div>
    );
  }

  const handleSave = async () => {
    if (!keyword.trim()) {
      setError('Informe a palavra-chave que aciona a resposta.');
      return;
    }
    if (!resposta.trim()) {
      setError('Digite a mensagem da resposta privada (DM).');
      return;
    }
    if (responderComentario && !respostaPublica.trim()) {
      setError('Digite a resposta pública antes de ativá-la.');
      return;
    }
    if (respostaPublica.trim().length > 500) {
      setError('A resposta pública aceita até 500 caracteres.');
      return;
    }
    setError('');

    const selectedCamp = campaigns.find((c) => String(c.id) === String(campanhaId));

    const payload = {
      id: existingRule?.id,
      media_id: selectedPost.id,
      media_caption: selectedPost.caption || '',
      media_permalink: selectedPost.permalink || '',
      media_url: selectedPost.thumbnail_url || selectedPost.media_url || '',
      media_type: selectedPost.media_type || 'IMAGE',
      palavra_chave: keyword.trim().toUpperCase(),
      resposta_privada: resposta.trim(),
      status,
      campanha_id: campanhaId || null,
      campanha_nome: selectedCamp?.nome || null,
      encaminhar_crm: encaminharCrm,
      responder_comentario: responderComentario,
      resposta_publica: respostaPublica.trim(),
    };

    await onSaveRule(payload);
  };

  const insertTag = (tag) => {
    setResposta((prev) => prev + ` ${tag}`);
  };

  // Preview formatado com tags fictícias
  const previewText = resposta
    .replace(/\{\{usuario\}\}/gi, '@maria_souza')
    .replace(/\{\{nome\}\}/gi, 'Maria')
    .replace(/\{\{post\}\}/gi, selectedPost.caption ? `"${selectedPost.caption.slice(0, 24)}..."` : 'publicação');
  const publicPreview = respostaPublica
    .replace(/\{\{usuario\}\}/gi, '@maria_souza')
    .replace(/\{\{nome\}\}/gi, 'Maria')
    .replace(/\{\{post\}\}/gi, selectedPost.caption ? `"${selectedPost.caption.slice(0, 24)}..."` : 'publicação');

  return (
    <div className="card" style={{ padding: 22, borderTop: '4px solid #E1306C' }}>
      {/* Post Summary Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          paddingBottom: 16,
          borderBottom: '1px solid var(--border-light, #E5E7EB)',
          marginBottom: 18,
          flexWrap: 'wrap',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 260 }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 8,
              background: '#000',
              overflow: 'hidden',
              flexShrink: 0,
            }}
          >
            {selectedPost.thumbnail_url || selectedPost.media_url ? (
              <img
                src={selectedPost.thumbnail_url || selectedPost.media_url}
                alt="Post"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : null}
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#E1306C' }}>
                Regra da Publicação
              </span>
              <span className={`badge ${status === 'ativo' ? 'badge-success' : 'badge-warning'}`}>
                {status === 'ativo' ? 'Ativa' : 'Pausada'}
              </span>
            </div>
            <p
              style={{
                fontSize: 12,
                color: 'var(--text-dark)',
                fontWeight: 600,
                margin: '2px 0 0',
                maxWidth: 400,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {selectedPost.caption || `Post ID ${selectedPost.id}`}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {selectedPost.permalink && (
            <a
              href={selectedPost.permalink}
              target="_blank"
              rel="noreferrer"
              className="btn btn-ghost btn-sm"
              style={{ fontSize: 11 }}
            >
              Ver no Instagram <ExternalLink style={{ width: 11, height: 11 }} />
            </a>
          )}

          {existingRule && (
            <button
              className={`btn btn-sm ${status === 'ativo' ? 'btn-ghost' : 'btn-primary'}`}
              onClick={async () => {
                const next = status === 'ativo' ? 'pausado' : 'ativo';
                if (await onToggleStatus(existingRule.id, next)) setStatus(next);
              }}
              style={{ fontSize: 11 }}
            >
              {status === 'ativo' ? (
                <>
                  <Pause style={{ width: 12, height: 12 }} /> Pausar Regra
                </>
              ) : (
                <>
                  <Play style={{ width: 12, height: 12 }} /> Ativar Regra
                </>
              )}
            </button>
          )}

          {existingRule && (
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => onDeleteRule(existingRule.id)}
              style={{ color: '#DC2626', padding: '6px 10px' }}
              title="Remover regra desta publicação"
            >
              <Trash2 style={{ width: 13, height: 13 }} />
            </button>
          )}
        </div>
      </div>

      {error && (
        <div
          style={{
            background: '#FEF2F2',
            border: '1px solid #FECACA',
            color: '#DC2626',
            borderRadius: 8,
            padding: '8px 12px',
            fontSize: 12,
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <AlertCircle style={{ width: 14, height: 14, flexShrink: 0 }} /> {error}
        </div>
      )}

      {/* Form Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
        {/* Left Column: Keyword, Campaign & Options */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Palavra-chave */}
          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}>
              <Tag style={{ width: 13, height: 13, color: '#E1306C' }} />
              Palavra-chave Gatilho *
            </label>
            <input
              className="form-input"
              placeholder="Ex: QUERO, PREÇO, AGENDAR, PROTOCOLO"
              value={keyword}
              onChange={(e) => {
                setKeyword(e.target.value.toUpperCase());
                setError('');
              }}
              style={{ textTransform: 'uppercase', fontWeight: 700, letterSpacing: 0.5 }}
            />
            <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
              Dispara a resposta privada quando o comentário contiver esta palavra (ignora maiúsculas e acentos).
            </span>
          </div>

          {/* Vínculo de Campanha */}
          <div className="form-group">
            <label className="form-label">Vincular a Campanha de Marketing</label>
            <select
              className="form-select"
              value={campanhaId}
              onChange={(e) => setCampanhaId(e.target.value)}
            >
              <option value="">— Nenhuma / Campanha Geral —</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome} ({c.status})
                </option>
              ))}
            </select>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
              Permite mensurar conversões e associar os comentários a um objetivo estratégico.
            </span>
          </div>

          {/* Toggle CRM */}
          <div
            style={{
              padding: 12,
              background: 'var(--bg-main, #F9FAFB)',
              borderRadius: 8,
              border: '1px solid var(--border-light, #E5E7EB)',
            }}
          >
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', margin: 0 }}>
              <input
                type="checkbox"
                checked={encaminharCrm}
                onChange={(e) => setEncaminharCrm(e.target.checked)}
                style={{ width: 16, height: 16, accentColor: '#E1306C' }}
              />
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-dark)' }}>
                Encaminhar automaticamente ao CRM
              </span>
            </label>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '6px 0 0 26px', lineHeight: 1.4 }}>
              Cadastra o interessado na fila &quot;Responder&quot; da recepção. Não inventa telefone e vincula ao perfil existente caso já cadastrado.
            </p>
          </div>
        </div>

        {/* Right Column: Resposta Privada (DM) com preview */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="form-group" style={{ margin: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <label className="form-label" style={{ margin: 0, fontWeight: 700 }}>
                Resposta Privada (Direct Message) *
              </label>
              <span style={{ fontSize: 11, color: resposta.length > 950 ? '#DC2626' : 'var(--text-muted)' }}>
                {resposta.length}/1000 caracteres
              </span>
            </div>

            {/* Quick Tags */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
                Inserir tag:
              </span>
              {[
                { tag: '{{usuario}}', label: '@usuario' },
                { tag: '{{nome}}', label: 'Nome' },
                { tag: '{{post}}', label: 'Post' },
              ].map((t) => (
                <button
                  key={t.tag}
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => insertTag(t.tag)}
                  style={{ padding: '2px 8px', fontSize: 10, borderRadius: 99, background: 'rgba(225, 48, 108, 0.08)', color: '#E1306C' }}
                >
                  +{t.label}
                </button>
              ))}
            </div>

            <textarea
              className="form-textarea"
              style={{ minHeight: 90, fontSize: 13, lineHeight: 1.5 }}
              placeholder="Digite o texto enviado no Direct de quem comentar a palavra-chave..."
              value={resposta}
              maxLength={1000}
              onChange={(e) => {
                setResposta(e.target.value);
                setError('');
              }}
            />
          </div>

          {/* DM Realistic Balloon Preview */}
          <div style={{ marginTop: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6 }}>
              <Sparkles style={{ width: 11, height: 11, color: '#E1306C' }} /> Preview da mensagem no Direct do Instagram:
            </span>
            <div
              style={{
                background: '#1F2937',
                padding: '12px 14px',
                borderRadius: 12,
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
              }}
            >
              <div
                style={{
                  alignSelf: 'flex-end',
                  maxWidth: '85%',
                  background: 'linear-gradient(135deg, #7C3AED 0%, #E1306C 100%)',
                  color: '#fff',
                  padding: '8px 12px',
                  borderRadius: '16px 16px 4px 16px',
                  fontSize: 12,
                  lineHeight: 1.45,
                }}
              >
                {previewText || 'Sua mensagem aparecerá aqui...'}
              </div>
              <span style={{ alignSelf: 'flex-end', fontSize: 9, color: 'rgba(255,255,255,0.5)', marginRight: 4 }}>
                Agora · Direct Privado
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Seção Resposta Pública */}
      <div style={{ marginTop: 20, padding: 14, borderRadius: 8, border: '1px solid var(--border-light, #E5E7EB)' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>
          <input
            type="checkbox"
            checked={responderComentario}
            disabled={saving}
            onChange={(event) => { setResponderComentario(event.target.checked); setError(''); }}
          />
          Responder também ao comentário
        </label>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
          Publica esta resposta abaixo do comentário somente após a confirmação do envio da DM.
          A resposta ficará visível no Instagram.
        </p>
        {responderComentario && (
          <div className="form-group">
            <label className="form-label" htmlFor="instagram-public-reply">Texto da resposta pública</label>
            <textarea
              id="instagram-public-reply"
              className="form-textarea"
              value={respostaPublica}
              maxLength={500}
              disabled={saving}
              onChange={(event) => { setRespostaPublica(event.target.value); setError(''); }}
              style={{ minHeight: 65 }}
            />
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {respostaPublica.length}/500 caracteres · Aceita emojis e a tag {'{{usuario}}'}.
            </span>
            <div style={{ marginTop: 8, padding: '8px 12px', borderRadius: 8, background: 'var(--bg-main, #F9FAFB)', fontSize: 12 }}>
              <strong>Prévia do comentário: </strong>{publicPreview || 'Digite sua resposta acima.'}
            </div>
          </div>
        )}
      </div>

      {/* Meta Limits & Regulations Note */}
      <div
        style={{
          marginTop: 16,
          padding: '8px 12px',
          background: 'rgba(59, 130, 246, 0.05)',
          border: '1px solid rgba(59, 130, 246, 0.2)',
          borderRadius: 8,
          fontSize: 11,
          color: '#1E40AF',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <Shield style={{ width: 14, height: 14, flexShrink: 0 }} />
        <span>
          <strong>Regulamento Meta Oficial:</strong> A Graph API permite o envio de 1 resposta privada por comentário em até 7 dias da postagem do comentário.
        </span>
      </div>

      {/* Action Footer */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: 20,
          paddingTop: 16,
          borderTop: '1px solid var(--border-light, #E5E7EB)',
          flexWrap: 'wrap',
          gap: 10,
        }}
      >
        <button
          className="btn btn-ghost btn-sm"
          type="button"
          onClick={onOpenTest}
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <FlaskConical style={{ width: 14, height: 14, color: '#8B5CF6' }} />
          Simular e Testar Comentário
        </button>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={saving}
            style={{
              background: 'linear-gradient(135deg, #E1306C 0%, #C13584 100%)',
              borderColor: 'transparent',
              color: '#fff',
            }}
          >
            {saving ? (
              <RefreshCw style={{ width: 14, height: 14, animation: 'spin 1s linear infinite' }} />
            ) : (
              <CheckCircle style={{ width: 14, height: 14 }} />
            )}
            {existingRule ? 'Atualizar Regra' : 'Salvar Regra Pausada'}
          </button>
        </div>
      </div>
    </div>
  );
}
