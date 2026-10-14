-- =============================================================================
-- PAIEMAE — Inteligência Comercial: Migração Consolidada
-- Arquivo: marketing_inteligencia_migration.sql
-- Executar no Supabase SQL Editor.
--
-- IDEMPOTÊNCIA: CREATE TABLE IF NOT EXISTS + CREATE OR REPLACE FUNCTION.
--   Reaplicar não perde dados nem altera definições existentes.
-- SEGURANÇA: SECURITY INVOKER em todas as funções (sem bypass de permissão).
--   RLS ativo em todas as novas tabelas.
-- RESTRIÇÕES PRESERVADAS: não toca em campaigns, crm_leads, appointments,
--   clients, sheet_transactions, marketing_ideas nem na integração Instagram.
-- =============================================================================

BEGIN;

-- ─── 0. Colunas opcionais na tabela clients ──────────────────────────────────
-- Garante a existência dos campos sem dados fictícios (iniciam como NULL)
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS source text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS neighborhood text;

COMMENT ON COLUMN public.clients.source IS 'Origem de aquisição comercial declarada ou confirmada.';
COMMENT ON COLUMN public.clients.city IS 'Cidade de residência declarada.';
COMMENT ON COLUMN public.clients.neighborhood IS 'Bairro de residência declarado.';

-- -----------------------------------------------------------------------------
-- 1. marketing_segments
--    Critérios versionados de público salvo. NÃO é uma lista de pessoas.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.marketing_segments (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL,
  description text,
  entity_base text        NOT NULL CHECK (entity_base IN ('lead', 'cliente')),
  conditions  jsonb       NOT NULL DEFAULT '[]'::jsonb,
  version     integer     NOT NULL DEFAULT 1,
  janela_dias integer,
  author_id   uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  author_name text,
  archived    boolean     NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.marketing_segments IS
  'Segmentos de público com critérios versionados. Não são listas de pessoas.';
COMMENT ON COLUMN public.marketing_segments.conditions IS
  'Array de {field, operator, value}. Campos e operadores validados pelo servidor.';
COMMENT ON COLUMN public.marketing_segments.version IS
  'Controle de concorrência otimista. Incrementar a cada edição.';

-- -----------------------------------------------------------------------------
-- 2. marketing_icp_profiles
--    Hipóteses de perfil ideal de cliente sustentadas por segmento e evidência.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.marketing_icp_profiles (
  id                       uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name                     text        NOT NULL,
  necessidades             text,
  servicos_interesse       text[],
  regiao                   text,
  criterios_relacionamento text,
  segment_id               uuid        REFERENCES public.marketing_segments(id) ON DELETE SET NULL,
  responsavel              text,
  status                   text        NOT NULL DEFAULT 'hipotese'
                             CHECK (status IN ('hipotese', 'validado')),
  validated_at             timestamptz,
  validated_by             uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  validator_name           text,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

COMMENT ON COLUMN public.marketing_icp_profiles.status IS
  'hipotese: ainda não validado. validado: aprovado explicitamente pela gestão.';

-- -----------------------------------------------------------------------------
-- 3. marketing_campaign_briefs
--    Extensão 1:1 da campanha existente (campaigns.id BIGINT).
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.marketing_campaign_briefs (
  id                     uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id            bigint      NOT NULL UNIQUE
                           REFERENCES public.campaigns(id) ON DELETE CASCADE,
  objetivo               text,
  meta                   text,
  publico_descricao      text,
  segment_id             uuid        REFERENCES public.marketing_segments(id) ON DELETE SET NULL,
  segment_version        integer,
  conditions_snapshot    jsonb,
  estimated_count        integer,
  snapshot_date          timestamptz,
  responsavel            text,
  okr_kr_ref             text,
  orcamento_planejado    numeric(14,2),
  investimento_realizado numeric(14,2),
  resultado_observado    text,
  decisao                text        CHECK (decisao IN ('repetir', 'ajustar', 'encerrar')),
  aprendizado            text,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'marketing_campaign_briefs' 
      AND column_name = 'campaign_id' 
      AND data_type = 'integer'
  ) THEN
    ALTER TABLE public.marketing_campaign_briefs 
      ALTER COLUMN campaign_id TYPE bigint;
  END IF;
END $$;

COMMENT ON COLUMN public.marketing_campaign_briefs.orcamento_planejado IS
  'Orçamento planejado — não lança despesa no financeiro automaticamente.';
COMMENT ON COLUMN public.marketing_campaign_briefs.investimento_realizado IS
  'Gasto realizado confirmado — distinto do orçamento planejado.';

-- -----------------------------------------------------------------------------
-- 4. marketing_commercial_settings
--    Configurações operacionais — singleton (id fixo).
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.marketing_commercial_settings (
  id                          uuid        PRIMARY KEY
                                DEFAULT 'a0000000-0000-0000-0000-000000000001'::uuid,
  meta_mensal_atendimentos    integer,
  meta_mensal_interessados    integer,
  okr_kr_ref                  text,
  definicao_metrica_principal text,
  periodo_padrao_dias         integer     DEFAULT 30,
  updated_at                  timestamptz NOT NULL DEFAULT now(),
  updated_by                  uuid        REFERENCES auth.users(id) ON DELETE SET NULL
);

COMMENT ON TABLE public.marketing_commercial_settings IS
  'Singleton de configurações. Metas definidas pela gestão; não alteram OKRs automaticamente.';

-- -----------------------------------------------------------------------------
-- 5. commercial_record_links
--    Associação manual confirmada entre sheet_transactions (client = texto)
--    e clients.id. Requer autoria e data. Não modifica o lançamento original.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.commercial_record_links (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  source_table text        NOT NULL DEFAULT 'sheet_transactions',
  source_id    text        NOT NULL,
  client_id    integer     NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  author_id    uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  author_name  text,
  confirmed_at timestamptz NOT NULL DEFAULT now(),
  note         text,
  UNIQUE (source_table, source_id)
);

COMMENT ON TABLE public.commercial_record_links IS
  'Associações confirmadas fontes financeiras → clients. Requer confirmação humana.';

-- -----------------------------------------------------------------------------
-- Índices
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_mkt_segments_entity_active
  ON public.marketing_segments(entity_base) WHERE NOT archived;

CREATE INDEX IF NOT EXISTS idx_mkt_segments_updated
  ON public.marketing_segments(updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_mkt_briefs_campaign
  ON public.marketing_campaign_briefs(campaign_id);

CREATE INDEX IF NOT EXISTS idx_commercial_links_source
  ON public.commercial_record_links(source_table, source_id);

CREATE INDEX IF NOT EXISTS idx_commercial_links_client
  ON public.commercial_record_links(client_id);

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
ALTER TABLE public.marketing_segments            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_icp_profiles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_campaign_briefs     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_commercial_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commercial_record_links       ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='marketing_segments' AND policyname='ic_seg_sel') THEN
    CREATE POLICY ic_seg_sel ON public.marketing_segments FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='marketing_segments' AND policyname='ic_seg_all') THEN
    CREATE POLICY ic_seg_all ON public.marketing_segments FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='commercial_record_links' AND policyname='ic_crl_sel') THEN
    CREATE POLICY ic_crl_sel ON public.commercial_record_links FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='commercial_record_links' AND policyname='ic_crl_all') THEN
    CREATE POLICY ic_crl_all ON public.commercial_record_links FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketing_segments            TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketing_icp_profiles        TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketing_campaign_briefs     TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketing_commercial_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.commercial_record_links       TO authenticated;

-- -----------------------------------------------------------------------------
-- RPC 1: Métricas agregadas da Visão Geral
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.fn_ic_overview_metrics(date, date);

CREATE OR REPLACE FUNCTION public.fn_ic_overview_metrics(
  p_date_from date,
  p_date_to   date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_clientes_atendidos    integer := 0;
  v_novos_clientes        integer := 0;
  v_clientes_retorno      integer := 0;
  v_participacao_retorno  numeric := NULL;
  v_interessados          integer := 0;
  v_leads_com_agendamento integer := 0;
  v_conversao_agendamento numeric := NULL;
  v_retornos_pendentes    integer := 0;
  v_interessados_sem_acao integer := 0;
  v_total_appts           integer := 0;
  v_appts_com_client      integer := 0;
  v_hoje                  date    := (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::date;
  
  -- Financeiro via sheet_transactions e commercial_record_links
  v_transacoes_total       integer := 0;
  v_transacoes_vinculadas  integer := 0;
  v_receita_vinculada      numeric := 0;
  v_clientes_pagantes      integer := 0;
  v_ticket_medio           numeric := NULL;
  v_receita_status         text    := 'indisponivel';
  v_cobertura_financeira   numeric := 0;
BEGIN
  -- 1. Clientes distintos com atendimento finalizado no período
  SELECT COUNT(DISTINCT client_id)
  INTO v_clientes_atendidos
  FROM appointments
  WHERE status = 'finalizado'
    AND appointment_date >= p_date_from
    AND appointment_date <= p_date_to
    AND client_id IS NOT NULL;

  -- 2. Novos clientes: primeiro atendimento concluído em toda a base ocorreu dentro do período
  SELECT COUNT(*)
  INTO v_novos_clientes
  FROM (
    SELECT client_id
    FROM appointments
    WHERE status = 'finalizado' AND client_id IS NOT NULL
    GROUP BY client_id
    HAVING MIN(appointment_date) >= p_date_from
       AND MIN(appointment_date) <= p_date_to
  ) sub;

  -- 3. Clientes que retornaram: atendidos no período que possuem histórico anterior ao período
  SELECT COUNT(DISTINCT a.client_id)
  INTO v_clientes_retorno
  FROM appointments a
  WHERE a.status = 'finalizado'
    AND a.appointment_date >= p_date_from
    AND a.appointment_date <= p_date_to
    AND a.client_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM appointments prev
      WHERE prev.client_id = a.client_id
        AND prev.status = 'finalizado'
        AND prev.appointment_date < p_date_from
    );

  IF v_clientes_atendidos > 0 THEN
    v_participacao_retorno := ROUND((v_clientes_retorno::numeric / v_clientes_atendidos) * 100, 1);
  END IF;

  -- 4. Interessados registrados no período
  SELECT COUNT(*)
  INTO v_interessados
  FROM crm_leads
  WHERE (created_at AT TIME ZONE 'America/Sao_Paulo')::date >= p_date_from
    AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date <= p_date_to;

  -- 5. Leads da coorte com agendamento VÁLIDO (não cancelado e até a data de corte)
  SELECT COUNT(DISTINCT l.id)
  INTO v_leads_com_agendamento
  FROM crm_leads l
  INNER JOIN appointments a ON a.id = l.appointment_id
  WHERE (l.created_at AT TIME ZONE 'America/Sao_Paulo')::date >= p_date_from
    AND (l.created_at AT TIME ZONE 'America/Sao_Paulo')::date <= p_date_to
    AND l.appointment_id IS NOT NULL
    AND a.status NOT IN ('cancelado', 'desmarcado', 'falta')
    AND a.appointment_date <= p_date_to;

  IF v_interessados > 0 THEN
    v_conversao_agendamento := ROUND((v_leads_com_agendamento::numeric / v_interessados) * 100, 1);
  END IF;

  -- 6. Oportunidades operacionais (exclui arquivados e encerrados)
  SELECT COUNT(*)
  INTO v_retornos_pendentes
  FROM crm_leads
  WHERE (arquivado IS FALSE OR arquivado IS NULL)
    AND status NOT IN ('encerrado_ganho', 'encerrado_perdido', 'arquivado')
    AND proxima_acao_prazo < v_hoje
    AND (proxima_acao_concluida IS FALSE OR proxima_acao_concluida IS NULL);

  -- "Sem ação": lead ativo que NÃO possui próxima ação pendente válida.
  -- Ação pendente válida: prazo preenchido + descrição não vazia (TRIM exclui espaços) + não concluída.
  -- Tarefa concluída (proxima_acao_concluida=TRUE) conta como sem ação mesmo com prazo e descrição preenchidos.
  SELECT COUNT(*)
  INTO v_interessados_sem_acao
  FROM crm_leads
  WHERE (arquivado IS FALSE OR arquivado IS NULL)
    AND status NOT IN ('encerrado_ganho', 'encerrado_perdido', 'arquivado')
    AND NOT (
      proxima_acao_prazo IS NOT NULL
      AND proxima_acao_descricao IS NOT NULL
      AND TRIM(proxima_acao_descricao) <> ''
      AND (proxima_acao_concluida IS FALSE OR proxima_acao_concluida IS NULL)
    );

  -- 7. Cobertura de atendimentos
  SELECT COUNT(*), COUNT(client_id)
  INTO v_total_appts, v_appts_com_client
  FROM appointments
  WHERE status = 'finalizado'
    AND appointment_date >= p_date_from
    AND appointment_date <= p_date_to;

  -- 8. Recebimentos confirmados e cobertura financeira via sheet_transactions e commercial_record_links
  SELECT
    COUNT(*),
    COUNT(crl.id),
    COALESCE(SUM(
      CASE 
        WHEN crl.id IS NOT NULL THEN st.gross
        ELSE 0
      END
    ), 0),
    COUNT(DISTINCT crl.client_id)
  INTO
    v_transacoes_total,
    v_transacoes_vinculadas,
    v_receita_vinculada,
    v_clientes_pagantes
  FROM sheet_transactions st
  LEFT JOIN commercial_record_links crl
    ON crl.source_table = 'sheet_transactions'
   AND crl.source_id = st.id::text
  WHERE st.date_ref >= p_date_from
    AND st.date_ref <= p_date_to
    AND st.deleted_at IS NULL
    AND (st.is_metadata IS NOT TRUE OR st.is_metadata IS NULL)
    -- Classificação comprovada: apenas receitas reais de procedimentos realizados e pagos na hora.
    -- Sem funcionalidade de estorno nesta entrega.
    AND lower(COALESCE(st.row_type, st.tipo, '')) = 'receita'
    AND NOT (lower(COALESCE(st.row_type, st.tipo, '')) LIKE ANY (ARRAY['despesa%', 'saida%', 'saída%', 'sangria%', 'gasto%', 'total%', 'resumo%']))
    AND NOT (lower(COALESCE(st.client, '')) LIKE ANY (ARRAY['sangria%', 'despesa%', 'passagem%', 'produtos%', 'tributos%', 'outras saída%', 'outras saida%', 'total%', 'resumo%']))
    AND NOT (lower(COALESCE(st.procedure, '')) LIKE ANY (ARRAY['sangria%', 'despesa%', 'passagem%', 'produtos%', 'tributos%', 'outras saída%', 'outras saida%', 'total%', 'resumo%']));

  IF v_transacoes_total = 0 THEN
    v_receita_status := 'sem_lancamentos';
    v_cobertura_financeira := 0;
  ELSIF v_transacoes_vinculadas = 0 THEN
    v_receita_status := 'indisponivel';
    v_cobertura_financeira := 0;
  ELSIF v_transacoes_vinculadas = v_transacoes_total THEN
    v_receita_status := 'disponivel';
    v_cobertura_financeira := 100.0;
  ELSE
    v_receita_status := 'parcial';
    v_cobertura_financeira := ROUND((v_transacoes_vinculadas::numeric / v_transacoes_total) * 100, 1);
  END IF;

  IF v_clientes_pagantes > 0 AND v_receita_vinculada > 0 THEN
    v_ticket_medio := ROUND(v_receita_vinculada / v_clientes_pagantes, 2);
  END IF;

  RETURN jsonb_build_object(
    'periodo', jsonb_build_object('from', p_date_from, 'to', p_date_to),
    'data_referencia', v_hoje,
    'clientes_atendidos',   v_clientes_atendidos,
    'novos_clientes',       v_novos_clientes,
    'clientes_retorno',     v_clientes_retorno,
    'participacao_retorno', v_participacao_retorno,
    'interessados',         v_interessados,
    'leads_com_agendamento',v_leads_com_agendamento,
    'conversao_agendamento',v_conversao_agendamento,
    'retornos_pendentes',   v_retornos_pendentes,
    'interessados_sem_acao',v_interessados_sem_acao,
    'saude_base', jsonb_build_object(
      'total_appointments',             v_total_appts,
      'appointments_com_client',        v_appts_com_client,
      'pct_com_client', CASE
        WHEN v_total_appts > 0
        THEN ROUND((v_appts_com_client::numeric / v_total_appts) * 100, 1)
        ELSE NULL
      END,
      'transacoes_total',               v_transacoes_total,
      'transacoes_vinculadas',          v_transacoes_vinculadas,
      'cobertura_financeira_pct',       v_cobertura_financeira
    ),
    'receita_status', v_receita_status,
    'receita_liquida_vinculada', v_receita_vinculada,
    'clientes_pagantes_vinculados', v_clientes_pagantes,
    'ticket_medio_vinculado', v_ticket_medio,
    'receita_nota', CASE
      WHEN v_receita_status = 'disponivel' THEN '100% dos lançamentos do período conciliados com clientes.'
      WHEN v_receita_status = 'parcial' THEN format('%s%% dos lançamentos conciliados com clientes via commercial_record_links.', v_cobertura_financeira)
      WHEN v_receita_status = 'sem_lancamentos' THEN 'Nenhum lançamento financeiro registrado para o período.'
      ELSE 'Lançamentos sem associação confirmada com clientes. Associe via conciliação para habilitar valores.'
    END
  );
END;
$$;

-- -----------------------------------------------------------------------------
-- RPC 2: Estatísticas por canal de origem dos leads
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.fn_ic_canal_stats(date, date);

CREATE OR REPLACE FUNCTION public.fn_ic_canal_stats(
  p_date_from date,
  p_date_to   date
)
RETURNS TABLE (
  canal                         text,
  interessados_total            bigint,
  interessados_com_agendamento  bigint,
  clientes_atendidos_vinculados bigint,
  recebimentos_atribuidos       numeric
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH lead_agg AS (
    SELECT
      COALESCE(NULLIF(TRIM(l.origem), ''), 'Não informada') AS canal_nome,
      COUNT(l.id) AS total_leads,
      COUNT(DISTINCT l.id) FILTER (
        WHERE l.appointment_id IS NOT NULL
          AND a.id IS NOT NULL
          AND a.status NOT IN ('cancelado', 'desmarcado', 'falta')
          AND a.appointment_date <= p_date_to
      ) AS total_com_agend,
      COUNT(DISTINCT a.client_id) FILTER (
        WHERE a.status = 'finalizado'
          AND a.appointment_date >= p_date_from
          AND a.appointment_date <= p_date_to
          AND a.client_id IS NOT NULL
      ) AS total_atendidos
    FROM crm_leads l
    LEFT JOIN appointments a ON a.id = l.appointment_id
    WHERE (l.created_at AT TIME ZONE 'America/Sao_Paulo')::date >= p_date_from
      AND (l.created_at AT TIME ZONE 'America/Sao_Paulo')::date <= p_date_to
    GROUP BY COALESCE(NULLIF(TRIM(l.origem), ''), 'Não informada')
  ),
  -- Transações elegíveis do período vinculadas a pacientes
  tx_with_client AS (
    SELECT
      st.id AS tx_id,
      crl.client_id,
      st.gross AS net_val,
      st.date_ref
    FROM sheet_transactions st
    INNER JOIN commercial_record_links crl
      ON crl.source_table = 'sheet_transactions'
     AND crl.source_id = st.id::text
    WHERE st.date_ref >= p_date_from
      AND st.date_ref <= p_date_to
      AND st.deleted_at IS NULL
      AND (st.is_metadata IS NOT TRUE OR st.is_metadata IS NULL)
      -- Classificação comprovada: apenas receitas reais. Sem estornos.
      AND lower(COALESCE(st.row_type, st.tipo, '')) = 'receita'
      AND NOT (lower(COALESCE(st.row_type, st.tipo, '')) LIKE ANY (ARRAY['despesa%', 'saida%', 'saída%', 'sangria%', 'gasto%', 'total%', 'resumo%']))
      AND NOT (lower(COALESCE(st.client, '')) LIKE ANY (ARRAY['sangria%', 'despesa%', 'passagem%', 'produtos%', 'tributos%', 'outras saída%', 'outras saida%', 'total%', 'resumo%']))
      AND NOT (lower(COALESCE(st.procedure, '')) LIKE ANY (ARRAY['sangria%', 'despesa%', 'passagem%', 'produtos%', 'tributos%', 'outras saída%', 'outras saida%', 'total%', 'resumo%']))
  ),
  -- Atribuição comprovada 1-para-1 por transação para evitar duplicação em múltiplos leads:
  -- Prioridade 1: Agendamento do cliente na data do pagamento que está vinculado a um lead
  -- Prioridade 2: Origem única e inequívoca do cliente (se todos os leads do cliente possuem a mesma origem)
  -- Sem comprovação suficiente: 'Não atribuído'
  tx_attributed AS (
    SELECT
      tx.tx_id,
      tx.net_val,
      COALESCE(
        (
          SELECT COALESCE(NULLIF(TRIM(l.origem), ''), 'Não informada')
          FROM crm_leads l
          INNER JOIN appointments a ON a.id = l.appointment_id
          WHERE a.client_id = tx.client_id
            AND a.appointment_date = tx.date_ref
            AND a.status NOT IN ('cancelado', 'desmarcado', 'falta')
          ORDER BY l.created_at DESC
          LIMIT 1
        ),
        (
          SELECT COALESCE(NULLIF(TRIM(MIN(l.origem)), ''), 'Não informada')
          FROM crm_leads l
          WHERE l.client_id = tx.client_id
            AND (l.created_at AT TIME ZONE 'America/Sao_Paulo')::date <= tx.date_ref
          HAVING COUNT(DISTINCT COALESCE(NULLIF(TRIM(l.origem), ''), 'Não informada')) = 1
        ),
        'Não atribuído'
      ) AS canal_atribuido
    FROM tx_with_client tx
  ),
  canal_financeiro AS (
    SELECT
      ta.canal_atribuido AS canal_nome,
      COALESCE(SUM(ta.net_val), 0) AS valor_atribuido
    FROM tx_attributed ta
    GROUP BY ta.canal_atribuido
  ),
  todos_canais AS (
    SELECT canal_nome FROM lead_agg
    UNION
    SELECT canal_nome FROM canal_financeiro
  )
  SELECT
    tc.canal_nome                                    AS canal,
    COALESCE(la.total_leads, 0)                      AS interessados_total,
    COALESCE(la.total_com_agend, 0)                  AS interessados_com_agendamento,
    COALESCE(la.total_atendidos, 0)                  AS clientes_atendidos_vinculados,
    COALESCE(cf.valor_atribuido, 0)                  AS recebimentos_atribuidos
  FROM todos_canais tc
  LEFT JOIN lead_agg la ON la.canal_nome = tc.canal_nome
  LEFT JOIN canal_financeiro cf ON cf.canal_nome = tc.canal_nome
  ORDER BY COALESCE(la.total_leads, 0) DESC, COALESCE(cf.valor_atribuido, 0) DESC;
END;
$$;

-- -----------------------------------------------------------------------------
-- RPC 3: RFM de clientes com data de corte, modos de filtro, receita e paginação
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.fn_ic_client_rfm(date, date, integer, integer);
DROP FUNCTION IF EXISTS public.fn_ic_client_rfm(date, date, integer, integer, text);

CREATE OR REPLACE FUNCTION public.fn_ic_client_rfm(
  p_date_from    date,
  p_date_to      date,
  p_limit        integer DEFAULT 50,
  p_offset       integer DEFAULT 0,
  p_filter_mode  text    DEFAULT 'atendidos_periodo'
)
RETURNS TABLE (
  client_id            integer,
  client_name          text,
  client_source        text,
  primeiro_atendimento date,
  ultimo_atendimento   date,
  dias_sem_atendimento integer,
  atendimentos_periodo bigint,
  atendimentos_total   bigint,
  valor_periodo        numeric,
  valor_total          numeric,
  total_count          bigint
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH client_revenue AS (
    SELECT
      crl.client_id AS rev_client_id,
      COALESCE(SUM(
        CASE 
          WHEN st.date_ref >= p_date_from AND st.date_ref <= p_date_to THEN st.gross
          ELSE 0
        END
      ), 0) AS rec_periodo,
      COALESCE(SUM(
        CASE 
          WHEN st.date_ref <= p_date_to THEN st.gross
          ELSE 0
        END
      ), 0) AS rec_total
    FROM commercial_record_links crl
    INNER JOIN sheet_transactions st
      ON st.id::text = crl.source_id
     AND crl.source_table = 'sheet_transactions'
    WHERE st.deleted_at IS NULL
      AND (st.is_metadata IS NOT TRUE OR st.is_metadata IS NULL)
      -- Classificação comprovada: apenas receitas reais. Sem estornos.
      -- NOT (expr LIKE ANY (ARRAY[...])) é sintaxe PostgreSQL válida e correta.
      AND lower(COALESCE(st.row_type, st.tipo, '')) = 'receita'
      AND NOT (lower(COALESCE(st.row_type, st.tipo, '')) LIKE ANY (ARRAY['despesa%', 'saida%', 'saída%', 'sangria%', 'gasto%', 'total%', 'resumo%']))
      AND NOT (lower(COALESCE(st.client, '')) LIKE ANY (ARRAY['sangria%', 'despesa%', 'passagem%', 'produtos%', 'tributos%', 'outras saída%', 'outras saida%', 'total%', 'resumo%']))
      AND NOT (lower(COALESCE(st.procedure, '')) LIKE ANY (ARRAY['sangria%', 'despesa%', 'passagem%', 'produtos%', 'tributos%', 'outras saída%', 'outras saida%', 'total%', 'resumo%']))
    GROUP BY crl.client_id
  ),
  filtered_clients AS (
    SELECT
      c.id                                                                         AS cid,
      c.name                                                                       AS cname,
      COALESCE(
        c.source,
        (SELECT l.origem FROM crm_leads l WHERE l.client_id = c.id AND l.origem IS NOT NULL AND TRIM(l.origem) <> '' ORDER BY l.created_at ASC LIMIT 1)
      )                                                                            AS csource,
      MIN(a.appointment_date) FILTER (WHERE a.status = 'finalizado')               AS prim_atend,
      MAX(a.appointment_date) FILTER (WHERE a.status = 'finalizado' AND a.appointment_date <= p_date_to) AS ult_atend,
      (p_date_to - MAX(a.appointment_date) FILTER (WHERE a.status = 'finalizado' AND a.appointment_date <= p_date_to))::integer AS dias_sem,
      COUNT(a.id) FILTER (
        WHERE a.status = 'finalizado' AND a.appointment_date >= p_date_from AND a.appointment_date <= p_date_to
      )                                                                            AS appts_per,
      COUNT(a.id) FILTER (
        WHERE a.status = 'finalizado' AND a.appointment_date <= p_date_to
      )                                                                            AS appts_tot,
      COALESCE(cr.rec_periodo, 0)                                                  AS v_per,
      COALESCE(cr.rec_total, 0)                                                    AS v_tot
    FROM clients c
    LEFT JOIN appointments a ON a.client_id = c.id
    LEFT JOIN client_revenue cr ON cr.rev_client_id = c.id
    GROUP BY c.id, c.name, c.source, cr.rec_periodo, cr.rec_total
    HAVING (
      CASE p_filter_mode
        WHEN 'sem_retorno' THEN
          COUNT(a.id) FILTER (WHERE a.status = 'finalizado' AND a.appointment_date < p_date_from) > 0
          AND COUNT(a.id) FILTER (WHERE a.status = 'finalizado' AND a.appointment_date >= p_date_from AND a.appointment_date <= p_date_to) = 0
        WHEN 'todos' THEN
          COUNT(a.id) FILTER (WHERE a.status = 'finalizado' AND a.appointment_date <= p_date_to) > 0
        ELSE
          COUNT(a.id) FILTER (WHERE a.status = 'finalizado' AND a.appointment_date >= p_date_from AND a.appointment_date <= p_date_to) > 0
      END
    )
  ),
  counted AS (
    SELECT COUNT(*) AS total_rows FROM filtered_clients
  )
  SELECT
    fc.cid            AS client_id,
    fc.cname          AS client_name,
    fc.csource        AS client_source,
    fc.prim_atend     AS primeiro_atendimento,
    fc.ult_atend      AS ultimo_atendimento,
    fc.dias_sem       AS dias_sem_atendimento,
    fc.appts_per      AS atendimentos_periodo,
    fc.appts_tot      AS atendimentos_total,
    fc.v_per          AS valor_periodo,
    fc.v_tot          AS valor_total,
    cnt.total_rows    AS total_count
  FROM filtered_clients fc
  CROSS JOIN counted cnt
  ORDER BY fc.dias_sem ASC NULLS LAST, fc.appts_per DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$;

-- -----------------------------------------------------------------------------
-- RPC 4: Preview de segmento de leads com operadores estritos
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.fn_ic_segment_preview_leads(jsonb, integer);

CREATE OR REPLACE FUNCTION public.fn_ic_segment_preview_leads(
  p_conditions jsonb,
  p_limit      integer DEFAULT 20
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_where_parts text[] := ARRAY[]::text[];
  v_where_sql   text   := '';
  v_cond        jsonb;
  v_field       text;
  v_op          text;
  v_val         text;
  v_count       integer;
  v_sample      jsonb;
  i             integer;
BEGIN
  IF p_conditions IS NULL OR jsonb_array_length(p_conditions) = 0 THEN
    SELECT COUNT(*), jsonb_agg(row_to_json(sub))
    INTO v_count, v_sample
    FROM (
      SELECT id, nome, origem, servico_interesse, status, created_at
      FROM crm_leads ORDER BY created_at DESC LIMIT p_limit
    ) sub;
    RETURN jsonb_build_object(
      'count', COALESCE(v_count, 0),
      'sample', COALESCE(v_sample, '[]'::jsonb),
      'conditions_applied', 0
    );
  END IF;

  FOR i IN 0 .. jsonb_array_length(p_conditions) - 1 LOOP
    v_cond  := p_conditions -> i;
    v_field := v_cond ->> 'field';
    v_op    := v_cond ->> 'operator';
    v_val   := v_cond ->> 'value';

    IF v_field = 'proxima_acao_concluida' THEN
      IF v_op NOT IN ('eq', 'is_null', 'not_null') THEN
        RETURN jsonb_build_object('error', 'Operador "' || COALESCE(v_op, '') || '" inválido para campo booleano ' || v_field);
      END IF;
      v_where_parts := v_where_parts || (
        CASE v_op
          WHEN 'eq'       THEN format('%I = %L::boolean', v_field, (v_val = 'true' OR v_val = 't' OR v_val = '1'))
          WHEN 'is_null'  THEN format('%I IS NULL', v_field)
          WHEN 'not_null' THEN format('%I IS NOT NULL', v_field)
        END
      );

    ELSIF v_field IN ('proxima_acao_prazo', 'created_at') THEN
      IF v_op NOT IN ('eq', 'neq', 'gte', 'lte', 'is_null', 'not_null') THEN
        RETURN jsonb_build_object('error', 'Operador "' || COALESCE(v_op, '') || '" inválido para data ' || v_field);
      END IF;
      v_where_parts := v_where_parts || (
        CASE v_op
          WHEN 'eq'       THEN format('(%I)::date = %L::date', v_field, v_val)
          WHEN 'neq'      THEN format('(%I)::date <> %L::date', v_field, v_val)
          WHEN 'gte'      THEN format('(%I)::date >= %L::date', v_field, v_val)
          WHEN 'lte'      THEN format('(%I)::date <= %L::date', v_field, v_val)
          WHEN 'is_null'  THEN format('%I IS NULL', v_field)
          WHEN 'not_null' THEN format('%I IS NOT NULL', v_field)
        END
      );

    ELSIF v_field IN ('origem', 'servico_interesse', 'status', 'responsavel', 'nome') THEN
      IF v_op NOT IN ('eq', 'neq', 'contains', 'is_null', 'not_null') THEN
        RETURN jsonb_build_object('error', 'Operador "' || COALESCE(v_op, '') || '" inválido para texto ' || v_field);
      END IF;
      v_where_parts := v_where_parts || (
        CASE v_op
          WHEN 'eq'       THEN format('%I = %L', v_field, v_val)
          WHEN 'neq'      THEN format('%I <> %L', v_field, v_val)
          WHEN 'contains' THEN format('%I ILIKE %L', v_field, '%' || v_val || '%')
          WHEN 'is_null'  THEN format('%I IS NULL', v_field)
          WHEN 'not_null' THEN format('%I IS NOT NULL', v_field)
        END
      );

    ELSE
      RETURN jsonb_build_object('error', 'Campo não permitido para segmento de interessados: ' || COALESCE(v_field, '(nulo)'));
    END IF;
  END LOOP;

  IF array_length(v_where_parts, 1) > 0 THEN
    v_where_sql := ' AND ' || array_to_string(v_where_parts, ' AND ');
  END IF;

  EXECUTE format('SELECT COUNT(*) FROM crm_leads WHERE true %s', v_where_sql)
  INTO v_count;

  EXECUTE format(
    $q$SELECT jsonb_agg(row_to_json(sub)) FROM (
         SELECT id, nome, origem, servico_interesse, status, created_at
         FROM crm_leads WHERE true %s ORDER BY created_at DESC LIMIT %s
       ) sub$q$,
    v_where_sql, p_limit
  ) INTO v_sample;

  RETURN jsonb_build_object(
    'count',              COALESCE(v_count, 0),
    'sample',             COALESCE(v_sample, '[]'::jsonb),
    'conditions_applied', jsonb_array_length(p_conditions)
  );
END;
$$;

-- -----------------------------------------------------------------------------
-- RPC 5: Preview de clientes com frequência, serviço e janela temporal
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.fn_ic_segment_preview_clients(jsonb, integer);
DROP FUNCTION IF EXISTS public.fn_ic_segment_preview_clients(jsonb, integer, integer);

CREATE OR REPLACE FUNCTION public.fn_ic_segment_preview_clients(
  p_conditions  jsonb,
  p_limit       integer DEFAULT 20,
  p_janela_dias integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_where_parts text[] := ARRAY[]::text[];
  v_where_sql   text   := '';
  v_cond        jsonb;
  v_field       text;
  v_op          text;
  v_val         text;
  v_count       integer;
  v_sample      jsonb;
  i             integer;
  v_query       text;
BEGIN
  IF p_conditions IS NOT NULL AND jsonb_array_length(p_conditions) > 0 THEN
    FOR i IN 0 .. jsonb_array_length(p_conditions) - 1 LOOP
      v_cond  := p_conditions -> i;
      v_field := v_cond ->> 'field';
      v_op    := v_cond ->> 'operator';
      v_val   := v_cond ->> 'value';

      IF v_field IN ('total_atendimentos', 'dias_sem_atendimento', 'atendimentos_janela') THEN
        IF v_op NOT IN ('eq', 'neq', 'gte', 'lte', 'is_null', 'not_null') THEN
          RETURN jsonb_build_object('error', 'Operador "' || COALESCE(v_op, '') || '" inválido para campo numérico ' || v_field);
        END IF;
        v_where_parts := v_where_parts || (
          CASE v_op
            WHEN 'eq'       THEN format('%I = %s', v_field, COALESCE(NULLIF(v_val, ''), '0'))
            WHEN 'neq'      THEN format('%I <> %s', v_field, COALESCE(NULLIF(v_val, ''), '0'))
            WHEN 'gte'      THEN format('%I >= %s', v_field, COALESCE(NULLIF(v_val, ''), '0'))
            WHEN 'lte'      THEN format('%I <= %s', v_field, COALESCE(NULLIF(v_val, ''), '0'))
            WHEN 'is_null'  THEN format('%I IS NULL', v_field)
            WHEN 'not_null' THEN format('%I IS NOT NULL', v_field)
          END
        );

      ELSIF v_field = 'servico_realizado' THEN
        IF v_op NOT IN ('eq', 'neq', 'contains', 'is_null', 'not_null') THEN
          RETURN jsonb_build_object('error', 'Operador "' || COALESCE(v_op, '') || '" inválido para serviço realizado');
        END IF;
        v_where_parts := v_where_parts || (
          CASE v_op
            WHEN 'eq'       THEN format('%L = ANY(servicos_realizados)', v_val)
            WHEN 'neq'      THEN format('NOT (%L = ANY(servicos_realizados))', v_val)
            WHEN 'contains' THEN format('EXISTS (SELECT 1 FROM unnest(servicos_realizados) s WHERE s ILIKE %L)', '%' || v_val || '%')
            WHEN 'is_null'  THEN 'array_length(servicos_realizados, 1) IS NULL'
            WHEN 'not_null' THEN 'array_length(servicos_realizados, 1) > 0'
          END
        );

      ELSIF v_field IN ('name', 'source', 'status', 'city', 'neighborhood') THEN
        IF v_op NOT IN ('eq', 'neq', 'contains', 'is_null', 'not_null') THEN
          RETURN jsonb_build_object('error', 'Operador "' || COALESCE(v_op, '') || '" inválido para texto ' || v_field);
        END IF;
        v_where_parts := v_where_parts || (
          CASE v_op
            WHEN 'eq'       THEN format('%I = %L', v_field, v_val)
            WHEN 'neq'      THEN format('%I <> %L', v_field, v_val)
            WHEN 'contains' THEN format('%I ILIKE %L', v_field, '%' || v_val || '%')
            WHEN 'is_null'  THEN format('%I IS NULL', v_field)
            WHEN 'not_null' THEN format('%I IS NOT NULL', v_field)
          END
        );

      ELSE
        RETURN jsonb_build_object('error', 'Campo não permitido para segmento de clientes: ' || COALESCE(v_field, '(nulo)'));
      END IF;
    END LOOP;
  END IF;

  IF array_length(v_where_parts, 1) > 0 THEN
    v_where_sql := ' AND ' || array_to_string(v_where_parts, ' AND ');
  END IF;

  v_query := format(
    $base$
    WITH client_stats AS (
      SELECT
        c.id,
        c.name,
        COALESCE(c.status, 'ativo') AS status,
        COALESCE(
          c.source,
          (SELECT l.origem FROM crm_leads l WHERE l.client_id = c.id AND l.origem IS NOT NULL AND TRIM(l.origem) <> '' ORDER BY l.created_at ASC LIMIT 1)
        ) AS source,
        c.city,
        c.neighborhood,
        COUNT(a.id) FILTER (WHERE a.status = 'finalizado') AS total_atendimentos,
        COUNT(a.id) FILTER (
          WHERE a.status = 'finalizado'
            AND (%L::integer IS NULL OR a.appointment_date >= CURRENT_DATE - (%L::integer || ' days')::interval)
        ) AS atendimentos_janela,
        MAX(a.appointment_date) FILTER (WHERE a.status = 'finalizado') AS ultimo_atendimento,
        (CURRENT_DATE - MAX(a.appointment_date) FILTER (WHERE a.status = 'finalizado'))::integer AS dias_sem_atendimento,
        ARRAY_AGG(DISTINCT a.procedure) FILTER (WHERE a.status = 'finalizado' AND a.procedure IS NOT NULL) AS servicos_realizados
      FROM clients c
      LEFT JOIN appointments a ON a.client_id = c.id
      GROUP BY c.id, c.name, c.status, c.source, c.city, c.neighborhood
    )
    $base$,
    p_janela_dias, p_janela_dias
  );

  EXECUTE v_query || format('SELECT COUNT(*) FROM client_stats WHERE true %s', v_where_sql)
  INTO v_count;

  EXECUTE v_query || format(
    $q$SELECT jsonb_agg(row_to_json(sub)) FROM (
         SELECT id, name, source, status, city, neighborhood, total_atendimentos, dias_sem_atendimento
         FROM client_stats WHERE true %s LIMIT %s
       ) sub$q$,
    v_where_sql, p_limit
  ) INTO v_sample;

  RETURN jsonb_build_object(
    'count',              COALESCE(v_count, 0),
    'sample',             COALESCE(v_sample, '[]'::jsonb),
    'conditions_applied', COALESCE(jsonb_array_length(p_conditions), 0)
  );
END;
$$;

-- -----------------------------------------------------------------------------
-- RPC 6: Consulta de transações não vinculadas para conciliação financeira
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.fn_ic_unlinked_transactions(date, date, integer, integer);

CREATE OR REPLACE FUNCTION public.fn_ic_unlinked_transactions(
  p_date_from date,
  p_date_to   date,
  p_limit     integer DEFAULT 50,
  p_offset    integer DEFAULT 0
)
RETURNS TABLE (
  transaction_id        uuid,
  date_ref              date,
  client_text           text,
  procedure             text,
  professional          text,
  gross                 numeric,
  payment_method        text,
  suggested_client_id   integer,
  suggested_client_name text,
  total_unlinked        bigint
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH unlinked AS (
    SELECT
      st.id AS tx_id,
      st.date_ref AS tx_date,
      st.client AS tx_client,
      st.procedure AS tx_proc,
      st.professional AS tx_prof,
      st.gross AS tx_gross,
      st.payment_method AS tx_pm,
      c.id AS sug_id,
      c.name AS sug_name
    FROM sheet_transactions st
    LEFT JOIN commercial_record_links crl
      ON crl.source_table = 'sheet_transactions'
     AND crl.source_id = st.id::text
    LEFT JOIN LATERAL (
      SELECT cl.id, cl.name
      FROM clients cl
      WHERE cl.name ILIKE '%' || TRIM(st.client) || '%'
         OR st.client ILIKE '%' || TRIM(cl.name) || '%'
      LIMIT 1
    ) c ON true
    WHERE crl.id IS NULL
      AND st.date_ref >= p_date_from
      AND st.date_ref <= p_date_to
      AND st.deleted_at IS NULL
      AND (st.is_metadata IS NOT TRUE OR st.is_metadata IS NULL)
      -- Exclui despesas, sangrias e resumos da lista de conciliação
      AND NOT (lower(COALESCE(st.row_type, st.tipo, '')) LIKE ANY (ARRAY['despesa%', 'saida%', 'saída%', 'sangria%', 'gasto%', 'total%', 'resumo%']))
      AND NOT (lower(COALESCE(st.client, '')) LIKE ANY (ARRAY['sangria%', 'despesa%', 'passagem%', 'produtos%', 'tributos%', 'outras saída%', 'outras saida%', 'total%', 'resumo%']))
      AND NOT (lower(COALESCE(st.procedure, '')) LIKE ANY (ARRAY['sangria%', 'despesa%', 'passagem%', 'produtos%', 'tributos%', 'outras saída%', 'outras saida%', 'total%', 'resumo%']))
  ),
  counted AS (
    SELECT COUNT(*) AS total_rows FROM unlinked
  )
  SELECT
    u.tx_id,
    u.tx_date,
    u.tx_client,
    u.tx_proc,
    u.tx_prof,
    u.tx_gross,
    u.tx_pm,
    u.sug_id,
    u.sug_name,
    cnt.total_rows
  FROM unlinked u
  CROSS JOIN counted cnt
  ORDER BY u.tx_date DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$;

-- -----------------------------------------------------------------------------
-- Permissões de Execução nas RPCs
-- -----------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.fn_ic_overview_metrics(date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_ic_canal_stats(date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_ic_client_rfm(date, date, integer, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_ic_segment_preview_leads(jsonb, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_ic_segment_preview_clients(jsonb, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_ic_unlinked_transactions(date, date, integer, integer) TO authenticated;

COMMIT;
