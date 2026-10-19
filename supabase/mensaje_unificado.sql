-- Mensaje unificado al dueño (19 oct 2026): el DM de Instagram y el correo con el
-- resultado dicen lo mismo. Estas filas ya estaban guardadas en Automatizaciones
-- (enabled = true), por eso el cambio en el código no basta: hay que actualizarlas.
-- Solo se reemplazan si SIGUEN con el texto original: si editaste el tuyo, no se toca.

update automations
set subject_template = 'Resultado de tu visita MysterFoodie: {{promedio}} de 5 estrellas',
    updated_at = now()
where key = 'resultado_visita'
  and subject_template in (
    'Resultado de tu evaluación Mystery Shopper - {{promedio}} estrellas',
    'Resultado de tu evaluación Mystery Shopper - {{promedio}} estrellas '
  );

update automations
set body_template = 'Un **MysterFoodie** visitó su {{tipo_negocio}} sin avisar, **pagó su consumo y calificó de forma independiente** la experiencia real.{{mesero_linea}} Este es el resultado:',
    updated_at = now()
where key = 'resultado_visita'
  and body_template like 'Un **MysterFoodie** calificado de nuestra comunidad visitó recientemente su {{tipo_negocio}} sin previo aviso.%';

update automations
set body_template = 'Hola equipo de {{negocio}}. Un MysterFoodie visitó su {{tipo_negocio}} sin avisar, pagó su consumo y calificó de forma independiente la experiencia real.{{mesero_linea}} El resultado fue de {{promedio}} de 5 estrellas. Aquí lo puedes ver: {{link_reporte}}',
    updated_at = now()
where key = 'instagram_dm'
  and body_template like 'Hola equipo de {{negocio}}, hoy los visitamos%';

-- Revisa qué quedó:
select key, enabled, subject_template, body_template from automations where key in ('resultado_visita', 'instagram_dm');
