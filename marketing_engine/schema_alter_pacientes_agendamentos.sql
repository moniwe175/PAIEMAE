-- ===========================================================================
-- schema_alter_pacientes_agendamentos.sql
-- Fase 2: Alinha schema_paiemae.sql aos campos reais encontrados no localStorage.
--
-- Decisões aprovadas:
--   pacientes:     +cidade, +obs, renomear total_compras → total_sessoes
--   agendamentos:  +fixo (boolean default false)
--   avatar:        NÃO criar coluna (calculado no frontend: nome.charAt(0))
--   bloqueios:     fora de escopo
--   anamnese:      fora de escopo
--   paciente_id:   NULL para registros migrados; preenchido só em novos agendamentos
--   horaFim/paciente: mapeiam para hora_fim/paciente_nome existentes (sem rename)
--   nascimento/ultimaVisita: conversão de formato na Fase 3 (sem mudança de schema)
--
-- ⚠️ NÃO RODE AINDA — revise e aprove antes de executar no Supabase SQL Editor.
-- ===========================================================================


-- ─── 1. ALTER TABLE pacientes ────────────────────────────────────────────────

-- 1a. Adicionar coluna cidade
ALTER TABLE public.pacientes
    ADD COLUMN IF NOT EXISTS cidade text;

-- 1b. Adicionar coluna obs (observações / anamnese livre)
ALTER TABLE public.pacientes
    ADD COLUMN IF NOT EXISTS obs text;

-- 1c. Renomear total_compras → total_sessoes (campo representa número de sessões)
ALTER TABLE public.pacientes
    RENAME COLUMN total_compras TO total_sessoes;


-- ─── 2. ALTER TABLE agendamentos ─────────────────────────────────────────────

-- 2a. Adicionar coluna fixo (marca agendamentos recorrentes/fixos)
ALTER TABLE public.agendamentos
    ADD COLUMN IF NOT EXISTS fixo boolean NOT NULL DEFAULT false;


-- ─── 3. Atualizar view auxiliar para incluir fixo ────────────────────────────

CREATE OR REPLACE VIEW public.v_agendamentos_com_horario AS
SELECT
    id,
    paciente_id,
    paciente_nome,
    telefone,
    (data || ' ' || coalesce(hora, '00:00'))::timestamptz AS scheduled_at,
    status,
    profissional,
    servico,
    valor,
    fixo,
    user_id,
    created_at
FROM public.agendamentos;
