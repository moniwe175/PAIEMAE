-- ============================================================
-- fix_cashier_trigger_sheet_sync.sql
-- Mantém cashier_state.dinheiro_entradas / dinheiro_saidas
-- sincronizado com sheet_transactions (sync do Google Sheets).
--
-- Regras implementadas:
--   1. INSERT de transação ativa            → soma o dinheiro no caixa da data_ref
--   2. UPDATE de valor                      → ajusta pelo diferencial (novo - antigo)
--   3. UPDATE de date_ref                   → move o valor entre caixas
--   4. Soft-delete (deleted_at NULL → valor)→ subtrai
--   5. RESTAURAÇÃO (deleted_at valor → NULL)→ soma de volta
--   6. DELETE físico                        → subtrai
--   7. Caixa inexistente para a data        → CRIA automaticamente
--      (opening_balance = closing_balance do último fechamento, ou 0)
--   8. Domingo ou segunda-feira             → IGNORA totalmente
--      (empresa fechada: não cria caixa nem aplica o delta; o que foi
--       sincronizado por engano nesses dias é descartado. O caixa de
--       sábado herda direto para o Fundo Inicial de terça-feira.)
--
-- Executar no SQL Editor do Supabase Dashboard.
-- ============================================================

-- ── 0. Garantir que as colunas existem no cashier_state ────
ALTER TABLE public.cashier_state
  ADD COLUMN IF NOT EXISTS dinheiro_entradas numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dinheiro_saidas   numeric NOT NULL DEFAULT 0;

-- ── 1. Helper: classifica a linha como entrada ou saída ─────
-- Linhas de despesa/saída afetam dinheiro_saidas; todo o resto
-- (receita, NULL, etc.) afeta dinheiro_entradas.
CREATE OR REPLACE FUNCTION public.cashier_kind_of(p_row_type text, p_tipo text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN lower(COALESCE(NULLIF(trim(p_row_type), ''), NULLIF(trim(p_tipo), ''), 'receita'))
         LIKE ANY (ARRAY['despesa%', 'saida%', 'saída%', 'sangria%'])
    THEN 'saida'
    ELSE 'entrada'
  END;
$$;

-- ── 1b. Helper: empresa NÃO funciona aos domingos e segundas ─
-- EXTRACT(DOW ...) → 0 = domingo, 1 = segunda, ..., 6 = sábado
CREATE OR REPLACE FUNCTION public.cashier_closed_day(p_date date)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT EXTRACT(DOW FROM p_date) IN (0, 1);
$$;

-- ── 2. Abertura automática: garante caixa para a data ───────
-- Se não existir caixa para p_date, cria um com
-- opening_balance = closing_balance do último caixa fechado
-- anterior à data (ou 0 se não houver nenhum).
CREATE OR REPLACE FUNCTION public.ensure_cashier_for_date(p_date date)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id      bigint;
  v_opening numeric;
BEGIN
  IF p_date IS NULL THEN
    RETURN NULL;
  END IF;

  -- Domingo/segunda: empresa fechada — nunca criar caixa nesses dias
  IF public.cashier_closed_day(p_date) THEN
    RETURN NULL;
  END IF;

  SELECT id INTO v_id FROM cashier_state WHERE date = p_date LIMIT 1;
  IF FOUND THEN
    RETURN v_id;
  END IF;

  -- Serializa a criação por data para evitar caixas duplicados
  -- quando a sync roda em paralelo (vários inserts na mesma data)
  PERFORM pg_advisory_xact_lock(hashtext('cashier_state:' || p_date::text));

  -- Re-checagem após obter o lock (outra transação pode ter criado)
  SELECT id INTO v_id FROM cashier_state WHERE date = p_date LIMIT 1;
  IF FOUND THEN
    RETURN v_id;
  END IF;

  -- Herda o saldo do último fechamento anterior à data
  SELECT COALESCE(closing_balance, 0) INTO v_opening
  FROM cashier_state
  WHERE status = 'fechado' AND date < p_date
  ORDER BY date DESC
  LIMIT 1;
  v_opening := COALESCE(v_opening, 0);

  -- IMPORTANTE: somente colunas confirmadas na tabela de produção.
  -- Não depender de colunas legadas (saldo, hora_abertura, sangrias,
  -- horaAbertura, dataAbertura) para a criação automática nunca falhar.
  INSERT INTO cashier_state (
    status, date, opening_balance, closing_balance,
    opened_at, closed_at, auto_closed,
    dinheiro_entradas, dinheiro_saidas, total_cash_in, total_cash_out
  ) VALUES (
    'aberto', p_date, v_opening, NULL,
    now(), NULL, false,
    0, 0, 0, 0
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- ── 3. Aplica um diferencial (positivo ou negativo) ─────────
CREATE OR REPLACE FUNCTION public.apply_cashier_delta(p_date date, p_kind text, p_delta numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id bigint;
BEGIN
  IF p_date IS NULL OR COALESCE(p_delta, 0) = 0 THEN
    RETURN;
  END IF;

  -- Domingo/segunda: transação sincronizada por engano em dia de
  -- fechamento é descartada (não contabiliza em caixa nenhum)
  IF public.cashier_closed_day(p_date) THEN
    RETURN;
  END IF;

  v_id := public.ensure_cashier_for_date(p_date);

  IF p_kind = 'saida' THEN
    UPDATE cashier_state
       SET dinheiro_saidas = dinheiro_saidas + p_delta
     WHERE id = v_id;
  ELSE
    UPDATE cashier_state
       SET dinheiro_entradas = dinheiro_entradas + p_delta
     WHERE id = v_id;
  END IF;

  -- Se o caixa já estava fechado (sync retroativa chegou depois do
  -- fechamento), mantém o closing_balance coerente com a fórmula
  UPDATE cashier_state
     SET closing_balance = COALESCE(opening_balance, 0)
                         + COALESCE(dinheiro_entradas, 0)
                         - COALESCE(dinheiro_saidas, 0)
   WHERE id = v_id AND status = 'fechado';
END;
$$;

-- ── 1c. Helper: extrai o valor real em dinheiro físico ────────
CREATE OR REPLACE FUNCTION public.cashier_amount_of(
  p_dinheiro numeric,
  p_gross numeric,
  p_valor numeric,
  p_total numeric,
  p_payment_method text,
  p_pagamento text,
  p_pix numeric,
  p_credito numeric,
  p_debito numeric
)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN COALESCE(p_dinheiro, 0) > 0 THEN p_dinheiro
    WHEN COALESCE(p_pix, 0) = 0 AND COALESCE(p_credito, 0) = 0 AND COALESCE(p_debito, 0) = 0
         AND lower(COALESCE(NULLIF(trim(p_payment_method), ''), NULLIF(trim(p_pagamento), ''), ''))
             LIKE ANY (ARRAY['%dinheiro%', '%especie%', '%espécie%', '%cash%'])
    THEN COALESCE(p_gross, p_valor, p_total, 0)
    ELSE 0
  END;
$$;

-- ── 4. Função da trigger ────────────────────────────────────
-- Estratégia unificada: toda versão de linha tem uma
-- "contribuição" (dinheiro se ativa, 0 se soft-deletada).
--   INSERT → aplica +contribuição(NEW)
--   DELETE → aplica -contribuição(OLD)
--   UPDATE → aplica -contribuição(OLD) e +contribuição(NEW)
-- O caso de UPDATE cobre sozinho: edição de valor (diferencial),
-- mudança de date_ref (mudança de caixa), soft-delete
-- (contribuição → 0) e RESTAURAÇÃO (0 → contribuição).
CREATE OR REPLACE FUNCTION public.sync_cashier_from_sheet_tx()
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
    IF OLD.deleted_at IS NULL THEN
      v_old_amount := public.cashier_amount_of(
        OLD.dinheiro, OLD.gross, OLD.valor, OLD.total,
        OLD.payment_method, OLD.pagamento,
        OLD.pix, OLD.credito, OLD.debito
      );
    END IF;
  END IF;

  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    IF NEW.deleted_at IS NULL THEN
      v_new_amount := public.cashier_amount_of(
        NEW.dinheiro, NEW.gross, NEW.valor, NEW.total,
        NEW.payment_method, NEW.pagamento,
        NEW.pix, NEW.credito, NEW.debito
      );
    END IF;
  END IF;

  IF TG_OP = 'INSERT' THEN
    PERFORM public.apply_cashier_delta(
      NEW.date_ref,
      public.cashier_kind_of(NEW.row_type, NEW.tipo),
      v_new_amount);

  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.apply_cashier_delta(
      OLD.date_ref,
      public.cashier_kind_of(OLD.row_type, OLD.tipo),
      -v_old_amount);

  ELSE -- UPDATE
    PERFORM public.apply_cashier_delta(
      OLD.date_ref,
      public.cashier_kind_of(OLD.row_type, OLD.tipo),
      -v_old_amount);
    PERFORM public.apply_cashier_delta(
      NEW.date_ref,
      public.cashier_kind_of(NEW.row_type, NEW.tipo),
      v_new_amount);
  END IF;

  RETURN NULL; -- trigger AFTER: valor de retorno é ignorado
END;
$$;

-- ── 5. Criar a trigger ──────────────────────────────────────
DROP TRIGGER IF EXISTS trg_sheet_tx_cashier_sync ON public.sheet_transactions;

CREATE TRIGGER trg_sheet_tx_cashier_sync
  AFTER INSERT OR UPDATE OR DELETE ON public.sheet_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_cashier_from_sheet_tx();

-- ── 6. BACKFILL (rodar UMA vez) ─────────────────────────────
-- dinheiro_entradas / dinheiro_saidas nunca foram populados por
-- nenhum caminho de código (sempre 0), então é seguro recalcular
-- a partir das transações ativas da sheet_transactions.
-- Obs.: só atualiza caixas já existentes; a partir de agora a
-- trigger cria caixas automaticamente para datas novas.
-- Transações de domingo/segunda são excluídas (empresa fechada).
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

-- Recalcular closing_balance dos caixas já fechados (APROVADO).
-- Reconcilia o histórico (registro de 30/07) com a fórmula oficial.
-- Importante: o closing_balance de 30/07 alimenta a cadeia de herança
-- (opening_balance dos próximos caixas), então o valor reconciliado
-- evita propagar erro adiante. Contagens físicas antigas continuam
-- preservadas em expected_cash / real_cash / cash_difference.
UPDATE public.cashier_state
   SET closing_balance = COALESCE(opening_balance, 0)
                       + COALESCE(dinheiro_entradas, 0)
                       - COALESCE(dinheiro_saidas, 0)
 WHERE status = 'fechado';

-- ── 7. Conferir resultado ───────────────────────────────────
SELECT date, status, opening_balance, dinheiro_entradas, dinheiro_saidas, closing_balance, auto_closed
FROM public.cashier_state
ORDER BY date DESC
LIMIT 10;
