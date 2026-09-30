import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { listAutomations, updateAutomation } from "@/lib/automations";

/** Lista las automatizaciones (solo admin, ver /automatizaciones). */
export async function GET() {
  try {
    await requireRole("admin");
  } catch {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  const automations = await listAutomations();
  return NextResponse.json({ automations });
}

type PatchBody = {
  key?: string;
  enabled?: boolean;
  subjectTemplate?: string;
  bodyTemplate?: string;
};

/** Edita la plantilla o el enabled de una automatización (solo admin). */
export async function PATCH(req: NextRequest) {
  try {
    await requireRole("admin");
  } catch {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  let body: PatchBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  if (!body.key) {
    return NextResponse.json({ error: "Falta la automatización a editar" }, { status: 400 });
  }

  try {
    await updateAutomation(body.key, {
      enabled: body.enabled,
      subjectTemplate: body.subjectTemplate,
      bodyTemplate: body.bodyTemplate,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "No se pudo guardar" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
