import Link from "next/link";
import type { ReactNode } from "react";
import type { HomeInsights as Data, Kpi, Mover } from "@/lib/homeInsights";
import { getVerdict } from "@/lib/verdict";

/**
 * Tablero del Inicio, de lo más importante a lo menos: cifras del mes, negocios para dar seguimiento, actividad,
 * calificaciones, rachas, cuándo se visita, lo que dice el equipo y nuevos negocios. Server component: todo es
 * HTML/SVG sin librerías (rápido, accesible y se ve igual en celular y escritorio).
 */
const RED = "#F24444";
const INK_SOFT = "rgba(60,60,67,0.6)";
const GRID = "rgba(60,60,67,0.1)";
const UP = "#248A3D";
const DOWN = "#C7301E";

function Panel({ title, sub, children, wide = false }: { title: string; sub?: string; children: ReactNode; wide?: boolean }) {
  return (
    <section className={`card p-5 ${wide ? "md:col-span-2" : ""}`}>
      <h3 className="text-[16px] font-bold">{title}</h3>
      {sub && (
        <p className="mt-0.5 text-[12.5px]" style={{ color: INK_SOFT }}>
          {sub}
        </p>
      )}
      <div className="mt-3.5">{children}</div>
    </section>
  );
}

const Empty = ({ children }: { children: ReactNode }) => (
  <p className="rounded-[12px] px-3.5 py-3 text-[13.5px]" style={{ background: "rgba(60,60,67,0.05)", color: INK_SOFT }}>
    {children}
  </p>
);

// ------------------------------------------------------------------- KPIs
function KpiTile({ k }: { k: Kpi }) {
  const tone = k.delta?.tone;
  const color = tone === "up" ? UP : tone === "down" ? DOWN : INK_SOFT;
  const arrow = tone === "up" ? "▲" : tone === "down" ? "▼" : "•";
  return (
    <div className="card px-4 py-3.5">
      <div className="text-[12.5px] font-medium" style={{ color: INK_SOFT }}>
        {k.label}
      </div>
      <div className="mt-1 flex items-baseline gap-1.5">
        <span className="heading text-[32px] font-bold leading-none">{k.value}</span>
        {k.hint && (
          <span className="text-[12.5px]" style={{ color: INK_SOFT }}>
            {k.hint}
          </span>
        )}
      </div>
      {k.delta && (
        <div className="mt-1.5 text-[12px] font-semibold" style={{ color }}>
          {arrow} {k.delta.text}
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------- movimientos
function MoverRow({ m }: { m: Mover }) {
  const up = m.delta > 0;
  return (
    <Link href={`/negocios/${m.clientId}`} className="mf-tap flex items-center gap-3 py-2.5">
      <span className="w-[62px] flex-shrink-0 text-[13px] font-bold" style={{ color: up ? UP : DOWN }}>
        {up ? "▲ +" : "▼ −"}
        {Math.abs(m.delta).toFixed(1)}
      </span>
      <span className="min-w-0 flex-1 truncate text-[14.5px] font-semibold">{m.name}</span>
      <span className="flex-shrink-0 text-[12.5px]" style={{ color: INK_SOFT }}>
        {m.from.toFixed(1)} → {m.to.toFixed(1)}
      </span>
    </Link>
  );
}

function Movers({ d }: { d: Data["movers"] }) {
  if (d.up.length === 0 && d.down.length === 0) return <Empty>Sin cambios importantes entre la última visita y la anterior de cada negocio. Aquí te avisamos cuando alguno suba o baje.</Empty>;
  return (
    <div>
      {d.down.length > 0 && (
        <>
          <div className="text-[11.5px] font-bold uppercase tracking-wide" style={{ color: DOWN }}>
            Bajaron · dales seguimiento
          </div>
          <div className="divide-y" style={{ borderColor: GRID }}>
            {d.down.map((m) => (
              <MoverRow key={m.clientId} m={m} />
            ))}
          </div>
        </>
      )}
      {d.up.length > 0 && (
        <>
          <div className={`${d.down.length ? "mt-3" : ""} text-[11.5px] font-bold uppercase tracking-wide`} style={{ color: UP }}>
            Subieron · buen momento para felicitarlos
          </div>
          <div className="divide-y" style={{ borderColor: GRID }}>
            {d.up.map((m) => (
              <MoverRow key={m.clientId} m={m} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------- barras semanales
function WeeklyBars({ data }: { data: Data["weekly"] }) {
  const W = 320;
  const H = 148;
  const top = 20;
  const bottom = 24;
  const base = H - bottom;
  const max = Math.max(1, ...data.map((d) => d.count));
  const slot = (W - 12) / data.length;
  const bw = 22;
  const r = 4;
  const total = data.reduce((s, d) => s + d.count, 0);
  if (total === 0) return <Empty>Todavía no hay visitas en estas semanas.</Empty>;
  const peak = Math.max(...data.map((d) => d.count));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Visitas por semana, últimas 8 semanas: ${data.map((d) => `${d.label} ${d.count}`).join(", ")}`} className="h-auto w-full">
      <line x1="6" x2={W - 6} y1={base} y2={base} stroke={GRID} />
      {data.map((d, i) => {
        const x = 6 + i * slot + (slot - bw) / 2;
        const h = (d.count / max) * (base - top);
        const y = base - h;
        const fill = d.current ? RED : "rgba(242,68,68,0.3)";
        const path =
          h >= r * 2
            ? `M${x} ${base}V${y + r}a${r} ${r} 0 0 1 ${r} ${-r}h${bw - 2 * r}a${r} ${r} 0 0 1 ${r} ${r}V${base}Z`
            : `M${x} ${base}h${bw}v${-Math.max(h, 0)}h${-bw}Z`;
        return (
          <g key={d.label}>
            <title>{`Semana del ${d.label}: ${d.count} ${d.count === 1 ? "visita" : "visitas"}`}</title>
            {d.count > 0 && <path d={path} fill={fill} />}
            {d.count > 0 && (d.current || d.count === peak) && (
              <text x={x + bw / 2} y={y - 5} textAnchor="middle" fontSize="11" fontWeight="700" fill="#1C1C1E">
                {d.count}
              </text>
            )}
            <text x={x + bw / 2} y={H - 7} textAnchor="middle" fontSize="9.5" fill={INK_SOFT}>
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// --------------------------------------------------------- tendencia mensual
function MonthlyLine({ data }: { data: Data["monthly"] }) {
  const W = 320;
  const H = 156;
  const left = 22;
  const right = 14;
  const top = 14;
  const bottom = 24;
  const x = (i: number) => left + (i * (W - left - right)) / (data.length - 1);
  const y = (v: number) => top + ((5 - v) / 4) * (H - top - bottom);
  const pts = data.map((d, i) => (d.avg === null ? null : { x: x(i), y: y(d.avg), d }));
  if (pts.filter(Boolean).length === 0) return <Empty>Sin visitas en los últimos 6 meses.</Empty>;
  const segs: string[] = [];
  let cur = "";
  for (const p of pts) {
    if (!p) {
      if (cur) segs.push(cur);
      cur = "";
    } else cur += `${cur ? "L" : "M"}${p.x} ${p.y}`;
  }
  if (cur) segs.push(cur);
  const last = [...pts].reverse().find(Boolean)!;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Calificación promedio por mes: ${data.map((d) => `${d.label} ${d.avg ?? "sin visitas"}`).join(", ")}`} className="h-auto w-full">
      {[1, 2, 3, 4, 5].map((v) => (
        <g key={v}>
          <line x1={left} x2={W - right} y1={y(v)} y2={y(v)} stroke={GRID} strokeDasharray={v === 1 ? undefined : "3 4"} />
          <text x={left - 6} y={y(v) + 3.5} textAnchor="end" fontSize="9.5" fill={INK_SOFT}>
            {v}
          </text>
        </g>
      ))}
      {segs.map((d, i) => (
        <path key={i} d={d} fill="none" stroke={RED} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      ))}
      {pts.map((p, i) =>
        p ? (
          <g key={i}>
            <title>{`${p.d.label}: ${p.d.avg} (${p.d.count} ${p.d.count === 1 ? "visita" : "visitas"})`}</title>
            <circle cx={p.x} cy={p.y} r="4.5" fill={RED} stroke="#fff" strokeWidth="2" />
          </g>
        ) : null
      )}
      <text x={last.x} y={last.y - 10} textAnchor="middle" fontSize="12" fontWeight="700" fill="#1C1C1E">
        {last.d.avg}
      </text>
      {data.map((d, i) => (
        <text key={d.label + i} x={x(i)} y={H - 7} textAnchor="middle" fontSize="9.5" fill={INK_SOFT}>
          {d.label}
        </text>
      ))}
    </svg>
  );
}

// ------------------------------------------------------------------ categorías
function CategoryBars({ data }: { data: Data["categories"] }) {
  if (data.length === 0) return <Empty>Aún no hay calificaciones para promediar.</Empty>;
  return (
    <div className="space-y-3">
      {data.map((c, i) => {
        const v = getVerdict(c.avg);
        return (
          <div key={c.key}>
            <div className="mb-1 flex items-baseline justify-between gap-2 text-[13.5px]">
              <span className="font-semibold">
                {c.label}
                {i === 0 && data.length > 1 && (
                  <span className="ml-1.5 text-[11px] font-bold" style={{ color: DOWN }}>
                    · la más baja
                  </span>
                )}
              </span>
              <span style={{ color: INK_SOFT }}>
                <strong className="text-[14px]" style={{ color: "#1C1C1E" }}>
                  {c.avg.toFixed(1)}
                </strong>{" "}
                · {v.label}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full" style={{ background: "rgba(60,60,67,0.08)" }}>
              <div className="h-full rounded-full" style={{ width: `${(c.avg / 5) * 100}%`, background: v.color }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ------------------------------------------------------------------- veredictos
function VerdictStack({ data }: { data: Data["verdicts"] }) {
  const total = data.reduce((s, d) => s + d.count, 0);
  if (total === 0) return <Empty>Sin visitas en los últimos 90 días.</Empty>;
  return (
    <div>
      <div className="flex h-3.5 gap-[2px] overflow-hidden rounded-full" role="img" aria-label={`Veredictos: ${data.map((d) => `${d.label} ${d.count}`).join(", ")}`}>
        {data
          .filter((d) => d.count > 0)
          .map((d) => (
            <div key={d.label} style={{ flex: d.count, background: d.color }} title={`${d.label}: ${d.count}`} />
          ))}
      </div>
      <ul className="mt-3 space-y-1.5">
        {data.map((d) => (
          <li key={d.label} className="flex items-center gap-2 text-[13.5px]">
            <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ background: d.color }} aria-hidden />
            <span className="flex-1 font-medium">{d.label}</span>
            <span style={{ color: INK_SOFT }}>
              <strong style={{ color: "#1C1C1E" }}>{d.count}</strong> · {Math.round((d.count / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ------------------------------------------------------------------------ rachas
function Streak({ s, isAdmin }: { s: Data["streak"]; isAdmin: boolean }) {
  const msg =
    s.current > 0
      ? s.current >= 4
        ? "¡Estás en racha! Mantén al menos una visita por semana."
        : "Una visita por semana mantiene tu racha."
      : "Una visita esta semana inicia tu racha.";
  return (
    <div>
      <div className="flex items-end gap-3">
        <div className="heading text-[44px] font-bold leading-none">{s.current}</div>
        <div className="pb-1 text-[13.5px] font-semibold leading-tight">
          {s.current === 1 ? "semana seguida" : "semanas seguidas"}
          <br />
          <span className="font-normal" style={{ color: INK_SOFT }}>
            con al menos una visita {s.current >= 2 ? "🔥" : ""}
          </span>
        </div>
      </div>
      <div className="mt-3 flex gap-1" role="img" aria-label="Últimas 12 semanas: semanas con visita en rojo">
        {s.weeks.map((on, i) => (
          <span key={i} className="h-2.5 flex-1 rounded-full" style={{ background: on ? RED : "rgba(60,60,67,0.1)" }} title={on ? "Con visita" : "Sin visita"} />
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10.5px]" style={{ color: INK_SOFT }}>
        <span>hace 12 semanas</span>
        <span>esta semana</span>
      </div>
      <p className="mt-3 text-[13px]" style={{ color: INK_SOFT }}>
        {msg} Tu mejor racha: <strong style={{ color: "#1C1C1E" }}>{s.best}</strong>.
        {s.lastVisitDaysAgo !== null && (
          <>
            {" "}
            Última visita tuya: {s.lastVisitDaysAgo === 0 ? "hoy" : s.lastVisitDaysAgo === 1 ? "ayer" : `hace ${s.lastVisitDaysAgo} días`}.
          </>
        )}
      </p>
      {isAdmin && s.team !== null && (
        <p className="mt-1.5 text-[13px]" style={{ color: INK_SOFT }}>
          La red lleva <strong style={{ color: "#1C1C1E" }}>{s.team}</strong> {s.team === 1 ? "semana" : "semanas"} seguidas con visitas.
        </p>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ mapa de calor
const DAY_NAMES = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];
function Heatmap({ h }: { h: Data["heat"] }) {
  if (h.total === 0) return <Empty>Sin visitas en los últimos 90 días.</Empty>;
  let best = { d: 0, s: 0, n: 0 };
  h.cells.forEach((row, d) => row.forEach((n, s) => n > best.n && (best = { d, s, n })));
  return (
    <div>
      <div className="grid gap-1" style={{ gridTemplateColumns: "34px repeat(4, minmax(0, 1fr))" }}>
        <span />
        {h.slots.map((s) => (
          <span key={s} className="text-center text-[10.5px] font-medium" style={{ color: INK_SOFT }}>
            {s}
          </span>
        ))}
        {h.cells.map((row, d) => (
          <div key={d} className="contents">
            <span className="flex items-center text-[10.5px] font-medium" style={{ color: INK_SOFT }}>
              {h.days[d]}
            </span>
            {row.map((n, s) => {
              const a = n === 0 ? 0 : 0.14 + 0.86 * (n / h.max);
              return (
                <span
                  key={s}
                  title={`${DAY_NAMES[d]} · ${h.slots[s]}: ${n} ${n === 1 ? "visita" : "visitas"}`}
                  className="flex h-8 items-center justify-center rounded-md text-[11.5px] font-bold"
                  style={{ background: n === 0 ? "rgba(60,60,67,0.05)" : `rgba(242,68,68,${a})`, color: a > 0.55 ? "#fff" : "#1C1C1E" }}
                >
                  {n > 0 ? n : ""}
                </span>
              );
            })}
          </div>
        ))}
      </div>
      <p className="mt-2.5 text-[12.5px]" style={{ color: INK_SOFT }}>
        Lo más frecuente: <strong style={{ color: "#1C1C1E" }}>{DAY_NAMES[best.d]}, {h.slots[best.s].toLowerCase()}</strong> ({best.n} {best.n === 1 ? "visita" : "visitas"}).
      </p>
    </div>
  );
}

// ---------------------------------------------------------------- palabras
function WordPool({ d }: { d: Data }) {
  if (d.words.length === 0 && d.good.length === 0 && d.improve.length === 0) {
    return <Empty>Cuando los MysterFoodies dejen más comentarios, aquí verás de qué se habla más.</Empty>;
  }
  const max = Math.max(1, ...d.words.map((w) => w.count));
  const min = Math.min(...d.words.map((w) => w.count), max);
  const size = (n: number) => 13 + (max === min ? 0.5 : (n - min) / (max - min)) * 15;
  const tags = (title: string, color: string, list: Data["good"]) =>
    list.length > 0 && (
      <div>
        <div className="mb-1.5 text-[12px] font-bold uppercase tracking-wide" style={{ color }}>
          {title}
        </div>
        <ul className="space-y-1.5">
          {list.map((t) => (
            <li key={t.tag} className="flex items-center gap-2 text-[13.5px]">
              <span className="min-w-0 flex-1 truncate font-medium">{t.tag}</span>
              <span className="h-1.5 w-16 flex-shrink-0 overflow-hidden rounded-full" style={{ background: "rgba(60,60,67,0.08)" }} aria-hidden>
                <span className="block h-full rounded-full" style={{ width: `${(t.count / list[0].count) * 100}%`, background: color }} />
              </span>
              <span className="w-6 flex-shrink-0 text-right text-[12.5px] font-semibold">{t.count}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  return (
    <div className="grid gap-5 md:grid-cols-[1.4fr_1fr]">
      {d.words.length > 0 && (
        <div className="flex flex-wrap items-baseline gap-x-3.5 gap-y-2 self-start" aria-label="Palabras más repetidas en los comentarios">
          {d.words.map((w, i) => (
            <span key={w.word} title={`${w.count} menciones`} className="font-semibold leading-tight" style={{ fontSize: size(w.count), color: i < 3 ? RED : i < 10 ? "#1C1C1E" : INK_SOFT }}>
              {w.word}
            </span>
          ))}
        </div>
      )}
      <div className="space-y-4">
        {tags("Lo que más se elogia", UP, d.good)}
        {tags("Lo que más piden mejorar", "#B26A00", d.improve)}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------- listas
function BusinessList({ list }: { list: Data["newBusinesses"] }) {
  if (list.length === 0) return <Empty>No hay negocios nuevos en los últimos días.</Empty>;
  return (
    <div className="divide-y" style={{ borderColor: GRID }}>
      {list.map((n) => (
        <Link key={n.id} href={`/negocios/${n.id}`} className="mf-tap flex items-center gap-3 py-2.5">
          <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-[13px] font-semibold text-white" style={{ background: n.avatarColor }}>
            {n.initial}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[14.5px] font-semibold">{n.nombre}</span>
            <span className="block truncate text-[12px]" style={{ color: INK_SOFT }}>
              {n.fecha}
              {n.creatorLabel ? ` · ${n.creatorLabel}` : ""}
            </span>
          </span>
        </Link>
      ))}
    </div>
  );
}

function Leaderboard({ list }: { list: Data["leaderboard"] }) {
  if (list.length === 0) return <Empty>Sin visitas del equipo en los últimos 30 días.</Empty>;
  return (
    <ol className="divide-y" style={{ borderColor: GRID }}>
      {list.map((p, i) => (
        <li key={p.id} className="flex items-center gap-3 py-2.5">
          <span className="w-4 text-center text-[13px] font-bold" style={{ color: i === 0 ? RED : INK_SOFT }}>
            {i + 1}
          </span>
          <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-[13px] font-semibold text-white" style={{ background: p.avatarColor }}>
            {p.initial}
          </span>
          <span className="min-w-0 flex-1 truncate text-[14.5px] font-semibold">{p.name}</span>
          <span className="flex-shrink-0 text-right text-[12.5px]" style={{ color: INK_SOFT }}>
            <strong className="text-[14px]" style={{ color: "#1C1C1E" }}>
              {p.count}
            </strong>{" "}
            {p.count === 1 ? "visita" : "visitas"}
            {p.avg !== null ? ` · ${p.avg.toFixed(1)}` : ""}
          </span>
        </li>
      ))}
    </ol>
  );
}

// ------------------------------------------------------------------ conjunto
export default function HomeInsights({ data, role, variant = "desktop" }: { data: Data; role: "admin" | "sibarita" | "agente"; variant?: "desktop" | "mobile" }) {
  const desktop = variant === "desktop";
  const showBusinesses = role !== "agente" && desktop;
  return (
    <div className={desktop ? "" : "px-5 pb-6"} aria-label="Estadísticas generales">
      <div className="mb-3 mt-6 flex items-baseline justify-between">
        <h2 className="text-[20px] font-bold">Estadísticas</h2>
        <span className="text-[12.5px] font-medium" style={{ color: INK_SOFT }}>
          {data.scopeLabel}
        </span>
      </div>

      {data.empty ? (
        <Empty>Aún no hay visitas registradas. En cuanto se levante la primera, aquí verás cifras, gráficas, rachas y lo que más dicen los MysterFoodies.</Empty>
      ) : (
        <>
          {desktop && (
            <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
              {data.kpis.map((k) => (
                <KpiTile key={k.label} k={k} />
              ))}
            </div>
          )}
          <div className="grid gap-4 md:grid-cols-2">
            {role !== "agente" && (
              <Panel title="Para dar seguimiento" sub="Negocios cuya última calificación cambió respecto a la visita anterior">
                <Movers d={data.movers} />
              </Panel>
            )}
            <Panel title="Visitas por semana" sub="Últimas 8 semanas">
              <WeeklyBars data={data.weekly} />
            </Panel>
            <Panel title="Calificación promedio por mes" sub="Últimos 6 meses · escala de 1 a 5">
              <MonthlyLine data={data.monthly} />
            </Panel>
            <Panel title="Calificación por categoría" sub="Últimas 40 visitas · de la más baja a la más alta">
              <CategoryBars data={data.categories} />
            </Panel>
            <Panel title="Rachas" sub="Constancia semana a semana">
              <Streak s={data.streak} isAdmin={role === "admin"} />
            </Panel>
            <Panel title="Veredictos" sub="Cómo salieron las visitas de los últimos 90 días">
              <VerdictStack data={data.verdicts} />
            </Panel>
            <Panel title="¿Cuándo se visita?" sub="Visitas por día y horario · últimos 90 días" wide={role === "agente"}>
              <Heatmap h={data.heat} />
            </Panel>
            {(role === "admin" || showBusinesses) && (
              <div className="flex flex-col gap-4">
                {role === "admin" && (
                  <Panel title="Equipo del mes" sub="Más visitas en los últimos 30 días">
                    <Leaderboard list={data.leaderboard} />
                  </Panel>
                )}
                {showBusinesses && (
                  <Panel title="Nuevos negocios" sub={data.newBusinessesMonth !== null ? `${data.newBusinessesMonth} este mes` : undefined}>
                    <BusinessList list={data.newBusinesses} />
                  </Panel>
                )}
              </div>
            )}
            <Panel title="Lo que dicen los MysterFoodies" sub="Palabras que más se repiten en los comentarios de todo el equipo" wide>
              <WordPool d={data} />
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}
