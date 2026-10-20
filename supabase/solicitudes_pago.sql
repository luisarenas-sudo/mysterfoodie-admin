-- Visita programada con pago en línea (Mercado Pago), 20 oct 2026.
-- El negocio desbloquea "visita asegurada" en el formulario de mysterfoodie.com y paga de una vez ($850 sin IVA;
-- el consumo se acuerda aparte). external_reference del pago: "visita:<visit_requests.id>".
alter table public.visit_requests
  add column if not exists paid_at timestamptz,
  add column if not exists payment_id text,
  add column if not exists payment_amount numeric;

comment on column public.visit_requests.paid_at is 'Cuándo Mercado Pago aprobó el pago de la visita programada (null = sin pagar).';
