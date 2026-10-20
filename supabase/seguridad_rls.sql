-- Seguridad de la base de datos (20 oct 2026) - respuesta al aviso "Table publicly accessible" de Supabase.
-- La app accede a los datos SOLO con el service role (servidor), que se salta RLS; el navegador usa Supabase únicamente para
-- autenticar, y el servidor lee "profiles" con la sesión del usuario (política "leer la propia o si eres admin").
-- Por eso las tablas quedan con RLS activo y SIN políticas: la API pública (anon / authenticated) no puede leer ni escribir nada,
-- salvo que cada quien lea su propio perfil.

-- 1) RLS en las 10 tablas que no lo tenían (antes cualquiera con la URL y la llave pública podía leer, editar y borrar).
alter table public.automations enable row level security;
alter table public.clients enable row level security;
alter table public.consultation_bookings enable row level security;
alter table public.email_confirmations enable row level security;
alter table public.form_flags enable row level security;
alter table public.form_ratings enable row level security;
alter table public.forms enable row level security;
alter table public.google_calendar_tokens enable row level security;
alter table public.report_payments enable row level security;
alter table public.visit_assignments enable row level security;

-- 2) Defensa en profundidad: quitar permisos de tabla a los roles de la API pública (solo "profiles" para authenticated).
revoke all on all tables in schema public from anon;
revoke all on all tables in schema public from authenticated;
revoke all on all sequences in schema public from anon, authenticated;
grant select on public.profiles to authenticated;

-- 3) Funciones: el disparador de alta de usuarios no debe poder llamarse por la API; current_user_role solo para sesiones iniciadas.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.current_user_role() from public, anon;
grant execute on function public.current_user_role() to authenticated;

-- 4) Que las tablas y funciones nuevas nazcan sin permisos para la API pública.
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon;

-- Para deshacer una tabla concreta (no recomendado): alter table public.<tabla> disable row level security;
