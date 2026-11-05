-- Indicadores líderes (nov 2026): contexto de la visita, «¿volverías?», facturación y servicio a domicilio.
-- Correr una vez en el SQL editor de Supabase. Es seguro volver a correrlo.

-- Contexto de la visita (se captura en el primer paso y con sellos de hora durante la visita).
alter table forms add column if not exists visit_started_at timestamptz;
alter table forms add column if not exists visit_ended_at timestamptz;
-- {"atendido": "2026-11-05T20:41:00Z", "bebida": "...", "platillo": "...", "cuenta": "..."}
alter table forms add column if not exists service_stamps jsonb;
-- vacio | poca | media | llena | espera
alter table forms add column if not exists occupancy text;
-- «¿Volverías?» de 1 a 10 (no entra al promedio de categorías).
alter table forms add column if not exists would_return smallint;
-- Facturación, se contesta junto a la foto del ticket: si | no | no_ofrecio
alter table forms add column if not exists invoice_offered text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'forms_would_return_range') then
    alter table forms add constraint forms_would_return_range check (would_return is null or would_return between 1 and 10);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'forms_invoice_offered_values') then
    alter table forms add constraint forms_invoice_offered_values check (invoice_offered is null or invoice_offered in ('si', 'no', 'no_ofrecio'));
  end if;
end $$;

-- Servicio a domicilio del negocio (se pregunta al darlo de alta).
alter table clients add column if not exists delivery_phone boolean not null default false;
alter table clients add column if not exists delivery_whatsapp boolean not null default false;
alter table clients add column if not exists delivery_app boolean not null default false;
