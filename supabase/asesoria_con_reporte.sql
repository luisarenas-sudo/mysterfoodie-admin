-- La asesoría gratuita se incluye con el reporte completo (se manda al día
-- siguiente de la compra). Actualiza el texto original del correo SOLO si
-- nadie lo ha personalizado en Automatizaciones (si ya lo editaste, no lo toca).
update automations
set body_template = E'Hola equipo de {{negocio}},\n\nGracias por obtener su reporte completo. Con él va incluida una asesoría gratuita de 20 minutos para platicar los resultados y algunas ideas para mejorar.\n\nElijan el horario que mejor les convenga aquí:\n{{link_agenda}}\n\nSaludos,\nMysterFoodie',
    updated_at = now()
where key = 'asesoria_gratuita'
  and body_template like 'Hola equipo de {{negocio}}%Ayer los visitamos con un Mystery Shopper%'
  and body_template not like '%reporte completo%';
