import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabase";
import { accessUrl, issueAccessToken, secondsSinceLastToken } from "@/lib/accessTokens";
import { sendRecoveryEmail } from "@/lib/accessEmails";

export const dynamic = "force-dynamic";

/**
 * Pública: "Olvidé mi contraseña" y "Pide uno nuevo". Siempre responde ok
 * (no revela si el correo existe) y no manda más de un correo por minuto
 * a la misma persona.
 */
export async function POST(req: NextRequest) {
  let body: { email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const email = (body.email || "").trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Ingresa tu correo." }, { status: 400 });
  }

  try {
    const db = getSupabaseServiceClient();
    const { data: profile } = await db.from("profiles").select("id, email, full_name").eq("email", email).maybeSingle();
    if (profile) {
      const since = await secondsSinceLastToken(db, profile.id as string);
      if (since === null || since > 60) {
        const baseUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;
        const { token, code } = await issueAccessToken(db, { userId: profile.id as string, email, purpose: "recovery" });
        await sendRecoveryEmail({
          to: email,
          name: profile.full_name as string | null,
          url: accessUrl(baseUrl, token),
          code,
          baseUrl,
        });
      }
    }
  } catch {
    // Misma respuesta de siempre: no se filtra nada.
  }
  return NextResponse.json({ ok: true });
}
