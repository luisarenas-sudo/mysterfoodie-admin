import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabase";
import { requireRole } from "@/lib/auth";
import { BUSINESS_TYPES } from "@/lib/categories";

type Body = {
  name: string;
  type: string;
  city?: string;
  contactName?: string;
  phone?: string;
  instagramHandle?: string;
  email?: string;
  address?: string;
  autoEmailEnabled?: boolean;
  hasWebsite?: boolean;
  hasGoogleBusiness?: boolean;
  hasProfessionalPhotos?: boolean;
  hasReels?: boolean;
};

/**
 * Alta directa de un negocio (sin pasar por el wizard de visita), usada
 * por la pantalla móvil "Nuevo negocio". Solo admin: mismo criterio que
 * /negocios en middleware.ts.
 */
export async function POST(req: NextRequest) {
  try {
    await requireRole("admin");
  } catch {
    return NextResponse.json(
      { error: "Necesitas iniciar sesión como admin para dar de alta un negocio" },
      { status: 401 }
    );
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const name = body.name?.trim();
  if (!name) {
    return NextResponse.json({ error: "Falta el nombre del negocio" }, { status: 400 });
  }

  const type = BUSINESS_TYPES.some((t) => t.value === body.type) ? body.type : "restaurante";

  let db;
  try {
    db = getSupabaseServiceClient();
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Supabase no configurado" },
      { status: 500 }
    );
  }

  const { data: newClient, error } = await db
    .from("clients")
    .insert({
      name,
      type,
      city: body.city?.trim() || null,
      contact_name: body.contactName?.trim() || null,
      phone: body.phone?.trim() || null,
      instagram_handle: body.instagramHandle?.trim().replace(/^@/, "") || null,
      email: body.email?.trim() || null,
      address: body.address?.trim() || null,
      auto_email_enabled: body.autoEmailEnabled ?? true,
      has_website: Boolean(body.hasWebsite),
      has_google_business: Boolean(body.hasGoogleBusiness),
      has_professional_photos: Boolean(body.hasProfessionalPhotos),
      has_reels: Boolean(body.hasReels),
    })
    .select("id")
    .single();

  if (error || !newClient) {
    return NextResponse.json(
      { error: error?.message || "No se pudo crear el negocio" },
      { status: 500 }
    );
  }

  return NextResponse.json({ id: newClient.id });
}
