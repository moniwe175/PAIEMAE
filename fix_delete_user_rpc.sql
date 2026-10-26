-- ============================================================================
-- RPC: admin_delete_user
-- ----------------------------------------------------------------------------
-- Permite que um ADMINISTRADOR exclua usuários sem precisar de Edge Function.
-- Executado com SECURITY DEFINER (roda como postgres / service_role).
--
-- SEGURANÇA:
--   - Verifica que o caller tem profiles.role = 'admin'
--   - Não permite excluir a si mesmo
--   - Não permite excluir outro admin
-- ============================================================================

CREATE OR REPLACE FUNCTION admin_delete_user(target_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id uuid := auth.uid();
  caller_role text;
  target_role text;
BEGIN
  -- 1. Gate: somente admin pode excluir
  SELECT role INTO caller_role
  FROM public.profiles
  WHERE id = caller_id;

  IF caller_role IS DISTINCT FROM 'admin' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Apenas administradores podem excluir acessos.');
  END IF;

  -- 2. Não excluir a si mesmo
  IF target_user_id = caller_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Você não pode excluir o seu próprio acesso.');
  END IF;

  -- 3. Não excluir outro admin
  SELECT role INTO target_role
  FROM public.profiles
  WHERE id = target_user_id;

  IF target_role = 'admin' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Não é possível excluir um administrador.');
  END IF;

  -- 4. Remove o profile (dados públicos)
  DELETE FROM public.profiles WHERE id = target_user_id;

  -- 5. Remove o usuário do auth (invalida sessões)
  DELETE FROM auth.users WHERE id = target_user_id;

  RETURN jsonb_build_object('success', true, 'id', target_user_id);

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Garante que somente usuários autenticados podem chamar esta função
REVOKE ALL ON FUNCTION admin_delete_user(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_delete_user(uuid) TO authenticated;
