-- ===========================================================================
-- schema_paiemae.sql
-- Tabelas para integrar o Marketing Engine ao schema real do PAIEMAE.
-- Substitui a tabela `patients` por `pacientes` e `appointments` por
-- `agendamentos`, usando nomes de campos em português.
--
-- IMPORTANTE: Revise este SQL antes de executar no Supabase SQL Editor.
-- ===========================================================================


-- ─── 1. Pacientes ────────────────────────────────────────────────────────────
-- Tabela principal de pacientes/clientes da clínica.
-- O Marketing Engine lê daqui para encontrar elegíveis por regras.

create table if not exists public.pacientes (
    id                  uuid primary key default gen_random_uuid(),
    nome                text not null,
    telefone            text,
    email               text,
    data_nascimento     date,                    -- usado para regra de aniversário
    status              text not null default 'ativo',  -- 'ativo' | 'inativo'
    origem              text,                    -- 'Instagram' | 'Indicação' | 'Google' | etc.
    total_compras       integer default 0,
    total_gasto         numeric default 0,
    ultimo_agendamento  timestamptz,             -- calculado a partir de agendamentos
    ultimo_tratamento   text,                    -- último procedimento realizado
    whatsapp_opt_out    boolean default false,   -- LGPD: paciente pediu para não receber msgs
    user_id             uuid references auth.users,
    created_at          timestamptz not null default now(),
    updated_at          timestamptz not null default now()
);

alter table public.pacientes enable row level security;

create policy "Users can view own pacientes"
    on public.pacientes for select using ( auth.uid() = user_id );
create policy "Users can insert own pacientes"
    on public.pacientes for insert with check ( auth.uid() = user_id );
create policy "Users can update own pacientes"
    on public.pacientes for update using ( auth.uid() = user_id );
create policy "Users can delete own pacientes"
    on public.pacientes for delete using ( auth.uid() = user_id );

-- Service role (usado pelo Marketing Engine) bypassa RLS automaticamente.

create index if not exists idx_pacientes_user_id on public.pacientes(user_id);
create index if not exists idx_pacientes_status on public.pacientes(status);
create index if not exists idx_pacientes_telefone on public.pacientes(telefone);
create index if not exists idx_pacientes_data_nascimento on public.pacientes(data_nascimento);

-- Trigger de updated_at
create trigger handle_updated_at_pacientes
    before update on public.pacientes
    for each row execute function public.handle_updated_at();


-- ─── 2. Agendamentos ──────────────────────────────────────────────────────────
-- Espelha os dados de agenda da clínica.
-- O Marketing Engine lê daqui para no-show, lembretes, etc.

create table if not exists public.agendamentos (
    id              uuid primary key default gen_random_uuid(),
    paciente_id     uuid references public.pacientes(id) on delete set null,
    paciente_nome   text,                    -- nome denormalizado para rapidez
    telefone        text,                    -- telefone na hora do agendamento
    data            date not null,           -- data do agendamento (YYYY-MM-DD)
    hora            text,                    -- hora de início (HH:MM)
    hora_fim        text,                    -- hora de fim (HH:MM)
    duracao         integer,                 -- duração em minutos
    profissional    text,
    servico         text,
    status          text not null default 'confirmado',  -- confirmado | cancelado | no_show | concluido
    valor           numeric default 0,
    observacoes     text,
    user_id         uuid references auth.users,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);

alter table public.agendamentos enable row level security;

create policy "Users can view own agendamentos"
    on public.agendamentos for select using ( auth.uid() = user_id );
create policy "Users can insert own agendamentos"
    on public.agendamentos for insert with check ( auth.uid() = user_id );
create policy "Users can update own agendamentos"
    on public.agendamentos for update using ( auth.uid() = user_id );
create policy "Users can delete own agendamentos"
    on public.agendamentos for delete using ( auth.uid() = user_id );

create index if not exists idx_agendamentos_user_id on public.agendamentos(user_id);
create index if not exists idx_agendamentos_paciente_id on public.agendamentos(paciente_id);
create index if not exists idx_agendamentos_data on public.agendamentos(data);
create index if not exists idx_agendamentos_status on public.agendamentos(status);

create trigger handle_updated_at_agendamentos
    before update on public.agendamentos
    for each row execute function public.handle_updated_at();


-- ─── 3. Marketing Approval Queue ──────────────────────────────────────────────
-- Fila de aprovação: tudo que exige análise de IA/humano antes do disparo.
-- Adaptado para referenciar `pacientes` em vez de `patients`.

create table if not exists public.marketing_approval_queue (
    id                  uuid primary key default gen_random_uuid(),
    paciente_id         uuid not null references public.pacientes(id),
    paciente_nome       text,
    paciente_telefone   text,
    strategy            text not null,           -- 'reaquecimento' | 'upsell' | 'no_show' | ...
    suggested_message   text not null,
    context             jsonb default '{}'::jsonb,  -- dados extras para IA/revisor
    status              text not null default 'pending',  -- pending | approved | rejected | sent
    final_message       text,                    -- preenchido após revisão/edição
    reviewed_by         text,
    reviewed_at         timestamptz,
    user_id             uuid references auth.users,
    created_at          timestamptz not null default now()
);

alter table public.marketing_approval_queue enable row level security;

create policy "Users can view own marketing_approval_queue"
    on public.marketing_approval_queue for select using ( auth.uid() = user_id );
create policy "Users can insert own marketing_approval_queue"
    on public.marketing_approval_queue for insert with check ( auth.uid() = user_id );
create policy "Users can update own marketing_approval_queue"
    on public.marketing_approval_queue for update using ( auth.uid() = user_id );

create index if not exists idx_approval_queue_status
    on public.marketing_approval_queue (status);
create index if not exists idx_approval_queue_paciente_id
    on public.marketing_approval_queue (paciente_id);


-- ─── 4. Marketing Log ─────────────────────────────────────────────────────────
-- Log de auditoria: todo disparo (auto) ou enfileiramento (approval).
-- Usado também para idempotência (evitar disparo duplicado no mesmo dia).

create table if not exists public.marketing_log (
    id          uuid primary key default gen_random_uuid(),
    paciente_id uuid not null references public.pacientes(id),
    tool_name   text not null,
    channel     text not null,     -- 'whatsapp' | 'approval_queue'
    status      text not null,     -- 'sent' | 'failed' | 'queued'
    payload     jsonb default '{}'::jsonb,
    user_id     uuid references auth.users,
    created_at  timestamptz not null default now()
);

alter table public.marketing_log enable row level security;

create policy "Users can view own marketing_log"
    on public.marketing_log for select using ( auth.uid() = user_id );
create policy "Users can insert own marketing_log"
    on public.marketing_log for insert with check ( auth.uid() = user_id );

create index if not exists idx_marketing_log_paciente_tool_date
    on public.marketing_log (paciente_id, tool_name, created_at);


-- ─── 5. View auxiliar (opcional) ──────────────────────────────────────────────
-- Facilita queries do engine: combina data + hora num único timestamp.

create or replace view public.v_agendamentos_com_horario as
select
    id,
    paciente_id,
    paciente_nome,
    telefone,
    (data || ' ' || coalesce(hora, '00:00'))::timestamptz as scheduled_at,
    status,
    profissional,
    servico,
    valor,
    user_id,
    created_at
from public.agendamentos;
