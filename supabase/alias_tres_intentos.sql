-- Nombre anónimo: los perfiles NUEVOS lo eligen una sola vez, con 3 intentos como tope; los que ya existían pueden cambiarlo.
-- Idempotente. Correr en el SQL Editor de Supabase ANTES de publicar la versión 0.24.0.
--  - alias_capped: true = perfil nuevo (3 intentos, sin cambios después). Los perfiles que ya existen quedan en false.
--  - alias_rolls / alias_proposals: intentos usados y nombres propuestos (solo se puede elegir uno de ellos).
--  - old_slugs: ligas anteriores de quien cambia su nombre, para que sus QR y ligas viejas sigan funcionando.
alter table public.profiles
  add column if not exists alias_capped boolean not null default false,
  add column if not exists alias_rolls int not null default 0,
  add column if not exists alias_proposals text[] not null default '{}',
  add column if not exists old_slugs text[] not null default '{}';

-- Desde aquí, los perfiles que se creen son "nuevos".
alter table public.profiles alter column alias_capped set default true;
