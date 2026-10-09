-- Lista de espera de la Foodie Academy (correos que se dejan en mysterfoodie.com).
-- Idempotente. Solo el servidor (service role) la lee y escribe: RLS activo y sin políticas.
create table if not exists public.academy_waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  source text,                         -- de dónde la dejó: metodologia, nosotros, footer-home...
  consent_at timestamptz not null default now(),
  confirmation_sent_at timestamptz,    -- cuándo se le mandó el correo de confirmación
  notified_at timestamptz,             -- cuándo se le avisó que abrió la Academy
  ip_hash text,                        -- huella (sha256) de la IP, solo para limitar abusos
  created_at timestamptz not null default now()
);

create unique index if not exists academy_waitlist_email_key on public.academy_waitlist (lower(email));
create index if not exists academy_waitlist_ip_idx on public.academy_waitlist (ip_hash, created_at);

alter table public.academy_waitlist enable row level security;

comment on table public.academy_waitlist is 'Interesados en la Foodie Academy (lista de espera). Avisar cuando abra: notified_at is null.';
