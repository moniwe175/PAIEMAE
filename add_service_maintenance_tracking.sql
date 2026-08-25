-- =============================================================================
-- add_service_maintenance_tracking.sql
-- =============================================================================
-- Adiciona a coluna `service_geladeira` na tabela `clients`.
-- Essa coluna é um JSON que registra quais serviços específicos a cliente
-- está em "geladeira" (espera), com a data de entrada em cada um.
--
-- Formato: { "Limpeza de Pele": "2026-07-25", "Botox": "2026-06-10" }
--
-- IMPORTANTE:
--   • O status GLOBAL da cliente permanece "ativo" mesmo com serviços em geladeira.
--   • A cliente só vai para status "inativo" se ficar 90 dias sem NENHUM serviço
--     (regra da tool_14, que não muda).
--   • Essa coluna é informativa — o motor de marketing usa as datas dos appointments
--     finalizados como fonte de verdade principal, não esta coluna.
--
-- COMO USAR:
--   1. Acesse o SQL Editor do Supabase.
--   2. Cole e execute este arquivo.
-- =============================================================================

-- 1. Adiciona a coluna service_geladeira (JSONB) na tabela clients
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS service_geladeira JSONB DEFAULT '{}'::jsonb;

-- 2. Cria índice GIN para consultas eficientes no JSON
CREATE INDEX IF NOT EXISTS idx_clients_service_geladeira
  ON clients USING gin (service_geladeira);

-- 3. Comentário descritivo na coluna
COMMENT ON COLUMN clients.service_geladeira IS
  'Mapa JSON de serviços em geladeira por cliente. Chave = nome do serviço, Valor = data ISO de entrada na geladeira. Ex: {"Limpeza de Pele": "2026-07-25"}. Status global do cliente NÃO muda — apenas o cronômetro desse serviço específico está em espera.';
