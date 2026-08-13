-- ============================================================================
-- fix_admin_profile.sql
-- Recupera o acesso total da conta principal (iurydacosta).
--
-- O "Administrador (Acesso Total)" NÃO é um cargo da tabela roles:
-- ele vem da coluna role = 'admin' em public.profiles.
-- Este script garante que a linha da conta principal exista e esteja
-- com role='admin' (cria se não existir, corrige se existir errada).
-- ============================================================================
-- EXECUTAR: Supabase Dashboard → SQL Editor → colar tudo → Run
-- ============================================================================

-- 1. Conta principal: garante linha + role admin
INSERT INTO public.profiles (id, role, cargo, permissions)
SELECT u.id, 'admin', 'Administrador', '{"admin":true}'::jsonb
FROM auth.users u
WHERE u.email = 'iurydacosta@centaurotelecom.com.br'
ON CONFLICT (id) DO UPDATE
  SET role = 'admin',
      cargo = 'Administrador',
      permissions = '{"admin":true}'::jsonb;

-- 2. Recepcionista: cria a linha se não existir (não sobrescreve se já houver)
INSERT INTO public.profiles (id, role, cargo, permissions)
SELECT u.id, 'staff', 'Recepcionista',
  '{
     "dashboard":{"ver":true,"edit":false},"agenda":{"ver":true,"edit":true},
     "pacientes":{"ver":true,"edit":true},"anamnese":{"ver":true,"edit":false},
     "servicos":{"ver":true,"edit":false}
   }'::jsonb
FROM auth.users u
WHERE u.email = 'moniwemark@gmail.com'
ON CONFLICT (id) DO NOTHING;

-- 3. Se a recepcionista já existe mas está com permissões vazias,
--    preenche a partir do cargo Recepcionista da tabela roles (se existir)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'roles') THEN
    UPDATE public.profiles p
    SET permissions = r.permissions, cargo = r.name
    FROM public.roles r
    WHERE r.name = 'Recepcionista'
      AND p.id = (SELECT id FROM auth.users WHERE email = 'moniwemark@gmail.com')
      AND COALESCE(p.role, 'staff') <> 'admin'
      AND (p.permissions IS NULL OR p.permissions = '{}'::jsonb);
  END IF;
END $$;

-- 4. Verificação: deve mostrar iurydacosta com role = admin
SELECT p.id, u.email, p.role, p.cargo
FROM public.profiles p
JOIN auth.users u ON u.id = p.id
ORDER BY u.email;
