-- Confirmación de mayoría de edad (18 años o más) al registrarse (nov 2026).
-- Se guarda junto con la aceptación de términos: misma fecha. Correr una vez en el SQL editor de Supabase. Es seguro volver a correrlo.
alter table profiles add column if not exists adult_confirmed_at timestamptz;
