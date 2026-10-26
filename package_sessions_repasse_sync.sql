-- Sessao de pacote comprovada pelo REPASSE da planilha.
-- Execute depois de patient_packages_migration.sql.
-- Idempotente: pode ser executada novamente sem duplicar sessoes.

ALTER TABLE public.patient_package_sessions
  ADD COLUMN IF NOT EXISTS sheet_transaction_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS patient_package_sessions_sheet_transaction_uidx
  ON public.patient_package_sessions (sheet_transaction_id)
  WHERE sheet_transaction_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.fn_package_normalize_text(p_value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT regexp_replace(
    translate(
      lower(trim(COALESCE(p_value, ''))),
      'áàâãäéèêëíìîïóòôõöúùûüç',
      'aaaaaeeeeiiiiooooouuuuc'
    ),
    '[^a-z0-9]+',
    '',
    'g'
  );
$$;

-- A Agenda continua podendo reservar o pacote no agendamento, mas finalizar
-- sozinho nao comprova uso. A comprovacao passa a ser o REPASSE.
DROP TRIGGER IF EXISTS trg_sync_package_session_from_appointment ON public.appointments;

-- Compatibilidade com o sincronizador antigo: ele enviava a coluna REPASSE
-- como gross quando as quatro formas de pagamento estavam zeradas. Normaliza
-- antes de gravar para nao tratar pacote como faturamento novo.
CREATE OR REPLACE FUNCTION public.fn_normalize_sheet_package_repasse()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF COALESCE(NEW.origin, 'planilha') = 'planilha'
     AND COALESCE(NEW.row_type, NEW.tipo, 'receita') = 'receita'
     AND COALESCE(NEW.repasse, 0) <= 0
     AND COALESCE(NEW.gross, 0) > 0
     AND COALESCE(NEW.pix, 0) = 0
     AND COALESCE(NEW.credito, 0) = 0
     AND COALESCE(NEW.debito, 0) = 0
     AND COALESCE(NEW.dinheiro, 0) = 0 THEN
    NEW.repasse := NEW.gross;
    NEW.gross := 0;
    NEW.payment_method := 'Repasse de pacote';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_normalize_sheet_package_repasse ON public.sheet_transactions;
CREATE TRIGGER trg_normalize_sheet_package_repasse
  BEFORE INSERT OR UPDATE OF repasse, gross, pix, credito, debito, dinheiro, row_type, tipo, origin
  ON public.sheet_transactions
  FOR EACH ROW EXECUTE FUNCTION public.fn_normalize_sheet_package_repasse();

CREATE OR REPLACE FUNCTION public.fn_sync_package_session_from_repasse()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_transaction_id uuid;
  v_old_package_id uuid;
  v_client_id integer;
  v_client_count integer;
  v_appointment_id uuid;
  v_appointment_package_id uuid;
  v_package public.patient_packages%ROWTYPE;
  v_package_count integer;
  v_existing public.patient_package_sessions%ROWTYPE;
  v_used integer;
  v_next integer;
  v_performed_at timestamptz;
BEGIN
  -- Excluir, zerar ou corrigir um repasse estorna sua sessao anterior.
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    v_transaction_id := OLD.id;

    SELECT patient_package_id INTO v_old_package_id
      FROM public.patient_package_sessions
     WHERE sheet_transaction_id = v_transaction_id
       AND status <> 'reversed'
     LIMIT 1;

    IF v_old_package_id IS NOT NULL THEN
      UPDATE public.patient_package_sessions
         SET status = 'reversed',
             reversed_at = now(),
             reversal_reason = CASE
               WHEN TG_OP = 'DELETE' THEN 'Repasse removido da planilha'
               ELSE 'Repasse corrigido ou atualizado na planilha'
             END
       WHERE sheet_transaction_id = v_transaction_id
         AND status <> 'reversed';
      PERFORM public.fn_refresh_patient_package_status(v_old_package_id);
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  -- Somente uma linha real com REPASSE positivo representa sessao de pacote.
  IF COALESCE(NEW.repasse, 0) <= 0
     OR COALESCE(NEW.is_metadata, false)
     OR NEW.deleted_at IS NOT NULL
     OR NEW.user_id IS NULL
     OR NEW.date_ref IS NULL
     OR public.fn_package_normalize_text(NEW.client) = ''
     OR public.fn_package_normalize_text(NEW.procedure) = '' THEN
    RETURN NEW;
  END IF;

  -- Nome sozinho pode ser ambiguo. Nao vincula quando existem homonimos.
  SELECT count(*)::integer, min(id)
    INTO v_client_count, v_client_id
    FROM public.clients
   WHERE user_id = NEW.user_id
     AND public.fn_package_normalize_text(name) = public.fn_package_normalize_text(NEW.client);

  IF v_client_count <> 1 THEN
    RAISE NOTICE 'Repasse % nao vinculado: paciente ausente ou nome ambiguo.', NEW.id;
    RETURN NEW;
  END IF;

  -- Procura primeiro o agendamento correspondente. Se houver mais de um no
  -- mesmo dia, usa o primeiro ainda sem outro repasse comprovando sua sessao.
  SELECT a.id, a.patient_package_id
    INTO v_appointment_id, v_appointment_package_id
    FROM public.appointments a
   WHERE a.client_id = v_client_id
     AND a.appointment_date = NEW.date_ref::text
     AND public.fn_package_normalize_text(a.procedure) = public.fn_package_normalize_text(NEW.procedure)
     AND COALESCE(a.status, '') NOT IN ('cancelado', 'cancelled', 'desmarcado', 'falta')
     AND (
       public.fn_package_normalize_text(NEW.professional) = ''
       OR public.fn_package_normalize_text(a.professional) = public.fn_package_normalize_text(NEW.professional)
     )
     AND NOT EXISTS (
       SELECT 1
         FROM public.patient_package_sessions occupied
        WHERE occupied.appointment_id = a.id
          AND occupied.sheet_transaction_id IS NOT NULL
          AND occupied.sheet_transaction_id <> NEW.id
          AND occupied.status <> 'reversed'
     )
   ORDER BY a.appointment_time, a.created_at
   LIMIT 1;

  -- O pacote reservado pela Agenda tem prioridade.
  IF v_appointment_package_id IS NOT NULL THEN
    SELECT * INTO v_package
      FROM public.patient_packages
     WHERE id = v_appointment_package_id
       AND user_id = NEW.user_id
       AND client_id = v_client_id
     FOR UPDATE;
  ELSE
    -- Sem reserva na Agenda, so prossegue quando existe exatamente um pacote
    -- ativo, com saldo e compativel com o procedimento informado no repasse.
    SELECT count(*)::integer
      INTO v_package_count
      FROM public.patient_packages candidate
     WHERE candidate.user_id = NEW.user_id
       AND candidate.client_id = v_client_id
       AND candidate.status = 'active'
       AND (
         jsonb_array_length(COALESCE(candidate.services, '[]'::jsonb)) = 0
         OR EXISTS (
           SELECT 1
             FROM jsonb_array_elements(COALESCE(candidate.services, '[]'::jsonb)) service
            WHERE public.fn_package_normalize_text(
              COALESCE(service->>'nome', service->>'name', trim(both '"' from service::text))
            ) = public.fn_package_normalize_text(NEW.procedure)
         )
       )
       AND (
         SELECT count(*)
           FROM public.patient_package_sessions used_session
          WHERE used_session.patient_package_id = candidate.id
            AND used_session.status <> 'reversed'
       ) < candidate.total_sessions;

    IF v_package_count = 1 THEN
      SELECT candidate.* INTO v_package
        FROM public.patient_packages candidate
       WHERE candidate.user_id = NEW.user_id
         AND candidate.client_id = v_client_id
         AND candidate.status = 'active'
         AND (
           jsonb_array_length(COALESCE(candidate.services, '[]'::jsonb)) = 0
           OR EXISTS (
             SELECT 1
               FROM jsonb_array_elements(COALESCE(candidate.services, '[]'::jsonb)) service
              WHERE public.fn_package_normalize_text(
                COALESCE(service->>'nome', service->>'name', trim(both '"' from service::text))
              ) = public.fn_package_normalize_text(NEW.procedure)
           )
         )
         AND (
           SELECT count(*)
             FROM public.patient_package_sessions used_session
            WHERE used_session.patient_package_id = candidate.id
              AND used_session.status <> 'reversed'
         ) < candidate.total_sessions
       FOR UPDATE;
    ELSE
      RAISE NOTICE 'Repasse % nao vinculado: nenhum pacote compativel ou mais de uma opcao.', NEW.id;
      RETURN NEW;
    END IF;
  END IF;

  IF v_package.id IS NULL THEN
    RAISE NOTICE 'Repasse % nao vinculado: pacote reservado nao encontrado.', NEW.id;
    RETURN NEW;
  END IF;

  SELECT count(*)::integer INTO v_used
    FROM public.patient_package_sessions
   WHERE patient_package_id = v_package.id
     AND status <> 'reversed'
     AND sheet_transaction_id IS DISTINCT FROM NEW.id
     AND (v_appointment_id IS NULL OR appointment_id IS DISTINCT FROM v_appointment_id);

  IF v_used >= v_package.total_sessions THEN
    RAISE NOTICE 'Repasse % nao vinculado: pacote sem saldo.', NEW.id;
    RETURN NEW;
  END IF;

  SELECT candidate INTO v_next
    FROM generate_series(1, v_package.total_sessions) candidate
   WHERE NOT EXISTS (
     SELECT 1
       FROM public.patient_package_sessions active_session
      WHERE active_session.patient_package_id = v_package.id
        AND active_session.session_number = candidate
        AND active_session.status <> 'reversed'
        AND active_session.sheet_transaction_id IS DISTINCT FROM NEW.id
        AND (v_appointment_id IS NULL OR active_session.appointment_id IS DISTINCT FROM v_appointment_id)
   )
   ORDER BY candidate
   LIMIT 1;

  v_performed_at := (NEW.date_ref::timestamp + interval '12 hours') AT TIME ZONE 'America/Sao_Paulo';

  -- Aproveita a sessao antiga criada pelo agendamento, se existir, sem contar
  -- duas vezes. Caso contrario, reutiliza o registro deste repasse ou cria um.
  SELECT * INTO v_existing
    FROM public.patient_package_sessions
   WHERE (v_appointment_id IS NOT NULL AND appointment_id = v_appointment_id)
      OR sheet_transaction_id = NEW.id
   ORDER BY CASE WHEN appointment_id = v_appointment_id THEN 0 ELSE 1 END
   LIMIT 1;

  IF FOUND THEN
    UPDATE public.patient_package_sessions
       SET patient_package_id = v_package.id,
           client_id = v_client_id,
           appointment_id = COALESCE(v_appointment_id, appointment_id),
           sheet_transaction_id = NEW.id,
           session_number = v_next,
           service_name = NEW.procedure,
           professional_name = NEW.professional,
           performed_at = v_performed_at,
           status = CASE WHEN signed_at IS NULL THEN 'pending_signature' ELSE 'signed' END,
           reversed_at = NULL,
           reversal_reason = NULL,
           notes = 'Sessao confirmada pelo repasse da planilha.'
     WHERE id = v_existing.id;
  ELSE
    INSERT INTO public.patient_package_sessions (
      user_id, patient_package_id, client_id, appointment_id, sheet_transaction_id,
      session_number, service_name, professional_name, performed_at, status,
      acknowledgment_text, notes
    ) VALUES (
      v_package.user_id, v_package.id, v_client_id, v_appointment_id, NEW.id,
      v_next, NEW.procedure, NEW.professional, v_performed_at, 'pending_signature',
      'Confirmo a realizacao da sessao ' || v_next || ' de ' || v_package.total_sessions ||
      ' do pacote ' || v_package.package_name || '.',
      'Sessao confirmada pelo repasse da planilha.'
    );
  END IF;

  IF v_appointment_id IS NOT NULL AND v_appointment_package_id IS NULL THEN
    UPDATE public.appointments
       SET patient_package_id = v_package.id
     WHERE id = v_appointment_id;
  END IF;

  PERFORM public.fn_refresh_patient_package_status(v_package.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_package_session_from_repasse ON public.sheet_transactions;
DROP TRIGGER IF EXISTS trg_sync_package_session_from_repasse_upsert ON public.sheet_transactions;
DROP TRIGGER IF EXISTS trg_sync_package_session_from_repasse_delete ON public.sheet_transactions;
CREATE TRIGGER trg_sync_package_session_from_repasse_upsert
  AFTER INSERT OR UPDATE OF repasse, gross, pix, credito, debito, dinheiro, client, procedure, professional, date_ref, deleted_at, is_metadata
  ON public.sheet_transactions
  FOR EACH ROW EXECUTE FUNCTION public.fn_sync_package_session_from_repasse();
CREATE TRIGGER trg_sync_package_session_from_repasse_delete
  AFTER DELETE ON public.sheet_transactions
  FOR EACH ROW EXECUTE FUNCTION public.fn_sync_package_session_from_repasse();

COMMENT ON COLUMN public.patient_package_sessions.sheet_transaction_id IS
  'Repasse da planilha que comprova o uso desta sessao do pacote.';
COMMENT ON FUNCTION public.fn_sync_package_session_from_repasse() IS
  'Consome ou estorna uma sessao de pacote exclusivamente a partir de um repasse real da planilha.';
