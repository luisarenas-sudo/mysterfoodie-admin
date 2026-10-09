-- ============================================================
-- Segunda etapa: PLANES de visitas por sucursal (Starter y los que vengan).
-- Un plan = un negocio (cada sucursal es su propio negocio) + N visitas al
-- mes (1 a 4) + tarifa por visita. Cada mes se generan solas las visitas
-- (como visit_assignments con plan_id) y un "periodo" que se marca como
-- cobrado (el cobro es fuera de la app en la Fase A).
-- Ejecutar completo en el SQL editor de Supabase (es idempotente).
-- ============================================================

create table if not exists client_plans (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  plan_key text not null default 'starter',
  plan_name text not null default 'Starter',
  visits_per_month int not null default 3 check (visits_per_month between 1 and 4),
  price_per_visit int not null default 700,          -- MXN por visita
  start_month text not null,                          -- 'YYYY-MM' (primer mes del plan)
  status text not null default 'activo',              -- activo | pausado | cancelado
  default_foodie_id uuid references profiles(id) on delete set null,
  notes text,
  ticket_sent_at timestamptz,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists client_plans_client_id_idx on client_plans(client_id);

-- Un renglón por plan y mes: cuánto toca cobrar y si ya se cobró.
create table if not exists plan_periods (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references client_plans(id) on delete cascade,
  month text not null,                                -- 'YYYY-MM'
  amount int not null,                                -- visitas x tarifa (MXN), sin el reembolso del ticket
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  unique (plan_id, month)
);

alter table client_plans enable row level security;
alter table plan_periods enable row level security;

-- Las visitas del plan viven en visit_assignments (así el Foodie las ve igual
-- que cualquier visita asignada). Sin Foodie todavía = assigned_to vacío.
alter table visit_assignments add column if not exists plan_id uuid references client_plans(id) on delete cascade;
alter table visit_assignments add column if not exists plan_month text;
alter table visit_assignments alter column assigned_to drop not null;
alter table visit_assignments alter column assigned_by drop not null;

alter table visit_assignments add column if not exists plan_seq int;

-- Evita generar dos veces la misma visita del mes aunque dos pantallas lo intenten a la vez.
create unique index if not exists visit_assignments_plan_seq_uidx on visit_assignments(plan_id, plan_month, plan_seq);

-- La visita guardada recuerda de qué plan salió (para el reparto de ganancias).
alter table forms add column if not exists plan_id uuid references client_plans(id) on delete set null;
create index if not exists forms_plan_id_idx on forms(plan_id);
