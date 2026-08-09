-- ============================================================
-- migrate_cashier_real.sql
-- Sistema de Caixa Real — Migração Completa
-- Executar no SQL Editor do Supabase Dashboard
-- ============================================================

-- ── 1. Adicionar colunas novas em cashier_state ──────────────
ALTER TABLE public.cashier_state
  ADD COLUMN IF NOT EXISTS date date,
  ADD COLUMN IF NOT EXISTS opening_balance numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS closing_balance numeric,
  ADD COLUMN IF NOT EXISTS total_cash_in  numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_cash_out numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS opened_at  timestamptz,
  ADD COLUMN IF NOT EXISTS closed_at  timestamptz,
  ADD COLUMN IF NOT EXISTS auto_closed boolean DEFAULT false;

-- ── 2. Migrar dados existentes para o novo schema ────────────
UPDATE public.cashier_state
SET
  date            = COALESCE(date, CURRENT_DATE),
  opening_balance = COALESCE(opening_balance, saldo, 0),
  opened_at       = COALESCE(opened_at, now())
WHERE date IS NULL OR opening_balance IS NULL;

-- ── 3. Criar tabela cashier_sangrias ─────────────────────────
CREATE TABLE IF NOT EXISTS public.cashier_sangrias (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cashier_date date        NOT NULL DEFAULT CURRENT_DATE,
  valor        numeric     NOT NULL,
  motivo       text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  user_id      uuid        REFERENCES auth.users(id)
);

-- Habilitar RLS na nova tabela
ALTER TABLE public.cashier_sangrias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all cashier_sangrias" ON public.cashier_sangrias;
CREATE POLICY "Allow all cashier_sangrias"
  ON public.cashier_sangrias FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- ── 4. Garantir que cashier_state sem RLS (como estava antes) ─
ALTER TABLE public.cashier_state DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all cashier state" ON public.cashier_state;
CREATE POLICY "Allow all cashier state"
  ON public.cashier_state FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- ── 5. Verificar resultado ───────────────────────────────────
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'cashier_state' AND table_schema = 'public'
ORDER BY ordinal_position;
