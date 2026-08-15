-- ============================================================
-- enable_realtime.sql
-- Habilita o Supabase Realtime nas tabelas financeiras
-- Execute este script uma vez no SQL Editor do Supabase
-- ============================================================

-- Habilitar Realtime na tabela de transações (essencial para sync em tempo real)
ALTER PUBLICATION supabase_realtime ADD TABLE transactions;

-- Habilitar Realtime nos logs de sync (para mostrar status do Python na UI)
ALTER PUBLICATION supabase_realtime ADD TABLE sync_logs;

-- Habilitar Realtime nas despesas (opcional mas recomendado)
ALTER PUBLICATION supabase_realtime ADD TABLE expenses;

-- Habilitar Realtime na tabela sheet_transactions (fonte real dos dados financeiros da planilha)
ALTER PUBLICATION supabase_realtime ADD TABLE sheet_transactions;

-- Habilitar Realtime na tabela sheet_connections (status das conexões de planilha)
ALTER PUBLICATION supabase_realtime ADD TABLE sheet_connections;

-- Habilitar Realtime na tabela cashier_state (estado e saldos do caixa)
ALTER PUBLICATION supabase_realtime ADD TABLE cashier_state;

-- Verificar quais tabelas estão com Realtime habilitado
SELECT schemaname, tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
ORDER BY tablename;
