-- ============================================================
-- Seguimiento a quien no compra el reporte: correo que el negocio deja en el
-- reporte público, recordatorios (día 2 y día 7) y baja de recordatorios.
-- Ejecutar en el SQL editor de Supabase (es idempotente).
-- ============================================================
alter table forms add column if not exists lead_email text;
alter table forms add column if not exists lead_email_at timestamptz;
alter table forms add column if not exists lead_email_count integer not null default 0;
alter table forms add column if not exists remind1_sent_at timestamptz;
alter table forms add column if not exists remind2_sent_at timestamptz;
alter table forms add column if not exists followup_optout_at timestamptz;
