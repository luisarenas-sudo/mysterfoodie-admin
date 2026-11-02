-- Tareas del Inicio para llenar el perfil anónimo (ID al día 1, Passport 2 días después de completar el ID).
-- Guarda cuándo se completó (y compartió) el nivel ID por primera vez. Idempotente.
alter table public.profiles add column if not exists anon_id_done_at timestamptz;
comment on column public.profiles.anon_id_done_at is 'Primera vez que la persona compartió todo el nivel ID de su perfil anónimo; de aquí corre el recordatorio para Passport.';
