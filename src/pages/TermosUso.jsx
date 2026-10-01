import { Link } from 'react-router-dom';

export default function TermosUso() {
  const updated = '01 de outubro de 2025';
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
            <div style={styles.badge}>Termos de Uso</div>
            <h1 style={styles.h1}>Condições de uso da integração Instagram</h1>
            <p style={styles.updated}>Última atualização: {updated}</p>
          </div>

          <div style={styles.card}>
            <h2 style={styles.h2}>1. Sobre esta integração</h2>
            <p style={styles.p}>
              A <strong>{company}</strong> utiliza uma integração com a plataforma Instagram (Meta Platforms)
              para automatizar o atendimento inicial a clientes que demonstram interesse em nossos serviços
              por meio de comentários em nossas publicações.
            </p>
            <p style={styles.p}>
              Esta integração opera exclusivamente em nossa conta profissional do Instagram e é autorizada
              por nós junto à Meta Platforms como controladora dos dados.
            </p>
          </div>

          <div style={styles.card}>
            <h2 style={styles.h2}>2. O que a automação faz</h2>
            <ul style={styles.ul}>
              <li style={styles.li}>
                Monitora comentários nas publicações da <strong>{company}</strong> no Instagram.
              </li>
              <li style={styles.li}>
                Quando um comentário contém uma palavra-chave configurada, envia automaticamente
                uma <strong>mensagem privada (Direct)</strong> com informações sobre o serviço de interesse.
              </li>
              <li style={styles.li}>
                Registra o interesse internamente para que nossa equipe de atendimento possa dar
                seguimento ao contato.
              </li>
            </ul>
            <div style={styles.infoBox}>
              <strong>ℹ️ Ação publicamente visível:</strong> a mensagem automática é enviada via
              Direct (mensagem privada). Nenhuma resposta pública é feita automaticamente em nome
              da empresa sem revisão humana.
            </div>
          </div>

          <div style={styles.card}>
            <h2 style={styles.h2}>3. Uso aceitável</h2>
            <p style={styles.p}>
              Ao comentar em nossas publicações no Instagram, você reconhece que:
            </p>
            <ul style={styles.ul}>
              <li style={styles.li}>
                Comentários públicos são visíveis a qualquer pessoa que acesse a publicação,
                de acordo com as políticas do Instagram/Meta.
              </li>
              <li style={styles.li}>
                Comentários que contenham palavras-chave de automação ativas podem resultar
                no recebimento de uma mensagem automática da {company} via Direct.
              </li>
              <li style={styles.li}>
                Caso não deseje receber mensagens automáticas, basta não responder ao Direct
                ou solicitar a remoção do seu contato pelo e-mail indicado nesta página.
              </li>
            </ul>
          </div>

          <div style={styles.card}>
            <h2 style={styles.h2}>4. Limitações</h2>
            <p style={styles.p}>
              A {company} não se responsabiliza por:
            </p>
            <ul style={styles.ul}>
              <li style={styles.li}>Interrupções na integração causadas pela plataforma Meta/Instagram.</li>
              <li style={styles.li}>Comentários que não acionem a automação por indisponibilidade técnica.</li>
              <li style={styles.li}>Conteúdo de comentários feitos por terceiros em nossas publicações.</li>
            </ul>
          </div>

          <div style={styles.card}>
            <h2 style={styles.h2}>5. Alterações nestes termos</h2>
            <p style={styles.p}>
              Podemos atualizar estes termos periodicamente. A data de atualização será revisada
              no topo desta página. O uso contínuo dos nossos canais após alterações implica
              concordância com os novos termos.
            </p>
          </div>

          <div style={styles.card}>
            <h2 style={styles.h2}>6. Contato</h2>
            <p style={styles.p}>
              Dúvidas sobre estes termos ou sobre o funcionamento da automação:
            </p>
            <p style={styles.p}>
              📧 <a href={`mailto:${contact}`} style={styles.link}>{contact}</a>
            </p>
          </div>

          <div style={styles.footerLinks}>
            <Link to="/privacidade" style={styles.link}>Política de Privacidade</Link>
            {' · '}
            <Link to="/exclusao-dados" style={styles.link}>Exclusão de Dados</Link>
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
  border: '#2e2829',
  accent: '#c8a97e',
  accentSoft: 'rgba(200,169,126,0.12)',
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
  logo: {
    fontSize: 18,
    fontWeight: 700,
    color: colors.accent,
    letterSpacing: '-0.3px',
  },
  navLinks: {
    display: 'flex',
    gap: 24,
    flexWrap: 'wrap',
  },
  navLink: {
    color: colors.textMuted,
    textDecoration: 'none',
    fontSize: 14,
  },
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
  updated: { color: colors.textSub, fontSize: 13, margin: 0 },
  card: {
    background: colors.surface,
    border: `1px solid ${colors.border}`,
    borderRadius: 16,
    padding: '28px 32px',
  },
  h2: {
    fontSize: 18,
    fontWeight: 700,
    color: colors.accent,
    margin: '0 0 16px',
    letterSpacing: '-0.3px',
  },
  p: { color: colors.textMuted, lineHeight: 1.75, margin: '0 0 12px', fontSize: 15 },
  ul: { paddingLeft: 20, margin: '0 0 16px' },
  li: { color: colors.textMuted, lineHeight: 1.75, marginBottom: 8, fontSize: 15 },
  infoBox: {
    background: colors.info,
    border: `1px solid ${colors.accent}22`,
    borderRadius: 10,
    padding: '14px 18px',
    fontSize: 14,
    color: colors.textMuted,
    lineHeight: 1.65,
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
