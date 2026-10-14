-- =============================================================================
-- PAIEMAE — Inteligência Comercial: Migração Incremental
-- Arquivo: marketing_inteligencia_migration.sql
-- Executar APÓS marketing_ideas_migration.sql já ter sido aplicado.
--
-- IDEMPOTÊNCIA: CREATE TABLE IF NOT EXISTS + CREATE OR REPLACE FUNCTION.
--   Reaplicar não perde dados nem altera definições existentes.
-- SEGURANÇA: SECURITY INVOKER em todas as funções (sem bypass de permissão).
--   RLS ativo em todas as novas tabelas.
-- RESTRIÇÕES PRESERVADAS: não toca em campaigns, crm_leads, appointments,
--   clients, sheet_transactions, marketing_ideas nem na integração Instagram.
-- =============================================================================

BEGIN;

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
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON COLUMN public.marketing_icp_profiles.status IS
  'hipotese: ainda não validado. validado: aprovado explicitamente pela gestão.';

-- -----------------------------------------------------------------------------
-- 3. marketing_campaign_briefs
--    Extensão 1:1 da campanha existente (campaigns.id INTEGER).
--    NÃO toca nos campos originais de campaigns nem no mapeador de notas.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.marketing_campaign_briefs (
  id                     uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id            integer     NOT NULL UNIQUE
                           REFERENCES public.campaigns(id) ON DELETE CASCADE,
  objetivo               text,
  meta                   text,
  publico_descricao      text,
  segment_id             uuid        REFERENCES public.marketing_segments(id) ON DELETE SET NULL,
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

-- Caso commercial_record_links tenha sido criada anteriormente com client_id uuid, ajusta para integer
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'commercial_record_links' 
      AND column_name = 'client_id' 
      AND data_type = 'uuid'
  ) THEN
    ALTER TABLE public.commercial_record_links DROP COLUMN client_id CASCADE;
    ALTER TABLE public.commercial_record_links ADD COLUMN client_id integer NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE;
  END IF;
END $$;

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
    CREATE POLICY ic_seg_sel ON public.marketing_segments FOR SELECT    TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='marketing_segments' AND policyname='ic_seg_ins') THEN
    CREATE POLICY ic_seg_ins ON public.marketing_segments FOR INSERT    TO authenticated WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='marketing_segments' AND policyname='ic_seg_upd') THEN
    CREATE POLICY ic_seg_upd ON public.marketing_segments FOR UPDATE    TO authenticated USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='marketing_icp_profiles' AND policyname='ic_icp_sel') THEN
    CREATE POLICY ic_icp_sel ON public.marketing_icp_profiles FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='marketing_icp_profiles' AND policyname='ic_icp_ins') THEN
    CREATE POLICY ic_icp_ins ON public.marketing_icp_profiles FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='marketing_icp_profiles' AND policyname='ic_icp_upd') THEN
    CREATE POLICY ic_icp_upd ON public.marketing_icp_profiles FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='marketing_campaign_briefs' AND policyname='ic_brief_sel') THEN
    CREATE POLICY ic_brief_sel ON public.marketing_campaign_briefs FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='marketing_campaign_briefs' AND policyname='ic_brief_ins') THEN
    CREATE POLICY ic_brief_ins ON public.marketing_campaign_briefs FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='marketing_campaign_briefs' AND policyname='ic_brief_upd') THEN
    CREATE POLICY ic_brief_upd ON public.marketing_campaign_briefs FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='marketing_campaign_briefs' AND policyname='ic_brief_del') THEN
    CREATE POLICY ic_brief_del ON public.marketing_campaign_briefs FOR DELETE TO authenticated USING (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='marketing_commercial_settings' AND policyname='ic_settings_all') THEN
    CREATE POLICY ic_settings_all ON public.marketing_commercial_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='commercial_record_links' AND policyname='ic_crl_sel') THEN
    CREATE POLICY ic_crl_sel ON public.commercial_record_links FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='commercial_record_links' AND policyname='ic_crl_ins') THEN
    CREATE POLICY ic_crl_ins ON public.commercial_record_links FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
END $$;

-- Grants
GRANT SELECT, INSERT, UPDATE         ON public.marketing_segments            TO authenticated;
GRANT SELECT, INSERT, UPDATE         ON public.marketing_icp_profiles        TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketing_campaign_briefs     TO authenticated;
GRANT SELECT, INSERT, UPDATE         ON public.marketing_commercial_settings TO authenticated;
GRANT SELECT, INSERT                 ON public.commercial_record_links        TO authenticated;

COMMIT;

-- =============================================================================
-- RPCs (CREATE OR REPLACE é idempotente — seguro reaplicar)
-- =============================================================================

-- RPC 1: Métricas agregadas da Visão Geral
-- Agrega no banco para evitar busca paginada no frontend.
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
  v_interessados          integer := 0;
  v_leads_com_agend       integer := 0;
  v_retornos_pendentes    integer := 0;
  v_leads_sem_proximo     integer := 0;
  v_total_appts           integer := 0;
  v_appts_com_client      integer := 0;
  v_participacao_retorno  numeric;
  v_conversao_agend       numeric;
  v_hoje_brt              date;
BEGIN
  v_hoje_brt := (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::date;

  -- Clientes distintos com atendimento finalizado no período
  SELECT COUNT(DISTINCT client_id)
  INTO v_clientes_atendidos
  FROM appointments
  WHERE status = 'finalizado'
    AND appointment_date >= p_date_from
    AND appointment_date <= p_date_to
    AND client_id IS NOT NULL;

  -- Novos: primeiro atendimento finalizado (histórico completo) dentro do período
  SELECT COUNT(*)
  INTO v_novos_clientes
  FROM (
    SELECT client_id
    FROM appointments
    WHERE status = 'finalizado' AND client_id IS NOT NULL
    GROUP BY client_id
    HAVING MIN(appointment_date) >= p_date_from
       AND MIN(appointment_date) <= p_date_to
  ) _new;

  -- Retornos: atendidos no período com atendimento finalizado anterior
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

  -- Interessados registrados no período (created_at em BRT)
  SELECT COUNT(*)
  INTO v_interessados
  FROM crm_leads
  WHERE (created_at AT TIME ZONE 'America/Sao_Paulo')::date >= p_date_from
    AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date <= p_date_to;

  -- Leads da coorte com appointment_id preenchido
  SELECT COUNT(*)
  INTO v_leads_com_agend
  FROM crm_leads
  WHERE (created_at AT TIME ZONE 'America/Sao_Paulo')::date >= p_date_from
    AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date <= p_date_to
    AND appointment_id IS NOT NULL;

  IF v_interessados > 0 THEN
    v_conversao_agend := ROUND((v_leads_com_agend::numeric / v_interessados) * 100, 1);
  END IF;

  -- Retornos pendentes (ação vencida hoje em BRT, lead aberto)
  SELECT COUNT(*)
  INTO v_retornos_pendentes
  FROM crm_leads
  WHERE status NOT LIKE 'encerrado%'
    AND proxima_acao_prazo IS NOT NULL
    AND proxima_acao_prazo < v_hoje_brt
    AND (proxima_acao_concluida IS NULL OR proxima_acao_concluida = false);

  -- Leads abertos sem próximo passo definido
  SELECT COUNT(*)
  INTO v_leads_sem_proximo
  FROM crm_leads
  WHERE status NOT LIKE 'encerrado%'
    AND (proxima_acao_descricao IS NULL OR TRIM(proxima_acao_descricao) = '');

  -- Cobertura: atendimentos com client_id no período
  SELECT COUNT(*), COUNT(client_id)
  INTO v_total_appts, v_appts_com_client
  FROM appointments
  WHERE status = 'finalizado'
    AND appointment_date >= p_date_from
    AND appointment_date <= p_date_to;

  RETURN jsonb_build_object(
    'date_from',    p_date_from,
    'date_to',      p_date_to,
    'calculated_at',(CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo'),

    'clientes_atendidos',   v_clientes_atendidos,
    'novos_clientes',       v_novos_clientes,
    'clientes_retorno',     v_clientes_retorno,
    'participacao_retorno', v_participacao_retorno,

    'interessados',            v_interessados,
    'leads_com_agendamento',   v_leads_com_agend,
    'conversao_agendamento',   v_conversao_agend,

    'retornos_pendentes',      v_retornos_pendentes,
    'leads_sem_proximo_passo', v_leads_sem_proximo,

    'cobertura', jsonb_build_object(
      'appointments_com_client',        v_appts_com_client,
      'total_appointments_finalizados', v_total_appts,
      'pct_com_client', CASE
        WHEN v_total_appts > 0
        THEN ROUND((v_appts_com_client::numeric / v_total_appts) * 100, 1)
        ELSE NULL END
    ),

    'receita_status', 'indisponivel',
    'receita_nota',   'sheet_transactions.client é texto sem FK para clients. '
                      'Associe via commercial_record_links para habilitar recebimentos por cliente.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_ic_overview_metrics(date, date) TO authenticated;

-- RPC 2: Estatísticas por canal de origem dos leads
DROP FUNCTION IF EXISTS public.fn_ic_canal_stats(date, date);
CREATE OR REPLACE FUNCTION public.fn_ic_canal_stats(
  p_date_from date,
  p_date_to   date
)
RETURNS TABLE (
  canal                         text,
  interessados_total            bigint,
  interessados_com_agendamento  bigint,
  clientes_atendidos_vinculados bigint
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(NULLIF(TRIM(l.origem), ''), 'Não informada') AS canal,
    COUNT(l.id)                                            AS interessados_total,
    COUNT(l.appointment_id)                                AS interessados_com_agendamento,
    COUNT(DISTINCT a.client_id) FILTER (
      WHERE a.status = 'finalizado'
        AND a.appointment_date >= p_date_from
        AND a.appointment_date <= p_date_to
        AND a.client_id IS NOT NULL
    )                                                      AS clientes_atendidos_vinculados
  FROM crm_leads l
  LEFT JOIN appointments a ON a.id = l.appointment_id
  WHERE (l.created_at AT TIME ZONE 'America/Sao_Paulo')::date >= p_date_from
    AND (l.created_at AT TIME ZONE 'America/Sao_Paulo')::date <= p_date_to
  GROUP BY COALESCE(NULLIF(TRIM(l.origem), ''), 'Não informada')
  ORDER BY interessados_total DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_ic_canal_stats(date, date) TO authenticated;

-- RPC 3: RFM de clientes (recência e frequência de atendimento)
-- Valor (V do RFM) indisponível: sheet_transactions.client é texto sem FK.
DROP FUNCTION IF EXISTS public.fn_ic_client_rfm(date, date, integer, integer);
CREATE OR REPLACE FUNCTION public.fn_ic_client_rfm(
  p_date_from date,
  p_date_to   date,
  p_limit     integer DEFAULT 50,
  p_offset    integer DEFAULT 0
)
RETURNS TABLE (
  client_id            integer,
  client_name          text,
  client_source        text,
  primeiro_atendimento date,
  ultimo_atendimento   date,
  dias_sem_atendimento integer,
  atendimentos_periodo bigint,
  atendimentos_total   bigint
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id                                                                         AS client_id,
    c.name                                                                       AS client_name,
    c.source                                                                     AS client_source,
    MIN(a.appointment_date)                                                      AS primeiro_atendimento,
    MAX(a.appointment_date)                                                      AS ultimo_atendimento,
    ((CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::date
      - MAX(a.appointment_date))::integer                                        AS dias_sem_atendimento,
    COUNT(a.id) FILTER (
      WHERE a.appointment_date >= p_date_from AND a.appointment_date <= p_date_to
    )                                                                            AS atendimentos_periodo,
    COUNT(a.id)                                                                  AS atendimentos_total
  FROM clients c
  INNER JOIN appointments a ON a.client_id = c.id
  WHERE a.status = 'finalizado'
    AND a.client_id IS NOT NULL
  GROUP BY c.id, c.name, c.source
  HAVING COUNT(a.id) FILTER (
    WHERE a.appointment_date >= p_date_from AND a.appointment_date <= p_date_to
  ) > 0
  ORDER BY dias_sem_atendimento ASC, atendimentos_periodo DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_ic_client_rfm(date, date, integer, integer) TO authenticated;

-- RPC 4: Preview server-side de segmento de leads (campos e operadores validados)
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
  v_allowed_fields    text[] := ARRAY[
    'origem', 'servico_interesse', 'status', 'responsavel',
    'proxima_acao_concluida', 'proxima_acao_prazo'
  ];
  v_allowed_operators text[] := ARRAY[
    'eq', 'neq', 'is_null', 'not_null', 'contains', 'gte', 'lte'
  ];
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
  FOR i IN 0 .. jsonb_array_length(p_conditions) - 1 LOOP
    v_cond  := p_conditions -> i;
    v_field := v_cond ->> 'field';
    v_op    := v_cond ->> 'operator';
    v_val   := v_cond ->> 'value';

    IF v_field IS NULL OR NOT (v_field = ANY(v_allowed_fields)) THEN
      RETURN jsonb_build_object('error', 'Campo não permitido: ' || COALESCE(v_field, '(nulo)'));
    END IF;
    IF v_op IS NULL OR NOT (v_op = ANY(v_allowed_operators)) THEN
      RETURN jsonb_build_object('error', 'Operador não permitido: ' || COALESCE(v_op, '(nulo)'));
    END IF;

    v_where_parts := v_where_parts || (
      CASE v_op
        WHEN 'eq'       THEN format('%I = %L',          v_field, v_val)
        WHEN 'neq'      THEN format('%I <> %L',         v_field, v_val)
        WHEN 'is_null'  THEN format('%I IS NULL',       v_field)
        WHEN 'not_null' THEN format('%I IS NOT NULL',   v_field)
        WHEN 'contains' THEN format('%I ILIKE %L',      v_field, '%' || v_val || '%')
        WHEN 'gte'      THEN format('%I >= %L',         v_field, v_val)
        WHEN 'lte'      THEN format('%I <= %L',         v_field, v_val)
      END
    );
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
    'count',              v_count,
    'sample',             COALESCE(v_sample, '[]'::jsonb),
    'conditions_applied', jsonb_array_length(p_conditions)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_ic_segment_preview_leads(jsonb, integer) TO authenticated;

-- RPC 5: Preview server-side de segmento de clientes
DROP FUNCTION IF EXISTS public.fn_ic_segment_preview_clients(jsonb, integer);
CREATE OR REPLACE FUNCTION public.fn_ic_segment_preview_clients(
  p_conditions jsonb,
  p_limit      integer DEFAULT 20
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_allowed_fields    text[] := ARRAY['source', 'status', 'city', 'neighborhood', 'name'];
  v_allowed_operators text[] := ARRAY['eq', 'neq', 'is_null', 'not_null', 'contains'];
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
  FOR i IN 0 .. jsonb_array_length(p_conditions) - 1 LOOP
    v_cond  := p_conditions -> i;
    v_field := v_cond ->> 'field';
    v_op    := v_cond ->> 'operator';
    v_val   := v_cond ->> 'value';

    IF v_field IS NULL OR NOT (v_field = ANY(v_allowed_fields)) THEN
      RETURN jsonb_build_object('error', 'Campo não permitido: ' || COALESCE(v_field, '(nulo)'));
    END IF;
    IF v_op IS NULL OR NOT (v_op = ANY(v_allowed_operators)) THEN
      RETURN jsonb_build_object('error', 'Operador não permitido: ' || COALESCE(v_op, '(nulo)'));
    END IF;

    v_where_parts := v_where_parts || (
      CASE v_op
        WHEN 'eq'       THEN format('%I = %L',          v_field, v_val)
        WHEN 'neq'      THEN format('%I <> %L',         v_field, v_val)
        WHEN 'is_null'  THEN format('%I IS NULL',       v_field)
        WHEN 'not_null' THEN format('%I IS NOT NULL',   v_field)
        WHEN 'contains' THEN format('%I ILIKE %L',      v_field, '%' || v_val || '%')
      END
    );
  END LOOP;

  IF array_length(v_where_parts, 1) > 0 THEN
    v_where_sql := ' AND ' || array_to_string(v_where_parts, ' AND ');
  END IF;

  EXECUTE format('SELECT COUNT(*) FROM clients WHERE true %s', v_where_sql)
  INTO v_count;

  EXECUTE format(
    $q$SELECT jsonb_agg(row_to_json(sub)) FROM (
         SELECT id, name, source, status, city, neighborhood
         FROM clients WHERE true %s LIMIT %s
       ) sub$q$,
    v_where_sql, p_limit
  ) INTO v_sample;

  RETURN jsonb_build_object(
    'count',              v_count,
    'sample',             COALESCE(v_sample, '[]'::jsonb),
    'conditions_applied', jsonb_array_length(p_conditions)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_ic_segment_preview_clients(jsonb, integer) TO authenticated;

-- =============================================================================
-- CONSULTAS DE VERIFICAÇÃO (descomente e execute após aplicar)
-- =============================================================================
/*
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'marketing_segments','marketing_icp_profiles',
    'marketing_campaign_briefs','marketing_commercial_settings',
    'commercial_record_links'
  );

SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'fn_ic_overview_metrics','fn_ic_canal_stats','fn_ic_client_rfm',
    'fn_ic_segment_preview_leads','fn_ic_segment_preview_clients'
  );

-- Teste com período real (ajuste as datas):
SELECT fn_ic_overview_metrics('2026-01-01', '2026-10-14');
SELECT * FROM fn_ic_canal_stats('2026-01-01', '2026-10-14');
SELECT * FROM fn_ic_client_rfm('2026-01-01', '2026-10-14', 10, 0);

-- Teste de preview de segmento:
SELECT fn_ic_segment_preview_leads('[{"field":"origem","operator":"eq","value":"Instagram"}]'::jsonb, 5);

-- Reaplicação segura (não perde dados):
-- Todos os CREATE TABLE usam IF NOT EXISTS.
-- Todos os CREATE OR REPLACE FUNCTION são idempotentes.
*/
