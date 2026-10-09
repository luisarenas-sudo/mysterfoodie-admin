import { NextRequest, NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/auth";
import { getSupabaseServiceClient } from "@/lib/supabase";

/** Cierra un aviso de Pendientes (la X). Solo afecta a quien lo cierra. */
export async function POST(req: NextRequest) {
  const profile = await getSessionProfile();
  if (!profile) return NextResponse.json({ error: "Necesitas iniciar sesión" }, { status: 401 });

  let body: { key?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const key = body.key?.trim();
  if (!key || key.length > 200) return NextResponse.json({ error: "Aviso no válido" }, { status: 400 });

  const db = getSupabaseServiceClient();
  const { error } = await db
    .from("alert_dismissals")
    .upsert({ user_id: profile.userId, alert_key: key, dismissed_at: new Date().toISOString() }, { onConflict: "user_id,alert_key" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
