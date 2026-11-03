-- Negocios VIP (plan o paquete de visitas contratado): correo de agradecimiento una sola vez.
-- Corre completo en el SQL editor de Supabase (idempotente).
alter table public.clients add column if not exists vip_email_sent_at timestamptz;

-- Cron diario 10:30 am CDMX (16:30 UTC): copia del job «activar-cuenta-negocio» con otra ruta, así la clave nunca se escribe aquí.
select cron.schedule('vip-negocios', '30 16 * * *', replace(b.command, 'activar-cuenta-negocio', 'vip-negocios'))
from cron.job b where b.jobname = 'activar-cuenta-negocio';
