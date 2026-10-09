import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { getSupabaseServiceClient } from "@/lib/supabase";

/**
 * Exporta la lista de espera de la Foodie Academy en CSV (solo Master Chef).
 * Útil el día que abra la Academy: ?pendientes=1 trae solo a quienes aún no se
 * les avisa (notified_at vacío).
 */
export async function GET(req: Request) {
  try {
    await requireRole("admin");
  } catch {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  const soloPendientes = new URL(req.url).searchParams.get("pendientes") === "1";
  const db = getSupabaseServiceClient();
  let q = db.from("academy_waitlist").select("email, source, created_at, confirmation_sent_at, notified_at").order("created_at", { ascending: true });
  if (soloPendientes) q = q.is("notified_at", null);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = ["correo,origen,registro,confirmacion_enviada,avisado"];
  for (const r of data || []) lines.push([r.email, r.source, r.created_at, r.confirmation_sent_at, r.notified_at].map(esc).join(","));
  return new NextResponse("﻿" + lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="foodie-academy-${soloPendientes ? "pendientes" : "lista"}.csv"`,
    },
  });
}
