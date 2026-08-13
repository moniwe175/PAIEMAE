-- ============================================================================
-- fix_rpc_admin_gate.sql
-- Fecha o vazamento da RPC list_team_members (recriada sem trava de admin).
-- Sem esta trava, QUALQUER usuário logado (ex.: recepcionista) consegue
-- listar emails, roles e permissões de toda a equipe via PostgREST.
-- ============================================================================
-- EXECUTAR: Supabase Dashboard → SQL Editor → colar tudo → Run
-- ============================================================================


-- 0. Helper is_admin() (idempotente)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role = 'admin'
  );
$$;


-- 1. Recria a RPC com trava: somente admin pode listar a equipe
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
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado: somente administradores podem listar a equipe';
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    u.email::text,
    COALESCE(u.raw_user_meta_data->>'full_name', u.email)::text AS full_name,
    COALESCE(p.role, 'staff')::text AS role,
    COALESCE(p.cargo, 'Recepcionista')::text AS cargo,
    COALESCE(p.permissions, '{}'::jsonb) AS permissions,
    p.created_at
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.id
  ORDER BY p.created_at DESC;
END;
$$;


-- 2. Verificação (execute logado como admin no seu cliente; como staff deve falhar)
SELECT 'RPC protegida: so admin lista a equipe' AS resultado;
