-- ============================================================
-- Pendientes del Inicio: avisos que cada persona puede cerrar con la X.
-- Los avisos se calculan en vivo (visitas asignadas, planes, cobros, compras…);
-- aquí solo se guarda qué cerró cada quien y cuándo:
--  - "pendiente" (algo por hacer): reaparece a las 24 h si sigue sin resolverse.
--  - "aviso" (algo que pasó): se oculta para siempre.
-- Ejecutar en el SQL editor de Supabase (es idempotente).
-- ============================================================
create table if not exists alert_dismissals (
  user_id uuid not null references profiles(id) on delete cascade,
  alert_key text not null,
  dismissed_at timestamptz not null default now(),
  primary key (user_id, alert_key)
);

alter table alert_dismissals enable row level security;
