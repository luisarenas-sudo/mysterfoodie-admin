import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { getSupabaseServiceClient } from "@/lib/supabase";
import { buildMysterfoodieProfile } from "@/lib/mysterfoodieProfile";
import MysterfoodieProfileView from "@/components/negocio/MysterfoodieProfileView";

export const dynamic = "force-dynamic";

/** Vista previa para el Master Chef del perfil anónimo que verían los negocios al comprarlo. */
export default async function PerfilAnonimoPreview({ params }: { params: Promise<{ formId: string }> }) {
  await requireRole("admin");
  const { formId } = await params;
  const db = getSupabaseServiceClient();
  const { data: form } = await db.from("forms").select("created_by").eq("id", formId).maybeSingle();
  if (!form?.created_by) notFound();
  const profile = await buildMysterfoodieProfile(form.created_by);
  if (!profile) notFound();
  return (
    <main className="mx-auto max-w-3xl px-4 py-6 md:px-6 md:py-10">
      <Link href={`/visitas/${formId}`} className="text-sm font-semibold" style={{ color: "#F24444" }}>
        ← Visita
      </Link>
      <p className="mt-3 rounded-xl px-4 py-2 text-[13px]" style={{ background: "#FFF6E0", color: "#9A6A00" }}>
        Vista previa de Master Chef: así lo ve un negocio que compra el perfil.
      </p>
      <div className="mt-4">
        <MysterfoodieProfileView profile={profile} />
      </div>
    </main>
  );
}
