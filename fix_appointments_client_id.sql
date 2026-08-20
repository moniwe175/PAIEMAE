-- =============================================================================
-- FIX: appointments.client_id criado como UUID, mas clients.id é INTEGER
-- =============================================================================
-- Sintoma: nenhum agendamento salva quando o cliente já existe no cadastro.
-- Erro no insert: invalid input syntax for type uuid: "7"
--
-- Causa: marketing_engine/schema.sql criou appointments.client_id como uuid.
-- O frontend envia o id do cliente (integer, ex.: 7) e o motor de marketing
-- (rules.py / marketing_queue) também usa client_id integer.
--
-- Correção: converter a coluna para integer e recriar a FK correta.
-- Seguro: a tabela appointments está vazia, nenhum dado é perdido.
-- =============================================================================

-- 1. Remove FK antiga (se existir)
ALTER TABLE public.appointments
  DROP CONSTRAINT IF EXISTS appointments_client_id_fkey;

-- 2. Converte a coluna uuid -> integer (tabela vazia, USING NULL é seguro)
ALTER TABLE public.appointments
  ALTER COLUMN client_id TYPE integer USING NULL;

-- 3. Recria a FK correta apontando para clients.id (integer)
ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.appointments.client_id IS
  'Vínculo com clients.id (integer) — usado pelo motor de marketing (lembretes WhatsApp).';

-- Conferência: deve mostrar data_type = integer
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'appointments' AND column_name = 'client_id';
