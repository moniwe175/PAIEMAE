-- ============================================================
-- fix_sheet_connections_and_rls.sql
-- Executar no SQL Editor do Supabase para corrigir:
-- 1. Tabela sheet_connections (adiciona colunas para compatibilidade)
-- 2. Permissões de RLS para evitar bloqueio ao adicionar planilhas
-- ============================================================

-- 1. Garantir que a tabela sheet_connections existe com todas as colunas necessárias
CREATE TABLE IF NOT EXISTS public.sheet_connections (
  id text PRIMARY KEY,
  nome text,
  name text,
  tipo text DEFAULT 'google',
  provider text DEFAULT 'google',
  tipo_label text,
  url text,
  sheet_url text,
  status text DEFAULT 'aguardando',
  sync_mode text DEFAULT 'polling60',
  auto_sync boolean DEFAULT true,
  polling_interval integer DEFAULT 60,
  poll_interval integer DEFAULT 60,
  tags jsonb DEFAULT '[]'::jsonb,
  columns jsonb DEFAULT '[]'::jsonb,
  linhas_sincronizadas integer DEFAULT 0,
  rows_synced integer DEFAULT 0,
  sheet_id text,
  api_key text,
  range text DEFAULT 'A1:Z1000',
  ultimo_sync text,
  last_sync text,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Adicionar colunas caso a tabela já existisse com menos colunas
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sheet_connections' AND column_name='nome') THEN
    ALTER TABLE public.sheet_connections ADD COLUMN nome text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sheet_connections' AND column_name='name') THEN
    ALTER TABLE public.sheet_connections ADD COLUMN name text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sheet_connections' AND column_name='provider') THEN
    ALTER TABLE public.sheet_connections ADD COLUMN provider text DEFAULT 'google';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sheet_connections' AND column_name='tipo') THEN
    ALTER TABLE public.sheet_connections ADD COLUMN tipo text DEFAULT 'google';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sheet_connections' AND column_name='sheet_url') THEN
    ALTER TABLE public.sheet_connections ADD COLUMN sheet_url text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sheet_connections' AND column_name='url') THEN
    ALTER TABLE public.sheet_connections ADD COLUMN url text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sheet_connections' AND column_name='sync_mode') THEN
    ALTER TABLE public.sheet_connections ADD COLUMN sync_mode text DEFAULT 'polling60';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sheet_connections' AND column_name='poll_interval') THEN
    ALTER TABLE public.sheet_connections ADD COLUMN poll_interval integer DEFAULT 60;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sheet_connections' AND column_name='rows_synced') THEN
    ALTER TABLE public.sheet_connections ADD COLUMN rows_synced integer DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sheet_connections' AND column_name='sheet_id') THEN
    ALTER TABLE public.sheet_connections ADD COLUMN sheet_id text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sheet_connections' AND column_name='api_key') THEN
    ALTER TABLE public.sheet_connections ADD COLUMN api_key text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sheet_connections' AND column_name='range') THEN
    ALTER TABLE public.sheet_connections ADD COLUMN range text DEFAULT 'A1:Z1000';
  END IF;
END $$;

-- 2. Corrigir políticas de RLS para proibir que o RLS bloqueie a tabela sheet_connections
ALTER TABLE public.sheet_connections DISABLE ROW LEVEL SECURITY;

-- Se o RLS for reabilitado, permitir acesso permissivo para anon e authenticated
DROP POLICY IF EXISTS "Users can view own sheet connections" ON public.sheet_connections;
DROP POLICY IF EXISTS "Users can manage own sheet connections" ON public.sheet_connections;
DROP POLICY IF EXISTS "Allow all sheet connections" ON public.sheet_connections;

CREATE POLICY "Allow all sheet connections"
  ON public.sheet_connections FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- 3. Habilitar Realtime na tabela sheet_connections
ALTER PUBLICATION supabase_realtime ADD TABLE sheet_connections;
