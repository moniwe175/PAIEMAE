-- Instagram / Marketing (executar após a migração do CRM).
-- Este script não modifica campaigns nem armazena credenciais da Meta.
-- Backend: SUPABASE_URL, SUPABASE_SERVICE_KEY, META_ACCESS_TOKEN,
-- INSTAGRAM_ACCOUNT_ID, META_APP_SECRET e META_VERIFY_TOKEN.

DO $$ BEGIN
  IF to_regclass('public.crm_leads') IS NULL THEN
    RAISE EXCEPTION 'Execute a migração do CRM antes da migração Instagram (public.crm_leads ausente).';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.instagram_connection_status (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  status text NOT NULL DEFAULT 'disconnected' CHECK (status IN ('connected', 'disconnected', 'error', 'expired')),
  account_id text,
  account_username text,
  account_name text,
  profile_picture_url text,
  followers_count integer DEFAULT 0,
  media_count integer DEFAULT 0,
  last_verified_at timestamptz,
  last_error text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.instagram_connection_status (id, status)
VALUES (1, 'disconnected') ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.instagram_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  media_id text NOT NULL,
  media_caption text,
  media_permalink text,
  media_url text,
  media_type text,
  palavra_chave text NOT NULL,
  resposta_privada text NOT NULL,
  status text NOT NULL DEFAULT 'pausado' CHECK (status IN ('ativo', 'pausado')),
  campanha_id bigint,
  campanha_nome text,
  encaminhar_crm boolean NOT NULL DEFAULT true,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- A tela apresenta uma regra por publicação; evite uma escolha arbitrária no webhook.
-- Resposta pública opcional: aplica também às instalações que já possuem regras.
-- Regras existentes continuam enviando apenas a DM até ativação explícita.
ALTER TABLE public.instagram_rules
  ADD COLUMN IF NOT EXISTS responder_comentario boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS resposta_publica text NOT NULL DEFAULT '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_instagram_rules_media_unique ON public.instagram_rules(media_id);
CREATE INDEX IF NOT EXISTS idx_instagram_rules_status ON public.instagram_rules(status);

CREATE TABLE IF NOT EXISTS public.instagram_interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id text NOT NULL UNIQUE,
  media_id text NOT NULL,
  media_caption text,
  media_permalink text,
  usuario_instagram text NOT NULL,
  usuario_id text,
  comentario_texto text NOT NULL,
  palavra_chave_detectada text,
  regra_id uuid REFERENCES public.instagram_rules(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'processando',
  resposta_enviada boolean NOT NULL DEFAULT false,
  resposta_texto text,
  erro_detalhes text,
  crm_lead_id uuid REFERENCES public.crm_leads(id) ON DELETE SET NULL,
  campanha_nome text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
-- Migra o CHECK de uma eventual primeira versão que não incluía 'processando'.
ALTER TABLE public.instagram_interactions DROP CONSTRAINT IF EXISTS instagram_interactions_status_check;
ALTER TABLE public.instagram_interactions ADD CONSTRAINT instagram_interactions_status_check
  CHECK (status IN ('processando', 'sucesso', 'falha', 'ignorado', 'pausado'));
CREATE INDEX IF NOT EXISTS idx_instagram_interactions_media ON public.instagram_interactions(media_id);
CREATE INDEX IF NOT EXISTS idx_instagram_interactions_created ON public.instagram_interactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_instagram_interactions_crm ON public.instagram_interactions(crm_lead_id);

ALTER TABLE public.instagram_connection_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instagram_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instagram_interactions ENABLE ROW LEVEL SECURITY;

-- Toda a leitura e escrita é mediada pelo backend, que valida o usuário.
-- Remover políticas permissivas de versões anteriores sem alterar outras tabelas.
DO $$ DECLARE p record; t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['instagram_connection_status', 'instagram_rules', 'instagram_interactions'] LOOP
    FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, t);
    END LOOP;
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon, authenticated', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO service_role', t);
  END LOOP;
END $$;
