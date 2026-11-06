import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/auth";
import { getSupabaseServiceClient } from "@/lib/supabase";
import { ADULT_REQUIRED_MESSAGE, COLLAB_REQUIRED_MESSAGE, isTeamAccount, needsTermsAcceptance, recordTermsAcceptance } from "@/lib/terms";

export const dynamic = "force-dynamic";

/**
 * Para quien ya tiene sesión (links de invitación o recuperación de Supabase):
 *  - GET: ¿falta aceptar los términos?
 *  - POST {accept: true}: deja constancia de la aceptación.
 */
async function currentUserId(): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

export async function GET() {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "Sin sesión" }, { status: 401 });
  const db = getSupabaseServiceClient();
  return NextResponse.json({ needed: await needsTermsAcceptance(db, userId), isTeam: await isTeamAccount(db, userId) });
}

export async function POST(req: NextRequest) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "Sin sesión" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { accept?: unknown; confirmAdult?: unknown; acceptCollab?: unknown } | null;
  if (body?.accept !== true) {
    return NextResponse.json({ error: "Debes aceptar los términos y condiciones del servicio." }, { status: 400 });
  }
  if (body.confirmAdult !== true) {
    return NextResponse.json({ error: ADULT_REQUIRED_MESSAGE }, { status: 400 });
  }
  if ((await isTeamAccount(getSupabaseServiceClient(), userId)) && body.acceptCollab !== true) {
    return NextResponse.json({ error: COLLAB_REQUIRED_MESSAGE }, { status: 400 });
  }
  const ok = await recordTermsAcceptance(getSupabaseServiceClient(), userId, "sesion");
  return NextResponse.json({ ok });
}
