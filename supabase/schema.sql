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

-- Foto de perfil (Google Sign-In la llena automaticamente via
-- app/auth/callback/route.ts; tambien se puede dejar vacia).
alter table profiles add column if not exists avatar_url text;

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

-- ============================================================
-- Automatizaciones: correos automáticos editables (ej. asesoría
-- gratuita post-visita) y agenda de citas vía Google Calendar.
-- ============================================================

-- Plantillas editables de cada automatización (ver /automatizaciones).
-- "asesoria_gratuita": correo que se manda al día siguiente de la
-- visita (8am hora CDMX) ofreciendo 20 min gratis para platicar del
-- negocio, con link a /agendar/[shortCode].
create table if not exists automations (
  key text primary key,
  enabled boolean not null default true,
  subject_template text not null,
  body_template text not null,
  updated_at timestamptz not null default now()
);

insert into automations (key, enabled, subject_template, body_template)
values (
  'asesoria_gratuita',
  true,
  'Hablemos de {{negocio}} — 20 min gratis',
  E'Hola equipo de {{negocio}},\n\nAyer los visitamos con un Mystery Shopper y nos encantaría platicar un poco más sobre los resultados y algunas ideas para mejorar.\n\n¿Te gustaría agendar 20 minutos gratis para platicarlo? Elige el horario que mejor te convenga aquí:\n{{link_agenda}}\n\nSaludos,\nMysterFoodie'
)
on conflict (key) do nothing;

-- Automatizaciones agregadas para exponer como plantilla editable TODOS
-- los mensajes automáticos de la app (no solo el de seguimiento), con
-- "enabled" controlando si se usa el texto personalizado o el texto
-- original de MysterFoodie -- ver AUTOMATION_CATALOG en lib/automations.ts
-- para la lista de {{tags}} de cada una.
insert into automations (key, enabled, subject_template, body_template)
values
  (
    'resultado_visita',
    true,
    'Resultado de tu evaluación Mystery Shopper - {{promedio}} estrellas',
    'Un **Myster Foodie** calificado de nuestra comunidad visitó recientemente su {{tipo_negocio}} sin previo aviso. Como cliente sibarita habitual, **pagó su consumo de su propio bolsillo y evaluó de forma 100% independiente** la experiencia real recibida.{{mesero_linea}}'
  ),
  (
    'asignacion_visita',
    true,
    'Nueva visita asignada: {{negocio}}',
    E'Hola {{foodie}},\n\nSe te asignó una nueva visita Mystery Shopper:\n\nNegocio: {{negocio}}\nUbicación: {{ubicacion}}\nNota: {{nota}}\n\nVe tus visitas asignadas aquí:\n{{link_visitas}}\n\nSaludos,\nMysterFoodie'
  ),
  (
    'confirmacion_cita_negocio',
    true,
    'Asesoría confirmada: {{negocio}}',
    E'Hola equipo de {{negocio}},\n\nTu asesoría gratuita con MysterFoodie quedó agendada para:\n\n{{fecha_hora}}\n\nTe llega una invitación de Google Calendar por separado con el enlace de la videollamada.\n\nSaludos,\nMysterFoodie'
  ),
  (
    'confirmacion_cita_admin',
    true,
    'Asesoría confirmada: {{negocio}}',
    E'{{negocio}} agendó una asesoría gratuita contigo para:\n\n{{fecha_hora}}\n\nTe llega una invitación de Google Calendar por separado con el enlace de la videollamada.\n\nSaludos,\nMysterFoodie'
  ),
  (
    'instagram_dm',
    true,
    '',
    'Hola equipo de {{negocio}}, hoy los visitamos e hicimos un Mystery Shopper.{{mesero_linea}} Obtuvimos {{promedio}} estrellas de promedio. Aquí puedes ver el reporte completo: {{link_reporte}}'
  )
on conflict (key) do nothing;

-- Evita mandar el correo de seguimiento mas de una vez por visita.
alter table forms add column if not exists followup_sent_at timestamptz;

-- Tokens de Google Calendar del admin (Luis), para leer su
-- disponibilidad (eventos "Face2Face") y crear el evento al agendar.
-- Una sola fila (id=1) -- se reemplaza si se reconecta.
create table if not exists google_calendar_tokens (
  id int primary key default 1,
  connected_email text,
  refresh_token text not null,
  access_token text,
  access_token_expires_at timestamptz,
  calendar_id text not null default 'primary',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint google_calendar_tokens_single_row check (id = 1)
);

-- Citas de asesoría gratuita agendadas desde /agendar/[shortCode].
create table if not exists consultation_bookings (
  id uuid primary key default gen_random_uuid(),
  form_id uuid references forms(id) on delete set null,
  client_id uuid references clients(id) on delete set null,
  business_name text not null,
  contact_email text not null,
  contact_name text,
  contact_phone text,
  slot_start timestamptz not null,
  slot_end timestamptz not null,
  calendar_event_id text,
  status text not null default 'confirmada',
  created_at timestamptz not null default now()
);

create index if not exists consultation_bookings_form_id_idx on consultation_bookings(form_id);

-- ============================================================
-- Cuentas de negocio (self-service): 20 minutos despues de comprar el
-- reporte completo, se le ofrece al negocio crear su cuenta (correo +
-- contraseña, o Google) via /api/cron/activar-cuenta-negocio. Desde
-- ahi puede ver el historial de sus visitas y, a futuro, pedir
-- visitas programadas y pagarlas directo.
-- ============================================================

-- Evita invitar al mismo negocio mas de una vez (tenga 1 visita o 10).
alter table clients add column if not exists account_invited_at timestamptz;

-- Automatización editable del correo de activación (opcional -- si no
-- se corre este insert, el cron usa un texto por default igual de
-- funcional, ver app/api/cron/activar-cuenta-negocio/route.ts).
insert into automations (key, enabled, subject_template, body_template)
values (
  'activacion_cuenta_negocio',
  true,
  'Activa tu cuenta en MysterFoodie',
  E'Hola equipo de {{negocio}},\n\nYa puedes crear tu cuenta en MysterFoodie para ver el historial de visitas de tu negocio, pedir nuevas visitas programadas y revisar tus reportes cuando quieras.\n\nEntra aquí para crear tu contraseña (o puedes continuar con tu cuenta de Google desde la misma pantalla):\n{{link_acceso}}\n\nSaludos,\nMysterFoodie'
)
on conflict (key) do nothing;

-- ============================================================
-- "Añadido por": saber qué rango (Master Chef/Sibarita/Foodie) y qué
-- persona dio de alta cada negocio, para mostrarlo en la lista de
-- Negocios (ver app/api/clients/route.ts, app/api/visits/route.ts y
-- lib/dashboard.ts). Ya aplicada en Supabase.
-- ============================================================
alter table clients add column if not exists created_by uuid references profiles(id);
