-- Consistencia de tono (3 nov 2026), parte 2: correos de ACTIVACIÓN DE CUENTA y ASESORÍA al negocio.
-- Regla: «ustedes» con el negocio; «MysterFoodie», no «mystery shopper». Cada UPDATE cambia solo la FRASE indicada y solo si sigue
-- presente (si personalizaste el resto, no se toca). Idempotente.

update automations set subject_template = replace(subject_template, E'Activa tu cuenta en MysterFoodie', E'Activen su cuenta en MysterFoodie'), updated_at = now()
where key = 'activacion_cuenta_negocio' and position(E'Activa tu cuenta en MysterFoodie' in subject_template) > 0;

update automations set body_template = replace(body_template, E'Ya puedes crear tu cuenta en MysterFoodie para ver el historial de visitas de tu negocio, pedir nuevas visitas programadas y revisar tus reportes cuando quieras.', E'Ya pueden crear su cuenta en MysterFoodie para ver el historial de visitas de su negocio, pedir nuevas visitas programadas y revisar sus reportes cuando quieran.'), updated_at = now()
where key = 'activacion_cuenta_negocio' and position(E'Ya puedes crear tu cuenta en MysterFoodie para ver el historial de visitas de tu negocio, pedir nuevas visitas programadas y revisar tus reportes cuando quieras.' in body_template) > 0;

update automations set body_template = replace(body_template, E'Entra aquí para crear tu contraseña (o puedes continuar con tu cuenta de Google desde la misma pantalla):', E'Entren aquí para crear su contraseña (o continúen con su cuenta de Google desde la misma pantalla):'), updated_at = now()
where key = 'activacion_cuenta_negocio' and position(E'Entra aquí para crear tu contraseña (o puedes continuar con tu cuenta de Google desde la misma pantalla):' in body_template) > 0;

-- Asesoría (seguimiento): «MysterFoodie», no «Mystery Shopper»
update automations set body_template = replace(replace(body_template, E'un Mystery Shopper', E'un MysterFoodie'), E'el Mystery Shopper', E'el MysterFoodie'), updated_at = now()
where key = 'asesoria_gratuita' and (position(E'un Mystery Shopper' in body_template) > 0 or position(E'el Mystery Shopper' in body_template) > 0);

-- Revisa qué quedó (busca «tu/tus/te» o «mystery» que aún sobren en correos al negocio):
select key, subject_template, body_template from automations where key in ('activacion_cuenta_negocio','asesoria_gratuita','confirmacion_cita_negocio','solicitud_recibida') order by key;
