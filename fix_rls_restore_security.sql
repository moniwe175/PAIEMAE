-- ============================================================================
-- fix_rls_restore_security.sql
-- Restaura a segurança do banco: reativa RLS em todas as tabelas do app
-- e cria policies corretas (nada mais fica público/aberto).
-- ============================================================================
--
-- CONTEXTO:
--   As policies antigas foram removidas e as tabelas ficaram públicas.
--   Com a chave anon (que é pública por design), QUALQUER pessoa podia
--   ler/escrever em tudo — inclusive promover a si mesma a admin em
--   profiles. Este script fecha isso.
--
-- MODELO DE SEGURANÇA:
--   1. Tabelas de negócio → somente usuários AUTENTICADOS (logados).
--      Anônimo/visitante não lê nem escreve nada.
--   2. profiles → cada um lê o próprio perfil; somente ADMIN gerencia
--      (cria/altera/exclui). Ninguém promove a si mesmo.
--   3. user_access_requests (legado do "Solicitar Acesso", removido do
--      login) → somente admins leem/alteram.
--   4. Gatilho anti-lockout: impede remover/excluir o ÚLTIMO admin.
--   5. service_role (Apps Script, Edge Functions, pg_cron) continua
--      acima do RLS — nada quebra na automação.
--
-- EXECUTAR: Supabase Dashboard → SQL Editor → colar tudo → Run
-- ============================================================================


-- ═══════════════════════════════════════════════════════════════════════
-- SEÇÃO 0: Diagnóstico ANTES (veja o estado atual)
-- ═══════════════════════════════════════════════════════════════════════

-- 0.1 RLS ativado ou não em cada tabela
SELECT c.relname AS tablename, c.relrowsecurity, c.relforcerowsecurity
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r'
ORDER BY c.relname;

-- 0.2 Policies existentes
SELECT tablename, policyname, roles, cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;


-- ═══════════════════════════════════════════════════════════════════════
-- SEÇÃO 1: Função auxiliar is_admin() (segura contra recursão)
-- SECURITY DEFINER roda como dono da função, evitando loop de RLS.
-- ═══════════════════════════════════════════════════════════════════════

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


-- ═══════════════════════════════════════════════════════════════════════
-- SEÇÃO 2: Tabelas de negócio → somente usuários autenticados
-- (logados). Visitantes anônimos não acessam nada.
-- O laço só toca em tabelas que existem (IF NOT EXISTS-safe).
-- ═══════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  t text;
  pol record;
  tables text[] := ARRAY[
    'anamneses','appointments','campaigns','cashier_sangrias','cashier_state',
    'clients','comissoes','daily_reports','expenses','inventory',
    'kanban_leads','marketing_engine_settings','marketing_queue',
    'message_templates','okr_cycles','okr_key_results','okr_objectives',
    'okr_tasks','packages','profissionais','servicos','sheet_connections',
    'sheet_transactions','split_config','sticky_notes','sync_logs',
    'transactions','whatsapp_connection_status','access_requests'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
      -- Remove TODAS as policies antigas (incl. anon e "somente próprios dados"),
      -- senão visitantes anônimos ou restrições legacy continuam valendo.
      FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = t
      LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, t);
      END LOOP;
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)',
        t || '_authenticated_all', t
      );
      RAISE NOTICE 'RLS + policy criada em: %', t;
    ELSE
      RAISE NOTICE 'Tabela não existe (ignorada): %', t;
    END IF;
  END LOOP;
END $$;


-- ═══════════════════════════════════════════════════════════════════════
-- SEÇÃO 3: profiles — leitura própria + gestão exclusiva de admin
-- Sem policy de escrita para o próprio usuário: ninguém se promove.
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Remove TODAS as policies antigas de profiles (incl. "Users can update own
-- profile", que permitiria um staff se autopromover a admin)
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profiles'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles', pol.policyname);
  END LOOP;
END $$;

-- Cada usuário lê o próprio perfil; admins leem todos
DROP POLICY IF EXISTS "profiles_select_own_or_admin" ON public.profiles;
CREATE POLICY "profiles_select_own_or_admin"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid() OR public.is_admin());

-- Somente admin cria/altera/exclui perfis (é o que o Gerenciar Acessos usa)
DROP POLICY IF EXISTS "profiles_admin_manage" ON public.profiles;
CREATE POLICY "profiles_admin_manage"
  ON public.profiles FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());


-- ═══════════════════════════════════════════════════════════════════════
-- SEÇÃO 4: user_access_requests (legado "Solicitar Acesso")
-- O fluxo público de solicitação saiu do login: somente admins agora.
-- ═══════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  pol record;
BEGIN
  IF to_regclass('public.user_access_requests') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.user_access_requests ENABLE ROW LEVEL SECURITY';
    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_access_requests'
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.user_access_requests', pol.policyname);
    END LOOP;
    EXECUTE 'CREATE POLICY "user_access_requests_admin_all"
             ON public.user_access_requests FOR ALL
             TO authenticated
             USING (public.is_admin())
             WITH CHECK (public.is_admin())';
    RAISE NOTICE 'user_access_requests trancada para admins';
  END IF;
END $$;


-- ═══════════════════════════════════════════════════════════════════════
-- SEÇÃO 5: Anti-lockout — protege o ÚLTIMO administrador
-- Impede rebaixar (admin → staff) ou excluir o único admin restante.
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.prevent_last_admin_loss()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  admin_count int;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.role = 'admin' AND NEW.role IS DISTINCT FROM 'admin' THEN
    SELECT count(*) INTO admin_count FROM public.profiles WHERE role = 'admin';
    IF admin_count <= 1 THEN
      RAISE EXCEPTION 'Não é possível rebaixar o último administrador do sistema.';
    END IF;
  END IF;

  IF TG_OP = 'DELETE' AND OLD.role = 'admin' THEN
    SELECT count(*) INTO admin_count FROM public.profiles WHERE role = 'admin';
    IF admin_count <= 1 THEN
      RAISE EXCEPTION 'Não é possível excluir o último administrador do sistema.';
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS trg_prevent_last_admin_loss ON public.profiles;
CREATE TRIGGER trg_prevent_last_admin_loss
  BEFORE UPDATE OR DELETE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_last_admin_loss();


-- ═══════════════════════════════════════════════════════════════════════
-- SEÇÃO 6: Verificação DEPOIS
-- ═══════════════════════════════════════════════════════════════════════

-- 6.1 Todas as tabelas do app devem aparecer com rowsecurity = true
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- 6.2 Policies criadas
SELECT tablename, policyname, roles, cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- 6.3 Confirma que existe pelo menos 1 admin (senão ninguém gerencia acessos)
SELECT id, role FROM public.profiles WHERE role = 'admin';

SELECT 'RLS restaurado com sucesso ✅' AS resultado;


-- ═══════════════════════════════════════════════════════════════════════
-- REVERT (só se precisar desfazer tudo — devolve ao estado público)
-- ═══════════════════════════════════════════════════════════════════════
-- DO $$
-- DECLARE r record;
-- BEGIN
--   FOR r IN SELECT tablename FROM pg_tables WHERE schemaname='public' LOOP
--     EXECUTE format('ALTER TABLE public.%I DISABLE ROW LEVEL SECURITY', r.tablename);
--   END LOOP;
-- END $$;
