-- PAIEMAE — Franquia & Viabilidade
-- Modelo econômico, unidades, fechamentos, marketing, padrões e COF.
-- Migração idempotente: pode ser executada mais de uma vez no Supabase SQL Editor.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.franchise_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS public.franchise_networks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  legal_name text,
  cnpj text,
  brand_name text,
  status text NOT NULL DEFAULT 'modelagem' CHECK (status IN ('modelagem', 'ativa', 'pausada')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.franchise_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  network_id uuid NOT NULL REFERENCES public.franchise_networks(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  unit_type text NOT NULL DEFAULT 'propria' CHECK (unit_type IN ('propria', 'franqueada', 'piloto')),
  status text NOT NULL DEFAULT 'ativa' CHECK (status IN ('implantacao', 'ativa', 'atencao', 'critica', 'inativa')),
  cnpj text,
  city text,
  state text,
  opening_date date,
  owner_name text,
  is_pilot boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (network_id, code)
);

CREATE TABLE IF NOT EXISTS public.franchise_unit_members (
  unit_id uuid NOT NULL REFERENCES public.franchise_units(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  access_level text NOT NULL DEFAULT 'unidade' CHECK (access_level IN ('rede', 'unidade', 'leitura')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (unit_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.franchise_economic_models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid NOT NULL UNIQUE REFERENCES public.franchise_units(id) ON DELETE CASCADE,
  version integer NOT NULL DEFAULT 1,
  configured boolean NOT NULL DEFAULT false,
  franchise_fee numeric(14,2) NOT NULL DEFAULT 0,
  construction_investment numeric(14,2) NOT NULL DEFAULT 0,
  equipment_investment numeric(14,2) NOT NULL DEFAULT 0,
  initial_inventory numeric(14,2) NOT NULL DEFAULT 0,
  preopening_marketing numeric(14,2) NOT NULL DEFAULT 0,
  licenses_investment numeric(14,2) NOT NULL DEFAULT 0,
  working_capital numeric(14,2) NOT NULL DEFAULT 0,
  other_initial_investment numeric(14,2) NOT NULL DEFAULT 0,
  royalty_type text NOT NULL DEFAULT 'percentual' CHECK (royalty_type IN ('percentual', 'fixo', 'isento')),
  royalty_value numeric(14,4) NOT NULL DEFAULT 0,
  marketing_fund_type text NOT NULL DEFAULT 'percentual' CHECK (marketing_fund_type IN ('percentual', 'fixo', 'isento')),
  marketing_fund_value numeric(14,4) NOT NULL DEFAULT 0,
  tax_rate numeric(8,4) NOT NULL DEFAULT 0,
  card_fee_rate numeric(8,4) NOT NULL DEFAULT 0,
  monthly_pro_labore numeric(14,2) NOT NULL DEFAULT 0,
  monthly_debt_service numeric(14,2) NOT NULL DEFAULT 0,
  monthly_fixed_costs numeric(14,2) NOT NULL DEFAULT 0,
  rooms_count integer NOT NULL DEFAULT 0,
  professionals_capacity integer NOT NULL DEFAULT 0,
  operating_days_month integer NOT NULL DEFAULT 0,
  hours_per_day numeric(6,2) NOT NULL DEFAULT 0,
  average_session_minutes integer NOT NULL DEFAULT 0,
  annual_discount_rate numeric(8,4) NOT NULL DEFAULT 12,
  projection_months integer NOT NULL DEFAULT 36,
  assumptions_notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.franchise_monthly_inputs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid NOT NULL REFERENCES public.franchise_units(id) ON DELETE CASCADE,
  period_month date NOT NULL,
  payroll numeric(14,2) NOT NULL DEFAULT 0,
  payroll_charges numeric(14,2) NOT NULL DEFAULT 0,
  rent numeric(14,2) NOT NULL DEFAULT 0,
  utilities numeric(14,2) NOT NULL DEFAULT 0,
  systems numeric(14,2) NOT NULL DEFAULT 0,
  accounting_legal numeric(14,2) NOT NULL DEFAULT 0,
  maintenance numeric(14,2) NOT NULL DEFAULT 0,
  insurance numeric(14,2) NOT NULL DEFAULT 0,
  other_fixed_costs numeric(14,2) NOT NULL DEFAULT 0,
  supplies_cost numeric(14,2) NOT NULL DEFAULT 0,
  taxes_override numeric(14,2),
  card_fees_override numeric(14,2),
  discounts numeric(14,2) NOT NULL DEFAULT 0,
  refunds numeric(14,2) NOT NULL DEFAULT 0,
  royalty_override numeric(14,2),
  marketing_fund_override numeric(14,2),
  pro_labore_override numeric(14,2),
  debt_service_override numeric(14,2),
  opening_cash numeric(14,2) NOT NULL DEFAULT 0,
  closing_cash numeric(14,2) NOT NULL DEFAULT 0,
  capex numeric(14,2) NOT NULL DEFAULT 0,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (unit_id, period_month),
  CHECK (period_month = date_trunc('month', period_month)::date)
);

-- Custos da franqueadora ficam separados dos custos das unidades. O fundo de
-- marketing tambem fica destacado, pois nao e receita operacional da marca.
CREATE TABLE IF NOT EXISTS public.franchise_network_monthly_inputs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  network_id uuid NOT NULL REFERENCES public.franchise_networks(id) ON DELETE CASCADE,
  period_month date NOT NULL,
  franchisor_payroll numeric(14,2) NOT NULL DEFAULT 0,
  technology_cost numeric(14,2) NOT NULL DEFAULT 0,
  field_support_cost numeric(14,2) NOT NULL DEFAULT 0,
  sales_expansion_cost numeric(14,2) NOT NULL DEFAULT 0,
  administrative_cost numeric(14,2) NOT NULL DEFAULT 0,
  other_costs numeric(14,2) NOT NULL DEFAULT 0,
  marketing_fund_spend numeric(14,2) NOT NULL DEFAULT 0,
  product_margin_revenue numeric(14,2) NOT NULL DEFAULT 0,
  other_operating_revenue numeric(14,2) NOT NULL DEFAULT 0,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (network_id, period_month),
  CHECK (period_month = date_trunc('month', period_month)::date)
);

CREATE TABLE IF NOT EXISTS public.franchise_marketing_investments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid NOT NULL REFERENCES public.franchise_units(id) ON DELETE CASCADE,
  period_month date NOT NULL,
  channel text NOT NULL,
  campaign text,
  amount numeric(14,2) NOT NULL DEFAULT 0,
  leads integer NOT NULL DEFAULT 0,
  new_paying_clients integer,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (period_month = date_trunc('month', period_month)::date)
);

CREATE TABLE IF NOT EXISTS public.franchise_fee_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid NOT NULL REFERENCES public.franchise_units(id) ON DELETE CASCADE,
  competence_month date NOT NULL,
  fee_type text NOT NULL CHECK (fee_type IN ('royalty', 'fundo_marketing', 'taxa_franquia', 'produto', 'suporte', 'outro')),
  calculation_base numeric(14,2) NOT NULL DEFAULT 0,
  rate numeric(10,4),
  amount_due numeric(14,2) NOT NULL DEFAULT 0,
  amount_paid numeric(14,2) NOT NULL DEFAULT 0,
  due_date date,
  paid_at timestamptz,
  status text NOT NULL DEFAULT 'previsto' CHECK (status IN ('previsto', 'aberto', 'pago', 'atrasado', 'cancelado')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.franchise_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid NOT NULL REFERENCES public.franchise_units(id) ON DELETE CASCADE,
  metric_key text NOT NULL,
  target_value numeric(16,4) NOT NULL,
  warning_value numeric(16,4),
  critical_value numeric(16,4),
  direction text NOT NULL DEFAULT 'higher_better' CHECK (direction IN ('higher_better', 'lower_better', 'range')),
  valid_from date NOT NULL DEFAULT CURRENT_DATE,
  valid_until date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (unit_id, metric_key, valid_from)
);

CREATE TABLE IF NOT EXISTS public.franchise_audits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid NOT NULL REFERENCES public.franchise_units(id) ON DELETE CASCADE,
  audit_date date NOT NULL DEFAULT CURRENT_DATE,
  financial_score numeric(5,2),
  operational_score numeric(5,2),
  quality_score numeric(5,2),
  marketing_score numeric(5,2),
  compliance_score numeric(5,2),
  overall_score numeric(5,2),
  status text NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho', 'concluida', 'plano_acao', 'regularizada')),
  findings jsonb NOT NULL DEFAULT '[]'::jsonb,
  action_plan jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text,
  auditor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.franchise_scenarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid NOT NULL REFERENCES public.franchise_units(id) ON DELETE CASCADE,
  name text NOT NULL,
  scenario_type text NOT NULL DEFAULT 'base' CHECK (scenario_type IN ('conservador', 'base', 'otimista', 'personalizado')),
  assumptions jsonb NOT NULL DEFAULT '{}'::jsonb,
  results_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.franchise_monthly_closes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid NOT NULL REFERENCES public.franchise_units(id) ON DELETE CASCADE,
  period_month date NOT NULL,
  status text NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto', 'em_revisao', 'fechado', 'reaberto')),
  data_quality_score numeric(5,2) NOT NULL DEFAULT 0,
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  missing_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  closed_at timestamptz,
  closed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reopened_at timestamptz,
  reopen_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (unit_id, period_month),
  CHECK (period_month = date_trunc('month', period_month)::date)
);

CREATE TABLE IF NOT EXISTS public.franchise_compliance_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  network_id uuid NOT NULL REFERENCES public.franchise_networks(id) ON DELETE CASCADE,
  unit_id uuid REFERENCES public.franchise_units(id) ON DELETE CASCADE,
  document_type text NOT NULL,
  title text NOT NULL,
  reference_period text,
  version integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'em_revisao', 'valido', 'vencido', 'substituido')),
  file_url text,
  issued_at date,
  expires_at date,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.franchise_networks (id, name, brand_name, status)
VALUES ('00000000-0000-4000-8000-000000000010', 'Rede Evelyn Esthetic Center', 'Evelyn Esthetic Center', 'modelagem')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.franchise_units (id, network_id, code, name, unit_type, status, is_pilot)
VALUES (
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000010',
  'MATRIZ',
  'Matriz',
  'piloto',
  'ativa',
  true
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.franchise_economic_models (unit_id)
VALUES ('00000000-0000-4000-8000-000000000001')
ON CONFLICT (unit_id) DO NOTHING;

-- Associa a base atual à Matriz sem apagar ou recriar registros existentes.
DO $$
DECLARE
  table_name text;
  constraint_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'clients', 'appointments', 'sheet_transactions', 'transactions', 'expenses',
    'comissoes', 'inventory', 'inventory_items', 'professionals', 'servicos'
  ]
  LOOP
    IF to_regclass('public.' || table_name) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS unit_id uuid', table_name);
      EXECUTE format(
        'UPDATE public.%I SET unit_id = %L::uuid WHERE unit_id IS NULL',
        table_name,
        '00000000-0000-4000-8000-000000000001'
      );
      EXECUTE format(
        'ALTER TABLE public.%I ALTER COLUMN unit_id SET DEFAULT %L::uuid',
        table_name,
        '00000000-0000-4000-8000-000000000001'
      );
      constraint_name := table_name || '_franchise_unit_id_fkey';
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = constraint_name) THEN
        EXECUTE format(
          'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (unit_id) REFERENCES public.franchise_units(id) ON DELETE RESTRICT',
          table_name,
          constraint_name
        );
      END IF;
      EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I(unit_id)', table_name || '_unit_id_idx', table_name);
    END IF;
  END LOOP;
END;
$$;

CREATE INDEX IF NOT EXISTS franchise_units_network_idx ON public.franchise_units(network_id);
CREATE INDEX IF NOT EXISTS franchise_monthly_inputs_unit_period_idx ON public.franchise_monthly_inputs(unit_id, period_month DESC);
CREATE INDEX IF NOT EXISTS franchise_network_monthly_period_idx ON public.franchise_network_monthly_inputs(network_id, period_month DESC);
CREATE INDEX IF NOT EXISTS franchise_marketing_unit_period_idx ON public.franchise_marketing_investments(unit_id, period_month DESC);
CREATE INDEX IF NOT EXISTS franchise_fee_ledger_unit_period_idx ON public.franchise_fee_ledger(unit_id, competence_month DESC);
CREATE INDEX IF NOT EXISTS franchise_audits_unit_date_idx ON public.franchise_audits(unit_id, audit_date DESC);
CREATE INDEX IF NOT EXISTS franchise_closes_unit_period_idx ON public.franchise_monthly_closes(unit_id, period_month DESC);

DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'franchise_networks', 'franchise_units', 'franchise_economic_models',
    'franchise_monthly_inputs', 'franchise_network_monthly_inputs',
    'franchise_marketing_investments', 'franchise_fee_ledger',
    'franchise_targets', 'franchise_audits', 'franchise_scenarios',
    'franchise_monthly_closes', 'franchise_compliance_documents'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', table_name || '_updated_at', table_name);
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.franchise_set_updated_at()',
      table_name || '_updated_at',
      table_name
    );
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.can_access_franchise(require_write boolean DEFAULT false)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (
        p.role = 'admin'
        OR CASE
          WHEN require_write THEN COALESCE((p.permissions->'franquia'->>'edit')::boolean, false)
          ELSE COALESCE((p.permissions->'franquia'->>'ver')::boolean, false)
            OR COALESCE((p.permissions->'franquia'->>'edit')::boolean, false)
        END
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.can_access_franchise(boolean) TO authenticated;

DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'franchise_networks', 'franchise_units', 'franchise_unit_members',
    'franchise_economic_models', 'franchise_monthly_inputs',
    'franchise_network_monthly_inputs',
    'franchise_marketing_investments', 'franchise_fee_ledger', 'franchise_targets',
    'franchise_audits', 'franchise_scenarios', 'franchise_monthly_closes',
    'franchise_compliance_documents'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('DROP POLICY IF EXISTS franchise_read ON public.%I', table_name);
    EXECUTE format('DROP POLICY IF EXISTS franchise_write ON public.%I', table_name);
    EXECUTE format(
      'CREATE POLICY franchise_read ON public.%I FOR SELECT TO authenticated USING (public.can_access_franchise(false))',
      table_name
    );
    EXECUTE format(
      'CREATE POLICY franchise_write ON public.%I FOR ALL TO authenticated USING (public.can_access_franchise(true)) WITH CHECK (public.can_access_franchise(true))',
      table_name
    );
  END LOOP;
END;
$$;

-- Financeiro e Gerente recebem o módulo por padrão. Admin já possui acesso irrestrito.
DO $$
BEGIN
  IF to_regclass('public.roles') IS NOT NULL THEN
    UPDATE public.roles
    SET permissions = jsonb_set(
      COALESCE(permissions, '{}'::jsonb),
      '{franquia}',
      '{"ver": true, "edit": true}'::jsonb,
      true
    )
    WHERE id IN ('role_financeiro', 'role_gerente');
  END IF;
END;
$$;

COMMIT;
