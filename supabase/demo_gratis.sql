-- Demo gratis (20 oct 2026): "Enviar GRATIS" al terminar una visita entrega el reporte
-- completo sin pago (report_unlocked_at) y lo marca como demo: PDF con marca de agua y
-- sin contar como venta en Ganancias. Correr UNA vez en el SQL Editor. Es seguro repetirlo.
alter table forms add column if not exists free_demo boolean not null default false;
