-- Crons diarios de la app (pg_cron + pg_net). Horas en UTC (CDMX = UTC-6 todo el año).
-- Cada job es copia del cron "activar-cuenta-negocio" (mismo header x-cron-secret) con
-- otra ruta, así la clave nunca se escribe aquí. Idempotente: cron.schedule con el mismo
-- nombre actualiza el job.
select cron.schedule(v.jobname, v.horario, replace(b.command, 'activar-cuenta-negocio', v.ruta))
from cron.job b,
  (values ('plan-visitas',    '0 12 * * *', 'plan-visitas'),     -- 6:00 am CDMX
          ('followup-emails', '0 14 * * *', 'followup-emails'),  -- 8:00 am CDMX (asesoría tras el pago)
          ('ticket-emails',   '0 15 * * *', 'ticket-emails'),    -- 9:00 am CDMX (oferta/aviso del ticket)
          ('solicitudes-vencidas', '0 * * * *', 'solicitudes-vencidas') -- cada hora (solicitudes de visita gratis: hechas / sin Foodie a los 5 días)
  ) as v(jobname, horario, ruta)
where b.jobname = 'activar-cuenta-negocio';
