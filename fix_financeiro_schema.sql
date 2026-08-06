-- SQL Migration: Ajustes no Schema para o Espelho Inteligente Financeiro e Sistema de Caixa
-- Execute este script no SQL Editor do Supabase se necessário.

-- 1. Atualizar tabela transactions
ALTER TABLE IF EXISTS public.transactions 
  ADD COLUMN IF NOT EXISTS cliente text,
  ADD COLUMN IF NOT EXISTS profissional text,
  ADD COLUMN IF NOT EXISTS valor numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pagamento text DEFAULT 'pix',
  ADD COLUMN IF NOT EXISTS ordem integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS hash text,
  ADD COLUMN IF NOT EXISTS comanda text;

-- Caso 'profissional' seja de tipo diferente, adicionar suporte a nome em texto se necessário
ALTER TABLE IF EXISTS public.transactions 
  ADD COLUMN IF NOT EXISTS profissional_nome text;

-- Index para otimização de busca por ordem
CREATE INDEX IF NOT EXISTS idx_transactions_ordem ON public.transactions(ordem ASC);
CREATE INDEX IF NOT EXISTS idx_transactions_hash ON public.transactions(hash);

-- 2. Atualizar tabela daily_reports (Caixa / Validação Financeira)
CREATE TABLE IF NOT EXISTS public.daily_reports (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users ON DELETE CASCADE,
  data text NOT NULL, -- YYYY-MM-DD ou DD/MM/YYYY
  data_caixa date,
  fundo_inicial numeric(12,2) DEFAULT 0,
  total_dinheiro numeric(12,2) DEFAULT 0,
  total_pix numeric(12,2) DEFAULT 0,
  total_credito numeric(12,2) DEFAULT 0,
  total_debito numeric(12,2) DEFAULT 0,
  fundo_final_calculado numeric(12,2) DEFAULT 0,
  fundo_final_real numeric(12,2) DEFAULT 0,
  diferenca numeric(12,2) DEFAULT 0,
  status text DEFAULT 'ok', -- 'ok' se diferenca == 0, senao 'erro'
  observacoes text,
  sheet_snapshot jsonb,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Suporte a colunas se a tabela já existia
ALTER TABLE IF EXISTS public.daily_reports
  ADD COLUMN IF NOT EXISTS data text,
  ADD COLUMN IF NOT EXISTS fundo_inicial numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_dinheiro numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_pix numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_credito numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_debito numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fundo_final_calculado numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fundo_final_real numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS diferenca numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'ok';

-- Indice para busca por data
CREATE INDEX IF NOT EXISTS idx_daily_reports_data ON public.daily_reports(data);

-- Habilitar RLS
ALTER TABLE public.daily_reports ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS permissive para daily_reports (para evitar bloqueios com anon key)
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.daily_reports;
DROP POLICY IF EXISTS "Allow select for daily_reports" ON public.daily_reports;
DROP POLICY IF EXISTS "Allow insert for daily_reports" ON public.daily_reports;
DROP POLICY IF EXISTS "Allow update for daily_reports" ON public.daily_reports;

CREATE POLICY "Allow select for daily_reports" ON public.daily_reports FOR SELECT USING (true);
CREATE POLICY "Allow insert for daily_reports" ON public.daily_reports FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update for daily_reports" ON public.daily_reports FOR UPDATE USING (true);
