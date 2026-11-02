import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabase";

/**
 * Baja de los recordatorios del reporte (enlace del pie de esos correos). El GET solo muestra un botón de confirmación,
 * para que un antivirus o la vista previa del correo que abren los enlaces no den de baja sin querer; el POST la aplica.
 */
const VALID = /^[A-Za-z0-9_-]{3,32}$/;

function page(inner: string) {
  return new NextResponse(
    `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>MysterFoodie</title></head>` +
      `<body style="font-family:system-ui,sans-serif;background:#f2f2f7;margin:0;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:24px">` +
      `<div style="max-width:420px;background:#fff;border-radius:18px;padding:28px;text-align:center"><p style="font-size:34px;margin:0">🍽️</p>${inner}</div></body></html>`,
    { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } }
  );
}

export async function GET(req: NextRequest) {
  const code = (req.nextUrl.searchParams.get("c") || "").trim();
  if (!VALID.test(code)) return page(`<p style="font-size:17px;font-weight:700;color:#1c1c1e;margin:10px 0 0">Enlace no válido.</p>`);
  return page(
    `<p style="font-size:17px;font-weight:700;color:#1c1c1e;margin:10px 0 0">¿No quieres recibir más mensajes sobre este resultado?</p>` +
      `<form method="post" action="/api/reportes/baja?c=${encodeURIComponent(code)}" style="margin-top:18px">` +
      `<button type="submit" style="background:#f24444;color:#fff;border:0;border-radius:12px;padding:13px 22px;font-size:15px;font-weight:700;cursor:pointer">Sí, no más mensajes</button></form>`
  );
}

export async function POST(req: NextRequest) {
  const code = (req.nextUrl.searchParams.get("c") || "").trim();
  if (!VALID.test(code)) return page(`<p style="font-size:17px;font-weight:700;color:#1c1c1e;margin:10px 0 0">Enlace no válido.</p>`);
  const { error } = await getSupabaseServiceClient()
    .from("forms")
    .update({ followup_optout_at: new Date().toISOString() })
    .eq("short_code", code)
    .is("followup_optout_at", null);
  if (error) {
    return page(`<p style="font-size:17px;font-weight:700;color:#1c1c1e;margin:10px 0 0">No pudimos procesar la baja.</p><p style="font-size:13.5px;color:#6b7280;margin:10px 0 0">Escríbenos a hola@mysterfoodie.com y lo resolvemos.</p>`);
  }
  return page(
    `<p style="font-size:17px;font-weight:700;color:#1c1c1e;margin:10px 0 0">Listo, ya no te enviaremos más mensajes sobre este resultado.</p>` +
      `<p style="font-size:13.5px;color:#6b7280;margin:10px 0 0">Gracias por habernos dejado visitarte. Si algún día quieres retomarlo: hola@mysterfoodie.com.</p>`
  );
}
