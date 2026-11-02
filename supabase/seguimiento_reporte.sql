-- ============================================================
-- Seguimiento del reporte público (/r/<código>): cuántos lo abren y
-- cuántos tocan "Comprar". Sin cookies ni servicios externos; solo guarda
-- fechas y un contador en la propia visita. Alimenta el aviso al Master Chef
-- ("abrieron el reporte de X y no compraron") y el embudo del Inicio.
-- Ejecutar en el SQL editor de Supabase (es idempotente).
-- ============================================================
alter table forms add column if not exists first_viewed_at timestamptz;
alter table forms add column if not exists last_viewed_at timestamptz;
alter table forms add column if not exists view_count integer not null default 0;
alter table forms add column if not exists checkout_clicked_at timestamptz;
-- Último aviso por correo al Master Chef por una apertura (pausa entre avisos).
alter table forms add column if not exists view_alert_sent_at timestamptz;
