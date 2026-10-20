-- Solicitudes de visita: tipo (gratis / programada), escalamiento por tiempo y decisión del Master Chef.
-- Idempotente. Correr en el SQL Editor de Supabase ANTES de publicar la versión 0.20.0 de la app.
--
-- Escalamiento de una solicitud GRATIS que nadie ha asignado (se mide desde created_at):
--   +2 h  -> correo al Master Chef "Tienes nuevas visitas no asignadas" (unassigned_alert_at)
--   +3 h  -> se ofrece a los sibaritas (pool_sibaritas_notified_at); la primera persona que la toma se la queda
--   +5 h  -> se ofrece también a los Shoppers (pool_shoppers_notified_at)
-- Una solicitud PROGRAMADA ($850 + consumo) no entra a la bolsa ni vence sola: el Master Chef acuerda fecha, pago y
-- consumo en persona (schedule_pref = fecha/horario que pidió el negocio).
-- decision: 'visita' = el Master Chef decidió hacer la visita gratis; 'alta_demanda' = decidió avisar al negocio
-- que hay más solicitudes de lo normal (status pasa a sin_foodie y sale el correo con los paquetes).
alter table public.visit_requests
  add column if not exists kind text not null default 'gratis',
  add column if not exists schedule_pref text,
  add column if not exists unassigned_alert_at timestamptz,
  add column if not exists pool_sibaritas_notified_at timestamptz,
  add column if not exists pool_shoppers_notified_at timestamptz,
  add column if not exists decision text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'visit_requests_kind_check') then
    alter table public.visit_requests add constraint visit_requests_kind_check check (kind in ('gratis', 'programada'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'visit_requests_decision_check') then
    alter table public.visit_requests add constraint visit_requests_decision_check check (decision is null or decision in ('visita', 'alta_demanda'));
  end if;
end $$;

comment on column public.visit_requests.kind is 'gratis = "Solicita una visita GRATIS"; programada = el negocio quiere contratar una visita ($850 + consumo).';
