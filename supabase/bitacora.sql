-- Bitácora por negocio (Master Chef): registra las acciones que hoy no dejan huella en otra tabla
-- (reasignaciones, visita tomada de la bolsa, reenvíos de correo, ediciones de datos).
-- El resto de la línea de tiempo (alta, solicitud, asignación, visita, correos, aperturas, pagos,
-- recordatorios...) se arma al vuelo con las tablas que ya existen, así que también muestra el historial pasado.
create table if not exists public.business_log (
  id bigint generated always as identity primary key,
  client_id uuid not null references public.clients(id) on delete cascade,
  created_at timestamptz not null default now(),
  kind text not null,                 -- asignacion | correo_reenvio | datos_editados ...
  title text not null,                -- "Se reasignó la visita a ..."
  detail text,
  actor_id uuid,                      -- quién lo hizo (profiles.id); null = automático
  actor_name text,                    -- foto del nombre al momento de la acción
  actor_role text,                    -- admin | sibarita | agente
  ref_id uuid                         -- p. ej. la asignación a la que se refiere
);

create index if not exists business_log_client_idx on public.business_log (client_id, created_at desc);

alter table public.business_log enable row level security;

comment on table public.business_log is 'Bitácora por negocio. Ver supabase/bitacora.sql y lib/bitacora.ts.';
