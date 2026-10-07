-- ==============================================================================
-- marketing_ideas_migration.sql
-- PAIEMAE | Sub-aba "Ideias e Planejamento" de Marketing
-- Executar no Supabase SQL Editor após crm_interessados_migration.sql
-- RE-EXECUÇÃO SEGURA: usa IF NOT EXISTS / IF EXISTS / OR REPLACE
-- ==============================================================================

-- ─── 1. Tabela principal de ideias ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.marketing_ideas (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo      text NOT NULL,
  descricao   text NOT NULL DEFAULT '',
  canal       text NOT NULL DEFAULT 'Instagram'
                CHECK (canal IN ('Instagram','WhatsApp','Email','SMS','Live','Stories','Reels','Outro')),
  tipo        text NOT NULL DEFAULT 'conteudo'
                CHECK (tipo IN ('conteudo','promocao','live','campanha','outro')),
  status      text NOT NULL DEFAULT 'ideia'
                CHECK (status IN ('ideia','planejando','em_execucao','concluida','arquivada')),
  prioridade  text NOT NULL DEFAULT 'media'
                CHECK (prioridade IN ('baixa','media','alta')),
  data_alvo   date,
  campanha_id bigint REFERENCES public.campaigns(id) ON DELETE SET NULL,
  criado_por  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  tags        text[] NOT NULL DEFAULT '{}',
  modelo_live jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ─── 2. Tarefas vinculadas a cada ideia ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.marketing_idea_tasks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ideia_id    uuid NOT NULL REFERENCES public.marketing_ideas(id) ON DELETE CASCADE,
  titulo      text NOT NULL,
  concluida   boolean NOT NULL DEFAULT false,
  responsavel text,
  prazo       date,
  ordem       integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ─── 3. Histórico de alterações de status ────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.marketing_idea_history (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ideia_id    uuid NOT NULL REFERENCES public.marketing_ideas(id) ON DELETE CASCADE,
  status_de   text,
  status_para text NOT NULL,
  nota        text,
  autor_id    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ─── 4. Índices ───────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_marketing_ideas_status      ON public.marketing_ideas(status);
CREATE INDEX IF NOT EXISTS idx_marketing_ideas_canal       ON public.marketing_ideas(canal);
CREATE INDEX IF NOT EXISTS idx_marketing_ideas_created     ON public.marketing_ideas(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_marketing_idea_tasks_ideia  ON public.marketing_idea_tasks(ideia_id);
CREATE INDEX IF NOT EXISTS idx_marketing_idea_history_ideia ON public.marketing_idea_history(ideia_id);

-- ─── 5. Trigger updated_at ───────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.marketing_ideas_handle_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_marketing_ideas_updated_at ON public.marketing_ideas;
CREATE TRIGGER trg_marketing_ideas_updated_at
  BEFORE UPDATE ON public.marketing_ideas
  FOR EACH ROW EXECUTE FUNCTION public.marketing_ideas_handle_updated_at();

-- ─── 6. RLS ───────────────────────────────────────────────────────────────────

ALTER TABLE public.marketing_ideas        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_idea_tasks   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_idea_history ENABLE ROW LEVEL SECURITY;

DO $$ DECLARE p record; t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['marketing_ideas','marketing_idea_tasks','marketing_idea_history'] LOOP
    FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, t);
    END LOOP;
    EXECUTE format(
      'CREATE POLICY allow_authenticated ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)',
      t
    );
  END LOOP;
END $$;
