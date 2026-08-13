-- ==============================================================================
-- SCRIPT SQL DE CRUD DE CARGOS E PERMISSÕES NO SUPABASE
-- Execute este script no SQL Editor do Supabase para garantir persistência total.
-- ==============================================================================

-- 1. Garante colunas de 'role', 'cargo' e 'permissions' na tabela profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role text DEFAULT 'staff';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cargo text DEFAULT 'Recepcionista';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS permissions jsonb DEFAULT '{}'::jsonb;

-- 2. Tabela de Cargos e Permissões (CRUD de Cargos)
CREATE TABLE IF NOT EXISTS public.roles (
  id text PRIMARY KEY,
  name text UNIQUE NOT NULL,
  description text,
  permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Ativa RLS na tabela roles
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

-- Politica de leitura para roles (todos autenticados podem ver os cargos)
DROP POLICY IF EXISTS "Autenticados podem ver cargos" ON public.roles;
CREATE POLICY "Autenticados podem ver cargos" 
  ON public.roles FOR SELECT 
  TO authenticated 
  USING (true);

-- Politica de gestao para roles (somente admin pode criar/editar cargos)
DROP POLICY IF EXISTS "Apenas admin gerencia cargos" ON public.roles;
CREATE POLICY "Apenas admin gerencia cargos" 
  ON public.roles FOR ALL 
  TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- 3. Inserir cargos padrao da clinica caso nao existam
INSERT INTO public.roles (id, name, permissions) VALUES
(
  'role_recepcao',
  'Recepcionista',
  '{
    "dashboard": {"ver": true, "edit": false},
    "agenda": {"ver": true, "edit": true},
    "pacientes": {"ver": true, "edit": true},
    "anamnese": {"ver": true, "edit": false},
    "servicos": {"ver": true, "edit": false}
  }'::jsonb
),
(
  'role_profissional',
  'Profissional / Atendimento',
  '{
    "dashboard": {"ver": true, "edit": false},
    "agenda": {"ver": true, "edit": true},
    "pacientes": {"ver": true, "edit": true},
    "anamnese": {"ver": true, "edit": true},
    "estoque": {"ver": true, "edit": false}
  }'::jsonb
),
(
  'role_financeiro',
  'Financeiro',
  '{
    "dashboard": {"ver": true, "edit": true},
    "relatorios": {"ver": true, "edit": true},
    "comissoes": {"ver": true, "edit": true},
    "financeiro": {"ver": true, "edit": true}
  }'::jsonb
),
(
  'role_gerente',
  'Gerente Operacional',
  '{
    "dashboard": {"ver": true, "edit": true},
    "agenda": {"ver": true, "edit": true},
    "pacientes": {"ver": true, "edit": true},
    "equipe": {"ver": true, "edit": true},
    "servicos": {"ver": true, "edit": true},
    "estoque": {"ver": true, "edit": true},
    "pacotes": {"ver": true, "edit": true},
    "relatorios": {"ver": true, "edit": true},
    "tarefas": {"ver": true, "edit": true},
    "marketing": {"ver": true, "edit": true}
  }'::jsonb
)
ON CONFLICT (name) DO NOTHING;

-- 4. Funcao RPC para listar equipe com perfis e cargos vinculados
CREATE OR REPLACE FUNCTION public.list_team_members()
RETURNS TABLE (
  id uuid,
  email text,
  full_name text,
  role text,
  cargo text,
  permissions jsonb,
  created_at timestamptz
) 
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT 
    p.id,
    u.email::text,
    COALESCE(p.nome, u.raw_user_meta_data->>'full_name', u.email)::text as full_name,
    COALESCE(p.role, 'staff')::text as role,
    COALESCE(p.cargo, 'Recepcionista')::text as cargo,
    COALESCE(p.permissions, '{}'::jsonb) as permissions,
    p.created_at
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.id
  ORDER BY p.created_at DESC;
$$;
