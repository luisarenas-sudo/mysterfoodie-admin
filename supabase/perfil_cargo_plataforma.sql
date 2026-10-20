-- Cargo por uso de la plataforma (10 % sobre el precio, lo paga el negocio) y reparto 50 % del precio al MysterFoodie.
-- Idempotente. Correr en el SQL Editor de Supabase ANTES de publicar la versión 0.25.0.
-- profile_purchases.amount = lo que se cobró (precio + cargo). price_amount = precio del perfil; platform_fee = cargo.
alter table public.profile_purchases
  add column if not exists price_amount numeric(10,2),
  add column if not exists platform_fee numeric(10,2) not null default 0;

-- Foto de la venta al momento del pago, para el detalle mensual de cada MysterFoodie (las ventas anteriores quedan con null/0).
alter table public.profile_earnings
  add column if not exists sale_price numeric(10,2),
  add column if not exists platform_fee numeric(10,2) not null default 0,
  add column if not exists tier text,
  add column if not exists client_id uuid references public.clients(id) on delete set null;
