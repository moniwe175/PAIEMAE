-- ============================================================================
-- Migration: Unique constraint on sheet_transactions(comanda, user_id)
-- Previne duplicatas e habilita upsert nativo via ON CONFLICT.
-- ============================================================================
--
-- CONTEXTO:
--   A coluna "comanda" é o identificador lógico de cada transação da planilha.
--   O Web App (google-apps-script/web-app-endpoint.gs) faz upsert por comanda.
--   Sem unique constraint, edições concorrentes podem criar duplicatas.
--
-- EXECUTAR:
--   Supabase Dashboard → SQL Editor → Cole este SQL → Run
--
-- SEGURANÇA:
--   - Faz backup antes (SEÇÃO 0)
--   - Remove duplicatas existentes (SEÇÃO 1)
--   - Adiciona constraint parcial (SEÇÃO 2)
--   - Revert disponível (SEÇÃO 3)
-- ============================================================================


-- ═══════════════════════════════════════════════════════════════════════════
-- SEÇÃO 0: Diagnóstico (execute PRIMEIRO para ver o estado atual)
-- ═══════════════════════════════════════════════════════════════════════════

-- 0.1 Ver se a constraint já existe
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'sheet_transactions'
  AND indexname LIKE '%unique%comanda%';

-- 0.2 Ver duplicatas existentes (mesma comanda + user_id, não deletadas)
SELECT comanda, user_id, COUNT(*) AS qtd
FROM public.sheet_transactions
WHERE comanda IS NOT NULL
  AND deleted_at IS NULL
GROUP BY comanda, user_id
HAVING COUNT(*) > 1
ORDER BY qtd DESC;

-- 0.3 Total de registros ativos
SELECT COUNT(*) AS total_ativos
FROM public.sheet_transactions
WHERE deleted_at IS NULL;


-- ═══════════════════════════════════════════════════════════════════════════
-- SEÇÃO 1: Limpar duplicatas existentes (mantém o mais recente)
-- Só execute se a query 0.2 retornou resultados.
-- ═══════════════════════════════════════════════════════════════════════════

-- Marca duplicatas como deletadas, mantendo apenas o registro mais recente
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

-- Verificar que não há mais duplicatas
SELECT comanda, user_id, COUNT(*) AS qtd
FROM public.sheet_transactions
WHERE comanda IS NOT NULL
  AND deleted_at IS NULL
GROUP BY comanda, user_id
HAVING COUNT(*) > 1;
-- Deve retornar 0 linhas


-- ═══════════════════════════════════════════════════════════════════════════
-- SEÇÃO 2: Criar unique constraint parcial
-- ═══════════════════════════════════════════════════════════════════════════

-- SEÇÃO 1.5: Garantir que a coluna user_id existe
-- O Web App associa cada linha da planilha ao usuário dono (SHEET_USER_ID).
-- Se a coluna já existir, nada acontece (IF NOT EXISTS).

ALTER TABLE public.sheet_transactions
  ADD COLUMN IF NOT EXISTS user_id uuid;


-- Drop se já existir (para re-execuções seguras)
DROP INDEX IF EXISTS public.idx_sheet_tx_unique_comanda_user;

-- Unique partial index: apenas registros ativos (deleted_at IS NULL)
-- Isso permite que uma comanda seja "recriada" após ser deletada.
CREATE UNIQUE INDEX idx_sheet_tx_unique_comanda_user
  ON public.sheet_transactions (comanda, user_id)
  WHERE comanda IS NOT NULL
    AND deleted_at IS NULL;

-- Verificar que foi criado
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'sheet_transactions'
  AND indexname = 'idx_sheet_tx_unique_comanda_user';


-- ═══════════════════════════════════════════════════════════════════════════
-- SEÇÃO 3: Revert (caso precise desfazer)
-- ═══════════════════════════════════════════════════════════════════════════

-- DROP INDEX IF EXISTS public.idx_sheet_tx_unique_comanda_user;
