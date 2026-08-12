-- ============================================================
-- fix_cashier_trigger_sangrias.sql
-- Propaga sangrias (cashier_sangrias) para
-- cashier_state.dinheiro_saidas do caixa da mesma data.
--
-- PRÉ-REQUISITO: executar ANTES o fix_cashier_trigger_sheet_sync.sql
-- (este arquivo reutiliza public.apply_cashier_delta, que já cuida de:
--  criar o caixa se não existir via ensure_cashier_for_date,
--  descartar domingos/segundas, e recalcular closing_balance de
--  caixas já fechados).
--
-- Regras:
--   1. INSERT de sangria            → soma valor em dinheiro_saidas
--   2. UPDATE de valor              → ajusta pelo diferencial
--   3. UPDATE de cashier_date       → move o valor entre caixas
--   4. DELETE físico                → subtrai
--
-- Sem dupla contagem: sangrias vindas da planilha ficam em
-- sheet_transactions com dinheiro = 0 (no-op na outra trigger);
-- a sync NUNCA escreve em cashier_sangrias. Só sangrias manuais
-- (realizarSangria → insertSangria) chegam nesta tabela.
--
-- Executar no SQL Editor do Supabase Dashboard.
-- ============================================================

-- ── 1. Função da trigger ────────────────────────────────────
-- Mesma estratégia de contribuição do sheet_transactions:
--   INSERT → +valor(NEW)
--   DELETE → -valor(OLD)
--   UPDATE → -valor(OLD) e +valor(NEW)  (cobre edição de valor
--            e mudança de data, cada um no caixa correspondente)
CREATE OR REPLACE FUNCTION public.sync_cashier_from_sangria()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_amount numeric := 0;
  v_new_amount numeric := 0;
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    v_old_amount := COALESCE(OLD.valor, 0);
  END IF;

  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    v_new_amount := COALESCE(NEW.valor, 0);
  END IF;

  IF TG_OP = 'INSERT' THEN
    PERFORM public.apply_cashier_delta(NEW.cashier_date, 'saida', v_new_amount);

  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.apply_cashier_delta(OLD.cashier_date, 'saida', -v_old_amount);

  ELSE -- UPDATE
    PERFORM public.apply_cashier_delta(OLD.cashier_date, 'saida', -v_old_amount);
    PERFORM public.apply_cashier_delta(NEW.cashier_date, 'saida', v_new_amount);
  END IF;

  RETURN NULL; -- trigger AFTER: valor de retorno é ignorado
END;
$$;

-- ── 2. Criar a trigger ──────────────────────────────────────
DROP TRIGGER IF EXISTS trg_cashier_sangrias_sync ON public.cashier_sangrias;

CREATE TRIGGER trg_cashier_sangrias_sync
  AFTER INSERT OR UPDATE OR DELETE ON public.cashier_sangrias
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_cashier_from_sangria();

-- ── 3. BACKFILL (rodar UMA vez, DEPOIS do backfill principal) ─
-- Sangrias já registradas nunca chegaram em dinheiro_saidas
-- (campo sempre foi 0), então é seguro SOMAR os totais históricos.
-- Obs.: aditivo — não re-executar este bloco. Sangrias de datas
-- sem linha em cashier_state são ignoradas (como no backfill principal).
UPDATE public.cashier_state cs
SET dinheiro_saidas = cs.dinheiro_saidas + COALESCE(t.total, 0)
FROM (
  SELECT cashier_date, SUM(COALESCE(valor, 0)) AS total
  FROM public.cashier_sangrias
  GROUP BY cashier_date
) t
WHERE cs.date = t.cashier_date;

-- ── 4. Conferir resultado ───────────────────────────────────
SELECT date, status, opening_balance, dinheiro_entradas, dinheiro_saidas, closing_balance
FROM public.cashier_state
ORDER BY date DESC
LIMIT 10;
