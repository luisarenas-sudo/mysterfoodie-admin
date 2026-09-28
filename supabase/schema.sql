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
