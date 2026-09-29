-- MysterFoodie - esquema base del flujo de formulario Mystery Shopper
-- Ejecutar en el SQL editor de Supabase

create extension if not exists "pgcrypto";

create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null default 'restaurante',
  contact_name text,
  phone text,
  instagram_handle text,
  email text,
  address text,
  city text,
  created_at timestamptz not null default now()
);

create table if not exists forms (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  shopper_name text,
  overall_score numeric(3,1) not null default 0,
  short_code text not null unique,
  status text not null default 'completado',
  created_at timestamptz not null default now()
);

-- Campos agregados para el cuestionario ampliado (~50 indicadores en 5
-- categorias): tipo de menu (select de Alimentos, no puntua) y
-- comentarios libres del mystery shopper al final del formulario.
-- Idempotente: seguro correrlo aunque la tabla forms ya exista.
alter table forms add column if not exists menu_type text;
alter table forms add column if not exists comments text;

-- Nombre del mesero que atendio la visita, capturado al final del
-- formulario; se usa para personalizar el correo enviado al negocio.
alter table forms add column if not exists waiter_name text;

-- Reporte completo comprado via MercadoPago. Mientras sea null, el link
-- publico (/r/[shortCode]) solo muestra el resumen por categoria. El
-- webhook de MercadoPago (/api/mercadopago/webhook) lo llena cuando
-- confirma un pago aprobado para ese formulario.
alter table forms add column if not exists report_unlocked_at timestamptz;

-- Guarda el link corto (go.mysterfoodie.com/xxx) generado al crear la
-- evaluacion, para poder reenviar el correo (o mandarlo a otro correo)
-- despues sin regenerar un link corto nuevo en Short.io cada vez.
alter table forms add column if not exists report_url text;

create table if not exists report_payments (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references forms(id) on delete cascade,
  mercadopago_preference_id text,
  mercadopago_payment_id text,
  status text not null default 'pending',
  amount numeric(10,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists report_payments_form_id_idx on report_payments(form_id);
create index if not exists report_payments_payment_id_idx on report_payments(mercadopago_payment_id);

create table if not exists form_ratings (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references forms(id) on delete cascade,
  category_key text not null,
  category_label text not null,
  score int not null check (score between 1 and 5)
);

create table if not exists form_flags (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references forms(id) on delete cascade,
  flag_key text not null,
  flag_label text not null,
  flag_value boolean not null
);

create table if not exists email_confirmations (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references forms(id) on delete cascade,
  recipient_email text not null,
  subject text not null,
  status text not null,
  provider_id text,
  error text,
  sent_at timestamptz not null default now()
);

create index if not exists forms_client_id_idx on forms(client_id);
create index if not exists form_ratings_form_id_idx on form_ratings(form_id);
create index if not exists form_flags_form_id_idx on form_flags(form_id);
create index if not exists email_confirmations_form_id_idx on email_confirmations(form_id);
create index if not exists forms_short_code_idx on forms(short_code);

-- ============================================================
-- Roles y cuentas: admin / agente / cliente
-- ============================================================
-- Ejecutar esta seccion despues de tener Supabase Auth habilitado
-- (Authentication > Providers > Email, con "Confirm email" segun se
-- prefiera). No requiere nada mas de configuracion para funcionar.

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  role text not null default 'cliente' check (role in ('admin', 'agente', 'cliente')),
  client_id uuid references clients(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists profiles_client_id_idx on profiles(client_id);
create index if not exists profiles_role_idx on profiles(role);

-- de que agente vino cada visita (para "Mis visitas" y, a futuro,
-- calcular comisiones)
alter table forms add column if not exists created_by uuid references profiles(id) on delete set null;
create index if not exists forms_created_by_idx on forms(created_by);

-- crea automaticamente un perfil en blanco (rol "cliente" por default)
-- cada vez que se crea un usuario nuevo en auth.users. El flujo de
-- invitacion (POST /api/admin/usuarios) lo actualiza justo despues con
-- el rol y negocio correctos.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, role)
  values (new.id, new.email, 'cliente')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- funcion "security definer" para poder consultar el rol propio sin
-- caer en recursion infinita de RLS (una policy en profiles que hace
-- select sobre profiles se auto-referencia si no pasa por aqui)
create or replace function public.current_user_role()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select role from public.profiles where id = auth.uid();
$$;

alter table profiles enable row level security;

drop policy if exists "profiles: leer la propia o si eres admin" on profiles;
create policy "profiles: leer la propia o si eres admin" on profiles
  for select using (
    auth.uid() = id or public.current_user_role() = 'admin'
  );

-- los cambios de rol/negocio y las invitaciones se hacen siempre desde
-- el servidor con la service role key (bypassa RLS), asi que no se
-- agregan policies de insert/update/delete para el anon/authenticated key.
