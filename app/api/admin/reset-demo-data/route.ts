import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { requireRole } from "@/lib/auth";
import { getSupabaseServiceClient } from "@/lib/supabase";
import { STAR_ITEMS, fullItemLabel } from "@/lib/categories";
import { overallScore, type Ratings } from "@/lib/scoring";

/**
 * Boton de un solo uso para admin (ver /perfil): borra TODOS los
 * negocios y visitas que haya en este momento -- a peticion explicita
 * de Luis, porque lo que hay hoy es data de prueba generada mientras
 * se armaba la app -- y los reemplaza por 3 negocios de ejemplo con
 * varias visitas cada uno, firmadas por "Foodies" ficticios que nunca
 * existieron como cuenta real (created_by = null a proposito).
 *
 * Por que created_by = null y no un created_by inventado: cualquier
 * calculo de ventas/comisiones a futuro (ver /admin/finanzas) agrupa
 * por el agente/sibarita REAL que vendio o visito. Una visita sin
 * dueno real simplemente no entra en ese agrupamiento, asi que estos
 * datos de relleno nunca se mezclan con ganancias reales sin tener
 * que inventar una columna "es_demo" aparte.
 *
 * Irreversible -- por eso vive detras de DeleteButton (confirmacion
 * de dos pasos) en vez de ser un boton de un solo clic.
 *
 * Borra en el mismo orden "a mano" que ya usa DELETE
 * /api/clients/[id] (la base no tiene cascada real en producción,
 * aunque supabase/schema.sql diga "on delete cascade" en varias
 * tablas -- ver ese endpoint para la referencia de este orden).
 */

type DemoVisit = {
  shopper: string;
  unlock: boolean;
  seed: number;
};

type DemoClient = {
  name: string;
  type: string;
  city: string;
  visits: DemoVisit[];
};

const DEMO_CLIENTS: DemoClient[] = [
  {
    name: "Fonda El Portal (ejemplo)",
    type: "restaurante",
    city: "Veracruz",
    visits: [
      { shopper: "Vale R. (Foodie de ejemplo)", unlock: true, seed: 1 },
      { shopper: "Memo T. (Foodie de ejemplo)", unlock: false, seed: 2 },
    ],
  },
  {
    name: "Taqueria La Esquina (ejemplo)",
    type: "restaurante",
    city: "Boca del Rio",
    visits: [
      { shopper: "Vale R. (Foodie de ejemplo)", unlock: false, seed: 3 },
      { shopper: "Caro N. (Foodie de ejemplo)", unlock: false, seed: 4 },
      { shopper: "Memo T. (Foodie de ejemplo)", unlock: true, seed: 5 },
    ],
  },
  {
    name: "Cafe Marola (ejemplo)",
    type: "cafeteria",
    city: "Xalapa",
    visits: [{ shopper: "Caro N. (Foodie de ejemplo)", unlock: true, seed: 6 }],
  },
];

/** Calificaciones variadas pero deterministas (3-5 estrellas, algun 2
 * ocasional) para que las 3 cuentas de ejemplo no se vean identicas
 * ni perfectas. */
function demoRatings(seed: number): Ratings {
  const ratings: Ratings = {};
  STAR_ITEMS.forEach((item, i) => {
    const v = ((seed * 7 + i * 3) % 5) + 1;
    ratings[item.key] = Math.max(2, v);
  });
  return ratings;
}

export async function DELETE() {
  try {
    await requireRole("admin");
  } catch {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  let db;
  try {
    db = getSupabaseServiceClient();
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Supabase no configurado" },
      { status: 500 }
    );
  }

  // La base NO borra en cascada en la práctica (ver DELETE
  // /api/clients/[id], que borra todo a mano en este mismo orden) así
  // que aquí se replica el mismo orden: primero lo que depende de
  // "forms", luego "forms", luego lo que depende directo de
  // "clients", y al final "clients" -- para nunca violar una foreign
  // key al borrar TODOS los negocios de un jalón.
  const { data: allForms } = await db.from("forms").select("id");
  const allFormIds = (allForms || []).map((f) => f.id);

  if (allFormIds.length > 0) {
    await db.from("form_ratings").delete().in("form_id", allFormIds);
    await db.from("form_flags").delete().in("form_id", allFormIds);
    await db.from("email_confirmations").delete().in("form_id", allFormIds);
    await db.from("report_payments").delete().in("form_id", allFormIds);
    await db.from("consultation_bookings").delete().in("form_id", allFormIds);
  }

  await db.from("visit_assignments").delete().not("id", "is", null);
  await db.from("consultation_bookings").delete().not("id", "is", null);

  if (allFormIds.length > 0) {
    const { error: formsDeleteError } = await db.from("forms").delete().in("id", allFormIds);
    if (formsDeleteError) {
      return NextResponse.json({ error: formsDeleteError.message }, { status: 500 });
    }
  }

  const { error: deleteError } = await db.from("clients").delete().not("id", "is", null);
  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  const created: string[] = [];

  for (const demoClient of DEMO_CLIENTS) {
    const { data: client, error: clientError } = await db
      .from("clients")
      .insert({ name: demoClient.name, type: demoClient.type, city: demoClient.city })
      .select("id")
      .single();

    if (clientError || !client) {
      return NextResponse.json(
        { error: clientError?.message || "No se pudo crear un negocio de ejemplo", created },
        { status: 500 }
      );
    }

    for (const visit of demoClient.visits) {
      const ratings = demoRatings(visit.seed);
      const score = overallScore(ratings);
      const shortCode = nanoid(8);

      const { data: form, error: formError } = await db
        .from("forms")
        .insert({
          client_id: client.id,
          shopper_name: visit.shopper,
          overall_score: score,
          short_code: shortCode,
          status: "completado",
          created_by: null,
          report_unlocked_at: visit.unlock ? new Date().toISOString() : null,
        })
        .select("id")
        .single();

      if (formError || !form) {
        return NextResponse.json(
          { error: formError?.message || "No se pudo crear una visita de ejemplo", created },
          { status: 500 }
        );
      }

      const ratingRows = STAR_ITEMS.map((item) => ({
        form_id: form.id,
        category_key: item.key,
        category_label: fullItemLabel(item),
        score: ratings[item.key],
      }));
      await db.from("form_ratings").insert(ratingRows);
    }

    created.push(demoClient.name);
  }

  return NextResponse.json({ ok: true, created });
}
