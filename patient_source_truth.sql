-- PAIEMAE — origem de pacientes sem atribuição fictícia
-- Seguro para executar mais de uma vez no Supabase SQL Editor.

BEGIN;

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS source_confirmed_at timestamptz;

-- Novos registros sem origem declarada devem permanecer desconhecidos.
ALTER TABLE public.clients
  ALTER COLUMN source DROP DEFAULT;

COMMENT ON COLUMN public.clients.source IS
  'Canal de aquisição declarado pelo paciente. NULL significa não informado.';

COMMENT ON COLUMN public.clients.source_confirmed_at IS
  'Momento em que a origem foi informada ou confirmada. Valores legados sem confirmação não entram na atribuição por canal.';

COMMIT;
