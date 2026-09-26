-- ==============================================================================
-- crm_interessados_migration.sql  (v2 - seguranca, integridade e novas colunas)
-- Repositorio: PAIEMAE  |  Data: 25/09/2026
-- ==============================================================================
-- Esta migracao:
--   1. Corrige a FK crm_interactions->crm_leads para ON DELETE RESTRICT (via ALTER TABLE).
--   2. Revoga privilegios amplos de anon / PUBLIC nas tabelas CRM.
--   3. Concede a authenticated apenas SELECT, INSERT e UPDATE em crm_leads
--      e SELECT, INSERT em crm_interactions (sem DELETE, sem TRUNCATE).
--   4. Cria/substitui can_access_crm com a precedencia correta (cargo > perfil):
--        - admin -> acesso irrestrito;
--        - nao-admin com cargo e roles.permissions nao vazio -> usa cargo;
--        - fallback -> profiles.permissions;
--        - ausencia da chave crm -> nega; edit exige ver.
--   5. Remove todas as policies antigas e cria policies estritas por acao.
--   6. Cria/ajusta trigger append-only para crm_interactions.
--   7. Cria/ajusta trigger updated_at exclusivo para crm_leads.
--   8. Adiciona colunas ausentes sem destruir dados existentes.
--   9. Adiciona indices necessarios para as consultas implementadas.
--  10. Atualiza permissao CRM nos cargos de forma idempotente.
-- RE-EXECUCAO SEGURA: usa IF NOT EXISTS / IF EXISTS / OR REPLACE.
-- ==============================================================================

-- =0= PRE-CHECAGEM ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'clients'
      AND column_name = 'id' AND data_type = 'integer'
  ) THEN
    RAISE EXCEPTION 'PRE-CHECAGEM FALHOU: public.clients.id nao e integer.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'appointments'
      AND column_name = 'id' AND data_type = 'uuid'
  ) THEN
    RAISE EXCEPTION 'PRE-CHECAGEM FALHOU: public.appointments.id nao e uuid.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles'
      AND column_name = 'cargo'
  ) THEN
    RAISE EXCEPTION 'PRE-CHECAGEM FALHOU: public.profiles nao tem coluna cargo.';
  END IF;
END $$;

-- =1= FUNCAO updated_at exclusiva do CRM =====================================

CREATE OR REPLACE FUNCTION public.crm_leads_handle_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$;

-- =2= FUNCAO can_access_crm ===================================================
-- Precedencia: cargo > perfil (espelha AuthContext.jsx).
-- Acao invalida, sessao ausente, crm ausente -> false.

CREATE OR REPLACE FUNCTION public.can_access_crm(action text DEFAULT 'ver')
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid    uuid;
  v_role   text;
  v_cargo  text;
  v_perms  jsonb;
  r_perms  jsonb;
  crm_perm jsonb;
BEGIN
  IF action NOT IN ('ver', 'edit') THEN RETURN false; END IF;

  v_uid := auth.uid();
  IF v_uid IS NULL THEN RETURN false; END IF;

  SELECT role, cargo, permissions
    INTO v_role, v_cargo, v_perms
    FROM public.profiles WHERE id = v_uid;

  IF v_role = 'admin' THEN RETURN true; END IF;

  -- Tenta cargo como fonte primaria
  IF v_cargo IS NOT NULL THEN
    SELECT permissions INTO r_perms FROM public.roles WHERE name = v_cargo;
    IF r_perms IS NOT NULL AND r_perms <> '{}'::jsonb THEN
      crm_perm := r_perms -> 'crm';
      IF crm_perm IS NULL THEN RETURN false; END IF;
      IF jsonb_typeof(crm_perm) = 'boolean' THEN
        RETURN (crm_perm)::text::boolean;
      END IF;
      IF action = 'ver' THEN
        RETURN coalesce((crm_perm->>'ver')::boolean, false);
      ELSE
        RETURN coalesce((crm_perm->>'edit')::boolean, false)
           AND coalesce((crm_perm->>'ver')::boolean, false);
      END IF;
    END IF;
  END IF;

  -- Fallback: permissoes do perfil
  IF v_perms IS NOT NULL AND v_perms <> '{}'::jsonb THEN
    crm_perm := v_perms -> 'crm';
    IF crm_perm IS NULL THEN RETURN false; END IF;
    IF jsonb_typeof(crm_perm) = 'boolean' THEN
      RETURN (crm_perm)::text::boolean;
    END IF;
    IF action = 'ver' THEN
      RETURN coalesce((crm_perm->>'ver')::boolean, false);
    ELSE
      RETURN coalesce((crm_perm->>'edit')::boolean, false)
         AND coalesce((crm_perm->>'ver')::boolean, false);
    END IF;
  END IF;

  RETURN false;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.can_access_crm(text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.can_access_crm(text) TO   authenticated;

-- =3= TABELA crm_leads ========================================================

CREATE TABLE IF NOT EXISTS public.crm_leads (
  id                           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  nome                         text        NOT NULL,
  telefone                     text,
  email                        text,
  instagram                    text,
  servico_interesse            text,
  origem                       text,
  responsavel                  text,
  status                       text        NOT NULL DEFAULT 'aguardando_resposta',
  qual_servico                 text,
  qual_prazo                   text,
  qual_disponibilidade         text,
  qual_objecao                 text,
  qual_updated_at              timestamptz,
  proxima_acao_descricao       text,
  proxima_acao_responsavel     text,
  proxima_acao_prazo           date,
  proxima_acao_concluida       boolean     DEFAULT false,
  client_id                    integer     REFERENCES public.clients(id) ON DELETE SET NULL,
  appointment_id               uuid        REFERENCES public.appointments(id) ON DELETE SET NULL,
  motivo_perda                 text,
  user_id                      uuid        REFERENCES auth.users ON DELETE SET NULL,
  created_at                   timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at                   timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Colunas novas (idempotente)
ALTER TABLE public.crm_leads
  ADD COLUMN IF NOT EXISTS telefone_normalizado        text,
  ADD COLUMN IF NOT EXISTS origem_outro                text,
  ADD COLUMN IF NOT EXISTS responsavel_id              uuid REFERENCES auth.users ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS proxima_acao_responsavel_id uuid REFERENCES auth.users ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS proxima_acao_status         text DEFAULT 'pendente',
  ADD COLUMN IF NOT EXISTS encerrado_at                timestamptz,
  ADD COLUMN IF NOT EXISTS encerrado_por_id            uuid REFERENCES auth.users ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS arquivado                   boolean DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS arquivado_at                timestamptz,
  ADD COLUMN IF NOT EXISTS arquivado_por_id            uuid REFERENCES auth.users ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS version                     integer DEFAULT 1;

-- CHECK de status (nao duplica se ja existir)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.crm_leads'::regclass
      AND conname = 'crm_leads_status_check'
  ) THEN
    ALTER TABLE public.crm_leads
      ADD CONSTRAINT crm_leads_status_check CHECK (status IN (
        'aguardando_resposta','aguardando_cliente','retorno_agendado',
        'agendado','encerrado_ganho','encerrado_perdido'
      ));
  END IF;
END $$;

-- Indices
CREATE INDEX IF NOT EXISTS idx_crm_leads_status          ON public.crm_leads(status);
CREATE INDEX IF NOT EXISTS idx_crm_leads_user_id         ON public.crm_leads(user_id);
CREATE INDEX IF NOT EXISTS idx_crm_leads_client_id       ON public.crm_leads(client_id);
CREATE INDEX IF NOT EXISTS idx_crm_leads_responsavel_id  ON public.crm_leads(responsavel_id);
CREATE INDEX IF NOT EXISTS idx_crm_leads_arquivado       ON public.crm_leads(arquivado);
CREATE INDEX IF NOT EXISTS idx_crm_leads_tel_norm        ON public.crm_leads(telefone_normalizado);

-- Trigger updated_at (exclusivo CRM)
DROP TRIGGER IF EXISTS trg_crm_leads_updated_at ON public.crm_leads;
CREATE TRIGGER trg_crm_leads_updated_at
  BEFORE UPDATE ON public.crm_leads
  FOR EACH ROW EXECUTE FUNCTION public.crm_leads_handle_updated_at();

-- =4= TABELA crm_interactions =================================================

CREATE TABLE IF NOT EXISTS public.crm_interactions (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id    uuid        NOT NULL,
  tipo       text        NOT NULL DEFAULT 'nota',
  conteudo   text        NOT NULL,
  autor      text,
  autor_id   uuid,
  meta       jsonb       DEFAULT '{}'::jsonb,
  user_id    uuid,
  created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.crm_interactions
  ADD COLUMN IF NOT EXISTS autor_id uuid,
  ADD COLUMN IF NOT EXISTS meta     jsonb DEFAULT '{}'::jsonb;

-- Corrige FK lead_id: remove CASCADE existente, instala RESTRICT
DO $$
DECLARE fk_name text;
BEGIN
  SELECT c.conname INTO fk_name
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
   WHERE c.conrelid = 'public.crm_interactions'::regclass
     AND c.contype = 'f'
     AND a.attname = 'lead_id';

  IF fk_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.crm_interactions DROP CONSTRAINT %I', fk_name);
  END IF;

  ALTER TABLE public.crm_interactions
    ADD CONSTRAINT crm_interactions_lead_id_fkey
      FOREIGN KEY (lead_id) REFERENCES public.crm_leads(id) ON DELETE RESTRICT;
END $$;

-- Indices
CREATE INDEX IF NOT EXISTS idx_crm_interactions_lead_id
  ON public.crm_interactions(lead_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_crm_interactions_created
  ON public.crm_interactions(created_at DESC);

-- =5= TRIGGER append-only =====================================================

CREATE OR REPLACE FUNCTION public.crm_interactions_prevent_mutation()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY INVOKER AS $$
BEGIN
  RAISE EXCEPTION 'Historico CRM e imutavel (operacao: %). Corrija com nova entrada.', TG_OP;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_mutation_crm_interactions ON public.crm_interactions;
CREATE TRIGGER trg_prevent_mutation_crm_interactions
  BEFORE UPDATE OR DELETE ON public.crm_interactions
  FOR EACH ROW EXECUTE FUNCTION public.crm_interactions_prevent_mutation();

-- =6= GRANTOS =================================================================

-- crm_leads
REVOKE ALL PRIVILEGES ON TABLE public.crm_leads FROM anon;
REVOKE ALL PRIVILEGES ON TABLE public.crm_leads FROM PUBLIC;
REVOKE DELETE, TRUNCATE, TRIGGER, REFERENCES ON TABLE public.crm_leads FROM authenticated;
GRANT  SELECT, INSERT, UPDATE ON TABLE public.crm_leads TO authenticated;

-- crm_interactions
REVOKE ALL PRIVILEGES ON TABLE public.crm_interactions FROM anon;
REVOKE ALL PRIVILEGES ON TABLE public.crm_interactions FROM PUBLIC;
REVOKE DELETE, UPDATE, TRUNCATE, TRIGGER, REFERENCES ON TABLE public.crm_interactions FROM authenticated;
GRANT  SELECT, INSERT ON TABLE public.crm_interactions TO authenticated;

-- =7= RLS =====================================================================

ALTER TABLE public.crm_leads        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_interactions ENABLE ROW LEVEL SECURITY;

-- Remove todas as policies existentes (loop seguro)
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT tablename, policyname FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('crm_leads', 'crm_interactions')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
  END LOOP;
END $$;

-- crm_leads
CREATE POLICY "crm_leads_select" ON public.crm_leads FOR SELECT TO authenticated
  USING (public.can_access_crm('ver'));

CREATE POLICY "crm_leads_insert" ON public.crm_leads FOR INSERT TO authenticated
  WITH CHECK (public.can_access_crm('edit'));

CREATE POLICY "crm_leads_update" ON public.crm_leads FOR UPDATE TO authenticated
  USING (public.can_access_crm('edit'))
  WITH CHECK (public.can_access_crm('edit'));

-- crm_interactions
CREATE POLICY "crm_interactions_select" ON public.crm_interactions FOR SELECT TO authenticated
  USING (public.can_access_crm('ver'));

CREATE POLICY "crm_interactions_insert" ON public.crm_interactions FOR INSERT TO authenticated
  WITH CHECK (public.can_access_crm('edit'));

-- =8= FUNCAO diretorio de responsaveis ========================================

CREATE OR REPLACE FUNCTION public.crm_list_responsaveis()
RETURNS TABLE (id uuid, nome text) LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  IF NOT public.can_access_crm('ver') THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;
  RETURN QUERY
  SELECT p.id, p.full_name
    FROM public.profiles p
   WHERE p.role IN ('admin', 'staff')
   ORDER BY p.full_name;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.crm_list_responsaveis() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.crm_list_responsaveis() TO   authenticated;

-- =9= PERMISSOES NOS CARGOS (idempotente) =====================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='roles') THEN

    UPDATE public.roles
       SET permissions = jsonb_set(permissions,'{crm}','{"ver":true,"edit":true}',true)
     WHERE name IN ('Recepcionista','Gerente Operacional')
       AND (permissions->'crm' IS NULL);

    UPDATE public.roles
       SET permissions = jsonb_set(permissions,'{crm}','{"ver":false,"edit":false}',true)
     WHERE name NOT IN ('Recepcionista','Gerente Operacional')
       AND (permissions->'crm' IS NULL);
  END IF;
END $$;

-- =10= VERIFICACOES POS-MIGRACAO (colar no SQL Editor apos aplicar) ===========
/*
SELECT tablename, policyname, cmd, roles, qual, with_check
  FROM pg_policies WHERE schemaname='public'
   AND tablename IN ('crm_leads','crm_interactions') ORDER BY tablename, policyname;

SELECT conname, pg_get_constraintdef(oid) AS def
  FROM pg_constraint WHERE conrelid='public.crm_interactions'::regclass AND contype='f';

SELECT table_name, grantee, privilege_type
  FROM information_schema.role_table_grants
 WHERE table_schema='public' AND table_name IN ('crm_leads','crm_interactions')
   AND grantee IN ('anon','authenticated','PUBLIC')
 ORDER BY table_name, grantee, privilege_type;

SELECT name, permissions->'crm' AS crm FROM public.roles ORDER BY name;

SELECT trigger_name, event_manipulation, action_timing, event_object_table
  FROM information_schema.triggers WHERE event_object_schema='public'
   AND event_object_table IN ('crm_leads','crm_interactions')
 ORDER BY event_object_table, trigger_name;
*/
