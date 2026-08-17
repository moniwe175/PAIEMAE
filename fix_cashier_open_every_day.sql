-- =====================================================================
-- FIX: Caixa aberto todos os dias — remove a regra de fechamento
--      domingo/segunda de dentro do BANCO DE DADOS
-- =====================================================================
-- Política atual (definida em 17/08/2026): o caixa é 100% automático —
-- abre e fecha TODOS os dias (inclusive domingo/segunda/feriados).
-- Dia sem movimento simplesmente fecha zerado; nenhum dia é pulado.
--
-- As funções ensure_cashier_for_date e apply_cashier_delta (criadas por
-- fix_cashier_trigger_sheet_sync.sql) chamam public.cashier_closed_day(),
-- que devolve TRUE para domingo/segunda e fazia o banco:
--   1) nunca criar caixa nesses dias (ensure_cashier_for_date);
--   2) descartar lançamentos sincronizados nesses dias (apply_cashier_delta).
--
-- Correção mínima e segura: redefinir cashier_closed_day para SEMPRE
-- devolver false. As duas funções acima passam a aceitar todos os dias
-- automaticamente, sem precisar alterar mais nada.
--
-- Idempotente: pode rodar quantas vezes quiser (CREATE OR REPLACE).
-- Rodar no Supabase → SQL Editor.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.cashier_closed_day(p_date date)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  -- Sem dias de fechamento: caixa opera todos os dias da semana
  SELECT false;
$$;
