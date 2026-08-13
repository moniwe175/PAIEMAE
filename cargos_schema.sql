-- ============================================================================
-- cargos_schema.sql
-- Base de dados para o CRUD de "Gestão de Cargos" controlar o acesso
-- às telas do sistema (o que cada cargo pode VER e EDITAR).
-- ============================================================================
--
-- MODELO:
--   cargos (permissoes jsonb por módulo) ← profiles.cargo_id ← usuário logado
--   - profiles.role = 'admin'  → acesso total, ignora o cargo (bypass)
--   - staff                    → vê/edita apenas o que o cargo permitir
--
-- MÓDULOS (chaves usadas no jsonb e no frontend):
--   dashboard, agenda, pacientes, anamnese, equipe, servicos, estoque,
--   pacotes, relatorios, estrategia, tarefas, marketing, motor, comissoes,
--   financeiro, integracoes, acessos
--
-- EXECUTAR: Supabase Dashboard → SQL Editor → colar tudo → Run
-- ============================================================================


-- ─── 0. Helper is_admin() (idempotente; também usada pelo RLS geral) ───
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


-- ─── 1. Tabela de cargos ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.cargos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  descricao text,
  is_system boolean NOT NULL DEFAULT false,
  -- formato: {"modulo": {"ver": bool, "edit": bool}, ...}
  permissoes jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Vínculo usuário → cargo
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS cargo_id uuid
  REFERENCES public.cargos(id) ON DELETE SET NULL;


-- ─── 2. Seed dos cargos padrão (não sobrescreve edições do CRUD) ─────
INSERT INTO public.cargos (nome, descricao, is_system, permissoes) VALUES
('Administrador (Acesso Total)', 'Acesso completo a todos os módulos.', true,
 '{
   "dashboard":{"ver":true,"edit":true},"agenda":{"ver":true,"edit":true},
   "pacientes":{"ver":true,"edit":true},"anamnese":{"ver":true,"edit":true},
   "equipe":{"ver":true,"edit":true},"servicos":{"ver":true,"edit":true},
   "estoque":{"ver":true,"edit":true},"pacotes":{"ver":true,"edit":true},
   "relatorios":{"ver":true,"edit":true},"estrategia":{"ver":true,"edit":true},
   "tarefas":{"ver":true,"edit":true},"marketing":{"ver":true,"edit":true},
   "motor":{"ver":true,"edit":true},"comissoes":{"ver":true,"edit":true},
   "financeiro":{"ver":true,"edit":true},"integracoes":{"ver":true,"edit":true},
   "acessos":{"ver":true,"edit":true}
 }'::jsonb),

('Recepcionista', 'Atendimento: agenda, pacientes e anamnese.', false,
 '{
   "dashboard":{"ver":true,"edit":false},"agenda":{"ver":true,"edit":true},
   "pacientes":{"ver":true,"edit":true},"anamnese":{"ver":true,"edit":false},
   "equipe":{"ver":false,"edit":false},"servicos":{"ver":true,"edit":false},
   "estoque":{"ver":false,"edit":false},"pacotes":{"ver":false,"edit":false},
   "relatorios":{"ver":false,"edit":false},"estrategia":{"ver":false,"edit":false},
   "tarefas":{"ver":false,"edit":false},"marketing":{"ver":false,"edit":false},
   "motor":{"ver":false,"edit":false},"comissoes":{"ver":false,"edit":false},
   "financeiro":{"ver":false,"edit":false},"integracoes":{"ver":false,"edit":false},
   "acessos":{"ver":false,"edit":false}
 }'::jsonb),

('Profissional / Atendimento', 'Procedimentos e agenda própria.', false,
 '{
   "dashboard":{"ver":true,"edit":false},"agenda":{"ver":true,"edit":true},
   "pacientes":{"ver":true,"edit":true},"anamnese":{"ver":true,"edit":true},
   "equipe":{"ver":false,"edit":false},"servicos":{"ver":true,"edit":false},
   "estoque":{"ver":false,"edit":false},"pacotes":{"ver":false,"edit":false},
   "relatorios":{"ver":false,"edit":false},"estrategia":{"ver":false,"edit":false},
   "tarefas":{"ver":true,"edit":true},"marketing":{"ver":false,"edit":false},
   "motor":{"ver":false,"edit":false},"comissoes":{"ver":true,"edit":false},
   "financeiro":{"ver":false,"edit":false},"integracoes":{"ver":false,"edit":false},
   "acessos":{"ver":false,"edit":false}
 }'::jsonb),

('Financeiro', 'Caixa, comissões e relatórios financeiros.', false,
 '{
   "dashboard":{"ver":true,"edit":false},"agenda":{"ver":false,"edit":false},
   "pacientes":{"ver":false,"edit":false},"anamnese":{"ver":false,"edit":false},
   "equipe":{"ver":false,"edit":false},"servicos":{"ver":false,"edit":false},
   "estoque":{"ver":false,"edit":false},"pacotes":{"ver":false,"edit":false},
   "relatorios":{"ver":true,"edit":true},"estrategia":{"ver":false,"edit":false},
   "tarefas":{"ver":false,"edit":false},"marketing":{"ver":false,"edit":false},
   "motor":{"ver":false,"edit":false},"comissoes":{"ver":true,"edit":true},
   "financeiro":{"ver":true,"edit":true},"integracoes":{"ver":false,"edit":false},
   "acessos":{"ver":false,"edit":false}
 }'::jsonb),

('Gerente Operacional', 'Operação completa, sem financeiro nem acessos.', false,
 '{
   "dashboard":{"ver":true,"edit":true},"agenda":{"ver":true,"edit":true},
   "pacientes":{"ver":true,"edit":true},"anamnese":{"ver":true,"edit":true},
   "equipe":{"ver":true,"edit":true},"servicos":{"ver":true,"edit":true},
   "estoque":{"ver":true,"edit":true},"pacotes":{"ver":true,"edit":true},
   "relatorios":{"ver":true,"edit":false},"estrategia":{"ver":true,"edit":true},
   "tarefas":{"ver":true,"edit":true},"marketing":{"ver":true,"edit":true},
   "motor":{"ver":true,"edit":true},"comissoes":{"ver":true,"edit":false},
   "financeiro":{"ver":false,"edit":false},"integracoes":{"ver":true,"edit":true},
   "acessos":{"ver":false,"edit":false}
 }'::jsonb)
ON CONFLICT (nome) DO NOTHING;


-- ─── 3. Associa os usuários atuais aos cargos ─────────────────────────
UPDATE public.profiles p
SET cargo_id = c.id
FROM public.cargos c
WHERE c.nome = 'Administrador (Acesso Total)'
  AND p.email = 'iurydacosta@centaurotelecom.com.br'
  AND p.cargo_id IS NULL;

UPDATE public.profiles p
SET cargo_id = c.id
FROM public.cargos c
WHERE c.nome = 'Recepcionista'
  AND p.email = 'moniwemark@gmail.com'
  AND p.cargo_id IS NULL;


-- ─── 4. RLS da tabela cargos ──────────────────────────────────────────
-- Leitura para qualquer usuário logado (o frontend precisa montar o menu).
-- Escrita (criar/editar/excluir cargos) somente admin.
ALTER TABLE public.cargos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cargos_select_authenticated" ON public.cargos;
CREATE POLICY "cargos_select_authenticated"
  ON public.cargos FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "cargos_admin_manage" ON public.cargos;
CREATE POLICY "cargos_admin_manage"
  ON public.cargos FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());


-- ─── 5. Verificação ───────────────────────────────────────────────────
SELECT nome, is_system, permissoes->'agenda' AS agenda
FROM public.cargos ORDER BY nome;

SELECT p.email, p.role, c.nome AS cargo
FROM public.profiles p
LEFT JOIN public.cargos c ON c.id = p.cargo_id
ORDER BY p.email;

SELECT 'Cargos criados e vinculados ✅' AS resultado;
