import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabase";
import { buildFormReportPdf } from "@/lib/fullReportDelivery";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Descarga del reporte completo en PDF desde el link público. Solo existe para el demo GRATIS
 * (el negocio recibe el reporte completo sin pasar por Mercado Pago): el PDF lleva la marca de agua GRATIS.
 * Las visitas pagadas reciben su PDF por correo.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ shortCode: string }> }) {
  const { shortCode } = await params;
  const db = getSupabaseServiceClient();
  const { data: form } = await db
    .from("forms")
    .select("id, overall_score, created_at, client_id, report_url, short_code, report_unlocked_at, free_demo")
    .eq("short_code", shortCode)
    .maybeSingle();
  if (!form || !form.free_demo || !form.report_unlocked_at) {
    return NextResponse.json({ error: "No disponible" }, { status: 404 });
  }

  try {
    const { pdf, businessName } = await buildFormReportPdf(
      db,
      {
        id: form.id as string,
        overall_score: Number(form.overall_score),
        client_id: form.client_id as string,
        report_url: (form.report_url as string | null) ?? null,
        short_code: form.short_code as string,
        created_at: form.created_at as string,
      },
      { demo: true }
    );
    const safeName = businessName.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "") || "negocio";
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="reporte-completo-${safeName}.pdf"`,
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (err) {
    console.error("No se pudo generar el PDF del demo gratis:", err);
    return NextResponse.json({ error: "No se pudo generar el PDF. Intenta de nuevo." }, { status: 500 });
  }
}
