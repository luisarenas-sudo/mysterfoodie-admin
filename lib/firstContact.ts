import type { getSupabaseServiceClient } from "./supabase";
import { GLOSARIO_NEGOCIO, type GlosarioKey } from "./glosario";

type Db = ReturnType<typeof getSupabaseServiceClient>;

/**
 * ¿Este correo de resultado es el primero que recibe esa dirección? Si es así, va con el
 * bloque "Nuestro mundo" (qué es un MysterFoodie, los planes...). Se mira el registro de
 * correos; `excludeFormId` evita contar el propio correo cuando se reenvía.
 */
export async function glosarioIfFirstEmail(db: Db, email: string, excludeFormId?: string): Promise<GlosarioKey[] | undefined> {
  try {
    let q = db.from("email_confirmations").select("id", { count: "exact", head: true }).ilike("recipient_email", email);
    if (excludeFormId) q = q.neq("form_id", excludeFormId);
    const { count, error } = await q;
    if (error) return GLOSARIO_NEGOCIO; // ante la duda, mejor explicar de más
    return (count ?? 0) === 0 ? GLOSARIO_NEGOCIO : undefined;
  } catch {
    return GLOSARIO_NEGOCIO;
  }
}
