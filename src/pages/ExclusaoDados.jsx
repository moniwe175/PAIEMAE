import { Link } from 'react-router-dom';

export default function ExclusaoDados() {
  const contact = 'iurycauamjesus@gmail.com';
  const company = 'Evelyn Esthetic Center';

  return (
    <div style={styles.page}>
      <nav style={styles.nav}>
        <span style={styles.logo}>Evelyn Esthetic Center</span>
        <div style={styles.navLinks}>
          <Link to="/privacidade" style={styles.navLink}>Privacidade</Link>
          <Link to="/termos" style={styles.navLink}>Termos de Uso</Link>
          <Link to="/exclusao-dados" style={styles.navLink}>Exclusão de Dados</Link>
        </div>
      </nav>

      <main style={styles.main}>
        <div style={styles.container}>
          <div style={styles.hero}>
            <div style={styles.badge}>Exclusão de Dados</div>
            <h1 style={styles.h1}>Solicite a remoção dos seus dados</h1>
            <p style={styles.sub}>
              Conforme a LGPD (Lei 13.709/2018) e as políticas da Meta Platforms,
              você pode solicitar a exclusão de qualquer dado que a {company} armazenou
              a seu respeito.
            </p>
          </div>

          {/* Caixa de destaque — o que realmente armazenamos */}
          <div style={styles.highlightCard}>
            <h2 style={styles.h2white}>O que armazenamos sobre você</h2>
            <p style={styles.pLight}>
              Se você comentou em uma publicação da {company} no Instagram e o comentário
              acionou nossa automação, podemos ter registrado:
            </p>
            <div style={styles.dataGrid}>
              {[
                { icon: '👤', label: '@username do Instagram', desc: 'Nome de usuário público do perfil' },
                { icon: '💬', label: 'Texto do comentário', desc: 'Conteúdo exato do comentário publicado' },
                { icon: '🔗', label: 'ID e link da publicação', desc: 'Identificador da postagem onde comentou' },
                { icon: '🕐', label: 'Data e hora', desc: 'Momento em que o evento foi processado' },
              ].map((item) => (
                <div key={item.label} style={styles.dataItem}>
                  <span style={styles.dataIcon}>{item.icon}</span>
                  <div>
                    <div style={styles.dataLabel}>{item.label}</div>
                    <div style={styles.dataDesc}>{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Passo a passo */}
          <div style={styles.card}>
            <h2 style={styles.h2}>Como solicitar a exclusão</h2>
            <p style={styles.p}>
              Envie um e-mail para <a href={`mailto:${contact}`} style={styles.link}>{contact}</a> com
              o assunto <strong>"Exclusão de dados — Instagram"</strong> e inclua:
            </p>
            <ol style={styles.ol}>
              <li style={styles.li}>
                <strong>Seu @username do Instagram</strong> (ex: @seuusuario) — necessário para
                localizar os registros, já que não armazenamos outros identificadores automaticamente.
              </li>
              <li style={styles.li}>
                <strong>O que deseja excluir:</strong>
                <ul style={styles.ul}>
                  <li style={styles.liSub}>Todos os registros associados ao seu @username</li>
                  <li style={styles.liSub}>Apenas o histórico de um comentário específico</li>
                  <li style={styles.liSub}>Seu cadastro no nosso sistema de atendimento (CRM)</li>
                </ul>
              </li>
            </ol>

            <div style={styles.infoBox}>
              <strong>⏱️ Prazo de resposta:</strong> Processamos as solicitações em até{' '}
              <strong>5 dias úteis</strong>. Enviaremos uma confirmação por e-mail quando a exclusão
              for concluída.
            </div>
          </div>

          {/* O que acontece após a exclusão */}
          <div style={styles.card}>
            <h2 style={styles.h2}>O que acontece após a solicitação</h2>
            <ul style={styles.ul}>
              <li style={styles.li}>
                Removemos o seu @username e os dados associados das tabelas internas do sistema.
              </li>
              <li style={styles.li}>
                Caso haja um cadastro no nosso sistema de atendimento (CRM), ele também é excluído
                ou anonimizado, a não ser que exista obrigação legal de retenção (ex: nota fiscal emitida).
              </li>
              <li style={styles.li}>
                A exclusão <strong>não apaga comentários feitos no Instagram</strong> — esses ficam
                sob controle da plataforma Meta. Para remover comentários, acesse diretamente
                sua conta no Instagram.
              </li>
              <li style={styles.li}>
                Após a exclusão, futuros comentários seus poderão acionar novamente a automação,
                pois os dados são registrados a partir de cada novo evento.
              </li>
            </ul>
          </div>

          {/* Para a Meta */}
          <div style={styles.card}>
            <h2 style={styles.h2}>Usuários que chegaram via Facebook Login</h2>
            <p style={styles.p}>
              A integração da {company} usa apenas dados de comentários públicos do Instagram.
              Não realizamos autenticação de usuários finais via Facebook Login — o login é
              exclusivo da equipe interna da empresa.
            </p>
            <p style={styles.p}>
              Caso a Meta direcione você a esta página após uma solicitação de exclusão de dados
              de aplicativo conectado, use o e-mail abaixo para confirmar a remoção:
            </p>
            <p style={styles.p}>
              📧 <a href={`mailto:${contact}`} style={styles.link}>{contact}</a>
            </p>
          </div>

          <div style={styles.footerLinks}>
            <Link to="/privacidade" style={styles.link}>Política de Privacidade</Link>
            {' · '}
            <Link to="/termos" style={styles.link}>Termos de Uso</Link>
          </div>
        </div>
      </main>

      <footer style={styles.footer}>
        © {new Date().getFullYear()} {company} · Todos os direitos reservados
      </footer>
    </div>
  );
}

const colors = {
  bg: '#0f0d0e',
  surface: '#1a1618',
  accent: '#c8a97e',
  accentSoft: 'rgba(200,169,126,0.12)',
  accentDeep: 'rgba(200,169,126,0.06)',
  border: '#2e2829',
  text: '#f0ebe8',
  textMuted: '#9b908d',
  textSub: '#6b605e',
  info: 'rgba(200,169,126,0.08)',
};

const styles = {
  page: {
    minHeight: '100vh',
    background: colors.bg,
    color: colors.text,
    fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
    display: 'flex',
    flexDirection: 'column',
  },
  nav: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 40px',
    borderBottom: `1px solid ${colors.border}`,
    background: colors.surface,
    flexWrap: 'wrap',
    gap: 12,
  },
  logo: { fontSize: 18, fontWeight: 700, color: colors.accent, letterSpacing: '-0.3px' },
  navLinks: { display: 'flex', gap: 24, flexWrap: 'wrap' },
  navLink: { color: colors.textMuted, textDecoration: 'none', fontSize: 14 },
  main: { flex: 1, padding: '48px 20px' },
  container: {
    maxWidth: 760,
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 24,
  },
  hero: { textAlign: 'center', paddingBottom: 8 },
  badge: {
    display: 'inline-block',
    background: colors.accentSoft,
    color: colors.accent,
    border: `1px solid ${colors.accent}33`,
    borderRadius: 999,
    padding: '4px 16px',
    fontSize: 13,
    fontWeight: 600,
    marginBottom: 16,
    letterSpacing: 0.5,
  },
  h1: {
    fontSize: 34,
    fontWeight: 800,
    margin: '0 0 12px',
    letterSpacing: '-0.8px',
    background: `linear-gradient(135deg, ${colors.text} 0%, ${colors.accent} 100%)`,
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },
  sub: { color: colors.textMuted, fontSize: 15, lineHeight: 1.7, maxWidth: 560, margin: '0 auto' },
  highlightCard: {
    background: `linear-gradient(135deg, #1e1a1b 0%, #221e1f 100%)`,
    border: `1px solid ${colors.accent}33`,
    borderRadius: 16,
    padding: '28px 32px',
  },
  h2white: { fontSize: 18, fontWeight: 700, color: colors.text, margin: '0 0 12px' },
  pLight: { color: colors.textMuted, lineHeight: 1.7, margin: '0 0 20px', fontSize: 15 },
  dataGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: 12,
  },
  dataItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 12,
    background: colors.accentDeep,
    border: `1px solid ${colors.border}`,
    borderRadius: 10,
    padding: '12px 16px',
  },
  dataIcon: { fontSize: 20, lineHeight: 1, marginTop: 2, flexShrink: 0 },
  dataLabel: { color: colors.text, fontWeight: 600, fontSize: 14, marginBottom: 2 },
  dataDesc: { color: colors.textSub, fontSize: 13 },
  card: {
    background: colors.surface,
    border: `1px solid ${colors.border}`,
    borderRadius: 16,
    padding: '28px 32px',
  },
  h2: { fontSize: 18, fontWeight: 700, color: colors.accent, margin: '0 0 16px', letterSpacing: '-0.3px' },
  p: { color: colors.textMuted, lineHeight: 1.75, margin: '0 0 12px', fontSize: 15 },
  ol: { paddingLeft: 20, margin: '0 0 16px' },
  ul: { paddingLeft: 20, margin: '8px 0 0' },
  li: { color: colors.textMuted, lineHeight: 1.75, marginBottom: 10, fontSize: 15 },
  liSub: { color: colors.textMuted, lineHeight: 1.7, marginBottom: 6, fontSize: 14 },
  infoBox: {
    background: colors.info,
    border: `1px solid ${colors.accent}22`,
    borderRadius: 10,
    padding: '14px 18px',
    fontSize: 14,
    color: colors.textMuted,
    lineHeight: 1.65,
    marginTop: 16,
  },
  link: { color: colors.accent, textDecoration: 'none' },
  footerLinks: { textAlign: 'center', fontSize: 14, color: colors.textSub },
  footer: {
    textAlign: 'center',
    padding: '24px',
    color: colors.textSub,
    fontSize: 13,
    borderTop: `1px solid ${colors.border}`,
  },
};
