-- Perfil anónimo en dos niveles (ID $350 / Passport $700), bloques que cada MysterFoodie decide compartir y sus ganancias.
-- Idempotente. Correr en el SQL Editor de Supabase ANTES de publicar la versión 0.23.0 (después de perfil_anonimo.sql).
alter table public.profiles
  add column if not exists persona jsonb not null default '{}'::jsonb,
  add column if not exists share_blocks text[] not null default '{}';

alter table public.shopper_applications
  add column if not exists persona jsonb not null default '{}'::jsonb,
  add column if not exists share_blocks text[] not null default '{}';

alter table public.profile_purchases
  add column if not exists tier text not null default 'id',
  add column if not exists blocks text[] not null default '{}';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profile_purchases_tier_check') then
    alter table public.profile_purchases add constraint profile_purchases_tier_check check (tier in ('id', 'passport'));
  end if;
end $$;

-- Una compra aprobada por nivel (ID y luego Passport como mejora).
drop index if exists public.profile_purchases_paid_key;
create unique index if not exists profile_purchases_paid_tier_key
  on public.profile_purchases (client_id, mysterfoodie_id, tier) where status = 'approved';

-- Ganancias del MysterFoodie por los bloques que compartió en cada venta. Se pagan igual que sus visitas.
create table if not exists public.profile_earnings (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null unique references public.profile_purchases(id) on delete cascade,
  mysterfoodie_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric(10,2) not null,
  blocks text[] not null default '{}',
  status text not null default 'pendiente' check (status in ('pendiente', 'pagado')),
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
create index if not exists profile_earnings_person_idx on public.profile_earnings (mysterfoodie_id, status);
alter table public.profile_earnings enable row level security;

-- Seguimiento: oferta del perfil al negocio (una vez por visita).
alter table public.forms add column if not exists profile_offer_sent_at timestamptz;

insert into automations (key, enabled, subject_template, body_template)
values (
  'perfil_oferta',
  true,
  'Destapa el perfil del MysterFoodie que visitó {{negocio}}',
  E'Hola equipo de {{negocio}},\n\nDestapa el perfil de tu MysterFoodie: conoce más sobre su estilo de vida, el tipo de restaurantes que frecuenta y sus generalidades demográficas. El buyer persona completo de quien los visitó el {{fecha_visita}}, sin perder su anonimato.\n\nNivel ID ({{precio_id}}): sus gustos, las palabras que más usa en sus reseñas, con cuántas personas sale, cuánto consume y el sector que representa.\nNivel Passport ({{precio_passport}}): además, su estilo de vida, demografía, movilidad y los medios que usa.\n\nEs un pago único y la información siempre es anónima: sin nombre, foto ni datos de contacto.\n\n{{link_perfil}}\n\nSaludos,\nMysterFoodie'
)
on conflict (key) do nothing;
