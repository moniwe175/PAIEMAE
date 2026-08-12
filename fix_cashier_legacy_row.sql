-- ============================================================
-- fix_cashier_legacy_row.sql
-- Repara a linha legada de cashier_state (status 'closed' em
-- inglês, date = NULL) criada por versão antiga do sistema.
--
-- ORDEM OBRIGATÓRIA:
--   1) já executado: fix_cashier_trigger_sheet_sync.sql
--   2) ESTE ARQUIVO
--   3) fix_cashier_trigger_sangrias.sql (continua bloqueado até aqui)
--
-- Rodar ANTES da próxima sincronização da planilha, senão o caixa
-- de terça pode ser auto-criado com opening_balance = 0 (sem herança).
-- ============================================================

-- ── A. DIAGNÓSTICO (rodar primeiro e conferir visualmente) ──
-- A1. Todos os valores distintos de status no histórico inteiro:
SELECT DISTINCT status FROM cashier_state;

-- A2. Linha(s) completa(s) — confirme a data real em closed_at / data:
SELECT id, status, date, opened_at, closed_at,
       opening_balance, closing_balance,
       dinheiro_entradas, dinheiro_saidas, data
FROM cashier_state
ORDER BY id;

-- ── B. Padronizar status para o padrão atual (aberto/fechado) ─
-- Todo o código atual (frontend, Edge Function, triggers) usa
-- português; NADA no sistema lê 'open'/'closed'. Idempotente.
UPDATE cashier_state SET status = 'fechado'
 WHERE lower(trim(status)) IN ('closed', 'close', 'fechada');

UPDATE cashier_state SET status = 'aberto'
 WHERE lower(trim(status)) IN ('open', 'aberta');

-- ── C. Backfill da data ─────────────────────────────────────
-- CONFIRMAR no diagnóstico A2 (closed_at ou o jsonb data) que a
-- data real é 30/07/2026 antes de executar.
UPDATE cashier_state
   SET date = '2026-07-30'
 WHERE id = 1 AND date IS NULL;

-- ── D. Reaplicar o backfill de entradas/saídas ───────────────
-- O backfill do arquivo anterior não pegou esta linha porque
-- cs.date era NULL (NULL nunca casa em JOIN). Agora com date
-- populada, as transações de 30/07 (se existirem) serão contadas.
UPDATE public.cashier_state cs
SET
  dinheiro_entradas = COALESCE(t.entradas, 0),
  dinheiro_saidas   = COALESCE(t.saidas, 0)
FROM (
  SELECT
    date_ref,
    SUM(CASE WHEN public.cashier_kind_of(row_type, tipo) = 'entrada'
             THEN COALESCE(dinheiro, 0) ELSE 0 END) AS entradas,
    SUM(CASE WHEN public.cashier_kind_of(row_type, tipo) = 'saida'
             THEN COALESCE(dinheiro, 0) ELSE 0 END) AS saidas
  FROM public.sheet_transactions
  WHERE deleted_at IS NULL
    AND date_ref IS NOT NULL
    AND NOT public.cashier_closed_day(date_ref)
  GROUP BY date_ref
) t
WHERE cs.date = t.date_ref;

-- ── E. closing_balance: preencher apenas onde falta ──────────
-- Versão conservadora: preserva o closing já registrado pelo
-- sistema antigo (verdade física da época); só calcula pela
-- fórmula se o campo estiver NULL. (Se o diagnóstico A2 mostrar
-- closing_balance NULL, esta linha resolve.)
UPDATE public.cashier_state
   SET closing_balance = COALESCE(opening_balance, 0)
                       + COALESCE(dinheiro_entradas, 0)
                       - COALESCE(dinheiro_saidas, 0)
 WHERE status = 'fechado' AND closing_balance IS NULL;

-- ── F. CONTINGÊNCIA (só se a sync já rodou depois da trigger e
--    auto-criou o caixa de hoje com opening_balance 0 sem herança) ──
-- UPDATE cashier_state
--    SET opening_balance = (SELECT COALESCE(closing_balance, 0)
--                             FROM cashier_state
--                            WHERE status = 'fechado' AND date < CURRENT_DATE
--                            ORDER BY date DESC LIMIT 1)
--  WHERE date = CURRENT_DATE AND status = 'aberto'
--    AND COALESCE(opening_balance, 0) = 0;

-- ── G. Conferência final ────────────────────────────────────
SELECT id, date, status, opening_balance, dinheiro_entradas, dinheiro_saidas, closing_balance
FROM cashier_state
ORDER BY date DESC NULLS LAST;
