-- La asesoría gratuita se incluye con el reporte completo (se manda al día
-- siguiente de la compra). Actualiza el texto original del correo SOLO si
-- nadie lo ha personalizado en Automatizaciones (si ya lo editaste, no lo toca).
update automations
set body_template = E'Hola equipo de {{negocio}},\n\nGracias por obtener su reporte completo. Con él va incluida una asesoría gratuita de 20 minutos para platicar los resultados y algunas ideas para mejorar.\n\nElijan el horario que mejor les convenga aquí:\n{{link_agenda}}\n\nSaludos,\nMysterFoodie',
    updated_at = now()
where key = 'asesoria_gratuita'
  and body_template = E'Hola equipo de {{negocio}},\n\nAyer los visitamos con un Mystery Shopper y nos encantaría platicar un poco más sobre los resultados y algunas ideas para mejorar.\n\n¿Te gustaría agendar 20 minutos gratis para platicarlo? Elige el horario que mejor te convenga aquí:\n{{link_agenda}}\n\nSaludos,\nMysterFoodie';
