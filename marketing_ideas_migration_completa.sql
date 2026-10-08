-- ==============================================================================
-- marketing_ideas_migration_completa.sql
-- PAIEMAE | Migração COMPLETA e IDEMPOTENTE — v1 + v2 + v3 em um único arquivo
-- Execute este arquivo no Supabase SQL Editor.
-- Pode ser re-executado sem risco em qualquer estado do banco.
-- ==============================================================================

-- ─── 1. Tabela principal: marketing_ideas ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.marketing_ideas (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo      text NOT NULL,
  descricao   text NOT NULL DEFAULT '',
  canal       text NOT NULL DEFAULT 'Instagram',
  tipo        text NOT NULL DEFAULT 'conteudo',
  status      text NOT NULL DEFAULT 'ideia',
  prioridade  text NOT NULL DEFAULT 'media',
  data_alvo   date,
  campanha_id bigint REFERENCES public.campaigns(id) ON DELETE SET NULL,
  criado_por  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  tags        text[] NOT NULL DEFAULT '{}',
  modelo_live jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ─── 2. Colunas adicionadas na v2 (ADD COLUMN IF NOT EXISTS é idempotente) ────

ALTER TABLE public.marketing_ideas
  ADD COLUMN IF NOT EXISTS etapa             text NOT NULL DEFAULT 'ideia',
  ADD COLUMN IF NOT EXISTS objetivo          text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS servico_tema      text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS publico           text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS regiao            text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS canais_divulgacao text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS destino           text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS cta               text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS responsavel_id    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS responsavel_nome  text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS data_prevista     timestamptz,
  ADD COLUMN IF NOT EXISTS orcamento_estimado numeric(12,2),
  ADD COLUMN IF NOT EXISTS roteiro           text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS participantes     text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS materiais         text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS data_real         timestamptz,
  ADD COLUMN IF NOT EXISTS aprendizado       text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS arquivada         boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS arquivada_em      timestamptz,
  ADD COLUMN IF NOT EXISTS versao            integer NOT NULL DEFAULT 1;

-- ─── 3. Colunas de aprovação (v3) ─────────────────────────────────────────────

ALTER TABLE public.marketing_ideas
  ADD COLUMN IF NOT EXISTS aprovado        boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS aprovado_em     timestamptz,
  ADD COLUMN IF NOT EXISTS aprovado_por    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS aprovador_nome  text NOT NULL DEFAULT '';

-- ─── 4. Constraint de etapa: remove antiga (se existir) e recria ──────────────

DO $$ BEGIN
  ALTER TABLE public.marketing_ideas DROP CONSTRAINT IF EXISTS marketing_ideas_etapa_check;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

ALTER TABLE public.marketing_ideas
  ADD CONSTRAINT marketing_ideas_etapa_check
  CHECK (etapa IN ('ideia','em_planejamento','agendada','em_execucao','concluida','executada'));

-- Migra dados legados: 'executada' -> 'concluida'
UPDATE public.marketing_ideas SET etapa = 'concluida' WHERE etapa = 'executada';

-- ─── 5. Indices ────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_marketing_ideas_status    ON public.marketing_ideas(status);
CREATE INDEX IF NOT EXISTS idx_marketing_ideas_canal     ON public.marketing_ideas(canal);
CREATE INDEX IF NOT EXISTS idx_marketing_ideas_created   ON public.marketing_ideas(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_marketing_ideas_etapa     ON public.marketing_ideas(etapa);
CREATE INDEX IF NOT EXISTS idx_marketing_ideas_arquivada ON public.marketing_ideas(arquivada);
CREATE INDEX IF NOT EXISTS idx_marketing_ideas_resp      ON public.marketing_ideas(responsavel_id);
CREATE INDEX IF NOT EXISTS idx_marketing_ideas_aprovado  ON public.marketing_ideas(aprovado);

-- ─── 6. Trigger updated_at ────────────────────────────────────────────────────

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

-- ─── 7. Tabela de tarefas ─────────────────────────────────────────────────────

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

CREATE INDEX IF NOT EXISTS idx_marketing_idea_tasks_ideia ON public.marketing_idea_tasks(ideia_id);

-- ─── 8. Tabela de historico legada (mantida para nao perder dados) ─────────────

CREATE TABLE IF NOT EXISTS public.marketing_idea_history (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ideia_id    uuid NOT NULL REFERENCES public.marketing_ideas(id) ON DELETE CASCADE,
  status_de   text,
  status_para text NOT NULL,
  nota        text,
  autor_id    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_marketing_idea_history_ideia ON public.marketing_idea_history(ideia_id);

-- ─── 9. Tabela de eventos (historico novo) ────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.marketing_idea_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ideia_id    uuid NOT NULL REFERENCES public.marketing_ideas(id) ON DELETE CASCADE,
  tipo        text NOT NULL DEFAULT 'status',
  autor_id    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  autor_nome  text,
  dados       jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_marketing_idea_events_ideia ON public.marketing_idea_events(ideia_id);
CREATE INDEX IF NOT EXISTS idx_marketing_idea_events_tipo  ON public.marketing_idea_events(tipo, created_at DESC);

-- Constraint de tipo: remove antiga e recria incluindo 'aprovacao'
DO $$ BEGIN
  ALTER TABLE public.marketing_idea_events DROP CONSTRAINT IF EXISTS marketing_idea_events_tipo_check;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

ALTER TABLE public.marketing_idea_events
  ADD CONSTRAINT marketing_idea_events_tipo_check
  CHECK (tipo IN ('status','campo','comentario','vinculo','arquivamento','duplicacao','criacao','aprovacao'));

-- Migra registros do historico antigo para eventos (idempotente)
INSERT INTO public.marketing_idea_events (ideia_id, tipo, dados, created_at)
SELECT
  h.ideia_id,
  'status',
  jsonb_build_object('status_de', h.status_de, 'status_para', h.status_para, 'nota', h.nota),
  h.created_at
FROM public.marketing_idea_history h
WHERE NOT EXISTS (
  SELECT 1 FROM public.marketing_idea_events e
  WHERE e.ideia_id = h.ideia_id AND e.created_at = h.created_at AND e.tipo = 'status'
);

-- ─── 10. Tabela da Lousa Digital (v3) ─────────────────────────────────────────

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

-- ─── 11. RLS — todas as tabelas ───────────────────────────────────────────────

ALTER TABLE public.marketing_ideas        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_idea_tasks   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_idea_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_idea_events  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_whiteboards  ENABLE ROW LEVEL SECURITY;

DO $$ DECLARE p record; t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'marketing_ideas',
    'marketing_idea_tasks',
    'marketing_idea_history',
    'marketing_idea_events',
    'marketing_whiteboards'
  ] LOOP
    FOR p IN SELECT policyname FROM pg_policies
      WHERE schemaname='public' AND tablename=t LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, t);
    END LOOP;
    EXECUTE format(
      'CREATE POLICY allow_authenticated ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)',
      t
    );
  END LOOP;
END $$;

-- ─── 12. Funcao: converter ideia em rascunho de campanha (transacional) ────────

CREATE OR REPLACE FUNCTION public.fn_convert_ideia_to_rascunho(
  p_ideia_id    uuid,
  p_nome_camp   text,
  p_canal_camp  text DEFAULT 'Instagram',
  p_mensagem    text DEFAULT '',
  p_publico     text DEFAULT '',
  p_orcamento   numeric DEFAULT 0,
  p_data_inicio text DEFAULT '',
  p_autor_id    uuid DEFAULT NULL,
  p_autor_nome  text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_ideia       marketing_ideas%ROWTYPE;
  v_camp_id     bigint;
  v_camp_nome   text;
  v_notes       text;
BEGIN
  SELECT * INTO v_ideia FROM public.marketing_ideas WHERE id = p_ideia_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'error', 'Ideia nao encontrada.');
  END IF;

  IF v_ideia.campanha_id IS NOT NULL THEN
    SELECT name INTO v_camp_nome FROM public.campaigns WHERE id = v_ideia.campanha_id;
    RETURN json_build_object(
      'ok', true, 'idempotente', true,
      'campanha_id', v_ideia.campanha_id, 'campanha_nome', v_camp_nome
    );
  END IF;

  v_notes := json_build_object(
    'orcamento', p_orcamento, 'data_inicio', p_data_inicio,
    'data_fim', '', 'abertos', 0, 'cliques', 0,
    'conversoes', 0, 'enviados', 0, 'origem_ideia_id', p_ideia_id::text
  )::text;

  INSERT INTO public.campaigns (name, type, status, message, target, sent_count, notes)
  VALUES (p_nome_camp, p_canal_camp, 'rascunho', p_mensagem, p_publico, 0, v_notes)
  RETURNING id INTO v_camp_id;

  UPDATE public.marketing_ideas
  SET campanha_id = v_camp_id,
      etapa       = CASE WHEN etapa = 'ideia' THEN 'em_planejamento' ELSE etapa END,
      versao      = versao + 1,
      updated_at  = now()
  WHERE id = p_ideia_id;

  INSERT INTO public.marketing_idea_events (ideia_id, tipo, autor_id, autor_nome, dados)
  VALUES (
    p_ideia_id, 'vinculo', p_autor_id, p_autor_nome,
    json_build_object('campanha_id', v_camp_id, 'campanha_nome', p_nome_camp, 'acao', 'convertida_em_rascunho')
  );

  RETURN json_build_object('ok', true, 'idempotente', false, 'campanha_id', v_camp_id, 'campanha_nome', p_nome_camp);

EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('ok', false, 'error', SQLERRM);
END;
$$;

-- ─── 13. Funcao: vincular ideia a campanha existente ──────────────────────────

CREATE OR REPLACE FUNCTION public.fn_vincular_ideia_campanha(
  p_ideia_id    uuid,
  p_campanha_id bigint,
  p_autor_id    uuid DEFAULT NULL,
  p_autor_nome  text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_ideia      marketing_ideas%ROWTYPE;
  v_camp_nome  text;
  v_camp_ant   bigint;
BEGIN
  SELECT * INTO v_ideia FROM public.marketing_ideas WHERE id = p_ideia_id FOR UPDATE;
  IF NOT FOUND THEN RETURN json_build_object('ok', false, 'error', 'Ideia nao encontrada.'); END IF;

  SELECT name INTO v_camp_nome FROM public.campaigns WHERE id = p_campanha_id;
  IF v_camp_nome IS NULL THEN RETURN json_build_object('ok', false, 'error', 'Campanha nao encontrada.'); END IF;

  v_camp_ant := v_ideia.campanha_id;
  UPDATE public.marketing_ideas SET campanha_id = p_campanha_id, versao = versao + 1, updated_at = now()
  WHERE id = p_ideia_id;

  INSERT INTO public.marketing_idea_events (ideia_id, tipo, autor_id, autor_nome, dados)
  VALUES (p_ideia_id, 'vinculo', p_autor_id, p_autor_nome,
    json_build_object('campanha_id_anterior', v_camp_ant, 'campanha_id_nova', p_campanha_id,
                      'campanha_nome', v_camp_nome, 'acao', 'vinculada_existente'));

  RETURN json_build_object('ok', true, 'campanha_id', p_campanha_id, 'campanha_nome', v_camp_nome);
END;
$$;

-- ─── 14. Funcao: arquivar/restaurar ideia ─────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fn_arquivar_ideia(
  p_ideia_id   uuid,
  p_arquivar   boolean,
  p_autor_id   uuid DEFAULT NULL,
  p_autor_nome text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  UPDATE public.marketing_ideas
  SET arquivada    = p_arquivar,
      arquivada_em = CASE WHEN p_arquivar THEN now() ELSE NULL END,
      versao       = versao + 1,
      updated_at   = now()
  WHERE id = p_ideia_id;

  IF NOT FOUND THEN RETURN json_build_object('ok', false, 'error', 'Ideia nao encontrada.'); END IF;

  INSERT INTO public.marketing_idea_events (ideia_id, tipo, autor_id, autor_nome, dados)
  VALUES (p_ideia_id, 'arquivamento', p_autor_id, p_autor_nome, json_build_object('arquivada', p_arquivar));

  RETURN json_build_object('ok', true);
END;
$$;

-- ─── 15. Funcao: aprovar/retirar aprovacao de ideia (v3) ──────────────────────

CREATE OR REPLACE FUNCTION public.fn_aprovar_ideia(
  p_ideia_id   uuid,
  p_aprovado   boolean,
  p_motivo     text DEFAULT '',
  p_autor_id   uuid DEFAULT NULL,
  p_autor_nome text DEFAULT NULL
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
    RETURN json_build_object('ok', false, 'error', 'Ideia nao encontrada.');
  END IF;

  IF NOT p_aprovado AND v_ideia.etapa IN ('em_execucao', 'concluida') THEN
    RETURN json_build_object(
      'ok', false,
      'error', 'Nao e possivel retirar a aprovacao de uma acao ja em execucao ou concluida. Retorne a etapa para planejamento antes.'
    );
  END IF;

  UPDATE public.marketing_ideas
  SET aprovado       = p_aprovado,
      aprovado_em    = CASE WHEN p_aprovado THEN now() ELSE NULL END,
      aprovado_por   = CASE WHEN p_aprovado THEN p_autor_id ELSE NULL END,
      aprovador_nome = CASE WHEN p_aprovado THEN COALESCE(p_autor_nome, 'Usuario') ELSE '' END,
      versao         = versao + 1,
      updated_at     = now()
  WHERE id = p_ideia_id;

  INSERT INTO public.marketing_idea_events (ideia_id, tipo, autor_id, autor_nome, dados)
  VALUES (
    p_ideia_id, 'aprovacao', p_autor_id, p_autor_nome,
    json_build_object('aprovado', p_aprovado, 'motivo', COALESCE(p_motivo, ''), 'etapa_atual', v_ideia.etapa)
  );

  RETURN json_build_object(
    'ok', true,
    'aprovado', p_aprovado,
    'aprovado_em', CASE WHEN p_aprovado THEN now() ELSE NULL END,
    'aprovador_nome', CASE WHEN p_aprovado THEN COALESCE(p_autor_nome, 'Usuario') ELSE '' END
  );
END;
$$;

-- ─── 16. Funcao: salvar layout da lousa com controle de versao (v3) ────────────

CREATE OR REPLACE FUNCTION public.fn_save_marketing_whiteboard(
  p_contexto        text,
  p_layout          jsonb,
  p_versao_esperada integer,
  p_autor_id        uuid DEFAULT NULL,
  p_autor_nome      text DEFAULT NULL
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

  IF NOT FOUND THEN
    INSERT INTO public.marketing_whiteboards
      (contexto, layout, versao, updated_by, updated_by_nome, updated_at)
    VALUES
      (p_contexto, p_layout, 1, p_autor_id, COALESCE(p_autor_nome, ''), now())
    RETURNING * INTO v_board;
    RETURN json_build_object('ok', true, 'versao', 1);
  END IF;

  IF p_versao_esperada IS NOT NULL AND p_versao_esperada > 0 AND v_board.versao <> p_versao_esperada THEN
    RETURN json_build_object(
      'ok', false, 'conflict', true,
      'error', 'A lousa foi alterada por outro usuario. Recarregue para mesclar as alteracoes.',
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

-- ─── 17. Trigger: impede exclusao de campanha com ideia vinculada ──────────────

CREATE OR REPLACE FUNCTION public.fn_check_campaign_ideas_before_delete()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE v_count int;
BEGIN
  SELECT COUNT(*) INTO v_count FROM public.marketing_ideas WHERE campanha_id = OLD.id;
  IF v_count > 0 THEN
    RAISE EXCEPTION 'Nao e possivel excluir esta campanha: % ideia(s) vinculada(s). Desvincule antes.', v_count;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_campaign_ideas ON public.campaigns;
CREATE TRIGGER trg_check_campaign_ideas
  BEFORE DELETE ON public.campaigns
  FOR EACH ROW EXECUTE FUNCTION public.fn_check_campaign_ideas_before_delete();

-- ─── 18. Grants ───────────────────────────────────────────────────────────────

GRANT EXECUTE ON FUNCTION public.fn_convert_ideia_to_rascunho      TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_vincular_ideia_campanha         TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_arquivar_ideia                  TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_aprovar_ideia                   TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_save_marketing_whiteboard       TO authenticated;
GRANT ALL ON TABLE public.marketing_whiteboards                     TO authenticated;
GRANT ALL ON TABLE public.marketing_ideas                           TO authenticated;
GRANT ALL ON TABLE public.marketing_idea_tasks                      TO authenticated;
GRANT ALL ON TABLE public.marketing_idea_events                     TO authenticated;
