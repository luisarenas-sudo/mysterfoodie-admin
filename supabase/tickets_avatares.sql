-- Ticket de consumo en las visitas + foto de perfil propia.
-- Se corre una sola vez en el SQL Editor de Supabase (es idempotente).

-- 1) Ticket de consumo: ruta de la foto en Storage, cuándo se subió y cuándo
--    se avisó al negocio (el aviso sale 3 días después de subirlo, una vez).
alter table public.forms add column if not exists ticket_photo_path text;
alter table public.forms add column if not exists ticket_uploaded_at timestamptz;
alter table public.forms add column if not exists ticket_email_sent_at timestamptz;

create index if not exists forms_ticket_email_pending_idx
  on public.forms (ticket_uploaded_at)
  where ticket_photo_path is not null and ticket_email_sent_at is null;

-- 2) Perfil: teléfono y "foto elegida por la persona" (para que el login con
--    Google no vuelva a pisar su foto; con avatar_url nulo significa "quiero
--    mis iniciales").
alter table public.profiles add column if not exists phone text;
alter table public.profiles add column if not exists avatar_locked boolean not null default false;

-- 3) Buckets de Storage. Tickets: privado (solo se ve con URL firmada que
--    genera el servidor). Avatares: público (la foto se muestra en toda la app).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('tickets', 'tickets', false, 5242880, array['image/jpeg','image/png'])
on conflict (id) do update set public = false, file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg','image/png'];

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg','image/png'])
on conflict (id) do update set public = true, file_size_limit = 2097152,
  allowed_mime_types = array['image/jpeg','image/png'];
-- Sin policies adicionales: solo el servidor (service role) escribe y firma.
