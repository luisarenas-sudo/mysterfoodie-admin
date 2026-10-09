import { getSupabaseServiceClient } from "@/lib/supabase";
import { getVerdict } from "@/lib/verdict";
import { PALABRA_FOODIE_QUOTE, foodieTrustText } from "@/lib/brand";
import { categoryScores, type Ratings } from "@/lib/scoring";
import {
  CATEGORIES,
  TOTAL_ITEM_COUNT,
  groupCategoryItems,
  type CategoryItem,
} from "@/lib/categories";
import { FULL_REPORT_PRICE_MXN } from "@/lib/mercadopago";
import { isCalendarConnected } from "@/lib/googleCalendar";
import AutoRefreshAfterPayment from "@/components/AutoRefreshAfterPayment";
import VerdictBadge from "@/components/VerdictBadge";
import FlancoCredit from "@/components/FlancoCredit";
import MobileReportePublico from "@/components/mobile/MobileReportePublico";
import CheckoutPayerForm from "@/components/CheckoutPayerForm";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

async function loadReport(shortCode: string) {
  let db;
  try {
    db = getSupabaseServiceClient();
  } catch {
    return "not_configured" as const;
  }

  const { data: form } = await db
    .from("forms")
    .select("id, overall_score, created_at, client_id, report_unlocked_at, menu_type, comments, ticket_photo_path")
    .eq("short_code", shortCode)
    .maybeSingle();

  if (!form) return null;

  // Página pública (la que abre el negocio/cliente desde el link corto) --
  // estas 3 consultas no dependen entre sí, así que se lanzan junto en vez
  // de esperarlas una por una para que cargue más rápido.
  const [{ data: client }, { data: ratingRows }, { data: flagRows }] = await Promise.all([
    db.from("clients").select("name, type, city").eq("id", form.client_id).maybeSingle(),
    db.from("form_ratings").select("category_key, score").eq("form_id", form.id),
    db.from("form_flags").select("flag_key, flag_value").eq("form_id", form.id),
  ]);

  const ratings: Ratings = {};
  (ratingRows || []).forEach((r) => {
    ratings[r.category_key] = r.score;
  });

  const flags: Record<string, boolean> = {};
  (flagRows || []).forEach((f) => {
    flags[f.flag_key] = f.flag_value;
  });

  return { form, client, catScores: categoryScores(ratings, flags), ratings, flags };
}

function StarsReadonly({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <svg
          key={n}
          viewBox="0 0 24 24"
          className={"h-4 w-4 " + (n <= value ? "fill-brand-500" : "fill-stone-200")}
          aria-hidden="true"
        >
          <path d="M12 2.5l2.9 6.06 6.6.78-4.86 4.6 1.27 6.56L12 17.3l-5.91 3.2 1.27-6.56L2.5 9.34l6.6-.78L12 2.5z" />
        </svg>
      ))}
      {value > 0 && <span className="ml-1 text-xs text-stone-500">{value}/5</span>}
    </div>
  );
}

function ItemValue({
  item,
  ratings,
  flags,
  menuType,
}: {
  item: CategoryItem;
  ratings: Ratings;
  flags: Record<string, boolean>;
  menuType: string | null;
}) {
  if (item.type === "star") {
    return <StarsReadonly value={ratings[item.key] || 0} />;
  }
  if (item.type === "boolean") {
    const value = Boolean(flags[item.key]);
    return (
      <span
        className={
          "rounded-full px-2 py-0.5 text-xs font-semibold " +
          (value ? "bg-green-100 text-green-700" : "bg-stone-200 text-stone-600")
        }
      >
        {value ? "Sí" : "No"}
      </span>
    );
  }
  if (item.type === "select" && item.options) {
    const opt = item.options.find((o) => o.value === menuType);
    return <span className="text-sm text-stone-600">{opt?.label ?? "—"}</span>;
  }
  return null;
}

function ItemRow({
  item,
  ratings,
  flags,
  menuType,
}: {
  item: CategoryItem;
  ratings: Ratings;
  flags: Record<string, boolean>;
  menuType: string | null;
}) {
  return (
    <div className="flex items-center justify-between card px-3 py-2">
      <span className="text-sm text-stone-700">{item.label}</span>
      <ItemValue item={item} ratings={ratings} flags={flags} menuType={menuType} />
    </div>
  );
}

function FullReportDetail({
  ratings,
  flags,
  menuType,
  comments,
  ticketHref,
}: {
  ratings: Ratings;
  flags: Record<string, boolean>;
  menuType: string | null;
  comments: string | null;
  ticketHref?: string | null;
}) {
  return (
    <div className="mt-10 space-y-8">
      <h2 className="heading text-xl text-ink">Detalle completo por indicador</h2>
      {CATEGORIES.map((cat) => (
        <div key={cat.key}>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-brand-600">
            {cat.label}
          </h3>
          <div className="mt-3 space-y-3">
            {groupCategoryItems(cat.items).map((block, blockIdx) =>
              block.kind === "standalone" ? (
                <div
                  key={`standalone-${blockIdx}`}
                  className="grid grid-cols-1 gap-2 sm:grid-cols-2"
                >
                  {block.items.map((item) => (
                    <ItemRow
                      key={item.key}
                      item={item}
                      ratings={ratings}
                      flags={flags}
                      menuType={menuType}
                    />
                  ))}
                </div>
              ) : (
                <div
                  key={`group-${block.group}-${blockIdx}`}
                  className="rounded-lg border border-stone-200 bg-stone-50 p-3"
                >
                  <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                    {block.group}
                  </p>
                  <div className="mt-2 space-y-3">
                    {block.subBlocks.map((sub, subIdx) => (
                      <div key={`sub-${subIdx}`}>
                        {sub.subgroup && (
                          <p className="mb-1 border-t border-stone-200 pt-2 text-xs font-medium text-stone-400">
                            {sub.subgroup}
                          </p>
                        )}
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          {sub.items.map((item) => (
                            <ItemRow
                              key={item.key}
                              item={item}
                              ratings={ratings}
                              flags={flags}
                              menuType={menuType}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      ))}
      {comments && comments.trim() && (
        <div className="card p-4">
          <p className="text-sm font-medium text-ink">Comentarios del mystery shopper</p>
          <p className="mt-2 whitespace-pre-wrap text-sm text-stone-600">{comments}</p>
        </div>
      )}
      {ticketHref && (
        <div className="card p-4">
          <p className="text-sm font-medium text-ink">Ticket de consumo</p>
          <a href={ticketHref} target="_blank" rel="noreferrer" className="mt-3 block overflow-hidden rounded-lg bg-stone-50">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={ticketHref} alt="Ticket de consumo de la visita" className="mx-auto max-h-[28rem] w-auto object-contain" />
          </a>
        </div>
      )}
    </div>
  );
}

export default async function ReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ shortCode: string }>;
  searchParams: Promise<{ pago?: string }>;
}) {
  const { shortCode } = await params;
  const { pago } = await searchParams;
  const data = await loadReport(shortCode);

  if (data === "not_configured") {
    return (
      <main className="mx-auto max-w-xl px-6 py-14">
        <p className="text-sm text-stone-600">
          Este sitio aún no tiene Supabase configurado, así que no se puede mostrar el reporte.
        </p>
      </main>
    );
  }

  if (!data) return notFound();

  const { form, client, catScores, ratings, flags } = data;
  const verdict = getVerdict(form.overall_score);
  const unlocked = Boolean(form.report_unlocked_at);
  const mercadopagoConfigured = Boolean(process.env.MERCADOPAGO_ACCESS_TOKEN);
  const contactWhatsapp = process.env.ADMIN_CONTACT_WHATSAPP;
  const whatsappFallbackLink = contactWhatsapp
    ? `https://wa.me/${contactWhatsapp}?text=${encodeURIComponent(
        `Hola, quiero el reporte completo de la evaluación de ${client?.name ?? ""} (código ${shortCode}).`
      )}`
    : null;

  const visibleCategories = catScores.filter((c) => c.count > 0);
  const paymentStatus = pago && ["exitoso", "pendiente", "fallido", "error"].includes(pago) ? pago : undefined;

  // La asesoría gratuita solo se ofrece si hay un calendario conectado (si
  // no, /agendar solo mostraría "no disponible").
  // La asesoría gratuita es parte del reporte completo: solo se ofrece (link a
  // agendar) cuando ya está desbloqueado; mientras tanto solo se menciona que
  // se incluye al comprarlo.
  let agendaHref: string | null = null;
  let agendaIncluded = false;
  try {
    const { connected } = await isCalendarConnected();
    if (connected) {
      if (unlocked) agendaHref = `/agendar/${shortCode}`;
      else agendaIncluded = true;
    }
  } catch {
    agendaHref = null;
  }

  return (
    <>
      <AutoRefreshAfterPayment active={!unlocked && (paymentStatus === "exitoso" || paymentStatus === "pendiente")} />
      <MobileReportePublico
        shortCode={shortCode}
        agendaHref={agendaHref}
        agendaIncluded={agendaIncluded}
        clientName={client?.name ?? "tu negocio"}
        overallScore={form.overall_score}
        categories={visibleCategories}
        unlocked={unlocked}
        price={FULL_REPORT_PRICE_MXN}
        mercadopagoConfigured={mercadopagoConfigured}
        whatsappFallbackLink={whatsappFallbackLink}
        paymentStatus={paymentStatus}
        ratings={ratings}
        flags={flags}
        menuType={form.menu_type}
        comments={form.comments}
        hasTicket={Boolean(form.ticket_photo_path)}
      />

    <main className="mx-auto hidden max-w-xl px-6 py-14 md:block">
      <p className="text-sm uppercase tracking-wide text-brand-600">MysterFoodie</p>
      <h1 className="heading mt-2 text-3xl text-ink">
        Resultado de la evaluación de {client?.name ?? "tu negocio"}
      </h1>
      <p className="mt-1 text-sm text-stone-500">
        Visita realizada el {new Date(form.created_at).toLocaleDateString("es-MX")}
      </p>

      {pago === "exitoso" && (
        <p className="mt-4 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          Pago recibido. Estamos preparando tu reporte: el detalle completo aparece aquí solo, en
          unos segundos.
        </p>
      )}
      {pago === "pendiente" && (
        <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Tu pago está en proceso. En cuanto se confirme, el detalle completo aparecerá aquí
          automáticamente.
        </p>
      )}
      {pago === "fallido" && (
        <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          El pago no se pudo completar. Puedes intentarlo de nuevo desde el botón de abajo.
        </p>
      )}
      {pago === "error" && (
        <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          Hubo un problema al iniciar el pago. Intenta de nuevo en unos minutos.
        </p>
      )}

      <div className="mt-6 card p-6 text-center">
        <p className="text-sm text-stone-500">Promedio general</p>
        <p className="text-5xl font-bold text-brand-600">{form.overall_score}</p>
        <p className="text-sm text-stone-500">de 5</p>
        <div className="mt-3 flex justify-center">
          <VerdictBadge score={form.overall_score} />
        </div>
        <p className="mx-auto mt-3 max-w-sm text-sm text-stone-500">{verdict.summary}</p>
      </div>

      {visibleCategories.length > 0 && (
        <div className="mt-6 grid grid-cols-2 gap-3">
          {visibleCategories.map((c) => (
            <div
              key={c.key}
              className="card p-4 text-center"
            >
              <p className="text-xs font-medium uppercase tracking-wide text-stone-500">
                {c.label}
              </p>
              <p className="mt-1 text-2xl font-bold" style={{ color: getVerdict(c.average).color }}>
                {c.average}
              </p>
              <p className="text-xs text-stone-400">de 5</p>
            </div>
          ))}
        </div>
      )}

      {unlocked ? (
        <FullReportDetail
          ratings={ratings}
          flags={flags}
          menuType={form.menu_type}
          comments={form.comments}
          ticketHref={form.ticket_photo_path ? `/r/${shortCode}/ticket` : null}
        />
      ) : (
        <div className="mt-8 rounded-lg border border-brand-100 bg-brand-50 p-6 text-center">
          <p className="font-medium text-ink">Este es un resumen por categoría.</p>
          <p className="mt-2 font-medium text-ink">
            El reporte completo incluye el detalle de los {TOTAL_ITEM_COUNT} indicadores
            evaluados dentro de cada categoría y los comentarios del mystery shopper
            {form.ticket_photo_path ? ", además del ticket de consumo de la visita" : ""}.
          </p>
          {agendaIncluded && (
            <p className="mt-2 text-sm text-stone-600">
              Incluye una asesoría gratuita de 20 minutos para platicar qué mover primero.
            </p>
          )}
          {mercadopagoConfigured ? (
            <CheckoutPayerForm shortCode={shortCode} price={FULL_REPORT_PRICE_MXN} />
          ) : whatsappFallbackLink ? (
            <a
              href={whatsappFallbackLink}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-block rounded-md bg-brand-gradient px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90"
            >
              Solicitar el reporte completo
            </a>
          ) : (
            <p className="mt-4 text-sm text-stone-600">
              Para solicitar el reporte completo, contacta a MysterFoodie.
            </p>
          )}
        </div>
      )}

      {agendaHref && (
        <div className="mt-8 rounded-lg border border-stone-200 bg-white p-5 text-center">
          <p className="font-semibold text-ink">¿Quieres mejorar tu calificación?</p>
          <p className="mt-1 text-sm text-stone-500">
            Agenda una asesoría gratuita y platicamos qué mover primero.
          </p>
          <a
            href={agendaHref}
            className="mt-3 inline-block rounded-md bg-brand-gradient px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90"
          >
            Agendar asesoría
          </a>
        </div>
      )}

      <div className="mt-10 rounded-xl p-6" style={{ background: "#1C1C1E" }}>
        <h3 className="heading text-lg font-bold uppercase tracking-wide text-white">Palabra Foodie</h3>
        <p className="mt-2 text-sm italic leading-relaxed text-white/85">
          &ldquo;{PALABRA_FOODIE_QUOTE}&rdquo;
        </p>
        <p className="mt-3 text-sm leading-relaxed text-white/55">
          {foodieTrustText(TOTAL_ITEM_COUNT)}
        </p>
      </div>

      <p className="mt-6 text-center">
        <FlancoCredit className="text-xs" color="#a8a29e" />
      </p>
    </main>
    </>
  );
}
