-- Constancia del Acuerdo de colaboración del equipo (Shopper, Sibarita, Master Chef), nov 2026.
-- Se guarda junto con la aceptación de términos: misma fecha. Correr una vez en el SQL editor de Supabase. Es seguro volver a correrlo.
alter table profiles add column if not exists collab_agreement_at timestamptz;
alter table profiles add column if not exists collab_agreement_version text;
