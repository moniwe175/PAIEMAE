-- Pacotes adquiridos por pacientes e comprovantes digitais de uso de sessao.
-- Execute no SQL Editor do Supabase. A migracao e idempotente.

CREATE TABLE IF NOT EXISTS public.patient_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  -- O banco operacional desta instalacao usa clients.id como integer.
  client_id integer NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  package_id text REFERENCES public.packages(id) ON DELETE SET NULL,
  package_name text NOT NULL,
  services jsonb NOT NULL DEFAULT '[]'::jsonb,
  total_sessions integer NOT NULL CHECK (total_sessions > 0),
  total_amount numeric(12,2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  purchased_at date NOT NULL DEFAULT CURRENT_DATE,
  expires_at date,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'completed', 'expired', 'paused', 'cancelled')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.patient_package_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  patient_package_id uuid NOT NULL REFERENCES public.patient_packages(id) ON DELETE CASCADE,
  client_id integer NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL,
  session_number integer NOT NULL CHECK (session_number > 0),
  service_name text,
  professional_name text,
  performed_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'pending_signature'
    CHECK (status IN ('pending_signature', 'signed', 'legacy', 'reversed')),
  acknowledgment_text text NOT NULL DEFAULT 'Confirmo a realizacao desta sessao do pacote.',
  signed_name text,
  signature_data_url text,
  signed_at timestamptz,
  reversed_at timestamptz,
  reversal_reason text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT patient_package_sessions_signature_check CHECK (
    (status = 'signed' AND signed_at IS NOT NULL AND signature_data_url IS NOT NULL)
    OR status <> 'signed'
  )
);

ALTER TABLE public.patient_package_sessions
  DROP CONSTRAINT IF EXISTS patient_package_sessions_number_unique;

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS patient_package_id uuid REFERENCES public.patient_packages(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS patient_package_sessions_appointment_uidx
  ON public.patient_package_sessions (appointment_id)
  WHERE appointment_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS patient_package_sessions_active_number_uidx
  ON public.patient_package_sessions (patient_package_id, session_number)
  WHERE status <> 'reversed';
CREATE INDEX IF NOT EXISTS patient_packages_client_idx
  ON public.patient_packages (user_id, client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS patient_package_sessions_client_idx
  ON public.patient_package_sessions (user_id, client_id, performed_at DESC);
CREATE INDEX IF NOT EXISTS patient_package_sessions_pending_idx
  ON public.patient_package_sessions (user_id, status, performed_at DESC);
CREATE INDEX IF NOT EXISTS appointments_patient_package_idx
  ON public.appointments (patient_package_id)
  WHERE patient_package_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.fn_touch_patient_package_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_patient_packages ON public.patient_packages;
CREATE TRIGGER trg_touch_patient_packages
  BEFORE UPDATE ON public.patient_packages
  FOR EACH ROW EXECUTE FUNCTION public.fn_touch_patient_package_updated_at();

DROP TRIGGER IF EXISTS trg_touch_patient_package_sessions ON public.patient_package_sessions;
CREATE TRIGGER trg_touch_patient_package_sessions
  BEFORE UPDATE ON public.patient_package_sessions
  FOR EACH ROW EXECUTE FUNCTION public.fn_touch_patient_package_updated_at();

CREATE OR REPLACE FUNCTION public.fn_refresh_patient_package_status(p_package_id uuid)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_total integer;
  v_used integer;
  v_current_status text;
  v_expires date;
BEGIN
  SELECT total_sessions, status, expires_at
    INTO v_total, v_current_status, v_expires
    FROM public.patient_packages
   WHERE id = p_package_id;

  IF NOT FOUND OR v_current_status IN ('paused', 'cancelled') THEN
    RETURN;
  END IF;

  SELECT count(*)::integer INTO v_used
    FROM public.patient_package_sessions
   WHERE patient_package_id = p_package_id
     AND status <> 'reversed';

  UPDATE public.patient_packages
     SET status = CASE
       WHEN v_used >= v_total THEN 'completed'
       WHEN v_expires IS NOT NULL AND v_expires < CURRENT_DATE THEN 'expired'
       ELSE 'active'
     END
   WHERE id = p_package_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_sync_package_session_from_appointment()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_package public.patient_packages%ROWTYPE;
  v_existing public.patient_package_sessions%ROWTYPE;
  v_used integer;
  v_next integer;
  v_performed_at timestamptz;
BEGIN
  IF TG_OP = 'UPDATE'
     AND OLD.patient_package_id IS DISTINCT FROM NEW.patient_package_id
     AND OLD.patient_package_id IS NOT NULL THEN
    UPDATE public.patient_package_sessions
       SET status = 'reversed', reversed_at = now(),
           reversal_reason = 'Pacote vinculado ao atendimento foi alterado'
     WHERE appointment_id = NEW.id AND status <> 'reversed';
    PERFORM public.fn_refresh_patient_package_status(OLD.patient_package_id);
  END IF;

  IF NEW.patient_package_id IS NULL THEN
    IF TG_OP = 'UPDATE' AND OLD.patient_package_id IS NOT NULL AND OLD.status = 'finalizado' THEN
      UPDATE public.patient_package_sessions
         SET status = 'reversed', reversed_at = now(),
             reversal_reason = 'Vinculo do pacote removido do agendamento'
       WHERE appointment_id = NEW.id AND status <> 'reversed';
      PERFORM public.fn_refresh_patient_package_status(OLD.patient_package_id);
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.status = 'finalizado' THEN
    SELECT * INTO v_package
      FROM public.patient_packages
     WHERE id = NEW.patient_package_id
     FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Pacote do paciente nao encontrado.';
    END IF;
    IF v_package.client_id IS DISTINCT FROM NEW.client_id THEN
      RAISE EXCEPTION 'O pacote selecionado nao pertence a este paciente.';
    END IF;
    IF v_package.status IN ('paused', 'cancelled', 'expired') THEN
      RAISE EXCEPTION 'O pacote selecionado nao esta disponivel (%).', v_package.status;
    END IF;

    SELECT * INTO v_existing
      FROM public.patient_package_sessions
     WHERE appointment_id = NEW.id;

    IF FOUND THEN
      IF v_existing.status = 'reversed' THEN
        SELECT count(*)::integer INTO v_used
          FROM public.patient_package_sessions
         WHERE patient_package_id = NEW.patient_package_id
           AND status <> 'reversed';
        IF v_used >= v_package.total_sessions THEN
          RAISE EXCEPTION 'Este pacote nao possui sessoes restantes.';
        END IF;

        SELECT candidate INTO v_next
          FROM generate_series(1, v_package.total_sessions) candidate
         WHERE NOT EXISTS (
           SELECT 1 FROM public.patient_package_sessions active_session
            WHERE active_session.patient_package_id = NEW.patient_package_id
              AND active_session.session_number = candidate
              AND active_session.status <> 'reversed'
         )
         ORDER BY candidate
         LIMIT 1;

        UPDATE public.patient_package_sessions
           SET status = CASE WHEN signed_at IS NULL THEN 'pending_signature' ELSE 'signed' END,
               reversed_at = NULL, reversal_reason = NULL,
               patient_package_id = v_package.id,
               client_id = v_package.client_id,
               session_number = v_next,
               service_name = NEW.procedure,
               professional_name = NEW.professional
         WHERE id = v_existing.id;
      END IF;
    ELSE
      SELECT count(*)::integer INTO v_used
        FROM public.patient_package_sessions
       WHERE patient_package_id = NEW.patient_package_id
         AND status <> 'reversed';
      IF v_used >= v_package.total_sessions THEN
        RAISE EXCEPTION 'Este pacote nao possui sessoes restantes.';
      END IF;

      SELECT candidate INTO v_next
        FROM generate_series(1, v_package.total_sessions) candidate
       WHERE NOT EXISTS (
         SELECT 1 FROM public.patient_package_sessions active_session
          WHERE active_session.patient_package_id = NEW.patient_package_id
            AND active_session.session_number = candidate
            AND active_session.status <> 'reversed'
       )
       ORDER BY candidate
       LIMIT 1;

      BEGIN
        v_performed_at := (NEW.appointment_date || ' ' || NEW.appointment_time)::timestamptz;
      EXCEPTION WHEN OTHERS THEN
        v_performed_at := now();
      END;

      INSERT INTO public.patient_package_sessions (
        user_id, patient_package_id, client_id, appointment_id, session_number,
        service_name, professional_name, performed_at, status, acknowledgment_text
      ) VALUES (
        v_package.user_id, v_package.id, v_package.client_id, NEW.id, v_next,
        NEW.procedure, NEW.professional, v_performed_at, 'pending_signature',
        'Confirmo a realizacao da sessao ' || v_next || ' de ' || v_package.total_sessions ||
        ' do pacote ' || v_package.package_name || '.'
      );
    END IF;

    PERFORM public.fn_refresh_patient_package_status(NEW.patient_package_id);
  ELSIF TG_OP = 'UPDATE' AND OLD.status = 'finalizado' THEN
    UPDATE public.patient_package_sessions
       SET status = 'reversed', reversed_at = now(),
           reversal_reason = 'Atendimento deixou de estar finalizado'
     WHERE appointment_id = NEW.id AND status <> 'reversed';
    PERFORM public.fn_refresh_patient_package_status(COALESCE(OLD.patient_package_id, NEW.patient_package_id));
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_package_session_from_appointment ON public.appointments;
CREATE TRIGGER trg_sync_package_session_from_appointment
  AFTER INSERT OR UPDATE OF status, patient_package_id ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.fn_sync_package_session_from_appointment();

ALTER TABLE public.patient_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_package_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS patient_packages_select_own ON public.patient_packages;
CREATE POLICY patient_packages_select_own ON public.patient_packages FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
DROP POLICY IF EXISTS patient_packages_insert_own ON public.patient_packages;
CREATE POLICY patient_packages_insert_own ON public.patient_packages FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS patient_packages_update_own ON public.patient_packages;
CREATE POLICY patient_packages_update_own ON public.patient_packages FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS patient_packages_delete_own ON public.patient_packages;
CREATE POLICY patient_packages_delete_own ON public.patient_packages FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS patient_package_sessions_select_own ON public.patient_package_sessions;
CREATE POLICY patient_package_sessions_select_own ON public.patient_package_sessions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
DROP POLICY IF EXISTS patient_package_sessions_insert_own ON public.patient_package_sessions;
CREATE POLICY patient_package_sessions_insert_own ON public.patient_package_sessions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS patient_package_sessions_update_own ON public.patient_package_sessions;
CREATE POLICY patient_package_sessions_update_own ON public.patient_package_sessions FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS patient_package_sessions_delete_own ON public.patient_package_sessions;
CREATE POLICY patient_package_sessions_delete_own ON public.patient_package_sessions FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.patient_packages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.patient_package_sessions TO authenticated;

COMMENT ON TABLE public.patient_packages IS 'Pacotes efetivamente adquiridos por pacientes; separado do catalogo packages.';
COMMENT ON TABLE public.patient_package_sessions IS 'Uso e assinatura de cada sessao de um pacote adquirido.';
