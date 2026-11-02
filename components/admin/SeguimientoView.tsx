import Link from "next/link";
import type { ReactNode } from "react";
import { Pix } from "@/components/ui/Pix";
import type { Seguimiento } from "@/lib/seguimiento";
import { CHANNEL_LABEL } from "@/lib/webStats";

/**
 * Perfil > Stats (solo Master Chef). Cada sección lleva su emoji para ubicarse de un vistazo.
 * Server component: HTML sin librerías, se ve igual en celular y escritorio.
 */
const RED = "#F24444";
const INK_SOFT = "rgba(60,60,67,0.6)";
const GRID = "rgba(60,60,67,0.1)";
const UP = "#248A3D";

const SOURCE_LABEL: Record<string, string> = {
  nav: "Menú de arriba",
  inicio: "Botón principal del Inicio",
  servicios: "Página de Servicios",
  footer: "Pie de página",
  pagina: "Página de la solicitud",
  nosotros: "Página de Nosotros",
  otra: "Otro / sin dato",
};

const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("es-MX", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "America/Mexico_City" }) : "—";
const pct = (n: number, d: number) => (d > 0 ? `${Math.round((n / d) * 100)}%` : "—");

function Section({ emoji, title, sub, children }: { emoji: string; title: string; sub?: string; children: ReactNode }) {
  return (
    <section className="card mb-4 p-4">
      <h2 className="flex items-center gap-2 text-[17px] font-bold leading-tight">
        <Pix e={emoji} size={22} /> {title}
      </h2>
      {sub && (
        <p className="mt-1 text-[12.5px] leading-snug" style={{ color: INK_SOFT }}>
          {sub}
        </p>
      )}
      <div className="mt-3.5">{children}</div>
    </section>
  );
}

const Missing = ({ children }: { children: ReactNode }) => (
  <p className="rounded-[12px] px-3.5 py-3 text-[13.5px]" style={{ background: "rgba(255,149,0,0.12)", color: "#8A5200" }}>
    {children}
  </p>
);

function Tile({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="min-w-0 rounded-[14px] px-3 py-2.5" style={{ background: "rgba(60,60,67,0.05)" }}>
      <div className="text-[12px] font-medium leading-tight" style={{ color: INK_SOFT }}>
        {label}
      </div>
      <div className="heading mt-1 text-[24px] font-bold leading-none">{value}</div>
      {hint && (
        <div className="mt-1 text-[11.5px] leading-tight" style={{ color: INK_SOFT }}>
          {hint}
        </div>
      )}
    </div>
  );
}

function Bars({ rows, color = RED }: { rows: { label: string; n: number; note?: string; sub?: string }[]; color?: string }) {
  const top = Math.max(1, ...rows.map((r) => r.n));
  if (rows.length === 0) return <p className="text-[13px]" style={{ color: INK_SOFT }}>Sin datos en este periodo.</p>;
  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <div key={r.label}>
          <div className="flex items-baseline justify-between gap-3 text-[13.5px]">
            <span className="min-w-0 font-semibold leading-snug [overflow-wrap:anywhere]">{r.label}</span>
            <span className="flex-shrink-0 whitespace-nowrap font-bold">
              {r.n}
              {r.note && (
                <span className="ml-1.5 text-[12px] font-normal" style={{ color: INK_SOFT }}>
                  {r.note}
                </span>
              )}
            </span>
          </div>
          <div className="mt-1 h-2.5 overflow-hidden rounded-full" style={{ background: GRID }}>
            <div className="h-full rounded-full" style={{ width: `${Math.round((r.n / top) * 100)}%`, background: color }} />
          </div>
          {r.sub && (
            <div className="mt-0.5 text-[11.5px] leading-snug" style={{ color: INK_SOFT }}>
              {r.sub}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function Funnel({ f }: { f: NonNullable<Seguimiento["funnel"]> }) {
  const steps = [
    { label: "Visitas con reporte", n: f.sent, note: "Resultado enviado al negocio" },
    { label: "Abrieron el reporte", n: f.opened, note: "Entraron al enlace" },
    ...(f.email !== null ? [{ label: "Dejaron su correo", n: f.email, note: "Abrieron el resumen por categoría" }] : []),
    { label: "Tocaron Comprar", n: f.clicked, note: "Llegaron al pago" },
    { label: "Pagaron", n: f.paid, note: "Reporte completo vendido" },
  ];
  const top = Math.max(f.sent, 1);
  return (
    <div className="space-y-3">
      {steps.map((s, i) => {
        const prev = i > 0 ? steps[i - 1].n : null;
        const step = prev && prev > 0 ? Math.min(100, Math.round((s.n / prev) * 100)) : null;
        return (
          <div key={s.label}>
            <div className="flex items-baseline justify-between gap-3 text-[13.5px]">
              <span className="min-w-0 font-semibold leading-snug">{s.label}</span>
              <span className="flex-shrink-0 font-bold">{s.n}</span>
            </div>
            <div className="mt-1 h-2.5 overflow-hidden rounded-full" style={{ background: GRID }}>
              <div className="h-full rounded-full" style={{ width: `${Math.round((s.n / top) * 100)}%`, background: i === steps.length - 1 ? UP : RED }} />
            </div>
            <div className="mt-0.5 text-[11.5px] leading-snug" style={{ color: INK_SOFT }}>
              {s.note}
              {step !== null ? ` · ${step}% del paso anterior` : ""}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DayBars({ data }: { data: { day: string; visits: number }[] }) {
  // Con 90 días las barras diarias quedarían como rayitas: se agrupan por semana.
  const weekly = data.length > 31;
  const pts = weekly
    ? Array.from({ length: Math.ceil(data.length / 7) }, (_, i) => {
        const part = data.slice(i * 7, i * 7 + 7);
        return { day: part[0].day, visits: part.reduce((a, d) => a + d.visits, 0) };
      })
    : data;
  const top = Math.max(1, ...pts.map((d) => d.visits));
  const nice = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
  return (
    <div>
      <div className="mb-1.5 text-[12px] font-semibold" style={{ color: INK_SOFT }}>
        {weekly ? "Páginas vistas por semana" : "Páginas vistas por día"}
      </div>
      <div className="flex h-24 items-end gap-[3px]" role="img" aria-label="Páginas vistas a la web">
        {pts.map((d) => (
          <div key={d.day} title={`${nice(d.day)}: ${d.visits}`} className="min-w-0 flex-1 rounded-t-[3px]" style={{ height: `${Math.max(3, Math.round((d.visits / top) * 100))}%`, background: d.visits ? RED : GRID }} />
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[11px]" style={{ color: INK_SOFT }}>
        <span>{nice(pts[0].day)}</span>
        <span>{nice(data[data.length - 1].day)}</span>
      </div>
    </div>
  );
}

function Chip({ children, tone }: { children: ReactNode; tone: "good" | "hot" | "soft" }) {
  const c = tone === "good" ? { bg: "rgba(52,199,89,0.14)", fg: UP } : tone === "hot" ? { bg: "rgba(242,68,68,0.12)", fg: "#C7301E" } : { bg: "rgba(60,60,67,0.08)", fg: "#6B6B70" };
  return (
    <span className="inline-block rounded-full px-2 py-0.5 text-[11.5px] font-bold" style={{ background: c.bg, color: c.fg }}>
      {children}
    </span>
  );
}

export default function SeguimientoView({ s }: { s: Seguimiento }) {
  const tabs = [7, 30, 90];
  const web = s.web;
  const siteFlow = web ? [
    { label: "Visitaron el sitio", n: web.visitors, sub: "Visitantes únicos por día" },
    { label: "Tocaron «Solicita una visita»", n: web.clicks, sub: "Clics en cualquiera de los botones" },
    { label: "Empezaron el formulario", n: web.formStarted, sub: "Escribieron en algún campo" },
    { label: "Enviaron su solicitud", n: web.formSent, sub: "Solicitud recibida" },
  ] : [];

  return (
    <>
      <div className="mb-4 flex gap-2" role="tablist" aria-label="Periodo">
        {tabs.map((d) => (
          <Link
            key={d}
            href={`/admin/seguimiento?dias=${d}`}
            className="mf-tap rounded-full px-4 py-1.5 text-[13.5px] font-semibold"
            style={s.days === d ? { background: RED, color: "#fff" } : { background: "rgba(60,60,67,0.08)" }}
          >
            {d} días
          </Link>
        ))}
      </div>

      <Section emoji="🧲" title="Embudo del reporte" sub={`Visitas con reporte de los últimos ${s.days} días: del resultado enviado al pago`}>
        {s.funnel ? <Funnel f={s.funnel} /> : <Missing>Aún no hay datos: falta correr supabase/seguimiento_reporte.sql.</Missing>}
      </Section>

      <Section emoji="👀" title="Qué hizo cada reporte" sub="Aperturas y toques en «Comprar», de los más recientes. Las aperturas del equipo no cuentan.">
        {!s.reports ? (
          <Missing>Aún no hay datos: falta correr supabase/seguimiento_reporte.sql.</Missing>
        ) : s.reports.length === 0 ? (
          <p className="text-[13px]" style={{ color: INK_SOFT }}>No se enviaron reportes en este periodo.</p>
        ) : (
          <div className="divide-y" style={{ borderColor: GRID }}>
            {s.reports.slice(0, 15).map((r) => (
              <Link key={r.id} href={`/negocios/${r.clientId}`} className="mf-tap block py-3 first:pt-0 last:pb-0">
                <div className="text-[14.5px] font-semibold leading-snug [overflow-wrap:anywhere]">{r.clientName}</div>
                <div className="mt-0.5 text-[12px] leading-snug" style={{ color: INK_SOFT }}>
                  Enviado {when(r.createdAt)}
                  {r.viewCount === 0 ? " · sin abrir" : ` · ${r.viewCount} ${r.viewCount === 1 ? "apertura" : "aperturas"}, última ${when(r.lastViewedAt)}`}
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {r.paid ? <Chip tone="good">Pagó</Chip> : r.checkoutClickedAt ? <Chip tone="hot">Tocó Comprar</Chip> : r.viewCount > 0 ? <Chip tone="soft">Abrió</Chip> : <Chip tone="soft">Sin abrir</Chip>}
                  {r.leadEmail && <Chip tone="soft">Dejó correo</Chip>}
                </div>
              </Link>
            ))}
          </div>
        )}
      </Section>

      <Section emoji="✉️" title="Correos y recordatorios" sub="Lo que la app mandó. No medimos si el destinatario los abrió: eso requiere un servicio externo y se decidió no usarlo.">
        {s.emails ? (
          <div className="mb-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <Tile label="Correos enviados" value={s.emails.sent} hint={`en ${s.days} días`} />
            <Tile label="Con error" value={s.emails.failed} hint={s.emails.failed ? "Revisa Inicio" : "Todo salió bien"} />
            {s.reminders ? (
              <>
                <Tile label="Recordatorios" value={s.reminders.sent1 + s.reminders.sent2} hint={`Día 2: ${s.reminders.sent1} · día 7: ${s.reminders.sent2}`} />
                <Tile label="Se dieron de baja" value={s.reminders.optOut} hint={`${pct(s.reminders.optOut, s.reminders.sent1)} de los recordados`} />
              </>
            ) : (
              <Tile label="Recordatorios" value="—" hint="Falta un SQL" />
            )}
          </div>
        ) : (
          <Missing>No se pudo leer el historial de correos.</Missing>
        )}
        {s.emails && s.emails.recent.length > 0 && (
          <ul className="space-y-2.5 text-[13.5px]">
            {s.emails.recent.map((e, i) => (
              <li key={i}>
                <div className="leading-snug [overflow-wrap:anywhere]" style={e.status === "failed" ? { color: "#C7301E" } : undefined}>
                  {e.status === "failed" ? "⚠️ " : ""}
                  {e.subject}
                </div>
                <div className="text-[12px]" style={{ color: INK_SOFT }}>
                  {when(e.at)}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section emoji="🎁" title="Solicitudes por botón" sub="Desde qué parte de mysterfoodie.com se pidió la visita, y cuántas ya tienen MysterFoodie asignado">
        {s.requests ? (
          <>
            <div className="mb-4 grid grid-cols-3 gap-2.5">
              <Tile label="Solicitudes" value={s.requests.total} />
              <Tile label="Gratis" value={s.requests.byKind.gratis} />
              <Tile label="Programadas" value={s.requests.byKind.programada} hint="Con pago" />
            </div>
            <Bars rows={s.requests.bySource.map((r) => ({ label: SOURCE_LABEL[r.source] ?? r.source, n: r.n, note: `${r.assigned} con foodie` }))} />
          </>
        ) : (
          <Missing>No se pudieron leer las solicitudes.</Missing>
        )}
      </Section>

      <Section emoji="🌐" title="Contador de mysterfoodie.com" sub="Contador propio, sin cookies y sin guardar IP. Quien regresa otro día cuenta como un visitante nuevo; no mide a quien bloquea scripts o activó «No rastrear».">
        {!web ? (
          <Missing>Aún no hay datos: falta correr supabase/eventos_web.sql en Supabase y subir la web con el contador.</Missing>
        ) : web.visits === 0 && web.clicks === 0 ? (
          <Missing>La tabla ya existe pero todavía no llega ninguna visita. Falta subir la web actualizada (con medicion.js) a cPanel.</Missing>
        ) : (
          <>
            <div className="mb-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              <Tile label="Visitantes" value={web.visitors} hint="únicos por día" />
              <Tile label="Páginas vistas" value={web.visits} />
              <Tile label="Tocaron Solicita" value={web.clicks} hint={`${pct(web.clicks, web.visitors)} de visitantes`} />
              <Tile label="Solicitudes" value={web.formSent} hint={`${pct(web.formSent, web.visitors)} de visitantes`} />
            </div>
            <DayBars data={web.perDay} />
            <h3 className="mb-2.5 mt-5 text-[14px] font-bold">Del sitio a la solicitud</h3>
            <Bars rows={siteFlow} />
            <div className="mt-5 grid gap-6 sm:grid-cols-2">
              <div>
                <h3 className="mb-2.5 text-[14px] font-bold">Páginas más vistas</h3>
                <Bars rows={web.topPages.map((p) => ({ label: p.page, n: p.n }))} />
              </div>
              <div>
                <h3 className="mb-2.5 text-[14px] font-bold">De dónde llegan</h3>
                <Bars rows={web.byChannel.map((c) => ({ label: CHANNEL_LABEL[c.channel] ?? c.channel, n: c.n }))} />
              </div>
              <div>
                <h3 className="mb-2.5 text-[14px] font-bold">Botones más tocados</h3>
                <Bars rows={web.clicksBySource.map((c) => ({ label: SOURCE_LABEL[c.source] ?? c.source, n: c.n }))} />
              </div>
              <div>
                <h3 className="mb-2.5 text-[14px] font-bold">Dispositivo</h3>
                <Bars rows={web.byDevice.map((d) => ({ label: d.device === "movil" ? "Celular" : "Computadora", n: d.n }))} />
              </div>
            </div>
          </>
        )}
      </Section>
    </>
  );
}
