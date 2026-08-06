-- ============================================================
-- fix_sheet_connections_schema.sql
-- Executar no SQL Editor do Supabase (dashboard.supabase.com)
-- Corrige a tabela sheet_connections para funcionar com o código
-- ============================================================

-- 1. Recriar a tabela com o schema correto (UUID id + colunas em inglês)
--    Se já existir, renomear e recriar

DO $$
BEGIN
  -- Verificar se a tabela já existe
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sheet_connections' AND table_schema = 'public') THEN
    -- Fazer backup dos dados existentes
    CREATE TABLE IF NOT EXISTS public.sheet_connections_backup AS SELECT * FROM public.sheet_connections;
    -- Remover tabela antiga
    DROP TABLE public.sheet_connections CASCADE;
  END IF;
END $$;

-- 2. Criar tabela nova com schema compatível com o código
CREATE TABLE public.sheet_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text DEFAULT 'google',
  name text NOT NULL DEFAULT 'Planilha',
  sheet_url text,
  status text DEFAULT 'aguardando',
  sync_mode text DEFAULT 'polling60',
  poll_interval integer DEFAULT 60,
  auto_sync boolean DEFAULT true,
  rows_synced integer DEFAULT 0,
  sheet_id text,
  api_key text,
  range text DEFAULT 'A1:Z1000',
  columns jsonb DEFAULT '[]'::jsonb,
  last_sync timestamp with time zone,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Desabilitar RLS para evitar bloqueio (pode habilitar depois com políticas adequadas)
ALTER TABLE public.sheet_connections DISABLE ROW LEVEL SECURITY;

-- Política permissiva para anon e authenticated
CREATE POLICY "Allow all sheet connections"
  ON public.sheet_connections FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- 4. Habilitar Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE sheet_connections;

-- 5. Trigger para updated_at automático
CREATE OR REPLACE FUNCTION public.handle_sheet_connections_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS handle_sheet_connections_updated_at ON public.sheet_connections;
CREATE TRIGGER handle_sheet_connections_updated_at
  BEFORE UPDATE ON public.sheet_connections
  FOR EACH ROW EXECUTE FUNCTION public.handle_sheet_connections_updated_at();

-- Confirmação
SELECT 'sheet_connections recriada com sucesso ✅' AS resultado;
