-- ============================================================
-- Reporte mensual de ventas y pagos: cierra cada mes con lo que hay que depositar a cada Sibarita/Shopper,
-- lo que queda a la plataforma y una palomita de "ya le pagué" por persona. Idempotente.
-- Ejecutar en el SQL editor de Supabase.
-- ============================================================
create table if not exists public.monthly_payout_reports (
  month text primary key check (month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  generated_at timestamptz not null default now(),
  gross numeric(12,2) not null default 0,            -- ventas brutas del mes (reportes, planes y perfiles, con cargo por plataforma)
  to_pay numeric(12,2) not null default 0,           -- total a depositar a Sibaritas y Shoppers
  platform numeric(12,2) not null default 0,         -- lo que queda a la plataforma (Master Chef + cargo por uso)
  paid_aside numeric(12,2) not null default 0,       -- ganancias de perfil que ya se habían pagado por separado
  unclassified_count int not null default 0,         -- ventas que no encajan en el reparto
  unpaid_plan_amount numeric(12,2) not null default 0, -- visitas de planes hechas pero sin cobrar (no reparten todavía)
  email_sent_at timestamptz,
  opened_at timestamptz
);

create table if not exists public.monthly_payouts (
  id uuid primary key default gen_random_uuid(),
  month text not null references public.monthly_payout_reports(month) on delete cascade,
  person_id uuid not null references public.profiles(id) on delete cascade,
  visits_amount numeric(12,2) not null default 0,
  profiles_amount numeric(12,2) not null default 0,
  total numeric(12,2) not null,
  sales_count int not null default 0,
  paid_at timestamptz,
  paid_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (month, person_id)
);
create index if not exists monthly_payouts_person_idx on public.monthly_payouts (person_id, month);

alter table public.monthly_payout_reports enable row level security;
alter table public.monthly_payouts enable row level security;
revoke all on public.monthly_payout_reports from anon, authenticated;
revoke all on public.monthly_payouts from anon, authenticated;

-- Cron: días 1 al 3 de cada mes, 9:00 am CDMX (15:00 UTC). Copia del job «activar-cuenta-negocio» con otra ruta, así la clave
-- nunca se escribe aquí. La ruta es idempotente: si el correo del mes ya salió, no hace nada (los días 2 y 3 solo reintentan).
select cron.schedule('reporte-mensual', '0 15 1-3 * *', replace(b.command, 'activar-cuenta-negocio', 'reporte-mensual'))
from cron.job b where b.jobname = 'activar-cuenta-negocio';
