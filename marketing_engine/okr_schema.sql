-- =============================================================================
-- ESTRATÉGIA / OKRs — okr_schema.sql
-- Aplique no SQL Editor do Supabase
-- =============================================================================

-- =============================================================================
-- 1. CICLO (Meses de acompanhamento)
-- Ex: "Junho 2025", "Julho 2025"
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.okr_cycles (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    is_active boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now()
);

-- =============================================================================
-- 2. OBJETIVOS
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.okr_objectives (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    cycle_id uuid REFERENCES public.okr_cycles(id) ON DELETE CASCADE,
    objective text NOT NULL,
    owner text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- =============================================================================
-- 3. KEY RESULTS (Metas)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.okr_key_results (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    objective_id uuid REFERENCES public.okr_objectives(id) ON DELETE CASCADE,
    name text NOT NULL,
    target numeric NOT NULL,
    unit text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- =============================================================================
-- 4. KANBAN TASKS (Tarefas)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.okr_tasks (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    kr_id uuid REFERENCES public.okr_key_results(id) ON DELETE CASCADE,
    title text NOT NULL,
    assignee text,
    due_day integer,
    status_column text DEFAULT 'todo', -- 'todo', 'doing', 'done'
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- =============================================================================
-- POLÍTICAS DE SEGURANÇA (RLS)
-- Como o ERP é usado em contexto local/único, vamos habilitar e liberar tudo.
-- =============================================================================
ALTER TABLE public.okr_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.okr_objectives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.okr_key_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.okr_tasks ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Permitir tudo okr_cycles') THEN
    CREATE POLICY "Permitir tudo okr_cycles" ON public.okr_cycles FOR ALL USING (true);
    CREATE POLICY "Permitir tudo okr_objectives" ON public.okr_objectives FOR ALL USING (true);
    CREATE POLICY "Permitir tudo okr_key_results" ON public.okr_key_results FOR ALL USING (true);
    CREATE POLICY "Permitir tudo okr_tasks" ON public.okr_tasks FOR ALL USING (true);
  END IF;
END $$;

-- =============================================================================
-- SEED INICIAL DE EXEMPLO (Caso não existam ciclos ainda)
-- =============================================================================
DO $$
DECLARE
    v_cycle_id uuid;
    v_obj_id uuid;
    v_kr_id uuid;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.okr_cycles) THEN
        -- Criar um ciclo ativo do mês corrente
        INSERT INTO public.okr_cycles (name, start_date, end_date, is_active)
        VALUES (to_char(CURRENT_DATE, 'TMMonth YYYY'), date_trunc('month', CURRENT_DATE)::date, (date_trunc('month', CURRENT_DATE) + interval '1 month' - interval '1 day')::date, true)
        RETURNING id INTO v_cycle_id;

        -- Inserir um Objetivo Inicial
        INSERT INTO public.okr_objectives (cycle_id, objective, owner)
        VALUES (v_cycle_id, 'Aumentar Faturamento Mensal para R$80.000', 'Evelyn')
        RETURNING id INTO v_obj_id;

        -- Inserir um Key Result Inicial
        INSERT INTO public.okr_key_results (objective_id, name, target, unit)
        VALUES (v_obj_id, 'Fechar 15 novos pacotes premium', 15, 'pacotes')
        RETURNING id INTO v_kr_id;

        -- Inserir algumas Tasks Iniciais
        INSERT INTO public.okr_tasks (kr_id, title, assignee, due_day, status_column)
        VALUES 
            (v_kr_id, 'Ligar para lista de leads quentes', 'Gabriela', 10, 'todo'),
            (v_kr_id, 'Preparar proposta para Clínica ABC', 'Evelyn', 12, 'doing'),
            (v_kr_id, 'Fechar pacote com Maria Silva', 'Evelyn', 8, 'done');
    END IF;
END $$;
