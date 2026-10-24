-- =============================================================================
-- LISTA DE ESPERA DA AGENDA
-- =============================================================================
-- Mantem pedidos de encaixe separados de appointments para que espera nao seja
-- contada como ocupacao, atendimento, venda ou conversao do CRM.
-- Idempotente: pode ser executada novamente no SQL Editor do Supabase.

CREATE TABLE IF NOT EXISTS public.appointment_waitlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id integer NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  service text NOT NULL,
  preferred_professional text,
  preferred_period text NOT NULL DEFAULT 'qualquer'
    CHECK (preferred_period IN ('qualquer', 'manha', 'tarde', 'noite')),
  available_from date NOT NULL DEFAULT CURRENT_DATE,
  available_until date,
  notes text,
  status text NOT NULL DEFAULT 'aguardando'
    CHECK (status IN ('aguardando', 'contatada', 'agendada', 'desistiu', 'expirada')),
  contacted_at timestamptz,
  scheduled_appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT appointment_waitlist_valid_window
    CHECK (available_until IS NULL OR available_until >= available_from)
);

CREATE INDEX IF NOT EXISTS appointment_waitlist_status_created_idx
  ON public.appointment_waitlist (status, created_at);

CREATE INDEX IF NOT EXISTS appointment_waitlist_client_idx
  ON public.appointment_waitlist (client_id);

CREATE INDEX IF NOT EXISTS appointment_waitlist_service_idx
  ON public.appointment_waitlist (lower(service));

CREATE UNIQUE INDEX IF NOT EXISTS appointment_waitlist_active_client_service_uidx
  ON public.appointment_waitlist (client_id, lower(service))
  WHERE status IN ('aguardando', 'contatada');

CREATE OR REPLACE FUNCTION public.fn_touch_appointment_waitlist_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_appointment_waitlist_updated_at
  ON public.appointment_waitlist;

CREATE TRIGGER trg_touch_appointment_waitlist_updated_at
  BEFORE UPDATE ON public.appointment_waitlist
  FOR EACH ROW EXECUTE FUNCTION public.fn_touch_appointment_waitlist_updated_at();

-- Se a recepcao agendar normalmente uma pessoa que estava esperando pelo mesmo
-- servico, a espera e encerrada sem exigir uma segunda acao manual.
CREATE OR REPLACE FUNCTION public.fn_close_waitlist_from_appointment()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.client_id IS NOT NULL
     AND coalesce(trim(NEW.procedure), '') <> ''
     AND lower(coalesce(NEW.status, '')) NOT IN (
       'cancelado', 'cancelled', 'desmarcado', 'falta', 'cliente_faltou',
       'no_show', 'bloqueado'
     ) THEN
    UPDATE public.appointment_waitlist
       SET status = 'agendada',
           scheduled_appointment_id = NEW.id
     WHERE client_id = NEW.client_id
       AND lower(trim(service)) = lower(trim(NEW.procedure))
       AND status IN ('aguardando', 'contatada');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_close_waitlist_from_appointment
  ON public.appointments;

CREATE TRIGGER trg_close_waitlist_from_appointment
  AFTER INSERT OR UPDATE OF client_id, procedure, status
  ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.fn_close_waitlist_from_appointment();

ALTER TABLE public.appointment_waitlist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS appointment_waitlist_authenticated_select
  ON public.appointment_waitlist;
CREATE POLICY appointment_waitlist_authenticated_select
  ON public.appointment_waitlist FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS appointment_waitlist_authenticated_insert
  ON public.appointment_waitlist;
CREATE POLICY appointment_waitlist_authenticated_insert
  ON public.appointment_waitlist FOR INSERT TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS appointment_waitlist_authenticated_update
  ON public.appointment_waitlist;
CREATE POLICY appointment_waitlist_authenticated_update
  ON public.appointment_waitlist FOR UPDATE TO authenticated
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS appointment_waitlist_authenticated_delete
  ON public.appointment_waitlist;
CREATE POLICY appointment_waitlist_authenticated_delete
  ON public.appointment_waitlist FOR DELETE TO authenticated
  USING (true);

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.appointment_waitlist TO authenticated;

COMMENT ON TABLE public.appointment_waitlist IS
  'Pedidos de encaixe de clientes cadastrados; nao representam horarios reservados.';

