-- =============================================================================
-- DOCUMENTOS E CONSENTIMENTOS DO PACIENTE
-- =============================================================================
-- Execute este arquivo no SQL Editor do Supabase.
-- Idempotente: pode ser executado novamente com seguranca.

CREATE TABLE IF NOT EXISTS public.patient_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- O banco operacional deste projeto usa clients.id como integer.
  client_id integer NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL,
  document_type text NOT NULL CHECK (document_type IN (
    'procedure_consent', 'image_authorization', 'responsibility_term', 'service_agreement'
  )),
  title text NOT NULL,
  procedure_name text,
  professional_name text,
  content_snapshot text NOT NULL,
  template_version integer NOT NULL DEFAULT 1 CHECK (template_version > 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'signed', 'revoked')),
  image_use_scopes text[] NOT NULL DEFAULT '{}'::text[],
  contract_amount numeric(12,2),
  contract_session_count integer CHECK (contract_session_count IS NULL OR contract_session_count > 0),
  payment_terms text,
  signed_by_name text,
  signature_data_url text,
  signed_at timestamptz,
  revoked_at timestamptz,
  revocation_reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  created_by uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT patient_documents_signature_consistency CHECK (
    status <> 'signed' OR (
      signed_at IS NOT NULL
      AND coalesce(trim(signed_by_name), '') <> ''
      AND coalesce(trim(signature_data_url), '') <> ''
    )
  ),
  CONSTRAINT patient_documents_revocation_consistency CHECK (
    status <> 'revoked' OR revoked_at IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS patient_documents_user_client_idx
  ON public.patient_documents (user_id, client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS patient_documents_status_idx
  ON public.patient_documents (user_id, status, created_at DESC);

CREATE OR REPLACE FUNCTION public.fn_touch_patient_documents_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_patient_documents_updated_at ON public.patient_documents;
CREATE TRIGGER trg_touch_patient_documents_updated_at
  BEFORE UPDATE ON public.patient_documents
  FOR EACH ROW EXECUTE FUNCTION public.fn_touch_patient_documents_updated_at();

-- Um documento assinado preserva o texto e a evidencia aceitos. Ele pode ser
-- revogado, mas nao reescrito. Correcoes exigem um novo documento/versionamento.
CREATE OR REPLACE FUNCTION public.fn_protect_signed_patient_document()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status IN ('signed', 'revoked') AND (
    NEW.client_id IS DISTINCT FROM OLD.client_id OR
    NEW.document_type IS DISTINCT FROM OLD.document_type OR
    NEW.title IS DISTINCT FROM OLD.title OR
    NEW.procedure_name IS DISTINCT FROM OLD.procedure_name OR
    NEW.professional_name IS DISTINCT FROM OLD.professional_name OR
    NEW.content_snapshot IS DISTINCT FROM OLD.content_snapshot OR
    NEW.template_version IS DISTINCT FROM OLD.template_version OR
    NEW.image_use_scopes IS DISTINCT FROM OLD.image_use_scopes OR
    NEW.contract_amount IS DISTINCT FROM OLD.contract_amount OR
    NEW.contract_session_count IS DISTINCT FROM OLD.contract_session_count OR
    NEW.payment_terms IS DISTINCT FROM OLD.payment_terms OR
    NEW.signed_by_name IS DISTINCT FROM OLD.signed_by_name OR
    NEW.signature_data_url IS DISTINCT FROM OLD.signature_data_url OR
    NEW.signed_at IS DISTINCT FROM OLD.signed_at
  ) THEN
    RAISE EXCEPTION 'Documento assinado ou revogado nao pode ser reescrito; crie uma nova versao';
  END IF;

  IF OLD.status = 'revoked' AND NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'Documento revogado nao pode ser reativado';
  END IF;

  IF OLD.status = 'signed' AND NEW.status NOT IN ('signed', 'revoked') THEN
    RAISE EXCEPTION 'Documento assinado somente pode permanecer assinado ou ser revogado';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_signed_patient_document ON public.patient_documents;
CREATE TRIGGER trg_protect_signed_patient_document
  BEFORE UPDATE ON public.patient_documents
  FOR EACH ROW EXECUTE FUNCTION public.fn_protect_signed_patient_document();

ALTER TABLE public.patient_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS patient_documents_select_own ON public.patient_documents;
CREATE POLICY patient_documents_select_own ON public.patient_documents
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS patient_documents_insert_own ON public.patient_documents;
CREATE POLICY patient_documents_insert_own ON public.patient_documents
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS patient_documents_update_own ON public.patient_documents;
CREATE POLICY patient_documents_update_own ON public.patient_documents
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS patient_documents_delete_pending_own ON public.patient_documents;
CREATE POLICY patient_documents_delete_pending_own ON public.patient_documents
  FOR DELETE TO authenticated USING (auth.uid() = user_id AND status = 'pending');

GRANT SELECT, INSERT, UPDATE, DELETE ON public.patient_documents TO authenticated;

COMMENT ON TABLE public.patient_documents IS
  'Documentos gerais do paciente. O content_snapshot e a assinatura preservam exatamente a versao aceita.';
COMMENT ON COLUMN public.patient_documents.content_snapshot IS
  'Copia imutavel do texto apresentado ao paciente no momento da criacao/assinatura.';
