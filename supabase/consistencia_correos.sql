-- Consistencia de tono y marca en los correos (3 nov 2026).
-- Regla: «ustedes» con el negocio («Hola equipo de X»), «tú» con personas; siempre «MysterFoodie» (no «mystery shopper»).
-- Estas filas ya están guardadas en Automatizaciones, por eso no basta cambiar el código. Cada UPDATE solo cambia la FRASE
-- indicada (replace) y únicamente si sigue presente: si personalizaste el resto del texto, no se toca. Idempotente.

-- Resultado: asunto en «ustedes»
update automations set subject_template = replace(subject_template, E'Resultado de tu visita MysterFoodie', E'Resultado de su visita MysterFoodie'), updated_at = now()
where key = 'resultado_visita' and position(E'Resultado de tu visita MysterFoodie' in subject_template) > 0;

-- Asignación al equipo: «MysterFoodie», no «Mystery Shopper»
update automations set body_template = replace(body_template, E'nueva visita Mystery Shopper', E'nueva visita MysterFoodie'), updated_at = now()
where key = 'asignacion_visita' and position(E'nueva visita Mystery Shopper' in body_template) > 0;

-- Cita al negocio en «ustedes» (1/2)
update automations set body_template = replace(body_template, E'Tu asesoría gratuita con MysterFoodie', E'Su asesoría gratuita con MysterFoodie'), updated_at = now()
where key = 'confirmacion_cita_negocio' and position(E'Tu asesoría gratuita con MysterFoodie' in body_template) > 0;

-- Cita al negocio en «ustedes» (2/2)
update automations set body_template = replace(body_template, E'Te llega una invitación de Google Calendar', E'Les llega una invitación de Google Calendar'), updated_at = now()
where key = 'confirmacion_cita_negocio' and position(E'Te llega una invitación de Google Calendar' in body_template) > 0;

-- DM de Instagram en «ustedes»
update automations set body_template = replace(body_template, E'Aquí lo puedes ver:', E'Aquí lo pueden ver:'), updated_at = now()
where key = 'instagram_dm' and position(E'Aquí lo puedes ver:' in body_template) > 0;

-- Ticket (oferta): «MysterFoodie»
update automations set body_template = replace(body_template, E'El mystery shopper que los visitó', E'El MysterFoodie que los visitó'), updated_at = now()
where key = 'ticket_oferta' and position(E'El mystery shopper que los visitó' in body_template) > 0;

-- Ticket (aviso): «MysterFoodie»
update automations set body_template = replace(body_template, E'El mystery shopper que los visitó', E'El MysterFoodie que los visitó'), updated_at = now()
where key = 'ticket_aviso' and position(E'El mystery shopper que los visitó' in body_template) > 0;

-- Ticket (aviso): asunto en «ustedes»
update automations set subject_template = replace(subject_template, E'Tu visita a', E'Su visita a'), updated_at = now()
where key = 'ticket_aviso' and position(E'Tu visita a' in subject_template) > 0;

-- Oferta del perfil: Passport primero (\U0001F451) y luego ID (\U0001FAAA)
update automations set body_template = replace(body_template, E'Nivel ID ({{precio_id}}): sus gustos, las palabras que más usa en sus reseñas, con cuántas personas sale, cuánto consume y el sector que representa.\nNivel Passport ({{precio_passport}}): además, su estilo de vida, demografía, movilidad y los medios que usa.', E'\U0001F451 Nivel Passport ({{precio_passport}}), el más completo y el que recomendamos: el buyer persona entero, con su estilo de vida, demografía, movilidad y los medios que usa, además de todo el nivel ID.\n\U0001FAAA Nivel ID ({{precio_id}}): sus gustos, las palabras que más usa en sus reseñas, con cuántas personas sale, cuánto consume y el sector que representa.'), updated_at = now()
where key = 'perfil_oferta' and position(E'Nivel ID ({{precio_id}}): sus gustos, las palabras que más usa en sus reseñas, con cuántas personas sale, cuánto consume y el sector que representa.\nNivel Passport ({{precio_passport}}): además, su estilo de vida, demografía, movilidad y los medios que usa.' in body_template) > 0;


-- Revisa qué quedó:
select key, left(subject_template, 60) as asunto, left(body_template, 80) as inicio from automations where key in ('resultado_visita','asignacion_visita','confirmacion_cita_negocio','instagram_dm','ticket_oferta','ticket_aviso','perfil_oferta') order by key;
