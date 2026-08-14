-- =============================================================================
-- MARKETING ENGINE NA NUVEM — marketing_engine_cloud_cron.sql
-- =============================================================================
-- Liga o motor de marketing que agora roda NA NUVEM (Vercel):
--   api/marketing-engine.js  ← 19 ferramentas (substitui o Python local)
--   pg_cron + pg_net         ← chamam a função a cada 30 min, em 2 metades
--
-- POR QUE 2 METADES: o plano gratuito da Vercel limita cada chamada a 10s;
--   half=1 (ferramentas 1–11) roda aos :00/:30
--   half=2 (ferramentas 12–19) roda aos :15/:45
--
-- SEGURO / IDEMPOTENTE: pode rodar mais de uma vez (recria os jobs).
-- PRÉ-REQUISITO: o site já ter sido reimplantado pela Vercel após o push
--   (a Vercel implanta sozinha ~1 min depois do commit).
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove jobs antigos com o mesmo nome (se existirem)
DO $$ BEGIN PERFORM cron.unschedule('marketing-engine-nuvem-half1'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN PERFORM cron.unschedule('marketing-engine-nuvem-half2'); EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Half 1: ferramentas 1–11 (Grupo A) aos 0 e 30 minutos
SELECT cron.schedule(
  'marketing-engine-nuvem-half1',
  '0,30 * * * *',
  $$SELECT net.http_post(
      url := 'https://paiemae.vercel.app/api/marketing-engine?half=1',
      headers := '{"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVjd2l6anlmbHhjaWNrYmZ6aGNwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzQwMDAwNSwiZXhwIjoyMDkyOTc2MDg1fQ.DzUFVGW4kxQrKQABHw6s02JJxWDYrGxH0hzLFOQ0YZE", "Content-Type": "application/json"}'::jsonb,
      body := '{}'::jsonb
  )$$
);

-- Half 2: ferramentas 12–19 (Grupo B) aos 15 e 45 minutos
SELECT cron.schedule(
  'marketing-engine-nuvem-half2',
  '15,45 * * * *',
  $$SELECT net.http_post(
      url := 'https://paiemae.vercel.app/api/marketing-engine?half=2',
      headers := '{"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVjd2l6anlmbHhjaWNrYmZ6aGNwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzQwMDAwNSwiZXhwIjoyMDkyOTc2MDg1fQ.DzUFVGW4kxQrKQABHw6s02JJxWDYrGxH0hzLFOQ0YZE", "Content-Type": "application/json"}'::jsonb,
      body := '{}'::jsonb
  )$$
);

-- -----------------------------------------------------------------------------
-- TESTE MANUAL (opcional, para ver o motor rodando AGORA sem esperar o cron):
-- -----------------------------------------------------------------------------
SELECT net.http_post(
  url := 'https://paiemae.vercel.app/api/marketing-engine?half=1',
  headers := '{"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVjd2l6anlmbHhjaWNrYmZ6aGNwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzQwMDAwNSwiZXhwIjoyMDkyOTc2MDg1fQ.DzUFVGW4kxQrKQABHw6s02JJxWDYrGxH0hzLFOQ0YZE", "Content-Type": "application/json"}'::jsonb,
  body := '{}'::jsonb
);

-- -----------------------------------------------------------------------------
-- VERIFICAÇÃO (1–2 min depois do teste manual): uma linha por ferramenta,
-- com error vazio.
-- -----------------------------------------------------------------------------
SELECT tool_id, tool_name, entries_generated, entries_inserted, error, created_at
FROM public.marketing_log
ORDER BY created_at DESC
LIMIT 30;
