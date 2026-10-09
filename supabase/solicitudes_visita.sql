-- "Solicita una visita GRATIS" (mysterfoodie.com): solicitudes de visita de negocios que se dan de alta
-- solos desde la web. Idempotente. Solo el servidor (service role) la lee y escribe: RLS activo y sin políticas.
--
-- Ciclo de una solicitud:
--   pendiente   -> recién llegada; el Master Chef la asigna a un sibarita, un Foodie o a sí mismo.
--   asignada    -> tiene visit_assignments. Días 1-3 desde assigned_at: solo la persona asignada.
--                  Días 4-5 (open_at .. expires_at): también la ven todos los Foodies y cualquiera puede tomarla.
--   completada  -> ya existe una visita (forms) del negocio posterior a la solicitud.
--   sin_foodie  -> pasó expires_at sin visita: se le avisó al negocio (nofoodie_email_sent_at) que por ahora
--                  no hay Foodie y se le invita a ver los paquetes. El Master Chef aún puede reasignarla.
create table if not exists public.visit_requests (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  status text not null default 'pendiente'
    check (status in ('pendiente', 'asignada', 'completada', 'sin_foodie')),
  source text,                          -- desde qué botón de la web llegó (hero, nav, footer, servicios...)
  message text,                         -- comentario libre del negocio (opcional)
  assignment_id uuid references public.visit_assignments(id) on delete set null,
  assigned_to uuid,                     -- copia de la asignación vigente, para listar rápido
  assigned_at timestamptz,
  open_at timestamptz,                  -- assigned_at + 3 días: desde aquí también la ven los Foodies
  expires_at timestamptz,               -- assigned_at + 5 días (o created_at + 5 días si nunca se asignó)
  confirmation_sent_at timestamptz,     -- correo "tu negocio fue dado de alta y la solicitud enviada"
  admin_notified_at timestamptz,        -- aviso al Master Chef
  nofoodie_email_sent_at timestamptz,   -- correo "por el momento no contamos con un foodie"
  completed_at timestamptz,
  ip_hash text,                         -- huella (sha256) de la IP, solo para limitar abusos
  created_at timestamptz not null default now()
);

create index if not exists visit_requests_status_idx on public.visit_requests (status, created_at);
create index if not exists visit_requests_client_idx on public.visit_requests (client_id);
create index if not exists visit_requests_ip_idx on public.visit_requests (ip_hash, created_at);

alter table public.visit_requests enable row level security;

-- De dónde vino cada negocio (web = se dio de alta solo desde "Solicita una visita GRATIS").
alter table public.clients add column if not exists source text;

comment on table public.visit_requests is 'Solicitudes de visita gratis hechas desde mysterfoodie.com. Ver supabase/solicitudes_visita.sql.';

-- Plantillas editables (Automatizaciones) de los dos correos al negocio.
insert into automations (key, enabled, subject_template, body_template)
values
  (
    'solicitud_recibida',
    true,
    'Tu negocio ya está en MysterFoodie: {{negocio}}',
    E'Hola {{contacto}},\n\n¡Gracias por pedir tu visita gratis! Tu negocio {{negocio}} ha sido dado de alta y tu solicitud ha sido enviada.\n\nEstos son los datos que registramos:\n{{datos}}\n\nQué sigue: asignaremos tu visita a uno de nuestros MysterFoodies. Es una visita anónima, así que no te avisaremos el día ni la hora. Cuando termine, recibirás por correo el resultado de tu visita.\n\nEntra a tu cuenta de MysterFoodie aquí (si es tu primera vez, ahí mismo creas tu contraseña o continúas con Google):\n{{link_acceso}}\n\nSaludos,\nMysterFoodie'
  ),
  (
    'solicitud_sin_foodie',
    true,
    'Sobre tu solicitud de visita en MysterFoodie',
    E'Hola {{contacto}},\n\nPor el momento y dado el alto volumen de solicitudes, no contamos con un foodie para tu visita a {{negocio}}.\n\nPuedes agendar paquetes de visitas con nosotros aquí, donde también encuentras la tabla comparativa de paquetes:\n{{link_paquetes}}\n\nGracias por tu interés,\nMysterFoodie'
  )
on conflict (key) do nothing;
