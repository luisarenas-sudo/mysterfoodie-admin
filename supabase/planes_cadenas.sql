-- ============================================================
-- Planes para cadenas (Appetizer: 3 sucursales, Main course: 4 a 5).
-- Una contratación genera un plan por sucursal; group_id los une para
-- mandar un solo ticket y marcar el cobro de todas a la vez.
-- Requiere haber corrido antes supabase/planes.sql. Es idempotente.
-- ============================================================
alter table client_plans add column if not exists group_id uuid;
create index if not exists client_plans_group_idx on client_plans(group_id);
