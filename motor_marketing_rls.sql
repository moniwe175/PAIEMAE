-- ─── RLS policies para o Motor de Marketing ─────────────────────────────────
-- Execute no Supabase → SQL Editor

-- message_templates: leitura e escrita via anon (frontend usa chave pública)
CREATE POLICY "public_read_templates" ON public.message_templates
  FOR SELECT TO anon USING (true);

CREATE POLICY "public_update_templates" ON public.message_templates
  FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- marketing_queue: leitura e escrita via anon
CREATE POLICY "public_read_queue" ON public.marketing_queue
  FOR SELECT TO anon USING (true);

CREATE POLICY "public_update_queue" ON public.marketing_queue
  FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- Habilitar Realtime nas duas tabelas (se ainda não estiver ativo)
ALTER TABLE public.message_templates REPLICA IDENTITY FULL;
ALTER TABLE public.marketing_queue REPLICA IDENTITY FULL;

-- Adicionar ao publication de realtime (execute se necessário)
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.message_templates;
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.marketing_queue;
