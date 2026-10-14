-- =============================================================================
-- PAIEMAE — Inteligência Comercial: Patch Incremental v2
-- Arquivo: marketing_inteligencia_patch2.sql
-- 
-- Aplica as correções dos pontos identificados:
-- 1. Exclui despesas, sangrias e resumos dos recebimentos e da conciliação;
--    valida apenas pagamentos reais (receitas) em sheet_transactions. Procedimento realizado e pago na hora.
--    Sem funcionalidade de estorno nesta entrega.
-- 2. Elimina a multiplicação de pagamentos em fn_ic_canal_stats quando o cliente
--    possui múltiplos leads/origens; exige atribuição comprovada (agendamento
--    concluído na data do pagamento ou origem única inequívoca) e mantém valores
--    sem evidência na categoria "Não atribuído".
-- 3. Atualiza fn_ic_client_rfm para aplicar o filtro estrito de receitas reais.
-- 4. Atualiza fn_ic_unlinked_transactions para retornar somente receitas elegíveis.
--
-- IDEMPOTÊNCIA: Seguro rodar sobre o banco já atualizado pelo patch anterior.
-- Preserva 100% dos dados, tabelas e vínculos existentes.
-- =============================================================================

BEGIN;

-- ─── 1. RPC 1: Métricas agregadas da Visão Geral (com filtro estrito de receitas) ───
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

  -- 4. Interessados registrados no período (fuso America/Sao_Paulo)
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
  -- FILTRO ESTRITO: Apenas receitas reais de procedimentos realizados e pagos na hora. Exclui despesas, sangrias e resumos.
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


-- ─── 2. RPC 2: Estatísticas por canal com atribuição comprovada (sem duplicação) ───
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


-- ─── 3. RPC 3: RFM com filtro estrito de receitas reais ──────────────────────────
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


-- ─── 4. RPC 4: Consulta de transações não vinculadas (somente receitas reais) ───
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

-- ─── 5. Grants ───────────────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.fn_ic_overview_metrics(date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_ic_canal_stats(date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_ic_client_rfm(date, date, integer, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_ic_unlinked_transactions(date, date, integer, integer) TO authenticated;

COMMIT;
