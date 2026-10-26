-- Corrige o fechamento automatico da lista de espera ao criar um agendamento.
-- O banco atual usa DATE tanto em appointment_waitlist.waitlist_date quanto em
-- appointments.appointment_date. A versao anterior convertia apenas um lado
-- para TEXT e provocava o erro PostgreSQL 42883 (text = date).
--
-- Idempotente: pode ser executado novamente no SQL Editor do Supabase.

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
       AND waitlist_date = NEW.appointment_date::date
       AND status IN ('aguardando', 'contatada');
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.fn_close_waitlist_from_appointment() IS
  'Fecha a espera do mesmo cliente, servico e dia quando o agendamento e salvo.';
