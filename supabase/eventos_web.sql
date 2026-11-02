-- Contador propio de mysterfoodie.com, SIN cookies.
-- Guarda eventos anónimos que manda el sitio (visita a una página, clic en «Solicita una visita»,
-- formulario iniciado y enviado). No guarda IP ni datos personales: «visitor» es un hash que
-- cambia cada día, así que no sirve para seguir a una persona de un día a otro.
-- Solo lo lee el Master Chef desde Perfil > Stats (con la llave de servicio; sin políticas RLS = nadie más).
create table if not exists public.web_events (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  event text not null check (event in ('visita', 'clic_solicitar', 'form_inicio', 'form_enviado')),
  page text not null,                 -- ruta, p. ej. /servicios/
  source text,                        -- desde qué parte del sitio (nav, inicio, servicios, footer, pagina, nosotros, otra)
  visitor text not null,              -- hash diario sin cookies (no reversible)
  device text,                        -- movil | escritorio
  channel text                        -- directo | instagram | facebook | google | whatsapp | correo | otro
);

create index if not exists web_events_created_idx on public.web_events (created_at desc);
create index if not exists web_events_visitor_idx on public.web_events (visitor, created_at desc);

alter table public.web_events enable row level security;

comment on table public.web_events is 'Contador propio sin cookies de mysterfoodie.com. Ver supabase/eventos_web.sql.';
