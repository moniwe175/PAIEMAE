-- ==============================================================================
-- marketing_ideas_migration_patch1.sql
-- PAIEMAE | Migração Incremental e Idempotente — Correções da Lousa de Marketing
--
-- Aplicar no Supabase SQL Editor APÓS a execução de marketing_ideas_migration_completa.sql.
-- É totalmente seguro e idempotente re-executar este arquivo.
-- ==============================================================================

-- ─── 1. Coluna 'formato' na tabela marketing_ideas ────────────────────────────
-- O formulário e o serviço utilizam 'formato' (ex: 'post', 'reels', 'story', 'carrossel', 'live', 'video_longo', 'outro', 'Não definido').
ALTER TABLE public.marketing_ideas
  ADD COLUMN IF NOT EXISTS formato text NOT NULL DEFAULT 'Não definido';

-- ─── 2. Migração segura de status legados v1 → etapa ───────────────────────────
-- Preserva rigorosamente qualquer alteração posterior.
-- Só migra se:
-- a) versao = 1 (nunca foi editada após a migração);
-- b) etapa = 'ideia';
-- c) NÃO há registro em marketing_idea_events indicando transição posterior para 'ideia';
-- d) NÃO há eventos de edição de campos posteriores.
-- Em caso de ambiguidade, o registro permanece inalterado.
UPDATE public.marketing_ideas i
SET etapa = CASE
  WHEN i.status = 'planejando'   THEN 'em_planejamento'
  WHEN i.status = 'em_execucao' THEN 'em_execucao'
  WHEN i.status = 'concluida'   THEN 'concluida'
  WHEN i.status = 'executada'   THEN 'concluida'
  ELSE i.etapa
END
WHERE i.etapa = 'ideia'
  AND i.status IN ('planejando', 'em_execucao', 'concluida', 'executada')
  AND COALESCE(i.versao, 1) = 1
  AND NOT EXISTS (
    SELECT 1 FROM public.marketing_idea_events e
    WHERE e.ideia_id = i.id
      AND (e.dados->>'etapa_para' = 'ideia' OR e.dados->>'status_para' = 'ideia')
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.marketing_idea_events e
    WHERE e.ideia_id = i.id
      AND e.tipo = 'campo'
  );

-- ─── 3. Migração segura de status 'arquivada' → coluna arquivada ───────────────
-- Preserva alterações posteriores: se uma ideia arquivada foi restaurada,
-- ou se foi editada (versao > 1), ela NÃO é re-arquivada.
UPDATE public.marketing_ideas i
SET arquivada    = true,
    arquivada_em = COALESCE(i.arquivada_em, i.updated_at, now())
WHERE i.status = 'arquivada'
  AND (i.arquivada IS NULL OR i.arquivada = false)
  AND COALESCE(i.versao, 1) = 1
  AND NOT EXISTS (
    SELECT 1 FROM public.marketing_idea_events e
    WHERE e.ideia_id = i.id
      AND (
        e.tipo = 'arquivamento'
        OR (e.dados->>'arquivada')::boolean = false
        OR e.tipo = 'campo'
      )
  );

-- ─── 4. Recuperação de autoria dos eventos legados e cópia incremental ─────────
-- A migração completa anterior executou um INSERT em marketing_idea_events sem incluir autor_id.
-- Atualizamos os eventos existentes que ficaram com autor_id nulo quando houver correspondência comprovada:
UPDATE public.marketing_idea_events e
SET autor_id = h.autor_id
FROM public.marketing_idea_history h
WHERE e.ideia_id = h.ideia_id
  AND e.created_at = h.created_at
  AND e.tipo = 'status'
  AND e.autor_id IS NULL
  AND h.autor_id IS NOT NULL;

-- Para quaisquer registros remanescentes no histórico antigo que ainda não foram inseridos:
INSERT INTO public.marketing_idea_events (ideia_id, tipo, autor_id, dados, created_at)
SELECT
  h.ideia_id,
  'status',
  h.autor_id,
  jsonb_build_object('status_de', h.status_de, 'status_para', h.status_para, 'nota', h.nota),
  h.created_at
FROM public.marketing_idea_history h
WHERE NOT EXISTS (
  SELECT 1 FROM public.marketing_idea_events e
  WHERE e.ideia_id = h.ideia_id
    AND e.created_at = h.created_at
    AND e.tipo = 'status'
);

-- ─── 5. RPC Atômica para Salvamento da Lousa com Controle Estrito de Versão ─────
-- - Protege contra primeira criação concorrente (try INSERT ON CONFLICT DO UPDATE)
-- - Se a lousa já existe, NÃO permite versão zero/nula sobrescrever
-- - Garante que apenas se versao_servidor == p_versao_esperada a atualização ocorra
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
  -- Bloqueia a linha existente para atualização
  SELECT * INTO v_board FROM public.marketing_whiteboards WHERE contexto = p_contexto FOR UPDATE;

  -- Se ainda não existe, cria a primeira versão (versao = 1)
  IF NOT FOUND THEN
    BEGIN
      INSERT INTO public.marketing_whiteboards
        (contexto, layout, versao, updated_by, updated_by_nome, updated_at)
      VALUES
        (p_contexto, p_layout, 1, p_autor_id, COALESCE(p_autor_nome, ''), now())
      RETURNING * INTO v_board;
      RETURN json_build_object('ok', true, 'versao', 1);
    EXCEPTION WHEN unique_violation THEN
      -- Se outra sessão inseriu milissegundos antes, recarrega com lock
      SELECT * INTO v_board FROM public.marketing_whiteboards WHERE contexto = p_contexto FOR UPDATE;
    END;
  END IF;

  -- Validação estrita de concorrência:
  -- A lousa existe (v_board.versao >= 1). Se o cliente enviou versão diferente ou nula/zero, rejeita com conflito!
  IF p_versao_esperada IS NULL OR p_versao_esperada <= 0 OR v_board.versao <> p_versao_esperada THEN
    RETURN json_build_object(
      'ok', false, 'conflict', true,
      'error', 'A lousa foi alterada por outro usuário. Recarregue para mesclar as alterações.',
      'versao_servidor', v_board.versao,
      'layout_servidor', v_board.layout
    );
  END IF;

  -- Atualiza layout e incrementa versão atomicamente
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

-- ─── 6. RPC Atômica para Edição de Ideia com Concorrência e Histórico ───────────
-- Garante lock e verificação de versão atômica na mesma transação
CREATE OR REPLACE FUNCTION public.fn_update_marketing_idea(
  p_ideia_id        uuid,
  p_patch           jsonb,
  p_versao_esperada integer DEFAULT NULL,
  p_autor_id        uuid DEFAULT NULL,
  p_autor_nome      text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_ideia marketing_ideas%ROWTYPE;
  v_nova_versao integer;
BEGIN
  SELECT * INTO v_ideia FROM public.marketing_ideas WHERE id = p_ideia_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'error', 'Ideia não encontrada.');
  END IF;

  IF p_versao_esperada IS NOT NULL AND v_ideia.versao <> p_versao_esperada THEN
    RETURN json_build_object(
      'ok', false, 'conflict', true,
      'error', 'Este registro foi modificado por outro usuário. Recarregue os dados para não sobrescrever as alterações.',
      'versao_servidor', v_ideia.versao
    );
  END IF;

  v_nova_versao := COALESCE(v_ideia.versao, 1) + 1;

  UPDATE public.marketing_ideas
  SET
    titulo              = COALESCE(p_patch->>'titulo', titulo),
    descricao           = COALESCE(p_patch->>'descricao', descricao),
    canal               = COALESCE(p_patch->>'canal', canal),
    tipo                = COALESCE(p_patch->>'tipo', tipo),
    status              = COALESCE(p_patch->>'status', status),
    prioridade          = COALESCE(p_patch->>'prioridade', prioridade),
    etapa               = COALESCE(p_patch->>'etapa', etapa),
    formato             = COALESCE(p_patch->>'formato', formato),
    objetivo            = COALESCE(p_patch->>'objetivo', objetivo),
    servico_tema        = COALESCE(p_patch->>'servico_tema', servico_tema),
    publico             = COALESCE(p_patch->>'publico', publico),
    regiao              = COALESCE(p_patch->>'regiao', regiao),
    destino             = COALESCE(p_patch->>'destino', destino),
    cta                 = COALESCE(p_patch->>'cta', cta),
    responsavel_id      = CASE WHEN p_patch ? 'responsavel_id' THEN (p_patch->>'responsavel_id')::uuid ELSE responsavel_id END,
    responsavel_nome    = COALESCE(p_patch->>'responsavel_nome', responsavel_nome),
    data_prevista       = CASE WHEN p_patch ? 'data_prevista' THEN (p_patch->>'data_prevista')::timestamptz ELSE data_prevista END,
    orcamento_estimado  = CASE WHEN p_patch ? 'orcamento_estimado' THEN (p_patch->>'orcamento_estimado')::numeric ELSE orcamento_estimado END,
    roteiro             = COALESCE(p_patch->>'roteiro', roteiro),
    participantes       = COALESCE(p_patch->>'participantes', participantes),
    materiais           = COALESCE(p_patch->>'materiais', materiais),
    data_real           = CASE WHEN p_patch ? 'data_real' THEN (p_patch->>'data_real')::timestamptz ELSE data_real END,
    aprendizado         = COALESCE(p_patch->>'aprendizado', aprendizado),
    versao              = v_nova_versao,
    updated_at          = now()
  WHERE id = p_ideia_id;

  -- Registra evento no histórico
  INSERT INTO public.marketing_idea_events (ideia_id, tipo, autor_id, autor_nome, dados)
  VALUES (
    p_ideia_id, 'campo', p_autor_id, p_autor_nome,
    jsonb_build_object('patch', p_patch, 'versao_anterior', v_ideia.versao, 'versao_nova', v_nova_versao)
  );

  RETURN json_build_object('ok', true, 'versao', v_nova_versao);
END;
$$;

-- ─── 7. Permissões ─────────────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.fn_save_marketing_whiteboard TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_update_marketing_idea TO authenticated;
