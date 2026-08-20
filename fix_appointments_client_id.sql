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
-- Correção completa (ordem importa):
--   1. Derruba o trigger que depende da coluna (bloqueia o ALTER TYPE)
--   2. Converte a coluna uuid -> integer
--   3. Recria a FK correta
--   4. Recria a função do trigger com cid integer (estava uuid)
--   5. Recria o trigger
--
-- Seguro: a tabela appointments está vazia, nenhum dado é perdido.
-- Pode rodar mais de uma vez (idempotente).
-- =============================================================================

-- 1. Remove o trigger que depende da coluna client_id
DROP TRIGGER IF EXISTS trg_appointments_visit_stats ON public.appointments;

-- 2. Remove FK antiga (se existir)
ALTER TABLE public.appointments
  DROP CONSTRAINT IF EXISTS appointments_client_id_fkey;

-- 3. Converte a coluna uuid -> integer (tabela vazia, USING NULL é seguro)
ALTER TABLE public.appointments
  ALTER COLUMN client_id TYPE integer USING NULL;

-- 4. Recria a FK correta apontando para clients.id (integer)
ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.appointments.client_id IS
  'Vínculo com clients.id (integer) — usado pelo motor de marketing (lembretes WhatsApp).';

-- 5. Recria a função do trigger com o tipo correto (cid integer, não uuid)
CREATE OR REPLACE FUNCTION public.recompute_client_visit_stats()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  cid integer;
BEGIN
  cid := COALESCE(NEW.client_id, OLD.client_id);
  IF cid IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  UPDATE public.clients c
  SET
    total_consultas_concluidas = (
      SELECT count(*)
      FROM public.appointments a
      WHERE a.client_id = cid
        AND a.status IN ('finalizado', 'completed')
    ),
    last_visit = (
      SELECT max(a.appointment_date)::date
      FROM public.appointments a
      WHERE a.client_id = cid
        AND a.status IN ('finalizado', 'completed')
    )
  WHERE c.id = cid;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- 6. Recria o trigger
CREATE TRIGGER trg_appointments_visit_stats
  AFTER INSERT OR UPDATE OF status, client_id ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.recompute_client_visit_stats();

-- Conferência: deve mostrar data_type = integer
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'appointments' AND column_name = 'client_id';
