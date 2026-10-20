-- Baja voluntaria (20 oct 2026): cualquier cuenta puede eliminarse desde Perfil.
-- Pasa por la hoja de salida (calificación + comentario) y entra como tarea al Master Chef
-- en /admin/bajas y en Pendientes. Reutiliza remove_user (supabase/acceso.sql).
-- Correr UNA vez en el SQL Editor de Supabase. Es seguro repetirlo.
alter table user_removals
  add column if not exists self_requested boolean not null default false,
  add column if not exists exit_rating int check (exit_rating between 1 and 5),
  add column if not exists exit_comment text;
