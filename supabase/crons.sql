-- Crons diarios de la app (pg_cron + pg_net). Horas en UTC (CDMX = UTC-6 todo el año).
-- Cada job es copia del cron "activar-cuenta-negocio" (mismo header x-cron-secret) con
-- otra ruta, así la clave nunca se escribe aquí. Idempotente: cron.schedule con el mismo
-- nombre actualiza el job.
select cron.schedule(v.jobname, v.horario, replace(b.command, 'activar-cuenta-negocio', v.ruta))
from cron.job b,
  (values ('plan-visitas',    '0 12 * * *', 'plan-visitas'),     -- 6:00 am CDMX
          ('followup-emails', '0 14 * * *', 'followup-emails'),  -- 8:00 am CDMX (asesoría tras el pago)
          ('ticket-emails',   '0 15 * * *', 'ticket-emails'),    -- 9:00 am CDMX (oferta/aviso del ticket)
          ('perfil-oferta',   '0 16 * * *', 'perfil-oferta'),    -- 10:00 am CDMX (oferta del perfil del MysterFoodie)
          ('recordatorios-reporte', '0 16 * * *', 'recordatorios-reporte'), -- 10:00 am CDMX (recordatorios del reporte: día 2 y día 7 a quien no lo ha comprado)
          ('perfil-anonimo', '0 17 * * *', 'perfil-anonimo'), -- 11:00 am CDMX (invitación única a perfiles nuevos para llenar su perfil anónimo, niveles ID y Passport)
          ('vip-negocios', '30 16 * * *', 'vip-negocios'), -- 10:30 am CDMX (agradecimiento único a negocios VIP: plan o paquete contratado)
          ('solicitudes-vencidas', '*/10 * * * *', 'solicitudes-vencidas') -- cada 10 min (solicitudes de visita: avisos a las 2/3/5 h sin asignar, hechas, sin Shopper a los 5 días)
  ) as v(jobname, horario, ruta)
where b.jobname = 'activar-cuenta-negocio';
