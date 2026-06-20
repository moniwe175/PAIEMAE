-- =============================================================================
-- marketing_engine_settings
-- Tabela de configuração liga/desliga do motor de marketing automático.
-- Linha única (id=1) — controlada via aba "Integrações" do frontend.
--
-- IMPORTANTE: rode este SQL manualmente no Supabase SQL Editor antes de
-- usar o toggle no frontend.
-- =============================================================================

CREATE TABLE IF NOT EXISTS marketing_engine_settings (
  id          int PRIMARY KEY DEFAULT 1,
  enabled     boolean NOT NULL DEFAULT true,
  updated_by  text,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT single_row CHECK (id = 1)
);

-- Linha semente: motor ligado por padrão
INSERT INTO marketing_engine_settings (id, enabled) VALUES (1, true)
ON CONFLICT (id) DO NOTHING;

-- RLS
ALTER TABLE marketing_engine_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all to read engine settings"
  ON marketing_engine_settings FOR SELECT
  USING (true);

CREATE POLICY "Allow all to update engine settings"
  ON marketing_engine_settings FOR UPDATE
  USING (true)
  WITH CHECK (true);
