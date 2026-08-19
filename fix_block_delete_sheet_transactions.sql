-- ============================================================
-- fix_shield_sheet_transactions.sql
-- Escudo da tabela sheet_transactions + limpeza do espelho antigo
-- + coluna user_id que o Apps Script envia
-- ============================================================
-- PROBLEMA DIAGNOSTICADO:
--   Dois syncs disputam a mesma tabela:
--   1) Apps Script (web-app-endpoint.gs) — o CORRETO: grava comandas
--      com prefixo de data (CORREÇÃO 4) e nunca apaga nada.
--   2) Sync ANTIGO (plataforma readdy.ai), ligado à conexão "teste"
--      da tabela sheet_connections: espelha a planilha e faz
--      "deleção de órfãos" — apaga do banco tudo que não está mais
--      na planilha. Como a virada limpa a planilha toda noite, o
--      histórico sumia toda madrugada (relatório só mostrava hoje).
--   As linhas do sync antigo são identificáveis: connection_id
--      preenchido (nenhum código do app atual usa connection_id).
--
-- SOLUÇÃO (este script, pode rodar de novo que é seguro):
--   A) Trigger BEFORE que:
--      - bloqueia DELETE físico (histórico financeiro é imutável;
--        exclusões legítimas usam soft-delete via deleted_at);
--      - ignora silenciosamente INSERT/UPDATE com connection_id
--        (neutraliza o espelho antigo mesmo que ele continue rodando),
--        exceto soft-delete administrativo (deleted_at NULL -> preenchido).
--   B) Soft-delete das linhas já gravadas pelo espelho antigo.
--   C) Cria a coluna user_id (o Apps Script envia user_id no payload;
--      sem a coluna o POST falhava com erro 400).
--
-- Executar no SQL Editor do Supabase Dashboard.
-- ============================================================

-- ── A) Função escudo ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.shield_sheet_transactions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 1) DELETE físico: cancela silenciosamente (RETURN NULL em BEFORE DELETE).
  IF TG_OP = 'DELETE' THEN
    RETURN NULL;
  END IF;

  -- 2) Linhas do espelho antigo (connection_id preenchido):
  IF NEW.connection_id IS NOT NULL THEN
    -- INSERT novo do espelho: ignora.
    IF TG_OP = 'INSERT' THEN
      RETURN NULL;
    END IF;
    -- UPDATE do espelho: ignora, EXETO soft-delete administrativo
    -- (deleted_at NULL -> preenchido), usado na limpeza abaixo.
    IF TG_OP = 'UPDATE' THEN
      IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
        RETURN NEW; -- permite a limpeza administrativa
      END IF;
      RETURN NULL; -- bloqueia reativação/edições do espelho
    END IF;
  END IF;

  -- 3) Demais gravações (Apps Script / app): segue normalmente.
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_shield_sheet_transactions ON public.sheet_transactions;
DROP TRIGGER IF EXISTS trg_block_delete_sheet_transactions ON public.sheet_transactions;

CREATE TRIGGER trg_shield_sheet_transactions
  BEFORE INSERT OR UPDATE OR DELETE ON public.sheet_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.shield_sheet_transactions();

-- ── B) Limpeza: soft-delete das linhas do espelho antigo ──────
UPDATE public.sheet_transactions
   SET deleted_at = now()
 WHERE connection_id IS NOT NULL
   AND deleted_at IS NULL;

-- ── C) Coluna que faltava (Apps Script envia user_id) ─────────
ALTER TABLE public.sheet_transactions
  ADD COLUMN IF NOT EXISTS user_id uuid;

-- ── D) Remove NOT NULL das colunas legadas do espelho antigo ──
-- O espelho (readdy.ai) criava estas colunas como obrigatórias e só
-- ele as preenchia. O Apps Script não as envia (correto), então o
-- INSERT falhava com 23502 "row_index violates not-null constraint".
-- Tornar nullable é inofensivo: o espelho segue gravando nelas (ou
-- nem grava mais, pois o escudo ignora seus INSERTs).
ALTER TABLE public.sheet_transactions
  ALTER COLUMN connection_id DROP NOT NULL,
  ALTER COLUMN row_index     DROP NOT NULL,
  ALTER COLUMN row_hash      DROP NOT NULL,
  ALTER COLUMN raw_data      DROP NOT NULL;

-- ── Conferir resultado ────────────────────────────────────────
SELECT tgname FROM pg_trigger
WHERE tgrelid = 'public.sheet_transactions'::regclass
  AND tgname = 'trg_shield_sheet_transactions';

SELECT count(*) AS linhas_espelho_ativas
FROM public.sheet_transactions
WHERE connection_id IS NOT NULL AND deleted_at IS NULL;

SELECT column_name FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'sheet_transactions' AND column_name = 'user_id';
