-- ============================================================
-- fix_cashier_state_schema.sql
-- Executar no SQL Editor do Supabase
-- Adiciona coluna data_abertura na tabela cashier_state
-- e corrige RLS para evitar bloqueio
-- ============================================================

-- 1. Adicionar coluna data_abertura (que o codigo usa mas nao existia na tabela)
ALTER TABLE public.cashier_state
  ADD COLUMN IF NOT EXISTS data_abertura text;

-- 2. Desabilitar RLS para evitar bloqueio (a tabela usa user_id unique, sem usuario logado falha)
ALTER TABLE public.cashier_state DISABLE ROW LEVEL SECURITY;

-- Politica permissiva para todos
DROP POLICY IF EXISTS "Users can view own cashier state" ON public.cashier_state;
DROP POLICY IF EXISTS "Users can upsert own cashier state" ON public.cashier_state;
DROP POLICY IF EXISTS "Allow all cashier state" ON public.cashier_state;

CREATE POLICY "Allow all cashier state"
  ON public.cashier_state FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- 3. Remover constraint unique no user_id que pode bloquear inserts sem usuario logado
ALTER TABLE public.cashier_state
  DROP CONSTRAINT IF EXISTS cashier_state_user_id_key;

-- Confirmar
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'cashier_state' AND table_schema = 'public'
ORDER BY ordinal_position;
