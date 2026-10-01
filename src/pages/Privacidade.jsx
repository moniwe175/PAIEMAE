import { Link } from 'react-router-dom';

export default function Privacidade() {
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
            <div style={styles.badge}>Política de Privacidade</div>
            <h1 style={styles.h1}>Como usamos seus dados</h1>
            <p style={styles.updated}>Última atualização: {updated}</p>
          </div>

          <div style={styles.card}>
            <h2 style={styles.h2}>1. Quem somos</h2>
            <p style={styles.p}>
              <strong>{company}</strong> é um centro de estética localizado no Brasil. Utilizamos um sistema
              interno de gestão (ERP) que inclui uma integração com o Instagram para responder automaticamente
              a comentários em nossas publicações e organizar o atendimento de clientes interessados.
            </p>
          </div>

          <div style={styles.card}>
            <h2 style={styles.h2}>2. Quais dados coletamos via Instagram</h2>
            <p style={styles.p}>
              Quando você comenta em uma de nossas publicações e a palavra do comentário corresponde a uma
              regra de automação ativa, nosso sistema coleta automaticamente:
            </p>
            <ul style={styles.ul}>
              <li style={styles.li}><strong>Nome de usuário do Instagram</strong> — o @handle público do perfil que comentou.</li>
              <li style={styles.li}><strong>Texto do comentário</strong> — o conteúdo exato da mensagem publicada.</li>
              <li style={styles.li}><strong>Identificadores da publicação</strong> — ID e link da postagem onde o comentário foi feito.</li>
              <li style={styles.li}><strong>Data e horário</strong> — quando o evento foi registrado em nosso sistema.</li>
            </ul>
            <div style={styles.infoBox}>
              <strong>📌 Não coletamos automaticamente:</strong> e-mail, telefone, endereço, data de nascimento,
              localização ou qualquer dado de saúde. O perfil do Instagram pode ser complementado manualmente
              pela nossa equipe de atendimento caso você entre em contato diretamente.
            </div>
          </div>

          <div style={styles.card}>
            <h2 style={styles.h2}>3. Para que usamos esses dados</h2>
            <ul style={styles.ul}>
              <li style={styles.li}>
                <strong>Resposta automática por Direct:</strong> enviar uma mensagem privada oferecendo
                informações sobre o serviço de interesse identificado no comentário.
              </li>
              <li style={styles.li}>
                <strong>Organização do atendimento:</strong> registrar o interesse no nosso sistema interno de
                CRM para que nossa equipe possa entrar em contato e agendar atendimento.
              </li>
              <li style={styles.li}>
                <strong>Histórico de automação:</strong> manter registro dos comentários processados para
                evitar duplicação de mensagens e auditar o funcionamento da integração.
              </li>
            </ul>
            <p style={styles.p}>
              Os dados <strong>não são vendidos, repassados a terceiros, usados para publicidade ou
              compartilhados</strong> fora do contexto de atendimento ao cliente da {company}.
            </p>
          </div>

          <div style={styles.card}>
            <h2 style={styles.h2}>4. Onde os dados ficam armazenados</h2>
            <p style={styles.p}>
              Os dados são armazenados no <strong>Supabase</strong> (banco de dados em nuvem com servidores
              na região South America, Brasil). O acesso às tabelas do Instagram é restrito ao backend do
              sistema — nunca exposto diretamente ao navegador — e protegido por políticas de segurança em
              nível de linha (Row Level Security).
            </p>
          </div>

          <div style={styles.card}>
            <h2 style={styles.h2}>5. Por quanto tempo os dados são mantidos</h2>
            <p style={styles.p}>
              Os registros de comentários e leads de Instagram são mantidos enquanto forem úteis para o
              atendimento. Você pode solicitar a exclusão a qualquer momento (ver seção abaixo).
              Dados de leads sem continuidade de atendimento são revisados periodicamente pela nossa equipe.
            </p>
          </div>

          <div style={styles.card}>
            <h2 style={styles.h2}>6. Seus direitos</h2>
            <p style={styles.p}>Em conformidade com a Lei Geral de Proteção de Dados (LGPD — Lei 13.709/2018), você tem direito a:</p>
            <ul style={styles.ul}>
              <li style={styles.li}>Saber quais dados temos sobre você</li>
              <li style={styles.li}>Solicitar correção de dados incorretos</li>
              <li style={styles.li}>Solicitar exclusão dos seus dados</li>
              <li style={styles.li}>Revogar seu interesse a qualquer momento</li>
            </ul>
            <p style={styles.p}>
              Para exercer qualquer um desses direitos, envie um e-mail para{' '}
              <a href={`mailto:${contact}`} style={styles.link}>{contact}</a> identificando
              seu @username do Instagram.
            </p>
          </div>

          <div style={styles.card}>
            <h2 style={styles.h2}>7. Base legal para o tratamento</h2>
            <p style={styles.p}>
              O tratamento dos dados de comentários públicos do Instagram ocorre com base no <strong>legítimo
              interesse</strong> da empresa em responder a manifestações de interesse feitas publicamente em
              nossas publicações (LGPD, art. 7º, IX), limitado ao estrito necessário para o atendimento
              solicitado.
            </p>
          </div>

          <div style={styles.card}>
            <h2 style={styles.h2}>8. Contato</h2>
            <p style={styles.p}>
              Para dúvidas sobre esta política ou para exercer seus direitos:
            </p>
            <p style={styles.p}>
              📧 <a href={`mailto:${contact}`} style={styles.link}>{contact}</a>
            </p>
            <p style={styles.p}>
              Respondemos em até 5 dias úteis.
            </p>
          </div>

          <div style={styles.footerLinks}>
            <Link to="/termos" style={styles.link}>Termos de Uso</Link>
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
  surfaceHover: '#221e20',
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
    transition: 'color 0.2s',
  },
  main: {
    flex: 1,
    padding: '48px 20px',
  },
  container: {
    maxWidth: 760,
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 24,
  },
  hero: {
    textAlign: 'center',
    paddingBottom: 8,
  },
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
    fontSize: 36,
    fontWeight: 800,
    margin: '0 0 12px',
    letterSpacing: '-0.8px',
    background: `linear-gradient(135deg, ${colors.text} 0%, ${colors.accent} 100%)`,
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },
  updated: {
    color: colors.textSub,
    fontSize: 13,
    margin: 0,
  },
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
  p: {
    color: colors.textMuted,
    lineHeight: 1.75,
    margin: '0 0 12px',
    fontSize: 15,
  },
  ul: {
    paddingLeft: 20,
    margin: '0 0 16px',
  },
  li: {
    color: colors.textMuted,
    lineHeight: 1.75,
    marginBottom: 8,
    fontSize: 15,
  },
  infoBox: {
    background: colors.info,
    border: `1px solid ${colors.accent}22`,
    borderRadius: 10,
    padding: '14px 18px',
    fontSize: 14,
    color: colors.textMuted,
    lineHeight: 1.65,
  },
  link: {
    color: colors.accent,
    textDecoration: 'none',
  },
  footerLinks: {
    textAlign: 'center',
    fontSize: 14,
    color: colors.textSub,
  },
  footer: {
    textAlign: 'center',
    padding: '24px',
    color: colors.textSub,
    fontSize: 13,
    borderTop: `1px solid ${colors.border}`,
  },
};
