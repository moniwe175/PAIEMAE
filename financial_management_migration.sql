-- PAIEMAE — Central de Saúde Financeira
-- Execute no SQL Editor do Supabase. É idempotente e preserva os dados existentes.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.franchise_monthly_inputs
  ADD COLUMN IF NOT EXISTS cash_reconciled boolean NOT NULL DEFAULT false;
ALTER TABLE public.franchise_monthly_inputs
  ADD COLUMN IF NOT EXISTS costs_confirmed boolean NOT NULL DEFAULT false;
ALTER TABLE public.franchise_monthly_inputs
  ADD COLUMN IF NOT EXISTS rates_confirmed boolean NOT NULL DEFAULT false;
ALTER TABLE public.franchise_monthly_inputs
  ADD COLUMN IF NOT EXISTS marketing_expense numeric(14,2) NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.financial_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid NOT NULL REFERENCES public.franchise_units(id) ON DELETE CASCADE,
  entry_type text NOT NULL CHECK (entry_type IN ('payable', 'receivable')),
  description text NOT NULL,
  category text,
  cost_behavior text CHECK (cost_behavior IS NULL OR cost_behavior IN ('fixed', 'variable', 'tax', 'debt', 'investment', 'withdrawal')),
  competence_date date NOT NULL,
  due_date date NOT NULL,
  amount numeric(14,2) NOT NULL CHECK (amount >= 0),
  paid_amount numeric(14,2) NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
  payment_date date,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'partial', 'paid', 'overdue', 'cancelled')),
  counterparty text,
  payment_method text,
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'csv', 'integration')),
  external_id text,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (paid_amount <= amount)
);

CREATE TABLE IF NOT EXISTS public.financial_budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid NOT NULL REFERENCES public.franchise_units(id) ON DELETE CASCADE,
  period_month date NOT NULL,
  category text NOT NULL,
  budget_amount numeric(14,2) NOT NULL DEFAULT 0 CHECK (budget_amount >= 0),
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (unit_id, period_month, category),
  CHECK (period_month = date_trunc('month', period_month)::date)
);

CREATE TABLE IF NOT EXISTS public.financial_service_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid NOT NULL REFERENCES public.franchise_units(id) ON DELETE CASCADE,
  service_name text NOT NULL,
  material_cost numeric(14,2) NOT NULL DEFAULT 0 CHECK (material_cost >= 0),
  duration_minutes integer CHECK (duration_minutes IS NULL OR duration_minutes > 0),
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (unit_id, service_name)
);

CREATE INDEX IF NOT EXISTS financial_entries_unit_due_idx ON public.financial_entries(unit_id, due_date);
CREATE INDEX IF NOT EXISTS financial_entries_unit_competence_idx ON public.financial_entries(unit_id, competence_date);
CREATE INDEX IF NOT EXISTS financial_budgets_unit_period_idx ON public.financial_budgets(unit_id, period_month);
CREATE INDEX IF NOT EXISTS financial_service_costs_unit_idx ON public.financial_service_costs(unit_id);
DROP INDEX IF EXISTS public.financial_entries_external_unique;
CREATE UNIQUE INDEX financial_entries_external_unique
  ON public.financial_entries(unit_id, external_id);

DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['financial_entries', 'financial_budgets', 'financial_service_costs']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', table_name || '_updated_at', table_name);
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.franchise_set_updated_at()',
      table_name || '_updated_at', table_name
    );
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', table_name || '_select', table_name);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', table_name || '_insert', table_name);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', table_name || '_update', table_name);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', table_name || '_delete', table_name);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT USING (public.can_access_franchise(false))', table_name || '_select', table_name);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT WITH CHECK (public.can_access_franchise(true))', table_name || '_insert', table_name);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE USING (public.can_access_franchise(true)) WITH CHECK (public.can_access_franchise(true))', table_name || '_update', table_name);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE USING (public.can_access_franchise(true))', table_name || '_delete', table_name);
  END LOOP;
END;
$$;

COMMENT ON TABLE public.financial_entries IS 'Contas a pagar e receber para conciliação e projeção de caixa.';
COMMENT ON TABLE public.financial_budgets IS 'Orçamento mensal por categoria, comparado ao realizado.';
COMMENT ON TABLE public.financial_service_costs IS 'Custo direto e duração real por serviço; nenhum valor é presumido.';

COMMIT;
