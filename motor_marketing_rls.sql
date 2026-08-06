-- ─── RLS policies para o Motor de Marketing ─────────────────────────────────
-- Execute no Supabase → SQL Editor

-- Habilitar RLS se ainda não estiver habilitado
ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_queue ENABLE ROW LEVEL SECURITY;

-- 1. message_templates
DROP POLICY IF EXISTS "public_read_templates" ON public.message_templates;
CREATE POLICY "public_read_templates" ON public.message_templates
  FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "public_update_templates" ON public.message_templates;
CREATE POLICY "public_update_templates" ON public.message_templates
  FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- 2. marketing_queue
DROP POLICY IF EXISTS "public_read_queue" ON public.marketing_queue;
CREATE POLICY "public_read_queue" ON public.marketing_queue
  FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "public_update_queue" ON public.marketing_queue;
CREATE POLICY "public_update_queue" ON public.marketing_queue
  FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- Habilitar Realtime nas duas tabelas
ALTER TABLE public.message_templates REPLICA IDENTITY FULL;
ALTER TABLE public.marketing_queue REPLICA IDENTITY FULL;
