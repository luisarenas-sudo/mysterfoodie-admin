-- Aceptación de los términos y condiciones del servicio (nov 2026).
-- Cada persona invitada (negocio o MysterFoodie de cualquier rango) marca la casilla
-- «Acepto los términos y condiciones del servicio» antes de unirse; aquí queda constancia
-- de cuándo, qué versión y por qué vía. Correr una vez en el SQL editor de Supabase. Es seguro volver a correrlo.
alter table profiles add column if not exists terms_accepted_at timestamptz;
alter table profiles add column if not exists terms_version text;
-- password | google | sesion
alter table profiles add column if not exists terms_accepted_via text;
