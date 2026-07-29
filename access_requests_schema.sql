-- ============================================================
-- access_requests_schema.sql
-- Tabela para gerenciar solicitações de acesso e aprovação de usuários
-- ============================================================

CREATE TABLE IF NOT EXISTS public.user_access_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  email text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Desabilitar RLS ou aplicar política permissiva para permitir insert de solicitação e leitura por admin
ALTER TABLE public.user_access_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "erp_user_access_requests_policy" ON public.user_access_requests;
CREATE POLICY "erp_user_access_requests_policy"
  ON public.user_access_requests FOR ALL
  TO authenticated, anon
  USING (true)
  WITH CHECK (true);

-- Habilitar Realtime para atualizar instantaneamente a lista de pendentes
ALTER PUBLICATION supabase_realtime ADD TABLE user_access_requests;

SELECT 'Tabela user_access_requests criada com sucesso ✅' AS resultado;
