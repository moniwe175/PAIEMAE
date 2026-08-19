-- ============================================================================
-- Migration: Unique constraint on sheet_transactions(comanda, user_id)
-- Previne duplicatas e habilita upsert nativo via ON CONFLICT.
-- ============================================================================
--
-- CONTEXTO:
--   A coluna "comanda" é o identificador lógico de cada transação da planilha.
--   O Web App (google-apps-script/web-app-endpoint.gs) faz upsert por comanda
--   com Prefer: resolution=merge-duplicates.
--
-- ATENÇÃO (lição aprendida em produção em 2026-08-18):
--   O PostgREST do Supabase NÃO usa índice PARCIAL como alvo do ON CONFLICT
--   (testado: HTTP 409 / 23505). Por isso o índice deve ser TOTAL
--   (sem WHERE). Para que o índice total caiba, as comandas já soft-deletadas
--   são "arquivadas" (renomeadas com sufixo _arq_<id>), já que elas não
--   aparecem em relatórios de qualquer forma (deleted_at preenchido).
--
-- EXECUTAR:
--   Supabase Dashboard → SQL Editor → Cole este SQL → Run (pode repetir).
-- ============================================================================


-- ═══════════════════════════════════════════════════════════════════════════
-- SEÇÃO 1: Limpar duplicatas existentes (mantém o mais recente)
-- ═══════════════════════════════════════════════════════════════════════════

-- Marca duplicadas como deletadas, mantendo apenas o registro mais recente
-- (maior updated_at) para cada par (comanda, user_id)
UPDATE public.sheet_transactions AS st
SET deleted_at = NOW()
WHERE st.id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY comanda, user_id
             ORDER BY updated_at DESC
           ) AS rn
    FROM public.sheet_transactions
    WHERE comanda IS NOT NULL
      AND deleted_at IS NULL
  ) ranked
  WHERE ranked.rn > 1
);


-- ═══════════════════════════════════════════════════════════════════════════
-- SEÇÃO 2: Índice único TOTAL (compatível com o upsert do PostgREST)
-- ═══════════════════════════════════════════════════════════════════════════

-- Garante que a coluna user_id existe
ALTER TABLE public.sheet_transactions
  ADD COLUMN IF NOT EXISTS user_id uuid;

-- Arquiva comandas soft-deletadas (renomeia) para o índice total caber.
-- Linhas ativas (deleted_at IS NULL) mantêm a comanda original.
UPDATE public.sheet_transactions
   SET comanda = comanda || '_arq_' || LEFT(id::text, 8)
 WHERE comanda IS NOT NULL
   AND deleted_at IS NOT NULL
   AND comanda NOT LIKE '%_arq_%';

-- Troca o índice parcial (se existir) pelo total
DROP INDEX IF EXISTS public.idx_sheet_tx_unique_comanda_user;

CREATE UNIQUE INDEX idx_sheet_tx_unique_comanda_user
  ON public.sheet_transactions (comanda, user_id);

-- Verificar que foi criado
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'sheet_transactions'
  AND indexname = 'idx_sheet_tx_unique_comanda_user';


-- ═══════════════════════════════════════════════════════════════════════════
-- SEÇÃO 3: Revert (caso precise desfazer)
-- ═══════════════════════════════════════════════════════════════════════════

-- DROP INDEX IF EXISTS public.idx_sheet_tx_unique_comanda_user;
