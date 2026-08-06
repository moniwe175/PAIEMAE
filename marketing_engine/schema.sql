-- =============================================================================
-- MARKETING ENGINE — schema.sql  (Versão Final Consolidada)
-- Projeto: PAIEMAE / EvelynEstheticCenter
-- Aplique no SQL Editor do Supabase
-- =============================================================================
-- ⚠️  LEIA ANTES DE EXECUTAR:
--   1. Usa CREATE TABLE IF NOT EXISTS e ADD COLUMN IF NOT EXISTS.
--      É seguro rodar mais de uma vez — não destrói dados existentes.
--   2. Pressupõe que supabase_schema.sql (principal) já foi rodado antes.
--   3. Pressupõe que existem: clients, appointments, servicos, auth.users.
-- =============================================================================


-- =============================================================================
-- 1. ALTERAÇÕES NA TABELA EXISTENTE: servicos
-- =============================================================================

-- Ferramenta 16 (Retorno Inteligente): timer dinâmico por serviço
-- Ex: Botox = 120, Limpeza de Pele = 30, Hidratação = 60. NULL = sem retorno.
ALTER TABLE public.servicos
    ADD COLUMN IF NOT EXISTS dias_para_retorno integer DEFAULT NULL;

-- Ferramenta 8 (Pré-Procedimento): dispara orientações 24h antes
ALTER TABLE public.servicos
    ADD COLUMN IF NOT EXISTS exige_preparo boolean DEFAULT false;

-- Ferramenta 9 (Pós-Procedimento): dispara cuidados 24h após consulta concluída
ALTER TABLE public.servicos
    ADD COLUMN IF NOT EXISTS exige_pos_procedimento boolean DEFAULT false;

-- Ferramenta 15 (Pacote Próximo do Fim): total de sessões do pacote
-- NULL = serviço avulso, não tem pacote
ALTER TABLE public.servicos
    ADD COLUMN IF NOT EXISTS sessoes_pacote integer DEFAULT NULL;

COMMENT ON COLUMN public.servicos.dias_para_retorno IS
    'Ferramenta 16: dias até o retorno biológico ideal deste serviço. NULL = sem regra de retorno.';
COMMENT ON COLUMN public.servicos.exige_preparo IS
    'Ferramenta 8: TRUE dispara orientações pré-procedimento 24h antes da consulta.';
COMMENT ON COLUMN public.servicos.exige_pos_procedimento IS
    'Ferramenta 9: TRUE dispara dicas de cuidado 24h após consulta concluída.';
COMMENT ON COLUMN public.servicos.sessoes_pacote IS
    'Ferramenta 15: número total de sessões do pacote. NULL = serviço avulso.';


-- =============================================================================
-- 2. ALTERAÇÕES NA TABELA EXISTENTE: clients
-- =============================================================================

-- Opt-out LGPD: Python filtra `whatsapp_opt_out = false` antes de qualquer disparo
ALTER TABLE public.clients
    ADD COLUMN IF NOT EXISTS whatsapp_opt_out boolean DEFAULT false;

-- status_paciente: 'novo' → primeira consulta ainda não ocorreu
--                  'ativo' → cliente regular
--                  'inativo' → sem visita recente
ALTER TABLE public.clients
    ADD COLUMN IF NOT EXISTS status_paciente text DEFAULT 'novo';

-- Contador de consultas concluídas — Ferramenta 6 dispara quando passa 0→1
ALTER TABLE public.clients
    ADD COLUMN IF NOT EXISTS total_consultas_concluidas integer DEFAULT 0;

-- last_visit: data da última consulta concluída (usada pelas Tools 13, 14, 19)
ALTER TABLE public.clients
    ADD COLUMN IF NOT EXISTS last_visit date DEFAULT NULL;

COMMENT ON COLUMN public.clients.whatsapp_opt_out IS
    'LGPD: se true, nenhuma ferramenta do motor dispara para este cliente.';
COMMENT ON COLUMN public.clients.total_consultas_concluidas IS
    'Ferramenta 6: incrementado quando consulta vai para completed. Trigger = 1 (primeira visita).';


-- =============================================================================
-- 3. ALTERAÇÕES NA TABELA EXISTENTE: appointments
-- =============================================================================

-- FK para clients (uuid) — necessária para as queries do rules.py
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'appointments' AND column_name = 'client_id'
    ) THEN
        ALTER TABLE public.appointments
            ADD COLUMN client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL;
    END IF;
END;
$$;

-- Flag de exames pendentes — Ferramenta 10 (Lembrete de Exames)
ALTER TABLE public.appointments
    ADD COLUMN IF NOT EXISTS exames_pendentes boolean DEFAULT false;

COMMENT ON COLUMN public.appointments.exames_pendentes IS
    'Ferramenta 10: se true, dispara lembrete de trazer resultados pendentes.';


-- =============================================================================
-- 4. NOVA TABELA: integration_configs
--    Configurações globais da clínica (link do Google, Instagram, etc.)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.integration_configs (
    key         text PRIMARY KEY,
    value       text,
    description text,
    updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Seed com chaves essenciais
INSERT INTO public.integration_configs (key, value, description) VALUES
    ('google_review_link', '', 'Link da avaliação no Google Meu Negócio. Usado na Ferramenta 6 (Boas-Vindas).'),
    ('instagram_link',     '', 'Link do Instagram da clínica.'),
    ('clinic_name',        'Clínica', 'Nome da clínica exibido nas mensagens.')
ON CONFLICT (key) DO NOTHING;

ALTER TABLE public.integration_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_all_integration_configs" ON public.integration_configs
    FOR ALL TO authenticated USING (true);


-- =============================================================================
-- 5. NOVA TABELA: message_templates
--    Uma linha por ferramenta (tool_id 1–19).
--    O Python NUNCA tem texto fixo — sempre faz SELECT aqui no momento do gatilho.
--    Tags suportadas: {{nome_paciente}}, {{data_consulta}}, {{hora_consulta}},
--                    {{nome_profissional}}, {{nome_servico}}, {{link_google}},
--                    {{link_instagram}}, {{dias_retorno}}, {{sessoes_restantes}}
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.message_templates (
    id              serial          PRIMARY KEY,
    tool_id         integer         NOT NULL UNIQUE CHECK (tool_id BETWEEN 1 AND 19),
    tool_name       text            NOT NULL,
    group_type      text            NOT NULL CHECK (group_type IN ('A', 'B')),
    template_text   text            NOT NULL,
    description     text,            -- explicação do gatilho para a recepcionista
    active          boolean         NOT NULL DEFAULT true,
    created_at      timestamptz     NOT NULL DEFAULT now(),
    updated_at      timestamptz     NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.message_templates IS
    'Templates das 19 ferramentas. Editável pelo Frontend. Python sempre faz SELECT aqui.';

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_templates_updated_at ON public.message_templates;
CREATE TRIGGER trg_templates_updated_at
    BEFORE UPDATE ON public.message_templates
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_read_templates" ON public.message_templates
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_all_templates" ON public.message_templates
    FOR ALL TO authenticated USING (true);


-- =============================================================================
-- 6. SEEDS: Templates padrão para as 19 ferramentas
--    ON CONFLICT DO NOTHING = não sobrescreve edições já feitas pela clínica.
-- =============================================================================

INSERT INTO public.message_templates (tool_id, tool_name, group_type, template_text, description) VALUES

-- ── GRUPO A — Automáticos ──────────────────────────────────────────────────

(1, 'Lembrete 24h', 'A',
 'Olá, {{nome_paciente}}! 😊 Passando para lembrar que você tem uma consulta amanhã com {{nome_profissional}} às {{hora_consulta}}. Te esperamos! Qualquer dúvida, estamos aqui.',
 'Disparado 24h antes do horário da consulta agendada.'),

(2, 'Lembrete 2h', 'A',
 'Oi, {{nome_paciente}}! Sua consulta com {{nome_profissional}} é em aproximadamente 2 horas ({{hora_consulta}}). Nos vemos logo! 💖',
 'Disparado 2h antes do horário da consulta agendada.'),

(3, 'Alerta de Atraso 15min', 'A',
 'Oi, {{nome_paciente}}! Percebemos que você ainda não chegou para sua consulta das {{hora_consulta}}. Está a caminho? Nos avise para aguardarmos! 🙏',
 'Disparado se paciente não confirmou chegada 15min após horário. CANCELADO automaticamente se PC ligar com +1h de atraso (expires_at).'),

(4, 'No-Show 24h', 'A',
 'Olá, {{nome_paciente}}. Sentimos sua falta hoje! Não conseguimos realizar sua consulta das {{hora_consulta}}. Quando quiser remarcar, é só nos chamar. 💙',
 'Disparado 24h após consulta com status no_show.'),

(5, 'Feliz Aniversário', 'A',
 'Feliz Aniversário, {{nome_paciente}}! 🎉🎂 Toda a equipe deseja um dia incrível para você. Como presente, preparamos uma surpresinha — venha nos visitar esse mês! 💝',
 'Disparado no dia do aniversário da paciente.'),

(6, 'Boas-Vindas & Prova Social', 'A',
 'Que alegria ter você conosco, {{nome_paciente}}! 🌟 Foi um prazer cuidar de você hoje. Se ficou satisfeita, sua avaliação faz toda a diferença para nós: {{link_google}} 💖',
 'Disparado após a 1ª consulta concluída (total_consultas_concluidas = 1).'),

(7, 'Confirmação de Agendamento', 'A',
 'Olá, {{nome_paciente}}! ✅ Seu agendamento foi confirmado. {{nome_servico}} com {{nome_profissional}} em {{data_consulta}} às {{hora_consulta}}. Qualquer dúvida é só chamar!',
 'Disparado imediatamente ao criar novo agendamento no sistema.'),

(8, 'Orientações Pré-Procedimento', 'A',
 'Oi, {{nome_paciente}}! Sua consulta de {{nome_servico}} é amanhã. Lembre-se: venha com a pele limpa, sem maquiagem e bem hidratada. Até amanhã! 😊',
 'Disparado 24h antes para serviços com exige_preparo = true.'),

(9, 'Dicas Pós-Procedimento', 'A',
 'Olá, {{nome_paciente}}! Como você está se sentindo após o {{nome_servico}} de ontem? Lembre-se de usar protetor solar, evitar calor e manter a pele hidratada nas próximas 48h. 💆‍♀️',
 'Disparado 24h após consulta concluída de serviço com exige_pos_procedimento = true.'),

(10, 'Lembrete de Exames', 'A',
 'Oi, {{nome_paciente}}! Passando para lembrar que você tem exames pendentes para trazer na sua próxima visita. Qualquer dúvida, estamos à disposição! 📋',
 'Disparado para agendamentos com flag exames_pendentes = true.'),

(11, 'NPS / Pesquisa de Satisfação', 'A',
 'Olá, {{nome_paciente}}! Como foi sua experiência conosco? De 0 a 10, o quanto você nos indicaria para um amigo? Sua opinião é muito importante para nós! 🌟 Responda por aqui mesmo.',
 'Disparado X dias após consulta concluída (configurável via NPS_DIAS_APOS_CONSULTA no .env).'),

-- ── GRUPO B — Edição humana ───────────────────────────────────────────────

(12, 'Recuperação de Orçamento', 'B',
 'Oi, {{nome_paciente}}! Notamos que você ainda não confirmou o orçamento que preparamos para você. Ainda tem interesse? Podemos conversar sobre condições especiais 😊',
 'Disparado X dias após orçamento não convertido. Recepcionista revisa antes de enviar.'),

(13, 'Inativo 30 dias', 'B',
 'Saudades, {{nome_paciente}}! 💕 Faz um tempinho que não te vemos por aqui. Que tal agendar uma visita? Temos novidades esperando por você!',
 'Disparado quando last_visit do cliente passa de 30 dias.'),

(14, 'Inativo 90 dias', 'B',
 'Oi, {{nome_paciente}}! Estamos com saudades suas e gostaríamos muito de te receber novamente. Preparamos uma condição especial para o seu retorno — podemos conversar? 💙',
 'Disparado quando last_visit passa de 90 dias. Tom de win-back mais agressivo.'),

(15, 'Pacote Próximo do Fim', 'B',
 'Oi, {{nome_paciente}}! Você tem apenas {{sessoes_restantes}} sessão(ões) restante(s) no seu pacote de {{nome_servico}}. Que tal já garantir a continuidade do seu tratamento? 😊',
 'Disparado quando restam 1 ou 2 sessões no pacote. Recepcionista revisa antes de enviar.'),

(16, 'Retorno Inteligente', 'B',
 'Oi, {{nome_paciente}}! Já faz {{dias_retorno}} dias desde o seu {{nome_servico}}. Esse é o momento ideal para um retorno e manter os resultados em dia! Vamos agendar? 💆‍♀️',
 'Disparado baseado em servicos.dias_para_retorno após consulta concluída. Cronômetro imutável.'),

(17, 'Recuperação de Cancelamento', 'B',
 'Oi, {{nome_paciente}}! Vimos que você cancelou sua consulta recentemente. Sem problemas! Quando quiser remarcar, é só nos chamar — teremos o melhor horário para você. 😊',
 'Disparado se paciente cancelou e não reagendou em 3 dias. Configurável via CANCELAMENTO_DIAS.'),

(18, 'Upgrade / Cross-sell', 'B',
 'Oi, {{nome_paciente}}! Com base no seu tratamento de {{nome_servico}}, temos uma sugestão que pode potencializar ainda mais seus resultados. Posso te contar mais? ✨',
 'Disparado X dias após serviço base. Recepcionista personaliza a sugestão antes de enviar.'),

(19, 'Data Comemorativa / Mês Temático', 'B',
 'Oi, {{nome_paciente}}! 🌸 Esse mês é especial e pensamos em você! Preparamos condições únicas para este período. Quer saber mais?',
 'Gatilho baseado em datas comemorativas e perfil da paciente. Recepcionista personaliza.')

ON CONFLICT (tool_id) DO NOTHING;


-- =============================================================================
-- 7. NOVA TABELA: marketing_queue
--    Fila unificada de mensagens.
--    Python insere → Baileys (Node.js) lê e envia.
-- =============================================================================
--
-- STATUS:
--   pending   → Grupo B aguardando aprovação da recepcionista no React
--   approved  → pronto para o Baileys enviar
--   sent      → enviado com sucesso
--   failed    → falha no envio (Baileys registra o erro)
--   cancelled → descartado manualmente ou por opt-out
--   expired   → janela de tempo crítica passou (ex: alerta 15min)

CREATE TABLE IF NOT EXISTS public.marketing_queue (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Cliente destinatário
    -- Desnormalizado para que o Baileys não precise fazer JOIN extra
    client_id       integer     REFERENCES public.clients(id) ON DELETE CASCADE,
    client_name     text        NOT NULL,
    client_phone    text        NOT NULL,

    -- Ferramenta que gerou esta entrada
    tool_id         integer     NOT NULL REFERENCES public.message_templates(tool_id),
    tool_name       text        NOT NULL,
    group_type      text        NOT NULL CHECK (group_type IN ('A', 'B')),

    -- Mensagem já renderizada (tags substituídas pelo Python)
    message_text    text        NOT NULL,

    -- Controle de fluxo
    status          text        NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','approved','sent','failed','cancelled','expired')),

    -- scheduled_at: quando o Baileys deve enviar esta mensagem.
    --   Regra da Retenção: ao ligar de manhã, Baileys busca approved WHERE scheduled_at <= now()
    scheduled_at    timestamptz NOT NULL DEFAULT now(),

    -- expires_at: deadline para gatilhos críticos (NULL = sem vencimento).
    --   Regra de Vencimento: se now() > expires_at e status = 'approved', Baileys muda para 'expired'
    expires_at      timestamptz DEFAULT NULL,

    -- Rastreabilidade
    appointment_id  uuid        REFERENCES public.appointments(id) ON DELETE SET NULL,
    context_data    jsonb       DEFAULT '{}'::jsonb,

    -- Auditoria de aprovação (Grupo B)
    approved_by     text        DEFAULT NULL,
    approved_at     timestamptz DEFAULT NULL,

    -- Auditoria de envio
    sent_at         timestamptz DEFAULT NULL,
    error_message   text        DEFAULT NULL,

    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_queue_updated_at ON public.marketing_queue;
CREATE TRIGGER trg_queue_updated_at
    BEFORE UPDATE ON public.marketing_queue
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Índices críticos para a performance do Baileys e do Python
CREATE INDEX IF NOT EXISTS idx_queue_status_scheduled
    ON public.marketing_queue (status, scheduled_at);

CREATE INDEX IF NOT EXISTS idx_queue_client
    ON public.marketing_queue (client_id, tool_id, created_at);

CREATE INDEX IF NOT EXISTS idx_queue_tool
    ON public.marketing_queue (tool_id);

COMMENT ON TABLE  public.marketing_queue IS
    'Fila unificada de mensagens. Python insere, Baileys lê e envia.';
COMMENT ON COLUMN public.marketing_queue.expires_at IS
    'Regra de Vencimento: se now() > expires_at e status = approved, Baileys muda para expired.';
COMMENT ON COLUMN public.marketing_queue.scheduled_at IS
    'Regra de Retenção: ao ligar de manhã, Baileys busca approved WHERE scheduled_at <= now().';

-- RLS
ALTER TABLE public.marketing_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_read_queue" ON public.marketing_queue
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_update_queue" ON public.marketing_queue
    FOR UPDATE TO authenticated USING (true);


-- =============================================================================
-- 8. NOVA TABELA: whatsapp_connection_status
--    Baileys escreve aqui. React lê via Supabase Realtime.
--    Elimina o QR Code no terminal — aparece direto na aba Integrações.
--    Sempre terá apenas 1 linha (id = 1).
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.whatsapp_connection_status (
    id              integer     PRIMARY KEY DEFAULT 1,
    status          text        NOT NULL DEFAULT 'disconnected'
                    CHECK (status IN ('disconnected','connecting','qr_ready','connected','error')),
    qr_code_base64  text        DEFAULT NULL,   -- string base64 do QR; nulo quando conectado
    phone_number    text        DEFAULT NULL,   -- número conectado (preenchido após scan)
    error_message   text        DEFAULT NULL,
    updated_at      timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT single_row CHECK (id = 1)
);

-- Linha inicial
INSERT INTO public.whatsapp_connection_status (id, status)
VALUES (1, 'disconnected')
ON CONFLICT (id) DO NOTHING;

COMMENT ON TABLE public.whatsapp_connection_status IS
    'Status da conexão Baileys. React escuta via Realtime e renderiza QR Code na aba Integrações.';

-- RLS: autenticados leem; service_role (Baileys) tem acesso total (bypass RLS)
ALTER TABLE public.whatsapp_connection_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_read_wa_status" ON public.whatsapp_connection_status
    FOR SELECT TO authenticated USING (true);

-- Habilitar Realtime para o React receber o QR sem polling
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_connection_status;


-- =============================================================================
-- 9. NOVA TABELA: marketing_engine_settings
--    Toggle liga/desliga o motor inteiro sem precisar parar o processo.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.marketing_engine_settings (
    id          integer PRIMARY KEY DEFAULT 1,
    enabled     boolean NOT NULL DEFAULT true,
    updated_at  timestamptz NOT NULL DEFAULT now(),
    updated_by  text
);

INSERT INTO public.marketing_engine_settings (id, enabled)
VALUES (1, true)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.marketing_engine_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_all_engine_settings" ON public.marketing_engine_settings
    FOR ALL TO authenticated USING (true);


-- =============================================================================
-- 10. VIEW AUXILIAR: vw_queue_pending
--     O Frontend usa esta view para o popup de aprovação do Grupo B.
--     Recepcionista lê, edita o message_text e clica em Aprovar →
--     UPDATE marketing_queue SET status='approved', approved_by='...', approved_at=now()
-- =============================================================================

CREATE OR REPLACE VIEW public.vw_queue_pending AS
SELECT
    q.id,
    q.client_id,
    q.client_name,
    q.client_phone,
    q.tool_id,
    q.tool_name,
    q.group_type,
    q.message_text,
    q.scheduled_at,
    q.context_data,
    q.created_at,
    t.description   AS tool_description,
    t.template_text AS template_original
FROM  public.marketing_queue    q
JOIN  public.message_templates  t ON t.tool_id = q.tool_id
WHERE q.status = 'pending'
ORDER BY q.created_at ASC;

COMMENT ON VIEW public.vw_queue_pending IS
    'Mensagens do Grupo B aguardando aprovação da recepcionista no React.';
