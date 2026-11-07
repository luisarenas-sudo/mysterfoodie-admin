import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { getSupabaseServiceClient } from "@/lib/supabase";
import { isValidMonth } from "@/lib/months";
import { getPayoutRows } from "@/lib/payouts";
import { ROLE_LABELS } from "@/lib/brand";

/** Master Chef: descarga el reporte de pagos del mes en CSV (se abre en Excel) para hacer los depósitos. GET ?mes=2026-10 */
export async function GET(req: NextRequest) {
  try {
    await requireRole("admin");
  } catch {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  const month = req.nextUrl.searchParams.get("mes") ?? "";
  if (!isValidMonth(month)) return NextResponse.json({ error: "Mes no válido" }, { status: 400 });
  const rows = await getPayoutRows(getSupabaseServiceClient(), month);
  const q = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const lines = [
    ["Persona", "Rol", "Correo", "Visitas", "Perfiles", "A depositar", "Pagado"].map(q).join(","),
    ...rows.map((r) =>
      [r.name, ROLE_LABELS[r.role] ?? r.role, r.email ?? "", r.visitsAmount.toFixed(2), r.profilesAmount.toFixed(2), r.total.toFixed(2), r.paidAt ? new Date(r.paidAt).toLocaleDateString("es-MX", { timeZone: "America/Mexico_City" }) : "No"]
        .map(q)
        .join(",")
    ),
  ];
  return new NextResponse("﻿" + lines.join("\r\n"), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="pagos-${month}.csv"`, "Cache-Control": "no-store" },
  });
}
