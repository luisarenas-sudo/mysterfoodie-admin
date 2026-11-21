-- Aviso de privacidad en el correo de resultado y el DM de Instagram (21 nov 2026).
-- Regla: el primer contacto con el negocio (correo de resultado, DM) debe avisar que el
-- resultado es privado, solo para ellos -- no es público. Frase acordada con Luis:
-- "Es un resultado privado, solo para ustedes."
-- Estas filas ya están guardadas en Automatizaciones (solo si Luis las personalizó), por eso
-- no basta cambiar el código. Cada UPDATE solo agrega la frase si el texto base sigue
-- presente (si personalizaste el resto, no se toca) y solo si la frase no está ya. Idempotente.

-- Correo de resultado (resultado_visita): justo antes de "Este es el resultado:"
update automations set body_template = replace(
  body_template,
  E'Este es el resultado:',
  E'Es un resultado privado, solo para ustedes. Este es el resultado:'
), updated_at = now()
where key = 'resultado_visita'
  and position(E'Este es el resultado:' in body_template) > 0
  and position(E'Es un resultado privado, solo para ustedes.' in body_template) = 0;

-- DM de Instagram (instagram_dm): justo antes de "Aquí lo pueden ver:"
update automations set body_template = replace(
  body_template,
  E'Aquí lo pueden ver:',
  E'Es un resultado privado, solo para ustedes. Aquí lo pueden ver:'
), updated_at = now()
where key = 'instagram_dm'
  and position(E'Aquí lo pueden ver:' in body_template) > 0
  and position(E'Es un resultado privado, solo para ustedes.' in body_template) = 0;

-- Revisa qué quedó:
select key, left(body_template, 140) as inicio from automations where key in ('resultado_visita','instagram_dm') order by key;
