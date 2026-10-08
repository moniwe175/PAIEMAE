-- ==============================================================================
-- marketing_ideas_migration_v3.sql
-- PAIEMAE | Migração incremental — Lousa de ideias com aprovação e execução
-- Executar no Supabase SQL Editor
-- RE-EXECUÇÃO SEGURA: IF NOT EXISTS / IF EXISTS / OR REPLACE em toda instrução
-- ==============================================================================

-- ─── 1. Campos de Aprovação e Novas Etapas em marketing_ideas ──────────────────

-- Remove restrição de etapa antiga (se existir) para permitir em_execucao e concluida
DO $$ BEGIN
  ALTER TABLE public.marketing_ideas DROP CONSTRAINT IF EXISTS marketing_ideas_etapa_check;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Atualiza a constraint de etapa suportando: ideia, em_planejamento, agendada, em_execucao, concluida (e executada como compatibilidade)
ALTER TABLE public.marketing_ideas
  ADD CONSTRAINT marketing_ideas_etapa_check
  CHECK (etapa IN ('ideia','em_planejamento','agendada','em_execucao','concluida','executada'));

-- Migra dados existentes de 'executada' para 'concluida'
UPDATE public.marketing_ideas
SET etapa = 'concluida'
WHERE etapa = 'executada';

-- Colunas de Aprovação separada da Execução
ALTER TABLE public.marketing_ideas
  ADD COLUMN IF NOT EXISTS aprovado        boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS aprovado_em     timestamptz,
  ADD COLUMN IF NOT EXISTS aprovado_por    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS aprovador_nome  text NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_marketing_ideas_aprovado ON public.marketing_ideas(aprovado);

-- ─── 2. Suporte ao tipo 'aprovacao' no histórico de eventos ───────────────────

DO $$ BEGIN
  ALTER TABLE public.marketing_idea_events DROP CONSTRAINT IF EXISTS marketing_idea_events_tipo_check;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

ALTER TABLE public.marketing_idea_events
  ADD CONSTRAINT marketing_idea_events_tipo_check
  CHECK (tipo IN ('status','campo','comentario','vinculo','arquivamento','duplicacao','criacao','aprovacao'));

-- ─── 3. Tabela da Lousa Digital (Whiteboard) ──────────────────────────────────

CREATE TABLE IF NOT EXISTS public.marketing_whiteboards (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contexto         text NOT NULL DEFAULT 'default' UNIQUE,
  layout           jsonb NOT NULL DEFAULT '{"nodes":[],"edges":[]}'::jsonb,
  versao           integer NOT NULL DEFAULT 1,
  updated_by       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by_nome  text NOT NULL DEFAULT '',
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_marketing_whiteboards_contexto ON public.marketing_whiteboards(contexto);

-- RLS para marketing_whiteboards
ALTER TABLE public.marketing_whiteboards ENABLE ROW LEVEL SECURITY;

DO $$ DECLARE p record;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies
    WHERE schemaname='public' AND tablename='marketing_whiteboards' LOOP
    EXECUTE format('DROP POLICY %I ON public.marketing_whiteboards', p.policyname);
  END LOOP;
  EXECUTE 'CREATE POLICY allow_authenticated ON public.marketing_whiteboards
    FOR ALL TO authenticated USING (true) WITH CHECK (true)';
END $$;

-- ─── 4. Função: Aprovar ou Retirar Aprovação com Histórico Seguro ─────────────

CREATE OR REPLACE FUNCTION public.fn_aprovar_ideia(
  p_ideia_id     uuid,
  p_aprovado     boolean,
  p_motivo       text DEFAULT '',
  p_autor_id     uuid DEFAULT NULL,
  p_autor_nome   text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_ideia marketing_ideas%ROWTYPE;
BEGIN
  SELECT * INTO v_ideia FROM public.marketing_ideas WHERE id = p_ideia_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'error', 'Ideia não encontrada.');
  END IF;

  -- Regra: Se estiver retirando aprovação mas a ideia já estiver em_execucao ou concluida, exigir retorno de etapa primeiro
  IF NOT p_aprovado AND v_ideia.etapa IN ('em_execucao', 'concluida') THEN
    RETURN json_build_object(
      'ok', false,
      'error', 'Não é possível retirar a aprovação de uma ação já em execução ou concluída. Retorne a etapa para planejamento antes.'
    );
  END IF;

  UPDATE public.marketing_ideas
  SET aprovado       = p_aprovado,
      aprovado_em    = CASE WHEN p_aprovado THEN now() ELSE NULL END,
      aprovado_por   = CASE WHEN p_aprovado THEN p_autor_id ELSE NULL END,
      aprovador_nome = CASE WHEN p_aprovado THEN COALESCE(p_autor_nome, 'Usuário') ELSE '' END,
      versao         = versao + 1,
      updated_at     = now()
  WHERE id = p_ideia_id;

  INSERT INTO public.marketing_idea_events
    (ideia_id, tipo, autor_id, autor_nome, dados)
  VALUES (
    p_ideia_id,
    'aprovacao',
    p_autor_id,
    p_autor_nome,
    json_build_object(
      'aprovado', p_aprovado,
      'motivo', COALESCE(p_motivo, ''),
      'etapa_atual', v_ideia.etapa
    )
  );

  RETURN json_build_object(
    'ok', true,
    'aprovado', p_aprovado,
    'aprovado_em', CASE WHEN p_aprovado THEN now() ELSE NULL END,
    'aprovador_nome', CASE WHEN p_aprovado THEN COALESCE(p_autor_nome, 'Usuário') ELSE '' END
  );
END;
$$;

-- ─── 5. Função: Salvar Layout da Lousa com Detecção de Concorrência ────────────

CREATE OR REPLACE FUNCTION public.fn_save_marketing_whiteboard(
  p_contexto       text,
  p_layout         jsonb,
  p_versao_esperada integer,
  p_autor_id       uuid DEFAULT NULL,
  p_autor_nome     text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_board marketing_whiteboards%ROWTYPE;
BEGIN
  SELECT * INTO v_board FROM public.marketing_whiteboards WHERE contexto = p_contexto FOR UPDATE;

  -- Se não existir registro inicial, insere com versão 1
  IF NOT FOUND THEN
    INSERT INTO public.marketing_whiteboards
      (contexto, layout, versao, updated_by, updated_by_nome, updated_at)
    VALUES
      (p_contexto, p_layout, 1, p_autor_id, COALESCE(p_autor_nome, ''), now())
    RETURNING * INTO v_board;

    RETURN json_build_object('ok', true, 'versao', 1);
  END IF;

  -- Detecção de concorrência: se versão no banco for diferente da esperada pelo cliente
  IF p_versao_esperada IS NOT NULL AND p_versao_esperada > 0 AND v_board.versao <> p_versao_esperada THEN
    RETURN json_build_object(
      'ok', false,
      'conflict', true,
      'error', 'A lousa foi alterada por outro usuário. Recarregue para mesclar as alterações.',
      'versao_servidor', v_board.versao,
      'layout_servidor', v_board.layout
    );
  END IF;

  UPDATE public.marketing_whiteboards
  SET layout          = p_layout,
      versao          = v_board.versao + 1,
      updated_by      = p_autor_id,
      updated_by_nome = COALESCE(p_autor_nome, ''),
      updated_at      = now()
  WHERE contexto = p_contexto;

  RETURN json_build_object('ok', true, 'versao', v_board.versao + 1);
END;
$$;

-- ─── 6. Grants ────────────────────────────────────────────────────────────────

GRANT EXECUTE ON FUNCTION public.fn_aprovar_ideia                TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_save_marketing_whiteboard    TO authenticated;
GRANT ALL ON TABLE public.marketing_whiteboards                  TO authenticated;
