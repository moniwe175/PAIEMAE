-- =============================================================================
-- MARKETING ENGINE — marketing_engine_fixes.sql
-- =============================================================================
-- Corrige os Bugs B e C da auditoria das 19 ferramentas:
--   * clients.last_visit e clients.total_consultas_concluidas passam a ser
--     DERIVADOS dos agendamentos (fonte da verdade), via trigger + backfill.
--   * Cria a tabela marketing_log (auditoria por ciclo do motor Python).
--   * Vincula agendamentos órfãos (client_id NULL) ao cadastro pelo nome.
--
-- SEGURO / IDEMPOTENTE: pode rodar mais de uma vez.
-- PRÉ-REQUISITO: já ter rodado marketing_engine/schema.sql (colunas extras).
-- =============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Trigger: recalcula last_visit + total_consultas_concluidas do cliente
--    sempre que um agendamento é inserido ou tem status/client_id alterado.
--    Não mantém contador duplicado: sempre reconta da tabela appointments.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.recompute_client_visit_stats()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  cid integer;
BEGIN
  cid := COALESCE(NEW.client_id, OLD.client_id);
  IF cid IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  UPDATE public.clients c
  SET
    total_consultas_concluidas = (
      SELECT count(*)
      FROM public.appointments a
      WHERE a.client_id = cid
        AND a.status IN ('finalizado', 'completed')
    ),
    last_visit = (
      SELECT max(a.appointment_date)::date
      FROM public.appointments a
      WHERE a.client_id = cid
        AND a.status IN ('finalizado', 'completed')
    )
  WHERE c.id = cid;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_appointments_visit_stats ON public.appointments;
CREATE TRIGGER trg_appointments_visit_stats
  AFTER INSERT OR UPDATE OF status, client_id ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.recompute_client_visit_stats();


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Vincula agendamentos órfãos ao cadastro do cliente (nome exato).
--    Resolve o bug histórico do formulário que criava client_id NULL.
-- ─────────────────────────────────────────────────────────────────────────────

UPDATE public.appointments a
SET client_id = c.id
FROM public.clients c
WHERE a.client_id IS NULL
  AND lower(trim(a.client_name)) = lower(trim(c.name));


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Backfill: preenche last_visit / total_consultas_concluidas de TODOS os
--    clientes a partir do histórico real de agendamentos.
-- ─────────────────────────────────────────────────────────────────────────────

UPDATE public.clients c
SET
  total_consultas_concluidas = s.cnt,
  last_visit = s.lv
FROM (
  SELECT
    a.client_id,
    count(*)::integer            AS cnt,
    max(a.appointment_date)::date AS lv
  FROM public.appointments a
  WHERE a.client_id IS NOT NULL
    AND a.status IN ('finalizado', 'completed')
  GROUP BY a.client_id
) s
WHERE c.id = s.client_id;


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Tabela de auditoria do motor (Bug C). O Python escreve 1 linha por
--    ferramenta a cada ciclo (geradas/inseridas/erro).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.marketing_log (
  id                bigserial    PRIMARY KEY,
  tool_id           integer,
  tool_name         text,
  entries_generated integer      NOT NULL DEFAULT 0,
  entries_inserted  integer      NOT NULL DEFAULT 0,
  error             text,
  created_at        timestamptz  NOT NULL DEFAULT now()
);

-- Se a tabela já existia com outro formato, garante as colunas que o motor usa
ALTER TABLE public.marketing_log
  ADD COLUMN IF NOT EXISTS tool_id integer,
  ADD COLUMN IF NOT EXISTS tool_name text,
  ADD COLUMN IF NOT EXISTS entries_generated integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS entries_inserted integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS error text,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_marketing_log_tool
  ON public.marketing_log (tool_id, created_at);

ALTER TABLE public.marketing_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_all_marketing_log" ON public.marketing_log;
CREATE POLICY "auth_all_marketing_log"
  ON public.marketing_log FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Ferramenta 12 (Recuperação de Orçamento): pausada até existir a feature
--    de orçamentos no site. Não criamos tabela fantasma sem origem de dados.
-- ─────────────────────────────────────────────────────────────────────────────

UPDATE public.message_templates
SET active = false
WHERE tool_id = 12;


-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Verificação (resultado esperado ao rodar):
-- ─────────────────────────────────────────────────────────────────────────────
SELECT c.name, c.total_consultas_concluidas, c.last_visit
FROM public.clients c
ORDER BY c.total_consultas_concluidas DESC
LIMIT 10;

SELECT count(*) AS orfaos_restantes
FROM public.appointments
WHERE client_id IS NULL AND client_name <> 'BLOQUEIO';
