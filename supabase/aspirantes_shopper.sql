-- Invitar Shoppers con QR: alias (nombre anónimo) por persona, liga corta y solicitudes de ingreso.
-- Idempotente. Correr en el SQL Editor de Supabase ANTES de publicar la versión 0.21.0 de la app.
--
-- Cada MysterFoodie tiene un nombre anónimo (alias): primer nombre de fruta/verdura/tubérculo + apellido de una
-- figura reconocida (ej. "Lima Hayek", "Zapote Infante"). Sibaritas y Master Chefs lo usan como liga fija
-- go.mysterfoodie.com/<alias> (QR en Perfil) que abre el formulario /unete/<alias>. El invitado llena TODO el
-- formulario y queda como solicitud "pendiente" hasta que el Master Chef la aprueba (ahí se crea su cuenta de Shopper).
alter table public.profiles
  add column if not exists alias text,
  add column if not exists alias_style text,
  add column if not exists alias_slug text,
  add column if not exists invite_short_url text,
  add column if not exists invited_by uuid references public.profiles(id) on delete set null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_alias_style_check') then
    alter table public.profiles add constraint profiles_alias_style_check check (alias_style is null or alias_style in ('femenino', 'masculino', 'no_binarie'));
  end if;
end $$;

create unique index if not exists profiles_alias_key on public.profiles (lower(alias)) where alias is not null;
create unique index if not exists profiles_alias_slug_key on public.profiles (alias_slug) where alias_slug is not null;

create table if not exists public.shopper_applications (
  id uuid primary key default gen_random_uuid(),
  inviter_id uuid references public.profiles(id) on delete set null,
  inviter_alias text,
  status text not null default 'pendiente' check (status in ('pendiente', 'aprobada', 'rechazada')),
  full_name text not null,
  whatsapp text not null,
  email text not null,
  city text not null,
  colonia text not null,
  is_adult boolean not null,
  instagram text not null,
  experience_level text not null,
  experience_text text not null,
  days text[] not null,
  slots text[] not null,
  has_vehicle boolean not null,
  alias_style text not null check (alias_style in ('femenino', 'masculino', 'no_binarie')),
  cuisines text[] not null,
  dishes text[] not null,
  ip_hash text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists shopper_applications_status_idx on public.shopper_applications (status, created_at);
create index if not exists shopper_applications_inviter_idx on public.shopper_applications (inviter_id);
create index if not exists shopper_applications_email_idx on public.shopper_applications (lower(email));
create index if not exists shopper_applications_ip_idx on public.shopper_applications (ip_hash, created_at);

-- Solo el servidor (service role) la lee y escribe: RLS activo y sin políticas.
alter table public.shopper_applications enable row level security;
