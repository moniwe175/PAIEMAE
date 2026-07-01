-- Supabase Database Schema for ERP Clínica de Estética
-- Run this in the Supabase SQL Editor to create all tables

-- Enable RLS (Row Level Security) on all tables

-- ─── 1. Profiles (extends auth.users) ─────────────────────────
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  nome text,
  avatar_url text,
  cargo text default 'profissional',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  using ( auth.uid() = id );

create policy "Users can update own profile"
  on public.profiles for update
  using ( auth.uid() = id );

-- ─── 2. Transactions ──────────────────────────────────────────
create table if not exists public.transactions (
  id text primary key,
  tipo text not null default 'receita',
  desc text,
  categoria text,
  data text not null,
  valor numeric not null default 0,
  origem text not null default 'manual',
  -- New format fields
  hora text,
  cliente text,
  procedimento text,
  total numeric default 0,
  clinica numeric default 0,
  profissional numeric default 0,
  pagamento text default 'Pix',
  status text default 'paid',
  profissional_nome text,
  user_id uuid references auth.users,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.transactions enable row level security;

create policy "Users can view own transactions"
  on public.transactions for select
  using ( auth.uid() = user_id );

create policy "Users can insert own transactions"
  on public.transactions for insert
  with check ( auth.uid() = user_id );

create policy "Users can delete own transactions"
  on public.transactions for delete
  using ( auth.uid() = user_id );

-- ─── 3. Expenses ──────────────────────────────────────────────
create table if not exists public.expenses (
  id text primary key,
  data text not null,
  descricao text not null,
  categoria text default 'Outros',
  valor numeric not null default 0,
  metodo_pagamento text default 'Pix',
  origem text default 'manual',
  user_id uuid references auth.users,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.expenses enable row level security;

create policy "Users can view own expenses"
  on public.expenses for select
  using ( auth.uid() = user_id );

create policy "Users can insert own expenses"
  on public.expenses for insert
  with check ( auth.uid() = user_id );

create policy "Users can delete own expenses"
  on public.expenses for delete
  using ( auth.uid() = user_id );

-- ─── 4. Commissions (Comissoes) ───────────────────────────────
create table if not exists public.comissoes (
  id text primary key,
  prof text not null,
  servico text,
  paciente text,
  data text,
  valor_serv numeric default 0,
  pct integer default 30,
  valor_comissao numeric default 0,
  status text default 'pendente',
  origem text default 'manual',
  user_id uuid references auth.users,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.comissoes enable row level security;

create policy "Users can view own comissoes"
  on public.comissoes for select
  using ( auth.uid() = user_id );

create policy "Users can insert own comissoes"
  on public.comissoes for insert
  with check ( auth.uid() = user_id );

create policy "Users can update own comissoes"
  on public.comissoes for update
  using ( auth.uid() = user_id );

-- ─── 5. Cashier State ─────────────────────────────────────────
create table if not exists public.cashier_state (
  id serial primary key,
  status text default 'fechado',
  saldo numeric default 0,
  hora_abertura text,
  sangrias jsonb default '[]'::jsonb,
  user_id uuid references auth.users unique,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.cashier_state enable row level security;

create policy "Users can view own cashier state"
  on public.cashier_state for select
  using ( auth.uid() = user_id );

create policy "Users can upsert own cashier state"
  on public.cashier_state for all
  using ( auth.uid() = user_id )
  with check ( auth.uid() = user_id );

-- ─── 6. Split Config ──────────────────────────────────────────
create table if not exists public.split_config (
  id serial primary key,
  profissional text not null unique,
  percentual integer default 40,
  user_id uuid references auth.users,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.split_config enable row level security;

create policy "Users can view own split config"
  on public.split_config for select
  using ( auth.uid() = user_id );

create policy "Users can upsert own split config"
  on public.split_config for all
  using ( auth.uid() = user_id )
  with check ( auth.uid() = user_id );

-- ─── 7. Sync Logs ─────────────────────────────────────────────
create table if not exists public.sync_logs (
  id serial primary key,
  type text default 'info',
  message text not null,
  timestamp text,
  user_id uuid references auth.users,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.sync_logs enable row level security;

create policy "Users can view own sync logs"
  on public.sync_logs for select
  using ( auth.uid() = user_id );

create policy "Users can insert own sync logs"
  on public.sync_logs for insert
  with check ( auth.uid() = user_id );

create policy "Users can delete own sync logs"
  on public.sync_logs for delete
  using ( auth.uid() = user_id );

-- ─── 8. Sheet Connections ─────────────────────────────────────
create table if not exists public.sheet_connections (
  id text primary key,
  nome text not null,
  tipo text default 'google',
  tipo_label text,
  url text,
  status text default 'aguardando',
  auto_sync boolean default true,
  polling_interval integer default 60,
  tags jsonb default '[]'::jsonb,
  linhas_sincronizadas integer default 0,
  ultimo_sync text,
  user_id uuid references auth.users,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.sheet_connections enable row level security;

create policy "Users can view own sheet connections"
  on public.sheet_connections for select
  using ( auth.uid() = user_id );

create policy "Users can manage own sheet connections"
  on public.sheet_connections for all
  using ( auth.uid() = user_id )
  with check ( auth.uid() = user_id );

-- ─── Functions ────────────────────────────────────────────────

-- Auto-update updated_at timestamp
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

-- Apply updated_at trigger to tables
create trigger handle_updated_at_profiles
  before update on public.profiles
  for each row execute function public.handle_updated_at();

create trigger handle_updated_at_cashier_state
  before update on public.cashier_state
  for each row execute function public.handle_updated_at();

create trigger handle_updated_at_split_config
  before update on public.split_config
  for each row execute function public.handle_updated_at();

create trigger handle_updated_at_sheet_connections
  before update on public.sheet_connections
  for each row execute function public.handle_updated_at();

-- ─── Indexes ──────────────────────────────────────────────────
create index if not exists idx_transactions_user_id on public.transactions(user_id);
create index if not exists idx_transactions_data on public.transactions(data);
create index if not exists idx_expenses_user_id on public.expenses(user_id);
create index if not exists idx_comissoes_user_id on public.comissoes(user_id);
create index if not exists idx_sync_logs_user_id on public.sync_logs(user_id);

-- ─── 9. Daily Reports (Caixa Fechamento) ─────────────────────
create table if not exists public.daily_reports (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  data_caixa date not null,
  fundo_inicial numeric(12,2) default 0,
  fundo_final numeric(12,2) default 0,
  total_pix numeric(12,2) default 0,
  total_credito numeric(12,2) default 0,
  total_debito numeric(12,2) default 0,
  total_dinheiro numeric(12,2) default 0,
  total_repasse numeric(12,2) default 0,
  faturamento_bruto numeric(12,2) default 0,
  total_despesas numeric(12,2) default 0,
  total_transacoes integer default 0,
  status text default 'fechado',
  observacoes text,
  sheet_snapshot jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(user_id, data_caixa)
);

alter table public.daily_reports enable row level security;

create policy "Users can view own daily reports"
  on public.daily_reports for select
  using ( auth.uid() = user_id );

create policy "Users can insert own daily reports"
  on public.daily_reports for insert
  with check ( auth.uid() = user_id );

create policy "Users can update own daily reports"
  on public.daily_reports for update
  using ( auth.uid() = user_id );

create policy "Users can delete own daily reports"
  on public.daily_reports for delete
  using ( auth.uid() = user_id );

create trigger handle_updated_at_daily_reports
  before update on public.daily_reports
  for each row execute function public.handle_updated_at();

create index if not exists idx_daily_reports_user_id on public.daily_reports(user_id);
create index if not exists idx_daily_reports_data on public.daily_reports(data_caixa);

-- ─── 10. Campaigns (Marketing) ────────────────────────────────
create table if not exists public.campaigns (
  id text primary key,
  nome text not null,
  canal text not null default 'WhatsApp',
  mensagem text,
  status text default 'rascunho',
  data_inicio text,
  data_fim text,
  enviados integer default 0,
  abertos integer default 0,
  cliques integer default 0,
  conversoes integer default 0,
  publico_alvo text,
  orcamento numeric default 0,
  user_id uuid references auth.users,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.campaigns enable row level security;

create policy "Users can view own campaigns"
  on public.campaigns for select
  using ( auth.uid() = user_id );

create policy "Users can insert own campaigns"
  on public.campaigns for insert
  with check ( auth.uid() = user_id );

create policy "Users can update own campaigns"
  on public.campaigns for update
  using ( auth.uid() = user_id );

create policy "Users can delete own campaigns"
  on public.campaigns for delete
  using ( auth.uid() = user_id );

create trigger handle_updated_at_campaigns
  before update on public.campaigns
  for each row execute function public.handle_updated_at();

create index if not exists idx_campaigns_user_id on public.campaigns(user_id);

-- ─── 11. OKR System ──────────────────────────────────────────

-- 11a. OKR Cycles (trimester periods)
create table if not exists public.ciclos_okr (
  id text primary key,
  nome text not null,
  data_inicio date not null,
  data_fim date not null,
  status text default 'ativo',
  user_id uuid references auth.users,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.ciclos_okr enable row level security;

create policy "Users can view own ciclos_okr"
  on public.ciclos_okr for select using ( auth.uid() = user_id );
create policy "Users can insert own ciclos_okr"
  on public.ciclos_okr for insert with check ( auth.uid() = user_id );
create policy "Users can update own ciclos_okr"
  on public.ciclos_okr for update using ( auth.uid() = user_id );
create policy "Users can delete own ciclos_okr"
  on public.ciclos_okr for delete using ( auth.uid() = user_id );

create index if not exists idx_ciclos_okr_user_id on public.ciclos_okr(user_id);

-- 11b. Objectives (macro goals per cycle)
create table if not exists public.objetivos (
  id text primary key,
  ciclo_id text references public.ciclos_okr(id) on delete cascade,
  titulo text not null,
  descricao text,
  ordem integer default 0,
  user_id uuid references auth.users,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.objetivos enable row level security;

create policy "Users can view own objetivos"
  on public.objetivos for select using ( auth.uid() = user_id );
create policy "Users can insert own objetivos"
  on public.objetivos for insert with check ( auth.uid() = user_id );
create policy "Users can update own objetivos"
  on public.objetivos for update using ( auth.uid() = user_id );
create policy "Users can delete own objetivos"
  on public.objetivos for delete using ( auth.uid() = user_id );

create index if not exists idx_objetivos_ciclo_id on public.objetivos(ciclo_id);

-- 11c. Key Results (measurable per objective)
create table if not exists public.key_results (
  id text primary key,
  objetivo_id text references public.objetivos(id) on delete cascade,
  titulo text not null,
  metrica text,
  valor_inicial numeric default 0,
  valor_atual numeric default 0,
  valor_meta numeric not null,
  status text default 'no_alvo',
  action_hint text,
  user_id uuid references auth.users,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.key_results enable row level security;

create policy "Users can view own key_results"
  on public.key_results for select using ( auth.uid() = user_id );
create policy "Users can insert own key_results"
  on public.key_results for insert with check ( auth.uid() = user_id );
create policy "Users can update own key_results"
  on public.key_results for update using ( auth.uid() = user_id );
create policy "Users can delete own key_results"
  on public.key_results for delete using ( auth.uid() = user_id );

create trigger handle_updated_at_key_results
  before update on public.key_results
  for each row execute function public.handle_updated_at();

create index if not exists idx_key_results_objetivo_id on public.key_results(objetivo_id);

-- 11d. Weekly snapshots for trend charts
create table if not exists public.kr_weekly_snapshots (
  id serial primary key,
  kr_id text references public.key_results(id) on delete cascade,
  semana date not null,
  valor numeric not null,
  user_id uuid references auth.users,
  unique(kr_id, semana)
);

alter table public.kr_weekly_snapshots enable row level security;

create policy "Users can view own kr_weekly_snapshots"
  on public.kr_weekly_snapshots for select using ( auth.uid() = user_id );
create policy "Users can insert own kr_weekly_snapshots"
  on public.kr_weekly_snapshots for insert with check ( auth.uid() = user_id );
create policy "Users can delete own kr_weekly_snapshots"
  on public.kr_weekly_snapshots for delete using ( auth.uid() = user_id );

create index if not exists idx_kr_snapshots_kr_id on public.kr_weekly_snapshots(kr_id);

-- 11e. Sticky Notes (priority notes on dashboard)
create table if not exists public.sticky_notes (
  id text primary key,
  texto text not null,
  prioridade text not null default 'medio',
  source text,
  source_kr_id text references public.key_results(id),
  auto_generated boolean default false,
  dismissed boolean default false,
  ordem integer default 0,
  user_id uuid references auth.users,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.sticky_notes enable row level security;

create policy "Users can view own sticky_notes"
  on public.sticky_notes for select using ( auth.uid() = user_id );
create policy "Users can insert own sticky_notes"
  on public.sticky_notes for insert with check ( auth.uid() = user_id );
create policy "Users can update own sticky_notes"
  on public.sticky_notes for update using ( auth.uid() = user_id );
create policy "Users can delete own sticky_notes"
  on public.sticky_notes for delete using ( auth.uid() = user_id );

create trigger handle_updated_at_sticky_notes
  before update on public.sticky_notes
  for each row execute function public.handle_updated_at();

create index if not exists idx_sticky_notes_user_id on public.sticky_notes(user_id);

-- 11f. Strategic Kanban tasks
create table if not exists public.strategic_tasks (
  id text primary key,
  titulo text not null,
  descricao text,
  coluna text default 'todo',
  objetivo_id text references public.objetivos(id),
  responsavel text,
  prioridade text default 'medio',
  ordem integer default 0,
  user_id uuid references auth.users,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.strategic_tasks enable row level security;

create policy "Users can view own strategic_tasks"
  on public.strategic_tasks for select using ( auth.uid() = user_id );
create policy "Users can insert own strategic_tasks"
  on public.strategic_tasks for insert with check ( auth.uid() = user_id );
create policy "Users can update own strategic_tasks"
  on public.strategic_tasks for update using ( auth.uid() = user_id );
create policy "Users can delete own strategic_tasks"
  on public.strategic_tasks for delete using ( auth.uid() = user_id );

create trigger handle_updated_at_strategic_tasks
  before update on public.strategic_tasks
  for each row execute function public.handle_updated_at();

create index if not exists idx_strategic_tasks_user_id on public.strategic_tasks(user_id);

-- ─── 12. Clients (Patients) ───────────────────────────────────
create table if not exists public.clients (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  phone text default '(00) 00000-0000',
  email text,
  birthdate text,
  source text default 'Instagram',
  total_purchases integer default 0,
  total_spent numeric(12,2) default 0,
  points integer default 0,
  status text default 'ativo',
  avatar text,
  user_id uuid references auth.users,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Backfill missing columns on existing clients tables (idempotent migration)
do $$
begin
  if not exists (select 1 from information_schema.columns where table_name = 'clients' and column_name = 'source') then
    alter table public.clients add column source text default 'Instagram';
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'clients' and column_name = 'total_purchases') then
    alter table public.clients add column total_purchases integer default 0;
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'clients' and column_name = 'total_spent') then
    alter table public.clients add column total_spent numeric(12,2) default 0;
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'clients' and column_name = 'points') then
    alter table public.clients add column points integer default 0;
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'clients' and column_name = 'status') then
    alter table public.clients add column status text default 'ativo';
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'clients' and column_name = 'avatar') then
    alter table public.clients add column avatar text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'clients' and column_name = 'birthdate') then
    alter table public.clients add column birthdate text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'clients' and column_name = 'user_id') then
    alter table public.clients add column user_id uuid references auth.users;
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'clients' and column_name = 'updated_at') then
    alter table public.clients add column updated_at timestamp with time zone default timezone('utc'::text, now()) not null;
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'clients' and column_name = 'created_at') then
    alter table public.clients add column created_at timestamp with time zone default timezone('utc'::text, now()) not null;
  end if;
end;
$$;

alter table public.clients enable row level security;

create policy "Users can view own clients"
  on public.clients for select
  using ( auth.uid() = user_id );

create policy "Users can insert own clients"
  on public.clients for insert
  with check ( auth.uid() = user_id );

create policy "Users can update own clients"
  on public.clients for update
  using ( auth.uid() = user_id );

create policy "Users can delete own clients"
  on public.clients for delete
  using ( auth.uid() = user_id );

create trigger handle_updated_at_clients
  before update on public.clients
  for each row execute function public.handle_updated_at();

create index if not exists idx_clients_user_id on public.clients(user_id);
create index if not exists idx_clients_name on public.clients(name);

-- ─── 13. Appointments ─────────────────────────────────────────
create table if not exists public.appointments (
  id uuid default gen_random_uuid() primary key,
  client_name text not null,
  client_phone text,
  procedure text,
  professional text,
  appointment_date text not null,
  appointment_time text not null,
  status text default 'aguardando_confirmacao',
  notes text,
  user_id uuid references auth.users,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.appointments enable row level security;

create policy "Users can view own appointments"
  on public.appointments for select
  using ( auth.uid() = user_id );

create policy "Users can insert own appointments"
  on public.appointments for insert
  with check ( auth.uid() = user_id );

create policy "Users can update own appointments"
  on public.appointments for update
  using ( auth.uid() = user_id );

create policy "Users can delete own appointments"
  on public.appointments for delete
  using ( auth.uid() = user_id );

create trigger handle_updated_at_appointments
  before update on public.appointments
  for each row execute function public.handle_updated_at();

create index if not exists idx_appointments_user_id on public.appointments(user_id);
create index if not exists idx_appointments_date on public.appointments(appointment_date);

-- ─── 14. Servicos ─────────────────────────────────────────────
create table if not exists public.servicos (
  id text primary key,
  nome text not null,
  categoria text,
  duracao integer default 30,
  preco numeric(12,2) default 0,
  comissao integer default 0,
  ativo boolean default true,
  descricao text,
  user_id uuid references auth.users,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.servicos enable row level security;

create policy "Users can view own servicos"
  on public.servicos for select
  using ( auth.uid() = user_id );

create policy "Users can insert own servicos"
  on public.servicos for insert
  with check ( auth.uid() = user_id );

create policy "Users can update own servicos"
  on public.servicos for update
  using ( auth.uid() = user_id );

create policy "Users can delete own servicos"
  on public.servicos for delete
  using ( auth.uid() = user_id );

create trigger handle_updated_at_servicos
  before update on public.servicos
  for each row execute function public.handle_updated_at();

create index if not exists idx_servicos_user_id on public.servicos(user_id);

-- ─── 15. Profissionais ────────────────────────────────────────
create table if not exists public.profissionais (
  id text primary key,
  nome text not null,
  cargo text,
  cor text,
  telefone text,
  email text,
  comissao integer default 0,
  servicos jsonb default '[]'::jsonb,
  user_id uuid references auth.users,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.profissionais enable row level security;

create policy "Users can view own profissionais"
  on public.profissionais for select
  using ( auth.uid() = user_id );

create policy "Users can insert own profissionais"
  on public.profissionais for insert
  with check ( auth.uid() = user_id );

create policy "Users can update own profissionais"
  on public.profissionais for update
  using ( auth.uid() = user_id );

create policy "Users can delete own profissionais"
  on public.profissionais for delete
  using ( auth.uid() = user_id );

create trigger handle_updated_at_profissionais
  before update on public.profissionais
  for each row execute function public.handle_updated_at();

create index if not exists idx_profissionais_user_id on public.profissionais(user_id);

-- ─── 16. Anamneses ────────────────────────────────────────────
create table if not exists public.anamneses (
  id text primary key,
  client_id uuid references public.clients(id) on delete cascade,
  data_preenchimento text,
  preenchido_por text default 'cliente',
  observacoes_profissional text,
  leu_termos boolean default false,
  form_data jsonb default '{}'::jsonb,
  user_id uuid references auth.users,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.anamneses enable row level security;

create policy "Users can view own anamneses"
  on public.anamneses for select
  using ( auth.uid() = user_id );

create policy "Users can insert own anamneses"
  on public.anamneses for insert
  with check ( auth.uid() = user_id );

create policy "Users can update own anamneses"
  on public.anamneses for update
  using ( auth.uid() = user_id );

create policy "Users can delete own anamneses"
  on public.anamneses for delete
  using ( auth.uid() = user_id );

create trigger handle_updated_at_anamneses
  before update on public.anamneses
  for each row execute function public.handle_updated_at();

create index if not exists idx_anamneses_user_id on public.anamneses(user_id);
create index if not exists idx_anamneses_client_id on public.anamneses(client_id);

-- ─── 17. Pacientes ────────────────────────────────────────────
create table if not exists public.pacientes (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  phone text default '(00) 00000-0000',
  email text,
  birthdate text,
  cidade text,
  status text default 'ativo',
  avatar text,
  user_id uuid references auth.users,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.pacientes enable row level security;

create policy "Users can view own pacientes"
  on public.pacientes for select
  using ( auth.uid() = user_id );

create policy "Users can insert own pacientes"
  on public.pacientes for insert
  with check ( auth.uid() = user_id );

create policy "Users can update own pacientes"
  on public.pacientes for update
  using ( auth.uid() = user_id );

create policy "Users can delete own pacientes"
  on public.pacientes for delete
  using ( auth.uid() = user_id );

create trigger handle_updated_at_pacientes
  before update on public.pacientes
  for each row execute function public.handle_updated_at();

create index if not exists idx_pacientes_user_id on public.pacientes(user_id);
create index if not exists idx_pacientes_name on public.pacientes(name);

-- ─── 18. Marketing Engine Settings ────────────────────────────
create table if not exists public.marketing_engine_settings (
  id integer primary key,
  enabled boolean default true,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_by text
);

-- Allow all authenticated users to read/update the single global toggle.
alter table public.marketing_engine_settings enable row level security;

create policy "Users can view marketing engine settings"
  on public.marketing_engine_settings for select
  to authenticated using (true);

create policy "Users can update marketing engine settings"
  on public.marketing_engine_settings for update
  to authenticated using (true) with check (true);

create policy "Users can insert marketing engine settings"
  on public.marketing_engine_settings for insert
  to authenticated with check (true);

-- ─── Backfill updated_at for OKR tables ───────────────────────
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_name = 'ciclos_okr' and column_name = 'updated_at'
  ) then
    alter table public.ciclos_okr add column updated_at timestamp with time zone default timezone('utc'::text, now()) not null;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_name = 'objetivos' and column_name = 'updated_at'
  ) then
    alter table public.objetivos add column updated_at timestamp with time zone default timezone('utc'::text, now()) not null;
  end if;
end;
$$;

create trigger handle_updated_at_ciclos_okr
  before update on public.ciclos_okr
  for each row execute function public.handle_updated_at();

create trigger handle_updated_at_objetivos
  before update on public.objetivos
  for each row execute function public.handle_updated_at();

-- ─── 19. Inventory (Estoque) ─────────────────────────────────
create table if not exists public.inventory (
  id text primary key,
  nome text not null,
  categoria text,
  estoque integer default 0,
  minimo integer default 0,
  preco numeric(12,2) default 0,
  fornecedor text,
  vencimento text,
  status text default 'ok',
  user_id uuid references auth.users,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.inventory enable row level security;

create policy "Users can view own inventory"
  on public.inventory for select using ( auth.uid() = user_id );
create policy "Users can insert own inventory"
  on public.inventory for insert with check ( auth.uid() = user_id );
create policy "Users can update own inventory"
  on public.inventory for update using ( auth.uid() = user_id );
create policy "Users can delete own inventory"
  on public.inventory for delete using ( auth.uid() = user_id );

create trigger handle_updated_at_inventory
  before update on public.inventory
  for each row execute function public.handle_updated_at();

create index if not exists idx_inventory_user_id on public.inventory(user_id);

-- ─── 20. Packages (Pacotes) ──────────────────────────────────
create table if not exists public.packages (
  id text primary key,
  nome text not null,
  servicos jsonb default '[]'::jsonb,
  sessoes integer default 1,
  preco numeric(12,2) default 0,
  desconto integer default 0,
  validade text default '6 meses',
  vendidos integer default 0,
  ativo boolean default true,
  user_id uuid references auth.users,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.packages enable row level security;

create policy "Users can view own packages"
  on public.packages for select using ( auth.uid() = user_id );
create policy "Users can insert own packages"
  on public.packages for insert with check ( auth.uid() = user_id );
create policy "Users can update own packages"
  on public.packages for update using ( auth.uid() = user_id );
create policy "Users can delete own packages"
  on public.packages for delete using ( auth.uid() = user_id );

create trigger handle_updated_at_packages
  before update on public.packages
  for each row execute function public.handle_updated_at();

create index if not exists idx_packages_user_id on public.packages(user_id);

-- ─── 21. Kanban Leads ────────────────────────────────────────
create table if not exists public.kanban_leads (
  id text primary key,
  nome text not null,
  servico text,
  valor numeric(12,2) default 0,
  coluna text default 'novo',
  avatar text,
  telefone text,
  email text,
  ordem integer default 0,
  user_id uuid references auth.users,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.kanban_leads enable row level security;

create policy "Users can view own kanban_leads"
  on public.kanban_leads for select using ( auth.uid() = user_id );
create policy "Users can insert own kanban_leads"
  on public.kanban_leads for insert with check ( auth.uid() = user_id );
create policy "Users can update own kanban_leads"
  on public.kanban_leads for update using ( auth.uid() = user_id );
create policy "Users can delete own kanban_leads"
  on public.kanban_leads for delete using ( auth.uid() = user_id );

create trigger handle_updated_at_kanban_leads
  before update on public.kanban_leads
  for each row execute function public.handle_updated_at();

create index if not exists idx_kanban_leads_user_id on public.kanban_leads(user_id);
