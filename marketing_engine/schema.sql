-- ===========================================================================
-- schema.sql
-- Tabelas que o MarketingEngine espera encontrar no Supabase, além das
-- tabelas já existentes de pacientes/agendamentos da clínica.
-- ===========================================================================

-- Fila de aprovação: tudo que exige análise de IA/humano antes do disparo.
create table if not exists marketing_approval_queue (
    id               uuid primary key default gen_random_uuid(),
    patient_id       uuid not null references patients(id),
    patient_name     text,
    patient_phone    text,
    strategy         text not null,            -- 'reaquecimento' | 'upsell' | 'no_show' | ...
    suggested_message text not null,
    context          jsonb default '{}'::jsonb, -- dados extras para a IA/revisor avaliar
    status           text not null default 'pending', -- pending | approved | rejected | sent
    final_message    text,                       -- preenchido após revisão/edição
    reviewed_by      text,
    reviewed_at      timestamptz,
    created_at       timestamptz not null default now()
);

create index if not exists idx_approval_queue_status
    on marketing_approval_queue (status);

-- Log de auditoria: todo disparo (auto) ou enfileiramento (approval).
-- Usado também para idempotência (evitar disparo duplicado no mesmo dia).
create table if not exists marketing_log (
    id          uuid primary key default gen_random_uuid(),
    patient_id  uuid not null references patients(id),
    tool_name   text not null,
    channel     text not null,   -- 'whatsapp' | 'approval_queue'
    status      text not null,   -- 'sent' | 'failed' | 'queued'
    payload     jsonb default '{}'::jsonb,
    created_at  timestamptz not null default now()
);

create index if not exists idx_marketing_log_patient_tool_date
    on marketing_log (patient_id, tool_name, created_at);

-- Recomendado: opt-out explícito (LGPD). Antes de qualquer finder() retornar
-- um paciente, filtre por `whatsapp_opt_out = false` na tabela patients.
-- alter table patients add column if not exists whatsapp_opt_out boolean default false;
