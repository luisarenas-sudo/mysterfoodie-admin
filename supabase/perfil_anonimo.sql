-- Perfil anónimo del MysterFoodie (comprable por cuentas de negocio) + consumo/personas por visita.
-- Idempotente. Correr en el SQL Editor de Supabase ANTES de publicar la versión 0.22.0.
alter table public.profiles
  add column if not exists postal_code text,
  add column if not exists food_cuisines text[],
  add column if not exists food_dishes text[];

alter table public.shopper_applications
  add column if not exists postal_code text;

-- Consumo total (MXN) y número de personas que fueron en la visita (lo captura quien visita, antes de la foto del ticket).
alter table public.forms
  add column if not exists consumption_total numeric(10,2),
  add column if not exists party_size int;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'forms_party_size_check') then
    alter table public.forms add constraint forms_party_size_check check (party_size is null or (party_size between 1 and 30));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'forms_consumption_total_check') then
    alter table public.forms add constraint forms_consumption_total_check check (consumption_total is null or (consumption_total >= 0 and consumption_total < 1000000));
  end if;
end $$;

-- Compras del perfil anónimo de un MysterFoodie por una cuenta de negocio ($350 MXN sin IVA, pago único).
create table if not exists public.profile_purchases (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  mysterfoodie_id uuid not null references public.profiles(id) on delete cascade,
  form_id uuid references public.forms(id) on delete set null,
  buyer_id uuid references public.profiles(id) on delete set null,
  mercadopago_preference_id text,
  mercadopago_payment_id text,
  status text not null default 'pending',
  amount numeric(10,2),
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists profile_purchases_client_idx on public.profile_purchases (client_id, status);
create unique index if not exists profile_purchases_paid_key
  on public.profile_purchases (client_id, mysterfoodie_id) where status = 'approved';

-- Solo el servidor (service role) la lee y escribe.
alter table public.profile_purchases enable row level security;
