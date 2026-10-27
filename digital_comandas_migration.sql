-- =============================================================================
-- COMANDA DIGITAL
-- =============================================================================
-- Execute no SQL Editor do Supabase.
-- Idempotente: pode ser executado novamente sem apagar comandas existentes.
--
-- A comanda e o documento operacional. Ao fechar, cada item gera uma linha
-- financeira propria em sheet_transactions. Assim o caixa recebe o total uma
-- unica vez e os rankings deixam de tratar "Botox, axila, virilha" como um
-- unico servico. Itens de pacote geram REPASSE, nunca nova receita.

CREATE SEQUENCE IF NOT EXISTS public.digital_comanda_number_seq START 1;

CREATE OR REPLACE FUNCTION public.fn_next_digital_comanda_number()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 'CMD-' || to_char(CURRENT_DATE, 'YYYY') || '-' ||
         lpad(nextval('public.digital_comanda_number_seq')::text, 6, '0');
$$;

CREATE TABLE IF NOT EXISTS public.digital_comandas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  command_number text NOT NULL DEFAULT public.fn_next_digital_comanda_number(),
  appointment_id uuid NOT NULL REFERENCES public.appointments(id) ON DELETE RESTRICT,
  client_id integer REFERENCES public.clients(id) ON DELETE SET NULL,
  client_name text NOT NULL,
  client_phone text,
  service_date date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'closed', 'cancelled')),
  notes text,
  payment_method text NOT NULL DEFAULT 'Pix',
  pix numeric(12,2) NOT NULL DEFAULT 0 CHECK (pix >= 0),
  credito numeric(12,2) NOT NULL DEFAULT 0 CHECK (credito >= 0),
  debito numeric(12,2) NOT NULL DEFAULT 0 CHECK (debito >= 0),
  dinheiro numeric(12,2) NOT NULL DEFAULT 0 CHECK (dinheiro >= 0),
  total_amount numeric(12,2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  sheet_sync_status text NOT NULL DEFAULT 'not_needed'
    CHECK (sheet_sync_status IN ('not_needed', 'pending', 'synced', 'error')),
  sheet_sync_error text,
  sheet_synced_at timestamptz,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  cancelled_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS digital_comandas_number_uidx
  ON public.digital_comandas (command_number);
CREATE UNIQUE INDEX IF NOT EXISTS digital_comandas_active_appointment_uidx
  ON public.digital_comandas (appointment_id)
  WHERE status <> 'cancelled';
CREATE INDEX IF NOT EXISTS digital_comandas_date_idx
  ON public.digital_comandas (service_date DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS digital_comandas_user_idx
  ON public.digital_comandas (user_id, service_date DESC);

CREATE TABLE IF NOT EXISTS public.digital_comanda_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comanda_id uuid NOT NULL REFERENCES public.digital_comandas(id) ON DELETE CASCADE,
  position integer NOT NULL CHECK (position > 0),
  service_id text,
  service_name text NOT NULL,
  professional_name text NOT NULL,
  quantity numeric(10,2) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price numeric(12,2) NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
  discount numeric(12,2) NOT NULL DEFAULT 0 CHECK (discount >= 0),
  is_package boolean NOT NULL DEFAULT false,
  patient_package_id uuid,
  notes text,
  line_total numeric(12,2) GENERATED ALWAYS AS (
    CASE WHEN is_package THEN 0
         ELSE greatest(round((quantity * unit_price) - discount, 2), 0)
    END
  ) STORED,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (comanda_id, position)
);

CREATE INDEX IF NOT EXISTS digital_comanda_items_comanda_idx
  ON public.digital_comanda_items (comanda_id, position);
CREATE INDEX IF NOT EXISTS digital_comanda_items_service_idx
  ON public.digital_comanda_items (service_id, service_name);

CREATE OR REPLACE FUNCTION public.fn_touch_digital_comanda_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_digital_comandas ON public.digital_comandas;
CREATE TRIGGER trg_touch_digital_comandas
  BEFORE UPDATE ON public.digital_comandas
  FOR EACH ROW EXECUTE FUNCTION public.fn_touch_digital_comanda_updated_at();

DROP TRIGGER IF EXISTS trg_touch_digital_comanda_items ON public.digital_comanda_items;
CREATE TRIGGER trg_touch_digital_comanda_items
  BEFORE UPDATE ON public.digital_comanda_items
  FOR EACH ROW EXECUTE FUNCTION public.fn_touch_digital_comanda_updated_at();

-- Vínculo explícito entre a linha financeira detalhada e a comanda/item.
ALTER TABLE public.sheet_transactions
  ADD COLUMN IF NOT EXISTS digital_comanda_id uuid REFERENCES public.digital_comandas(id) ON DELETE SET NULL;
ALTER TABLE public.sheet_transactions
  ADD COLUMN IF NOT EXISTS digital_comanda_item_id uuid REFERENCES public.digital_comanda_items(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS sheet_transactions_digital_item_uidx
  ON public.sheet_transactions (digital_comanda_item_id)
  WHERE digital_comanda_item_id IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS sheet_transactions_digital_comanda_idx
  ON public.sheet_transactions (digital_comanda_id)
  WHERE digital_comanda_id IS NOT NULL;

-- Salva cabeçalho e itens em uma única transação. Uma comanda fechada é
-- imutável; correção financeira exige cancelamento e uma nova comanda.
CREATE OR REPLACE FUNCTION public.fn_save_digital_comanda(
  p_comanda_id uuid,
  p_appointment_id uuid,
  p_header jsonb,
  p_items jsonb
)
RETURNS public.digital_comandas
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_comanda public.digital_comandas%ROWTYPE;
  v_appointment public.appointments%ROWTYPE;
  v_item jsonb;
  v_position integer := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Sessao nao autenticada';
  END IF;
  IF jsonb_typeof(COALESCE(p_items, '[]'::jsonb)) <> 'array'
     OR jsonb_array_length(COALESCE(p_items, '[]'::jsonb)) = 0 THEN
    RAISE EXCEPTION 'Adicione pelo menos um servico a comanda';
  END IF;

  SELECT * INTO v_appointment
    FROM public.appointments
   WHERE id = p_appointment_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Agendamento nao encontrado';
  END IF;

  IF p_comanda_id IS NOT NULL THEN
    SELECT * INTO v_comanda
      FROM public.digital_comandas
     WHERE id = p_comanda_id AND user_id = v_user_id
     FOR UPDATE;
  ELSE
    SELECT * INTO v_comanda
      FROM public.digital_comandas
     WHERE appointment_id = p_appointment_id
       AND status <> 'cancelled'
     FOR UPDATE;
  END IF;

  IF FOUND AND v_comanda.status <> 'draft' THEN
    RAISE EXCEPTION 'Comanda fechada ou cancelada nao pode ser alterada';
  END IF;

  IF v_comanda.id IS NULL THEN
    INSERT INTO public.digital_comandas (
      appointment_id, client_id, client_name, client_phone, service_date,
      notes, payment_method, pix, credito, debito, dinheiro, user_id
    ) VALUES (
      p_appointment_id,
      v_appointment.client_id,
      COALESCE(NULLIF(trim(v_appointment.client_name), ''), NULLIF(trim(p_header->>'client_name'), ''), 'Cliente'),
      COALESCE(NULLIF(trim(v_appointment.client_phone), ''), NULLIF(trim(p_header->>'client_phone'), '')),
      COALESCE(v_appointment.appointment_date::date, CURRENT_DATE),
      NULLIF(trim(p_header->>'notes'), ''),
      COALESCE(NULLIF(trim(p_header->>'payment_method'), ''), 'Pix'),
      COALESCE((p_header->>'pix')::numeric, 0),
      COALESCE((p_header->>'credito')::numeric, 0),
      COALESCE((p_header->>'debito')::numeric, 0),
      COALESCE((p_header->>'dinheiro')::numeric, 0),
      v_user_id
    ) RETURNING * INTO v_comanda;
  ELSE
    UPDATE public.digital_comandas
       SET notes = NULLIF(trim(p_header->>'notes'), ''),
           payment_method = COALESCE(NULLIF(trim(p_header->>'payment_method'), ''), 'Pix'),
           pix = COALESCE((p_header->>'pix')::numeric, 0),
           credito = COALESCE((p_header->>'credito')::numeric, 0),
           debito = COALESCE((p_header->>'debito')::numeric, 0),
           dinheiro = COALESCE((p_header->>'dinheiro')::numeric, 0),
           sheet_sync_status = 'not_needed',
           sheet_sync_error = NULL
     WHERE id = v_comanda.id
     RETURNING * INTO v_comanda;
  END IF;

  DELETE FROM public.digital_comanda_items WHERE comanda_id = v_comanda.id;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    v_position := v_position + 1;
    IF COALESCE(trim(v_item->>'service_name'), '') = '' THEN
      RAISE EXCEPTION 'Item % sem servico', v_position;
    END IF;
    IF COALESCE(trim(v_item->>'professional_name'), '') = '' THEN
      RAISE EXCEPTION 'Item % sem profissional', v_position;
    END IF;

    INSERT INTO public.digital_comanda_items (
      comanda_id, position, service_id, service_name, professional_name,
      quantity, unit_price, discount, is_package, patient_package_id, notes
    ) VALUES (
      v_comanda.id,
      v_position,
      NULLIF(trim(v_item->>'service_id'), ''),
      trim(v_item->>'service_name'),
      trim(v_item->>'professional_name'),
      greatest(COALESCE((v_item->>'quantity')::numeric, 1), 0.01),
      greatest(COALESCE((v_item->>'unit_price')::numeric, 0), 0),
      greatest(COALESCE((v_item->>'discount')::numeric, 0), 0),
      COALESCE((v_item->>'is_package')::boolean, false),
      NULLIF(v_item->>'patient_package_id', '')::uuid,
      NULLIF(trim(v_item->>'notes'), '')
    );
  END LOOP;

  UPDATE public.digital_comandas
     SET total_amount = COALESCE((
       SELECT sum(line_total) FROM public.digital_comanda_items WHERE comanda_id = v_comanda.id
     ), 0)
   WHERE id = v_comanda.id
   RETURNING * INTO v_comanda;

  RETURN v_comanda;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_close_digital_comanda(p_comanda_id uuid)
RETURNS public.digital_comandas
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_comanda public.digital_comandas%ROWTYPE;
  v_item public.digital_comanda_items%ROWTYPE;
  v_paid_total numeric(12,2);
  v_payment_total numeric(12,2);
  v_paid_count integer;
  v_paid_index integer := 0;
  v_used_pix numeric(12,2) := 0;
  v_used_credito numeric(12,2) := 0;
  v_used_debito numeric(12,2) := 0;
  v_used_dinheiro numeric(12,2) := 0;
  v_pix numeric(12,2);
  v_credito numeric(12,2);
  v_debito numeric(12,2);
  v_dinheiro numeric(12,2);
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Sessao nao autenticada'; END IF;

  SELECT * INTO v_comanda
    FROM public.digital_comandas
   WHERE id = p_comanda_id AND user_id = v_user_id
   FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Comanda nao encontrada'; END IF;
  IF v_comanda.status = 'closed' THEN RETURN v_comanda; END IF;
  IF v_comanda.status <> 'draft' THEN RAISE EXCEPTION 'Comanda cancelada nao pode ser fechada'; END IF;

  SELECT COALESCE(sum(line_total), 0), count(*) FILTER (WHERE NOT is_package AND line_total > 0)
    INTO v_paid_total, v_paid_count
    FROM public.digital_comanda_items
   WHERE comanda_id = v_comanda.id;

  IF NOT EXISTS (SELECT 1 FROM public.digital_comanda_items WHERE comanda_id = v_comanda.id) THEN
    RAISE EXCEPTION 'Adicione pelo menos um servico a comanda';
  END IF;

  v_payment_total := round(v_comanda.pix + v_comanda.credito + v_comanda.debito + v_comanda.dinheiro, 2);
  IF abs(v_paid_total - v_payment_total) > 0.009 THEN
    RAISE EXCEPTION 'Pagamentos (%) diferentes do total dos servicos (%)', v_payment_total, v_paid_total;
  END IF;

  -- Remove uma tentativa anterior incompleta antes de reconstruir as linhas.
  DELETE FROM public.sheet_transactions
   WHERE digital_comanda_id = v_comanda.id;

  FOR v_item IN
    SELECT * FROM public.digital_comanda_items
     WHERE comanda_id = v_comanda.id
     ORDER BY position
  LOOP
    v_pix := 0; v_credito := 0; v_debito := 0; v_dinheiro := 0;
    IF NOT v_item.is_package AND v_item.line_total > 0 THEN
      v_paid_index := v_paid_index + 1;
      IF v_paid_index = v_paid_count THEN
        v_pix := v_comanda.pix - v_used_pix;
        v_credito := v_comanda.credito - v_used_credito;
        v_debito := v_comanda.debito - v_used_debito;
        v_dinheiro := v_comanda.dinheiro - v_used_dinheiro;
      ELSE
        v_pix := round(v_comanda.pix * v_item.line_total / NULLIF(v_paid_total, 0), 2);
        v_credito := round(v_comanda.credito * v_item.line_total / NULLIF(v_paid_total, 0), 2);
        v_debito := round(v_comanda.debito * v_item.line_total / NULLIF(v_paid_total, 0), 2);
        v_dinheiro := round(v_comanda.dinheiro * v_item.line_total / NULLIF(v_paid_total, 0), 2);
      END IF;
      v_used_pix := v_used_pix + v_pix;
      v_used_credito := v_used_credito + v_credito;
      v_used_debito := v_used_debito + v_debito;
      v_used_dinheiro := v_used_dinheiro + v_dinheiro;
    END IF;

    INSERT INTO public.sheet_transactions (
      date_ref, client, procedure, professional, gross, payment_method,
      pix, credito, debito, dinheiro, repasse, comanda, row_type, tipo,
      origin, is_metadata, deleted_at, user_id,
      digital_comanda_id, digital_comanda_item_id
    ) VALUES (
      v_comanda.service_date,
      v_comanda.client_name,
      v_item.service_name,
      v_item.professional_name,
      CASE WHEN v_item.is_package THEN 0 ELSE v_item.line_total END,
      CASE WHEN v_item.is_package THEN 'Repasse de pacote' ELSE v_comanda.payment_method END,
      v_pix, v_credito, v_debito, v_dinheiro,
      CASE WHEN v_item.is_package THEN 1 ELSE 0 END,
      v_comanda.service_date::text || '_' || v_comanda.command_number || '-' || lpad(v_item.position::text, 2, '0'),
      'receita', 'receita', 'comanda_digital', false, NULL, v_comanda.user_id,
      v_comanda.id, v_item.id
    );
  END LOOP;

  UPDATE public.appointments
     SET status = 'finalizado'
   WHERE id = v_comanda.appointment_id;

  UPDATE public.digital_comandas
     SET status = 'closed',
         total_amount = v_paid_total,
         closed_at = now(),
         sheet_sync_status = 'pending',
         sheet_sync_error = NULL
   WHERE id = v_comanda.id
   RETURNING * INTO v_comanda;

  RETURN v_comanda;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_cancel_digital_comanda(p_comanda_id uuid, p_reason text DEFAULT NULL)
RETURNS public.digital_comandas
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_comanda public.digital_comandas%ROWTYPE;
BEGIN
  SELECT * INTO v_comanda
    FROM public.digital_comandas
   WHERE id = p_comanda_id AND user_id = auth.uid()
   FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Comanda nao encontrada'; END IF;
  IF v_comanda.status = 'cancelled' THEN RETURN v_comanda; END IF;

  UPDATE public.sheet_transactions
     SET deleted_at = now()
   WHERE digital_comanda_id = v_comanda.id
     AND deleted_at IS NULL;

  UPDATE public.digital_comandas
     SET status = 'cancelled',
         cancelled_at = now(),
         notes = concat_ws(E'\n', notes, NULLIF('Cancelamento: ' || COALESCE(trim(p_reason), ''), 'Cancelamento: ')),
         sheet_sync_status = 'pending',
         sheet_sync_error = NULL
   WHERE id = v_comanda.id
   RETURNING * INTO v_comanda;
  RETURN v_comanda;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_mark_digital_comanda_sheet_sync(
  p_comanda_id uuid,
  p_success boolean,
  p_error text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.digital_comandas
     SET sheet_sync_status = CASE WHEN p_success THEN 'synced' ELSE 'error' END,
         sheet_sync_error = CASE WHEN p_success THEN NULL ELSE left(COALESCE(p_error, 'Falha desconhecida'), 1000) END,
         sheet_synced_at = CASE WHEN p_success THEN now() ELSE sheet_synced_at END
   WHERE id = p_comanda_id
     AND user_id = auth.uid();
END;
$$;

ALTER TABLE public.digital_comandas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.digital_comanda_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS digital_comandas_select_own ON public.digital_comandas;
CREATE POLICY digital_comandas_select_own ON public.digital_comandas
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS digital_comanda_items_select_own ON public.digital_comanda_items;
CREATE POLICY digital_comanda_items_select_own ON public.digital_comanda_items
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.digital_comandas c
       WHERE c.id = comanda_id AND c.user_id = auth.uid()
    )
  );

GRANT SELECT ON public.digital_comandas, public.digital_comanda_items TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_save_digital_comanda(uuid, uuid, jsonb, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_close_digital_comanda(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_cancel_digital_comanda(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_mark_digital_comanda_sheet_sync(uuid, boolean, text) TO authenticated;

COMMENT ON TABLE public.digital_comandas IS
  'Cabecalho da comanda digital ligada a um agendamento.';
COMMENT ON TABLE public.digital_comanda_items IS
  'Servicos individualizados da comanda; fonte correta para ranking e receita por servico.';
