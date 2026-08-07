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

-- 3. whatsapp_connection_status
DROP POLICY IF EXISTS "public_all_whatsapp_status" ON public.whatsapp_connection_status;
DROP POLICY IF EXISTS "public_read_whatsapp_status" ON public.whatsapp_connection_status;
CREATE POLICY "public_read_whatsapp_status" ON public.whatsapp_connection_status
  FOR SELECT TO anon, authenticated USING (true);

-- Habilitar Realtime nas três tabelas
ALTER TABLE public.message_templates REPLICA IDENTITY FULL;
ALTER TABLE public.marketing_queue REPLICA IDENTITY FULL;
ALTER TABLE public.whatsapp_connection_status REPLICA IDENTITY FULL;
