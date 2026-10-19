-- =============================================================================
-- CRM + AGENDA: qualificação e vínculo automáticos
-- Data: 19/10/2026
--
-- Migração idempotente. Não altera RLS nem permissões das tabelas.
-- Mantém crm_leads.client_id, appointment_id e status sincronizados para que
-- as RPCs fn_ic_* da Inteligência Comercial continuem usando os mesmos campos.
-- =============================================================================

BEGIN;

ALTER TABLE public.crm_leads
  ADD COLUMN IF NOT EXISTS telefone_normalizado text;

-- Somente dígitos; remove o DDI mantendo os últimos 11 dígitos brasileiros.
CREATE OR REPLACE FUNCTION public.fn_crm_normalize_phone(p_phone text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN length(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g')) >= 10
      THEN right(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), 11)
    ELSE NULL
  END;
$$;

-- Mantém a coluna materializada consistente sem depender da interface.
CREATE OR REPLACE FUNCTION public.crm_leads_normalize_phone_before_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.telefone_normalizado := public.fn_crm_normalize_phone(NEW.telefone);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_crm_leads_normalize_phone ON public.crm_leads;
CREATE TRIGGER trg_crm_leads_normalize_phone
  BEFORE INSERT OR UPDATE ON public.crm_leads
  FOR EACH ROW
  EXECUTE FUNCTION public.crm_leads_normalize_phone_before_write();

-- Sincroniza um único lead. SECURITY DEFINER é necessário porque uma mudança
-- feita pela Agenda não pode falhar só porque o operador não edita o CRM.
CREATE OR REPLACE FUNCTION public.fn_crm_sync_lead_from_agenda(p_lead_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_lead                     public.crm_leads%ROWTYPE;
  v_phone                    text;
  v_today                    date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_duplicate_leads          integer := 0;
  v_candidate_clients        integer := 0;
  v_candidate_client_id      integer;
  v_finalized_appointment_id uuid;
  v_active_appointment_id    uuid;
  v_latest_bad_status        text;
  v_new_client_id            integer;
  v_new_appointment_id       uuid;
  v_new_status               text;
  v_new_loss_reason          text;
  v_new_closed_at            timestamptz;
  v_changes                  text[] := ARRAY[]::text[];
BEGIN
  SELECT *
    INTO v_lead
    FROM public.crm_leads
   WHERE id = p_lead_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  v_phone := public.fn_crm_normalize_phone(coalesce(v_lead.telefone_normalizado, v_lead.telefone));

  -- Dois leads com o mesmo telefone são ambíguos: nenhum é vinculado sozinho.
  IF v_phone IS NOT NULL THEN
    SELECT count(*)
      INTO v_duplicate_leads
      FROM public.crm_leads l
     WHERE public.fn_crm_normalize_phone(coalesce(l.telefone_normalizado, l.telefone)) = v_phone;
  END IF;

  IF v_phone IS NOT NULL AND v_duplicate_leads = 1 THEN
    -- Consolida IDs encontrados no cadastro e nos agendamentos. Se aparecerem
    -- dois pacientes diferentes para o mesmo telefone, não assume nenhum.
    SELECT count(*), min(candidate_id)
      INTO v_candidate_clients, v_candidate_client_id
      FROM (
        SELECT c.id AS candidate_id
          FROM public.clients c
         WHERE public.fn_crm_normalize_phone(c.phone) = v_phone
        UNION
        SELECT a.client_id AS candidate_id
          FROM public.appointments a
         WHERE public.fn_crm_normalize_phone(a.client_phone) = v_phone
           AND a.client_id IS NOT NULL
      ) candidates;

    IF v_candidate_clients <= 1 THEN
      v_new_client_id := v_candidate_client_id;

      -- Um atendimento finalizado prova a conversão e tem precedência.
      SELECT a.id
        INTO v_finalized_appointment_id
        FROM public.appointments a
       WHERE (
              public.fn_crm_normalize_phone(a.client_phone) = v_phone
              OR (v_candidate_client_id IS NOT NULL AND a.client_id = v_candidate_client_id)
             )
         AND lower(coalesce(a.status, '')) = 'finalizado'
         AND a.appointment_date::date <= v_today
       ORDER BY a.appointment_date DESC, a.appointment_time DESC, a.updated_at DESC NULLS LAST, a.id
       LIMIT 1;

      -- Sem atendimento finalizado, usa o próximo horário realmente ativo.
      IF v_finalized_appointment_id IS NULL THEN
        SELECT a.id
          INTO v_active_appointment_id
          FROM public.appointments a
         WHERE (
                public.fn_crm_normalize_phone(a.client_phone) = v_phone
                OR (v_candidate_client_id IS NOT NULL AND a.client_id = v_candidate_client_id)
               )
           AND a.appointment_date::date >= v_today
           AND lower(coalesce(a.status, '')) NOT IN (
             'finalizado', 'cancelado', 'cancelada', 'desmarcado', 'desmarcada',
             'falta', 'cliente_faltou', 'nao_compareceu', 'não_compareceu',
             'no_show', 'bloqueado', 'bloqueada'
           )
         ORDER BY a.appointment_date ASC, a.appointment_time ASC, a.created_at ASC NULLS LAST, a.id
         LIMIT 1;
      END IF;

      -- Só é perda por falta/cancelamento quando não houve conversão nem remarcação.
      IF v_finalized_appointment_id IS NULL AND v_active_appointment_id IS NULL THEN
        SELECT lower(coalesce(a.status, ''))
          INTO v_latest_bad_status
          FROM public.appointments a
         WHERE (
                public.fn_crm_normalize_phone(a.client_phone) = v_phone
                OR (v_candidate_client_id IS NOT NULL AND a.client_id = v_candidate_client_id)
               )
           AND lower(coalesce(a.status, '')) IN (
             'cancelado', 'cancelada', 'desmarcado', 'desmarcada',
             'falta', 'cliente_faltou', 'nao_compareceu', 'não_compareceu', 'no_show'
           )
         ORDER BY a.appointment_date DESC, a.appointment_time DESC, a.updated_at DESC NULLS LAST, a.id
         LIMIT 1;
      END IF;
    END IF;
  END IF;

  IF v_finalized_appointment_id IS NOT NULL THEN
    v_new_appointment_id := v_finalized_appointment_id;
    v_new_status := 'encerrado_ganho';
  ELSIF v_active_appointment_id IS NOT NULL THEN
    v_new_appointment_id := v_active_appointment_id;
    v_new_status := 'agendado';
  ELSIF v_latest_bad_status IS NOT NULL
     OR v_lead.created_at < (v_today - 30)::timestamp THEN
    v_new_appointment_id := NULL;
    v_new_status := 'encerrado_perdido';
  ELSE
    v_new_appointment_id := NULL;
    v_new_status := 'aguardando_resposta';
  END IF;

  v_new_loss_reason := CASE WHEN v_new_status = 'encerrado_perdido' THEN 'automatico' ELSE NULL END;
  v_new_closed_at := CASE
    WHEN v_new_status IN ('encerrado_ganho', 'encerrado_perdido')
      THEN coalesce(v_lead.encerrado_at, timezone('utc'::text, now()))
    ELSE NULL
  END;

  IF v_lead.status IS DISTINCT FROM v_new_status THEN
    v_changes := array_append(v_changes, format('status: %s -> %s', coalesce(v_lead.status, 'vazio'), v_new_status));
  END IF;
  IF v_lead.client_id IS DISTINCT FROM v_new_client_id THEN
    v_changes := array_append(v_changes, 'vínculo com paciente atualizado');
  END IF;
  IF v_lead.appointment_id IS DISTINCT FROM v_new_appointment_id THEN
    v_changes := array_append(v_changes, 'vínculo com agendamento atualizado');
  END IF;

  IF cardinality(v_changes) > 0
     OR v_lead.telefone_normalizado IS DISTINCT FROM v_phone
     OR v_lead.motivo_perda IS DISTINCT FROM v_new_loss_reason THEN
    UPDATE public.crm_leads
       SET telefone_normalizado = v_phone,
           client_id = v_new_client_id,
           appointment_id = v_new_appointment_id,
           status = v_new_status,
           motivo_perda = v_new_loss_reason,
           encerrado_at = v_new_closed_at
     WHERE id = p_lead_id;

    IF cardinality(v_changes) > 0 THEN
      INSERT INTO public.crm_interactions (
        lead_id, tipo, conteudo, autor, meta, user_id
      ) VALUES (
        p_lead_id,
        'sistema',
        'Agenda sincronizou automaticamente: ' || array_to_string(v_changes, ' · '),
        'Sistema · Agenda',
        jsonb_build_object(
          'acao', 'sincronizacao_automatica_agenda',
          'status_de', v_lead.status,
          'status_para', v_new_status,
          'client_id_de', v_lead.client_id,
          'client_id_para', v_new_client_id,
          'appointment_id_de', v_lead.appointment_id,
          'appointment_id_para', v_new_appointment_id
        ),
        v_lead.user_id
      );
    END IF;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_crm_sync_lead_from_agenda(uuid) FROM PUBLIC;

-- Recalcula pendências dependentes apenas da passagem do tempo (regra de 30
-- dias). A tela do CRM chama esta função antes de consultar a lista.
CREATE OR REPLACE FUNCTION public.fn_crm_sync_all_leads_from_agenda()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_lead_id uuid;
  v_count   integer := 0;
BEGIN
  FOR v_lead_id IN
    SELECT id
      FROM public.crm_leads
     WHERE arquivado IS FALSE OR arquivado IS NULL
     ORDER BY created_at, id
  LOOP
    PERFORM public.fn_crm_sync_lead_from_agenda(v_lead_id);
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_crm_sync_all_leads_from_agenda() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_crm_sync_all_leads_from_agenda() TO authenticated;

-- Sincroniza o próprio lead após cadastro ou troca de telefone.
CREATE OR REPLACE FUNCTION public.crm_leads_sync_after_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public.fn_crm_sync_lead_from_agenda(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_crm_leads_sync_after_insert ON public.crm_leads;
CREATE TRIGGER trg_crm_leads_sync_after_insert
  AFTER INSERT ON public.crm_leads
  FOR EACH ROW
  EXECUTE FUNCTION public.crm_leads_sync_after_write();

DROP TRIGGER IF EXISTS trg_crm_leads_sync_after_phone_update ON public.crm_leads;
CREATE TRIGGER trg_crm_leads_sync_after_phone_update
  AFTER UPDATE OF telefone ON public.crm_leads
  FOR EACH ROW
  WHEN (OLD.telefone IS DISTINCT FROM NEW.telefone)
  EXECUTE FUNCTION public.crm_leads_sync_after_write();

-- Uma alteração na Agenda recalcula todos os leads potencialmente relacionados
-- pelo vínculo antigo, novo vínculo ou pelos telefones antigo e novo.
CREATE OR REPLACE FUNCTION public.appointments_sync_crm_leads_after_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_old_phone  text;
  v_new_phone  text;
  v_old_client integer;
  v_new_client integer;
  v_lead_id    uuid;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    v_old_phone := public.fn_crm_normalize_phone(OLD.client_phone);
    v_old_client := OLD.client_id;
  END IF;

  v_new_phone := public.fn_crm_normalize_phone(NEW.client_phone);
  v_new_client := NEW.client_id;

  FOR v_lead_id IN
    SELECT DISTINCT l.id
      FROM public.crm_leads l
     WHERE l.appointment_id = NEW.id
        OR (TG_OP = 'UPDATE' AND l.appointment_id = OLD.id)
        OR (v_new_client IS NOT NULL AND l.client_id = v_new_client)
        OR (v_old_client IS NOT NULL AND l.client_id = v_old_client)
        OR (v_new_phone IS NOT NULL AND public.fn_crm_normalize_phone(coalesce(l.telefone_normalizado, l.telefone)) = v_new_phone)
        OR (v_old_phone IS NOT NULL AND public.fn_crm_normalize_phone(coalesce(l.telefone_normalizado, l.telefone)) = v_old_phone)
  LOOP
    PERFORM public.fn_crm_sync_lead_from_agenda(v_lead_id);
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_appointments_sync_crm_after_insert ON public.appointments;
CREATE TRIGGER trg_appointments_sync_crm_after_insert
  AFTER INSERT ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.appointments_sync_crm_leads_after_write();

DROP TRIGGER IF EXISTS trg_appointments_sync_crm_after_update ON public.appointments;
CREATE TRIGGER trg_appointments_sync_crm_after_update
  AFTER UPDATE OF status, client_id, client_phone, appointment_date, appointment_time
  ON public.appointments
  FOR EACH ROW
  WHEN (
       OLD.status IS DISTINCT FROM NEW.status
    OR OLD.client_id IS DISTINCT FROM NEW.client_id
    OR OLD.client_phone IS DISTINCT FROM NEW.client_phone
    OR OLD.appointment_date IS DISTINCT FROM NEW.appointment_date
    OR OLD.appointment_time IS DISTINCT FROM NEW.appointment_time
  )
  EXECUTE FUNCTION public.appointments_sync_crm_leads_after_write();

CREATE INDEX IF NOT EXISTS idx_appointments_crm_phone_norm
  ON public.appointments (public.fn_crm_normalize_phone(client_phone));

-- Backfill: normaliza e recalcula todos os interessados já existentes.
UPDATE public.crm_leads
   SET telefone_normalizado = public.fn_crm_normalize_phone(telefone)
 WHERE telefone_normalizado IS DISTINCT FROM public.fn_crm_normalize_phone(telefone);

DO $$
DECLARE
  v_lead_id uuid;
BEGIN
  FOR v_lead_id IN SELECT id FROM public.crm_leads ORDER BY created_at, id LOOP
    PERFORM public.fn_crm_sync_lead_from_agenda(v_lead_id);
  END LOOP;
END;
$$;

COMMIT;

-- Verificação opcional após aplicar:
-- SELECT status, count(*) FROM public.crm_leads GROUP BY status ORDER BY status;
-- SELECT tipo, conteudo, created_at FROM public.crm_interactions
--  WHERE meta->>'acao' = 'sincronizacao_automatica_agenda' ORDER BY created_at DESC LIMIT 20;
