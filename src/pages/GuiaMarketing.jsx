import { useState, useEffect, useCallback } from 'react';
import {
  BookOpen, Zap, Database, RefreshCw, Loader2, MessageSquare,
  Clock, AlertTriangle, Calendar, Radio, Shield, Timer, Eye,
  ChevronDown, ChevronRight, Server, Smartphone, ToggleRight
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { fetchTemplates, fetchQueuePendingCount } from '../services/supabaseService';

// ═══════════════════════════════════════════════════════════════
// DADOS — As 19 ferramentas do motor (fonte: rules.py / api/marketing-engine.js)
// ═══════════════════════════════════════════════════════════════

const FERRAMENTAS = [
  { id: 1, nome: 'Lembrete 24h', grupo: 'A', gatilho: 'Consulta agendada para AMANHÃ com status ativo.', le: ['appointments'], escreve: 'approved', janela: '24h', tags: ['nome_paciente', 'nome_profissional', 'hora_consulta', 'data_consulta'], obs: 'É a ferramenta que mais evita faltas: a paciente recebe o lembrete no dia anterior, sem ninguém precisar lembrar de enviar.', passos: ['1. O motor procura em appointments todas as consultas de amanhã com status ativo (agendado, confirmado, aguardando confirmação...).', '2. Descarta as que não têm cliente vinculado (client_id) ou telefone.', '3. Checa a idempotência: já disparou lembrete 24h para essa cliente nas últimas 24h? Se sim, pula.', '4. Pega o texto em message_templates, preenche as tags com os dados da consulta e insere na marketing_queue já como approved.', '5. O worker do WhatsApp envia em até 30 segundos.'] },
  { id: 2, nome: 'Lembrete 2h', grupo: 'A', gatilho: 'Consulta de hoje cujo horário está a ~2h de distância (janela ±5min).', le: ['appointments'], escreve: 'approved', janela: '4h', tags: ['nome_paciente', 'nome_profissional', 'hora_consulta'], obs: 'O motor compara o relógio atual com o horário de cada consulta de hoje: só entram as que caem entre 1h55 e 2h05 à frente.', passos: ['1. Lista as consultas de HOJE com status ativo.', '2. Para cada uma, calcula: horário da consulta − agora está entre 1h55min e 2h05min?', '3. Quem cair fora da janela é ignorado (vai ser pega num ciclo futuro ou já passou).', '4. Idempotência de 4h evita reenvio se o motor rodar duas vezes seguido.', '5. Mensagem entra approved e o worker dispara.'] },
  { id: 3, nome: 'Alerta de Atraso 15min', grupo: 'A', gatilho: 'Paciente ainda não chegou 10–20min após o horário da consulta.', le: ['appointments'], escreve: 'approved', janela: '2h', tags: ['nome_paciente', 'hora_consulta'], obs: '⏱ Tem Regra de Vencimento: expires_at = horário da consulta + 1h. Se o worker só for enviar depois disso, marca expired em vez de mandar mensagem velha.', passos: ['1. Procura consultas de hoje cujo horário ficou 10 a 20 minutos NO PASSADO e continuam com status ativo (ou seja: ninguém marcou "em atendimento").', '2. Verifica idempotência de 2h.', '3. Insere na fila como approved, mas com expires_at = horário + 1 hora.', '4. Quando o worker pega a mensagem, ele confere: passou do expires_at? Então vira expired e não envia — avisar de atraso 3h depois não faz sentido.'] },
  { id: 4, nome: 'No-Show 24h', grupo: 'A', gatilho: 'Consultas de ONTEM com status cliente_faltou / no_show.', le: ['appointments'], escreve: 'approved', janela: '24h', tags: ['nome_paciente', 'hora_consulta'], obs: 'Mensagem de reaproximação suave — convida a remarcar sem tom de cobrança.', passos: ['1. Busca as consultas de ONTEM cujo status foi marcado como cliente_faltou.', '2. Idempotência de 24h garante um único disparo por falta.', '3. Entra approved e é enviada automaticamente.'] },
  { id: 5, nome: 'Feliz Aniversário', grupo: 'A', gatilho: 'Clientes com aniversário HOJE (dia/mês do birthdate).', le: ['clients'], escreve: 'approved', janela: '24h', tags: ['nome_paciente'], obs: 'Respeita LGPD: clientes com whatsapp_opt_out = true nunca recebem.', passos: ['1. Varre a tabela clients: status ativo, nascimento preenchido e opt-out desligado.', '2. Compara dia e mês do aniversário com a data de hoje.', '3. Quem faz aniversário hoje e ainda não recebeu (janela 24h) ganha a mensagem approved.'] },
  { id: 6, nome: 'Boas-Vindas & Prova Social', grupo: 'A', gatilho: 'Cliente com exatamente 1 consulta concluída (primeira visita), nas últimas 2h.', le: ['appointments', 'integration_configs'], escreve: 'approved', janela: '24h', tags: ['nome_paciente', 'link_google'], obs: 'O link da avaliação vem de integration_configs (chave google_review_link) — configure na aba Integrações.', passos: ['1. Acha consultas que viraram "finalizado" nas últimas 2 horas.', '2. Para cada uma, conta quantas consultas concluídas aquela cliente tem no total.', '3. Só segue se a contagem for EXATAMENTE 1 — é a primeira visita dela.', '4. Renderiza o template com o link do Google e insere approved: a cliente sai da clínica já recebendo o pedido de avaliação.'] },
  { id: 7, nome: 'Confirmação de Agendamento', grupo: 'A', gatilho: 'Agendamentos criados nos últimos 30 minutos.', le: ['appointments'], escreve: 'approved', janela: '1h', tags: ['nome_paciente', 'nome_servico', 'nome_profissional', 'data_consulta', 'hora_consulta'], obs: 'Disparo imediato: marcou no sistema, a cliente recebe a confirmação na hora.', passos: ['1. Filtra appointments com created_at nos últimos 30 minutos e status ativo.', '2. Idempotência curta (1h) porque o motor roda a cada 15–30 min.', '3. Mensagem com todos os detalhes (serviço, profissional, data e hora) entra approved.'] },
  { id: 8, nome: 'Pré-Procedimento', grupo: 'A', gatilho: 'Consulta AMANHÃ de serviço com exige_preparo = true.', le: ['servicos', 'appointments'], escreve: 'approved', janela: '24h', tags: ['nome_paciente', 'nome_servico'], obs: 'Você liga a flag exige_preparo no cadastro do Serviço — a partir daí toda consulta dele amanhã recebe orientações.', passos: ['1. Lê em servicos quais procedimentos têm exige_preparo = true.', '2. Cruza com as consultas de AMANHÃ: o nome do procedimento bate com a lista de preparo?', '3. Se sim, envia as orientações (pele limpa, sem maquiagem...) como approved.'] },
  { id: 9, nome: 'Pós-Procedimento', grupo: 'A', gatilho: 'Consulta concluída ONTEM de serviço com exige_pos_procedimento = true.', le: ['servicos', 'appointments'], escreve: 'approved', janela: '24h', tags: ['nome_paciente', 'nome_servico'], obs: 'Mesma lógica da 8, mas no dia seguinte: cuidados pós (protetor solar, evitar calor...).', passos: ['1. Lê em servicos quais têm exige_pos_procedimento = true.', '2. Cruza com consultas de ONTEM que foram finalizadas.', '3. Manda as dicas de cuidado como approved — mostra atenção e reduz complicações.'] },
  { id: 10, nome: 'Lembrete de Exames', grupo: 'A', gatilho: 'Consulta amanhã com flag exames_pendentes = true.', le: ['appointments'], escreve: 'approved', janela: '7 dias', tags: ['nome_paciente'], obs: 'A recepcionista marca o flag exames_pendentes no agendamento quando falta resultado.', passos: ['1. Procura consultas de amanhã com exames_pendentes = true.', '2. Janela anti-repetição maior (7 dias) para não insistir todo dia no mesmo exame.', '3. Mensagem approved lembrando de trazer os resultados.'] },
  { id: 11, nome: 'NPS / Pesquisa', grupo: 'A', gatilho: 'Consulta concluída há 3 dias (NPS_DIAS_APOS_CONSULTA).', le: ['appointments'], escreve: 'approved', janela: '7 dias', tags: ['nome_paciente'], obs: 'O intervalo de 3 dias dá tempo de a cliente sentir o resultado antes de avaliar.', passos: ['1. Calcula a data-alvo: hoje − 3 dias.', '2. Busca consultas finalizadas exatamente nessa data.', '3. Envia a pergunta 0–10 como approved. A resposta chega direto no WhatsApp da clínica.'] },
  { id: 12, nome: 'Recuperação de Orçamento', grupo: 'B', gatilho: 'Orçamento pendente há mais de 7 dias sem conversão.', le: ['orcamentos', 'servicos', 'clients'], escreve: 'pending', janela: '7 dias', tags: ['nome_paciente', 'nome_servico'], obs: '⏸ Pausada automaticamente: enquanto a tabela orcamentos não existir no sistema, ela roda sem gerar nada.', passos: ['1. Tenta ler a tabela orcamentos procurando registros pendentes com mais de 7 dias.', '2. Se a tabela não existir ainda, a ferramenta se auto-pausa (sem erro).', '3. Quando existir: monta a mensagem com o nome do serviço orçado e insere como pending.', '4. A recepcionista revisa na fila antes do envio — pode personalizar condições especiais.'] },
  { id: 13, nome: 'Inativo 30 dias', grupo: 'B', gatilho: 'Cliente cuja last_visit completou exatamente 30 dias.', le: ['clients'], escreve: 'pending', janela: '30 dias', tags: ['nome_paciente'], obs: 'last_visit não é digitada em lugar nenhum: um trigger recalcula sozinha toda vez que uma consulta é finalizada.', passos: ['1. Olha clients com status ativo e last_visit entre 30 e 31 dias atrás — ou seja, que completaram 30 dias HOJE.', '2. Filtra opt-out e telefone preenchido.', '3. Janela de 30 dias impede repetir a mesma cobrança de saudade.', '4. Entra como pending: a recepcionista aprova (ou descarta se souber que a cliente já voltou).'] },
  { id: 14, nome: 'Inativo 90 dias', grupo: 'B', gatilho: 'Cliente cuja last_visit completou exatamente 90 dias.', le: ['clients'], escreve: 'pending', janela: '90 dias', tags: ['nome_paciente'], obs: 'Win-back mais forte: oferece condição especial para o retorno.', passos: ['1. Mesma mecânica da 13, mas com a janela de 90/91 dias.', '2. Como a cliente sumiu por 3 meses, o texto já traz um incentivo de retorno.', '3. Entra pending para revisão humana — mensagem sensível, merece olhar da equipe.'] },
  { id: 15, nome: 'Pacote Próximo do Fim', grupo: 'B', gatilho: 'Cliente com 1 ou 2 sessões restantes no pacote (servicos.sessoes_pacote).', le: ['servicos', 'appointments'], escreve: 'pending', janela: '30 dias', tags: ['nome_paciente', 'nome_servico', 'sessoes_restantes'], obs: 'Momento de ouro comercial: a renovação é oferecida ANTES de o pacote acabar.', passos: ['1. Lê em servicos quais têm sessoes_pacote definido (ex.: 10 sessões).', '2. Para cada serviço, conta quantas consultas finalizadas cada cliente já fez nele.', '3. Calcula: restantes = sessões do pacote − sessões feitas.', '4. Se sobraram 1 ou 2 sessões, gera a mensagem com {{sessoes_restantes}} como pending.', '5. A recepcionista aprova e já pode engatar a oferta de renovação.'] },
  { id: 16, nome: 'Retorno Inteligente', grupo: 'B', gatilho: 'Hoje = data da consulta + servicos.dias_para_retorno.', le: ['servicos', 'appointments'], escreve: 'pending', janela: '30 dias', tags: ['nome_paciente', 'nome_servico', 'dias_retorno'], obs: '⏱ Cronômetro imutável: o prazo é calculado pelas DATAS das consultas. Editar o template não reinicia nem atrasa nada.', passos: ['1. Lê em servicos o dias_para_retorno de cada procedimento (ex.: Botox = 120, limpeza de pele = 30).', '2. Para cada serviço, calcula a data-base: hoje − dias_para_retorno.', '3. Busca consultas finalizadas exatamente nessa data-base.', '4. Quem chegou no prazo biológico ideal recebe o convite de retorno — como pending, para a equipe validar.'] },
  { id: 17, nome: 'Recuperação de Cancelamento', grupo: 'B', gatilho: 'Cancelou há 3 dias e NÃO reagendou depois.', le: ['appointments'], escreve: 'pending', janela: '72h', tags: ['nome_paciente'], obs: 'Se a cliente cancelou mas já remarcou depois, a ferramenta percebe e NÃO envia nada.', passos: ['1. Encontra consultas canceladas há exatamente 3 dias (CANCELAMENTO_DIAS).', '2. Para cada cliente, verifica se existe algum agendamento ativo criado depois do cancelamento.', '3. Se reagendou → pula. Se não → mensagem convidando a remarcar, como pending.'] },
  { id: 18, nome: 'Upgrade / Cross-sell', grupo: 'B', gatilho: 'Consulta concluída há 14 dias (CROSSSELL_DIAS_APOS).', le: ['appointments'], escreve: 'pending', janela: '14 dias', tags: ['nome_paciente', 'nome_servico'], obs: 'A sugestão de procedimento complementar é personalizada pela recepcionista antes do envio.', passos: ['1. Calcula a data-alvo: hoje − 14 dias.', '2. Busca consultas finalizadas nessa data.', '3. Gera o rascunho como pending — a recepcionista edita sugerindo o complemento ideal para aquele tratamento.'] },
  { id: 19, nome: 'Data Comemorativa', grupo: 'B', gatilho: 'Calendário fixo: 08/03, 12/05, 12/06, 12/10 e 25/12.', le: ['clients'], escreve: 'pending', janela: '365 dias', tags: ['nome_paciente'], obs: 'Datas atuais: Dia da Mulher, Dia das Mães, Dia dos Namorados, Dia das Crianças e Natal.', passos: ['1. Checa se hoje é uma das datas do calendário interno do motor.', '2. Se for, seleciona TODOS os clientes ativos com telefone e pelo menos 1 visita (e sem opt-out).', '3. Janela de 365 dias garante uma mensagem por ano por data.', '4. Tudo entra como pending para a equipe aprovar o lote — envio em massa sempre com olho humano.'] },
];

// ═══════════════════════════════════════════════════════════════
// DADOS — Tabelas do banco usadas pelo marketing
// ═══════════════════════════════════════════════════════════════

const TABELAS = [
  {
    nome: 'message_templates', papel: 'O "texto" das 19 ferramentas',
    desc: 'Uma linha por ferramenta (tool_id 1–19). O motor NUNCA tem texto fixo: no momento do gatilho ele faz SELECT aqui e renderiza as tags {{nome_paciente}}, {{hora_consulta}}, etc. Editar aqui (aba Motor → Ferramentas) vale na hora, sem reiniciar nenhum cronômetro.',
    quem: [{ q: 'Site (Motor)', o: 'lê e edita' }, { q: 'Motor (Vercel)', o: 'lê a cada ciclo' }],
  },
  {
    nome: 'marketing_queue', papel: 'A fila unificada de mensagens',
    desc: 'Coração do fluxo: o motor INSERE, a recepcionista APROVA (Grupo B) e o worker do WhatsApp LÊ e envia. Guarda a mensagem já renderizada, status, scheduled_at, expires_at, quem aprovou e quando enviou.',
    quem: [{ q: 'Motor (Vercel)', o: 'insere' }, { q: 'Site (Motor → Fila)', o: 'aprova/descarta' }, { q: 'Worker WhatsApp', o: 'lê, envia e atualiza' }],
  },
  {
    nome: 'marketing_log', papel: 'Auditoria por ciclo',
    desc: 'Toda vez que cada ferramenta roda, grava uma linha: quantas mensagens gerou, quantas inseriu e se deu erro. É o "raio-X" para saber se o motor está vivo e saudável.',
    quem: [{ q: 'Motor (Vercel)', o: 'insere a cada ciclo' }],
  },
  {
    nome: 'whatsapp_connection_status', papel: 'Status da conexão WhatsApp',
    desc: 'Sempre 1 linha (id=1). O worker escreve o status (disconnected / connecting / qr_ready / connected) e o QR Code em base64. O site lê via Realtime e mostra o QR na aba Integrações — sem precisar olhar terminal.',
    quem: [{ q: 'Worker WhatsApp', o: 'escreve (heartbeat a cada 30s)' }, { q: 'Site (Integrações)', o: 'lê via Realtime' }],
  },
  {
    nome: 'marketing_engine_settings', papel: 'Interruptor geral do motor',
    desc: '1 linha com enabled = true/false. Se desligar no painel, o próximo ciclo do motor pula tudo sem precisar parar nenhum processo.',
    quem: [{ q: 'Site', o: 'liga/desliga' }, { q: 'Motor (Vercel)', o: 'lê antes de cada ciclo' }],
  },
  {
    nome: 'integration_configs', papel: 'Configurações globais da clínica',
    desc: 'Chave/valor: google_review_link (usado na Boas-Vindas), instagram_link e clinic_name. Qualquer ferramenta lê daqui, e você edita sem tocar em código.',
    quem: [{ q: 'Site (Integrações)', o: 'edita' }, { q: 'Motor (Vercel)', o: 'lê' }],
  },
  {
    nome: 'vw_queue_pending', papel: 'Visão para aprovação do Grupo B',
    desc: 'VIEW (não tabela) que junta marketing_queue + message_templates mostrando só o que está pending, com o template original ao lado para a recepcionista comparar antes de aprovar.',
    quem: [{ q: 'Site (Motor → Fila)', o: 'lê' }],
  },
  {
    nome: 'campaigns', papel: 'Campanhas manuais (aba Marketing)',
    desc: 'Campanhas criadas por você (nome, canal: WhatsApp/Instagram/Email/SMS, mensagem, público-alvo, orçamento e métricas de enviados/abertos/cliques/conversões). Independente do motor automático.',
    quem: [{ q: 'Site (Marketing)', o: 'cria, edita e exclui' }],
  },
];

const COLUNAS_EXTRAS = [
  { tabela: 'servicos', colunas: 'dias_para_retorno, exige_preparo, exige_pos_procedimento, sessoes_pacote', uso: 'Alimentam as ferramentas 8, 9, 15 e 16 — configuradas na aba Serviços.' },
  { tabela: 'clients', colunas: 'whatsapp_opt_out, status_paciente, total_consultas_concluidas, last_visit', uso: 'LGPD (opt-out) e gatilhos de aniversário, inatividade e boas-vindas. last_visit e total são DERIVADOS dos agendamentos via trigger.' },
  { tabela: 'appointments', colunas: 'client_id, exames_pendentes', uso: 'client_id liga a consulta ao cadastro (essencial para TODAS as ferramentas); exames_pendentes alimenta a ferramenta 10.' },
];

const STATUS_FILA = [
  { status: 'pending',   label: 'Aguardando aprovação', cor: '#F39C12', bg: '#FFF8E1', desc: 'Grupo B: esperando a recepcionista revisar na aba Motor → Fila.' },
  { status: 'approved',  label: 'Pronto para enviar',   cor: '#3498DB', bg: '#EBF5FB', desc: 'Grupo A já nasce aqui; Grupo B chega aqui ao aprovar. Worker pega em até 30s.' },
  { status: 'sent',      label: 'Enviado',              cor: '#27AE60', bg: '#EAFAF1', desc: 'Worker enviou com sucesso; sent_at registrado.' },
  { status: 'failed',    label: 'Falhou',               cor: '#E74C3C', bg: '#FDEDEC', desc: 'Erro no envio (telefone inválido, WhatsApp desconectado...); error_message guarda o motivo.' },
  { status: 'cancelled', label: 'Cancelado',            cor: '#95A5A6', bg: '#F4F6F7', desc: 'Descartado manualmente pela recepcionista.' },
  { status: 'expired',   label: 'Expirado',             cor: '#95A5A6', bg: '#F4F6F7', desc: 'Janela crítica passou (ex.: alerta de atraso com +1h) — enviar não faria mais sentido.' },
];

const ETAPAS_FLUXO = [
  { icone: Clock,    titulo: '1. Relógio (pg_cron)', desc: 'Dentro do próprio Supabase, pg_cron + pg_net chamam o motor a cada 30 min: ferramentas 1–11 nos minutos :00/:30 e 12–19 nos :15/:45 (dividido em 2 metades por causa do limite de 10s da Vercel).' },
  { icone: Server,   titulo: '2. Motor (Vercel)', desc: 'A função api/marketing-engine.js roda as ferramentas: lê appointments/clients/servicos, busca o template em message_templates, renderiza as {{tags}} e checa idempotência (já disparou nas últimas Xh? então pula).' },
  { icone: Database, titulo: '3. Fila (marketing_queue)', desc: 'Cada disparo vira uma linha na fila: Grupo A entra approved, Grupo B entra pending. Tudo auditado em marketing_log.' },
  { icone: Eye,      titulo: '4. Aprovação (Grupo B)', desc: 'As mensagens pending aparecem em tempo real na aba Motor → Fila. A recepcionista lê, personaliza se quiser e clica Aprovar (→ approved) ou Descartar (→ cancelled).' },
  { icone: Smartphone, titulo: '5. Worker WhatsApp (Baileys)', desc: 'Processo Node no computador da clínica: a cada 30s busca approved com scheduled_at vencido, aplica a Regra de Vencimento (expires_at) e envia. Sucesso → sent; erro → failed.' },
  { icone: MessageSquare, titulo: '6. Cliente recebe', desc: 'A mensagem chega no WhatsApp da paciente. O histórico completo fica na aba Motor → Histórico (enviados hoje, no mês, falhas).' },
];

const REGRAS = [
  { icone: Shield, titulo: 'Zero texto fixo', desc: 'Todo texto vem de message_templates. O motor decide QUEM e QUANDO — nunca O QUÊ dizer. Editar o template no site vale imediatamente.' },
  { icone: Timer,  titulo: 'Cronômetros imutáveis', desc: 'Os contadores (retorno, inatividade, NPS...) são calculados pelas DATAS dos agendamentos. Editar template não reinicia nenhuma contagem.' },
  { icone: RefreshCw, titulo: 'Idempotência (anti-duplicata)', desc: 'Antes de inserir, o motor checa se já existe disparo da mesma ferramenta para o mesmo cliente na janela da regra (24h, 4h, 7d...). Nunca manda duas vezes.' },
  { icone: AlertTriangle, titulo: 'Regra de Vencimento', desc: 'Gatilhos críticos têm expires_at (ex.: alerta de atraso vale até 1h depois). Passou? O worker marca expired em vez de mandar mensagem velha.' },
  { icone: Shield, titulo: 'LGPD / Opt-out', desc: 'Clientes com whatsapp_opt_out = true nunca recebem mensagens do motor (filtro aplicado nas ferramentas de base de clientes).' },
  { icone: ToggleRight, titulo: 'Interruptor geral', desc: 'marketing_engine_settings.enabled desliga o motor inteiro com 1 clique, sem parar processo nenhum.' },
];

// ─── Helpers ────────────────────────────────────────────────────

const fmtHora = (iso) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  } catch { return iso; }
};

// ═══════════════════════════════════════════════════════════════
// COMPONENTES
// ═══════════════════════════════════════════════════════════════

// ─── Painel ao vivo (mostra o banco funcionando AGORA) ─────────

function PainelAoVivo() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [tmplRes, pendRes, engineRes, waRes, sentRes] = await Promise.all([
        fetchTemplates(),
        fetchQueuePendingCount(),
        supabase.from('marketing_engine_settings').select('enabled').eq('id', 1).maybeSingle(),
        supabase.from('whatsapp_connection_status').select('status, updated_at').eq('id', 1).maybeSingle(),
        supabase.from('marketing_queue').select('id', { count: 'exact', head: true }).eq('status', 'sent'),
      ]);
      const templates = tmplRes.data || [];
      setStats({
        ativas: templates.filter(t => t.active).length,
        total: templates.length,
        pendentes: pendRes.data || 0,
        motorLigado: engineRes.data ? engineRes.data.enabled !== false : true,
        waStatus: waRes.data?.status || 'disconnected',
        waAtualizado: waRes.data?.updated_at || null,
        enviados: sentRes.count || 0,
      });
    } catch { /* silencioso */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 24 }}>
        <Loader2 style={{ width: 24, height: 24, animation: 'spin 1s linear infinite', color: 'var(--text-muted)', margin: '0 auto 8px' }} />
        <p style={{ color: 'var(--text-muted)', fontSize: 12 }}>Consultando o banco...</p>
      </div>
    );
  }
  if (!stats) return null;

  const waCfg = {
    connected:    { label: 'Conectado',    cor: '#27AE60', bg: '#EAFAF1' },
    connecting:   { label: 'Conectando',   cor: '#F39C12', bg: '#FFF8E1' },
    qr_ready:     { label: 'QR pronto',    cor: '#3498DB', bg: '#EBF5FB' },
    disconnected: { label: 'Desconectado', cor: '#E74C3C', bg: '#FDEDEC' },
    error:        { label: 'Erro',         cor: '#E74C3C', bg: '#FDEDEC' },
  }[stats.waStatus] || { label: stats.waStatus, cor: '#95A5A6', bg: '#F4F6F7' };

  const cards = [
    { label: 'Motor', val: stats.motorLigado ? 'Ligado' : 'Desligado', cor: stats.motorLigado ? '#27AE60' : '#E74C3C', extra: 'marketing_engine_settings' },
    { label: 'Ferramentas ativas', val: `${stats.ativas}/${stats.total}`, cor: 'var(--text-dark)', extra: 'message_templates' },
    { label: 'Aguardando aprovação', val: stats.pendentes, cor: stats.pendentes > 0 ? '#F39C12' : 'var(--text-dark)', extra: 'marketing_queue (pending)' },
    { label: 'Enviadas até hoje', val: stats.enviados, cor: '#27AE60', extra: 'marketing_queue (sent)' },
  ];

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 10, marginBottom: 10 }}>
        {cards.map(c => (
          <div key={c.label} style={{
            background: 'var(--bg-card)', borderRadius: 10, padding: '14px 16px',
            border: '1px solid var(--border-color)', textAlign: 'center',
          }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: c.cor }}>{c.val}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>{c.label}</div>
            <div style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'monospace', marginTop: 4, opacity: 0.7 }}>{c.extra}</div>
          </div>
        ))}
        {/* WhatsApp status */}
        <div style={{
          background: waCfg.bg, borderRadius: 10, padding: '14px 16px',
          border: `1px solid ${waCfg.cor}30`, textAlign: 'center',
        }}>
          <Smartphone style={{ width: 18, height: 18, color: waCfg.cor, margin: '0 auto 4px', display: 'block' }} />
          <div style={{ fontSize: 14, fontWeight: 800, color: waCfg.cor }}>{waCfg.label}</div>
          <div style={{ fontSize: 11, color: waCfg.cor, fontWeight: 600, opacity: 0.85 }}>WhatsApp {stats.waAtualizado ? `(${fmtHora(stats.waAtualizado)})` : ''}</div>
          <div style={{ fontSize: 9, color: waCfg.cor, fontFamily: 'monospace', marginTop: 4, opacity: 0.6 }}>whatsapp_connection_status</div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--text-muted)' }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#27AE60', display: 'inline-block' }} />
        Estes números vêm AO VIVO do Supabase — são as mesmas tabelas que o motor usa.
        <button
          onClick={load}
          style={{ marginLeft: 'auto', padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}
        >
          <RefreshCw style={{ width: 11, height: 11 }} /> Atualizar
        </button>
      </div>
    </div>
  );
}

// ─── Aba Fluxo ─────────────────────────────────────────────────

function AbaFluxo() {
  return (
    <div>
      <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-dark)', margin: '0 0 12px' }}>
        O caminho de uma mensagem — do relógio até o WhatsApp da cliente
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
        {ETAPAS_FLUXO.map(({ icone: Icon, titulo, desc }, i) => (
          <div key={titulo} style={{
            display: 'flex', gap: 14, background: 'var(--bg-card)',
            border: '1px solid var(--border-color)', borderRadius: 10, padding: '14px 16px',
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10, background: '#6C63FF18', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon style={{ width: 17, height: 17, color: '#6C63FF' }} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-dark)', marginBottom: 3 }}>{titulo}</div>
              <div style={{ fontSize: 12, color: 'var(--text-medium)', lineHeight: 1.6 }}>{desc}</div>
            </div>
          </div>
        ))}
      </div>

      <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-dark)', margin: '0 0 12px' }}>
        As 6 regras de ouro do motor
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10, marginBottom: 28 }}>
        {REGRAS.map(({ icone: Icon, titulo, desc }) => (
          <div key={titulo} style={{
            background: 'var(--bg-card)', border: '1px solid var(--border-color)',
            borderRadius: 10, padding: '14px 16px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <Icon style={{ width: 15, height: 15, color: '#27AE60' }} />
              <span style={{ fontWeight: 700, fontSize: 12, color: 'var(--text-dark)' }}>{titulo}</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-medium)', lineHeight: 1.6 }}>{desc}</div>
          </div>
        ))}
      </div>

      <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-dark)', margin: '0 0 12px' }}>
        Os ciclos de execução (quando cada metade roda)
      </h3>
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border-color)',
        borderRadius: 10, padding: '16px 18px', fontSize: 12, color: 'var(--text-medium)', lineHeight: 1.8,
      }}>
        <div><strong style={{ color: 'var(--text-dark)' }}>:00 e :30</strong> — Ferramentas 1–11 (Grupo A, automáticas) via <code style={{ fontFamily: 'monospace', background: 'var(--bg-main)', padding: '1px 5px', borderRadius: 4 }}>?half=1</code></div>
        <div><strong style={{ color: 'var(--text-dark)' }}>:15 e :45</strong> — Ferramentas 12–19 (Grupo B, revisão humana) via <code style={{ fontFamily: 'monospace', background: 'var(--bg-main)', padding: '1px 5px', borderRadius: 4 }}>?half=2</code></div>
        <div style={{ marginTop: 6, color: 'var(--text-muted)' }}>
          Quem agenda é o <strong>pg_cron</strong> dentro do próprio Supabase (arquivo <code style={{ fontFamily: 'monospace' }}>marketing_engine_cloud_cron.sql</code>) — não precisa de nenhum computador ligado para o motor gerar mensagens. Só o envio final pelo WhatsApp precisa do worker rodando na clínica.
        </div>
      </div>
    </div>
  );
}

// ─── Aba Ferramentas ───────────────────────────────────────────

function AbaFerramentas() {
  const [filter, setFilter] = useState('todos'); // 'todos' | 'A' | 'B'
  const [expanded, setExpanded] = useState(null);

  const filtered = FERRAMENTAS.filter(f => filter === 'todos' || f.grupo === filter);

  return (
    <div>
      {/* Legenda dos grupos */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{
          flex: 1, minWidth: 220, background: '#EAFAF1', border: '1px solid #82E0AA',
          borderRadius: 10, padding: '12px 14px',
        }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#27AE60', marginBottom: 3 }}>⚡ Grupo A (11 ferramentas) — Automáticas</div>
          <div style={{ fontSize: 11, color: '#1E7A46', lineHeight: 1.6 }}>Entram na fila já como <strong>approved</strong>: o worker envia sozinho. São mensagens operacionais (lembretes, confirmações, parabéns).</div>
        </div>
        <div style={{
          flex: 1, minWidth: 220, background: '#FFF8E1', border: '1px solid #FFD966',
          borderRadius: 10, padding: '12px 14px',
        }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#F39C12', marginBottom: 3 }}>👁 Grupo B (8 ferramentas) — Revisão humana</div>
          <div style={{ fontSize: 11, color: '#8B6914', lineHeight: 1.6 }}>Entram como <strong>pending</strong>: a recepcionista revisa e aprova na aba Motor → Fila. São mensagens comerciais (win-back, cross-sell, recuperação).</div>
        </div>
      </div>

      {/* Filtro */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {[
          { key: 'todos', label: 'Todas (19)' },
          { key: 'A', label: '⚡ Automáticas (11)' },
          { key: 'B', label: '👁 Revisão humana (8)' },
        ].map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            style={{
              padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600,
              border: '1px solid',
              borderColor: filter === f.key ? 'var(--color-primary)' : 'var(--border-color)',
              background: filter === f.key ? 'var(--color-primary)' : 'none',
              color: filter === f.key ? '#fff' : 'var(--text-medium)',
              cursor: 'pointer',
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Lista */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filtered.map(f => {
          const isA = f.grupo === 'A';
          const open = expanded === f.id;
          return (
            <div key={f.id} style={{
              background: 'var(--bg-card)', borderRadius: 10,
              border: '1px solid var(--border-color)',
              borderLeft: `4px solid ${isA ? '#27AE60' : '#F39C12'}`,
              overflow: 'hidden',
            }}>
              <button
                onClick={() => setExpanded(open ? null : f.id)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 16px', background: 'none', border: 'none',
                  cursor: 'pointer', textAlign: 'left',
                }}
              >
                <div style={{
                  width: 26, height: 26, borderRadius: 7, flexShrink: 0,
                  background: isA ? '#27AE6018' : '#F39C1218',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: isA ? '#27AE60' : '#F39C12' }}>{f.id}</span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-dark)' }}>{f.nome}</span>
                  <span style={{
                    marginLeft: 8, padding: '1px 7px', borderRadius: 99, fontSize: 10, fontWeight: 700,
                    background: isA ? '#EAFAF1' : '#FFF8E1', color: isA ? '#27AE60' : '#F39C12',
                    border: `1px solid ${isA ? '#82E0AA' : '#FFD966'}`,
                  }}>
                    entra como {f.escreve}
                  </span>
                </div>
                {open
                  ? <ChevronDown style={{ width: 15, height: 15, color: 'var(--text-muted)', flexShrink: 0 }} />
                  : <ChevronRight style={{ width: 15, height: 15, color: 'var(--text-muted)', flexShrink: 0 }} />}
              </button>

              {open && (
                <div style={{ padding: '0 16px 14px 54px', fontSize: 12, lineHeight: 1.7 }}>
                  <div style={{ color: 'var(--text-medium)', marginBottom: 8 }}>
                    <strong style={{ color: 'var(--text-dark)' }}>Gatilho: </strong>{f.gatilho}
                  </div>

                  {/* Como funciona por dentro */}
                  {f.passos && (
                    <div style={{
                      background: 'var(--bg-main)', borderRadius: 8, padding: '10px 12px',
                      marginBottom: 8, border: '1px solid var(--border-light)',
                    }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>
                        Como funciona por dentro
                      </div>
                      {f.passos.map(p => (
                        <div key={p} style={{ color: 'var(--text-medium)', marginBottom: 3 }}>{p}</div>
                      ))}
                    </div>
                  )}

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                    <strong style={{ color: 'var(--text-dark)' }}>Lê do banco: </strong>
                    {f.le.map(t => (
                      <code key={t} style={{
                        fontFamily: 'monospace', fontSize: 11, background: 'var(--bg-main)',
                        padding: '1px 6px', borderRadius: 4, color: '#6C63FF',
                      }}>{t}</code>
                    ))}
                    {f.janela && (
                      <span style={{
                        marginLeft: 8, padding: '1px 8px', borderRadius: 99, fontSize: 10, fontWeight: 700,
                        background: '#EBF5FB', color: '#3498DB', border: '1px solid #85C1E9',
                      }}>
                        🔒 anti-duplicata: {f.janela}
                      </span>
                    )}
                  </div>

                  {f.tags && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, alignItems: 'center', marginBottom: 6 }}>
                      <strong style={{ color: 'var(--text-dark)' }}>Tags do template: </strong>
                      {f.tags.map(t => (
                        <code key={t} style={{
                          fontFamily: 'monospace', fontSize: 10, background: '#6C63FF10',
                          padding: '1px 6px', borderRadius: 4, color: '#6C63FF',
                        }}>{'{{' + t + '}}'}</code>
                      ))}
                    </div>
                  )}

                  <div style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>{f.obs}</div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Aba Banco de Dados ────────────────────────────────────────

function AbaBanco() {
  const [expanded, setExpanded] = useState(null);

  return (
    <div>
      <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-dark)', margin: '0 0 12px' }}>
        Tabelas do marketing no Supabase
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 28 }}>
        {TABELAS.map(t => {
          const open = expanded === t.nome;
          return (
            <div key={t.nome} style={{
              background: 'var(--bg-card)', borderRadius: 10,
              border: '1px solid var(--border-color)', overflow: 'hidden',
            }}>
              <button
                onClick={() => setExpanded(open ? null : t.nome)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 16px', background: 'none', border: 'none',
                  cursor: 'pointer', textAlign: 'left',
                }}
              >
                <Database style={{ width: 16, height: 16, color: '#6C63FF', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <code style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 700, color: 'var(--text-dark)' }}>{t.nome}</code>
                  <span style={{ marginLeft: 10, fontSize: 11, color: 'var(--text-muted)' }}>{t.papel}</span>
                </div>
                {open
                  ? <ChevronDown style={{ width: 15, height: 15, color: 'var(--text-muted)', flexShrink: 0 }} />
                  : <ChevronRight style={{ width: 15, height: 15, color: 'var(--text-muted)', flexShrink: 0 }} />}
              </button>
              {open && (
                <div style={{ padding: '0 16px 14px 44px', fontSize: 12, lineHeight: 1.7 }}>
                  <div style={{ color: 'var(--text-medium)', marginBottom: 8 }}>{t.desc}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {t.quem.map(q => (
                      <span key={q.q} style={{
                        padding: '3px 9px', borderRadius: 99, fontSize: 11,
                        background: 'var(--bg-main)', border: '1px solid var(--border-light)',
                        color: 'var(--text-medium)',
                      }}>
                        <strong>{q.q}</strong> {q.o}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Colunas extras */}
      <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-dark)', margin: '0 0 12px' }}>
        Colunas que o marketing adicionou a tabelas existentes
      </h3>
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border-color)',
        borderRadius: 10, overflow: 'hidden', marginBottom: 28,
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: 'var(--bg-main)' }}>
              <th style={{ padding: '9px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', fontSize: 11 }}>Tabela</th>
              <th style={{ padding: '9px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', fontSize: 11 }}>Colunas adicionadas</th>
              <th style={{ padding: '9px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', fontSize: 11 }}>Para que servem</th>
            </tr>
          </thead>
          <tbody>
            {COLUNAS_EXTRAS.map(c => (
              <tr key={c.tabela} style={{ borderTop: '1px solid var(--border-light)' }}>
                <td style={{ padding: '9px 14px' }}>
                  <code style={{ fontFamily: 'monospace', fontWeight: 700, color: '#6C63FF' }}>{c.tabela}</code>
                </td>
                <td style={{ padding: '9px 14px', fontFamily: 'monospace', fontSize: 11, color: 'var(--text-medium)' }}>{c.colunas}</td>
                <td style={{ padding: '9px 14px', color: 'var(--text-medium)', lineHeight: 1.6 }}>{c.uso}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Ciclo de vida da fila */}
      <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-dark)', margin: '0 0 12px' }}>
        Ciclo de vida de uma mensagem (coluna status da marketing_queue)
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 10 }}>
        {STATUS_FILA.map(s => (
          <div key={s.status} style={{
            background: s.bg, borderRadius: 10, padding: '12px 14px',
            border: `1px solid ${s.cor}35`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5 }}>
              <code style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 800, color: s.cor }}>{s.status}</code>
              <span style={{ fontSize: 11, fontWeight: 700, color: s.cor }}>{s.label}</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-medium)', lineHeight: 1.6 }}>{s.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// PÁGINA PRINCIPAL
// ═══════════════════════════════════════════════════════════════

export default function GuiaMarketing() {
  const [activeTab, setActiveTab] = useState('fluxo');

  const TABS = [
    { key: 'fluxo',      label: 'Como Funciona',  icon: Radio },
    { key: 'ferramentas', label: 'As 19 Ferramentas', icon: Zap },
    { key: 'banco',      label: 'Banco de Dados', icon: Database },
  ];

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <div className="page-header-label">
          <BookOpen style={{ width: 14, height: 14 }} />
          GUIA DO MARKETING
        </div>
        <h1 className="page-title">Guia do Marketing</h1>
        <p className="page-subtitle">
          Como cada ferramenta funciona, o caminho da mensagem até o WhatsApp e todas as tabelas do banco envolvidas
        </p>
      </div>

      {/* Painel ao vivo */}
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border-color)',
        borderRadius: 12, padding: '16px 18px', marginBottom: 24,
      }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-dark)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 7 }}>
          <Calendar style={{ width: 14, height: 14, color: '#6C63FF' }} />
          Estado atual do sistema
        </div>
        <PainelAoVivo />
      </div>

      {/* Tabs */}
      <div style={{ borderBottom: '1px solid var(--border-color)', marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 0 }}>
          {TABS.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  padding: '10px 20px', fontSize: 13, fontWeight: 600,
                  color: activeTab === tab.key ? 'var(--text-dark)' : 'var(--text-muted)',
                  background: 'none', border: 'none',
                  borderBottom: activeTab === tab.key ? '2px solid var(--color-primary)' : '2px solid transparent',
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 7,
                  transition: 'all 0.15s',
                }}
              >
                <Icon style={{ width: 14, height: 14 }} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'fluxo' && <AbaFluxo />}
      {activeTab === 'ferramentas' && <AbaFerramentas />}
      {activeTab === 'banco' && <AbaBanco />}

      {/* Rodapé: onde ficar cada coisa no dia a dia */}
      <div style={{
        marginTop: 28, background: '#EBF5FB', border: '1px solid #85C1E9',
        borderRadius: 10, padding: '14px 16px', fontSize: 12, color: '#1B4F72', lineHeight: 1.8,
      }}>
        <strong>📍 No dia a dia, onde fica cada coisa:</strong><br />
        • <strong>Motor → Ferramentas</strong>: ligar/desligar e editar o texto das 19 ferramentas (message_templates).<br />
        • <strong>Motor → Fila</strong>: aprovar ou descartar mensagens do Grupo B (marketing_queue).<br />
        • <strong>Motor → Histórico</strong>: acompanhar enviados, falhas e cancelados.<br />
        • <strong>Marketing</strong>: campanhas manuais (tabela campaigns), independentes do motor.<br />
        • <strong>Integrações</strong>: conectar o WhatsApp (QR Code) e configurar link do Google/Instagram.<br />
        • <strong>Serviços</strong>: configurar dias_para_retorno, preparo, pós-procedimento e sessões de pacote.
      </div>
    </div>
  );
}
