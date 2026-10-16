-- Auditoría de textos web/app (16 oct 2026): unifica "Myster Foodie" -> "MysterFoodie"
-- en el correo "resultado_visita" ya guardado en Automatizaciones. Solo cambia la
-- ortografía de la marca; el resto del texto (aunque lo hayas editado) queda igual.
update automations
set body_template = replace(body_template, 'Myster Foodie', 'MysterFoodie'),
    updated_at = now()
where key = 'resultado_visita'
  and body_template like '%Myster Foodie%';
