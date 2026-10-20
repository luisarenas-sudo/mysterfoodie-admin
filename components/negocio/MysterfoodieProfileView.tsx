import type { MysterfoodieProfile } from "@/lib/mysterfoodieProfile";

const money = (n: number | null) =>
  n == null ? "—" : n.toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 });

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card p-4">
      <h2 className="text-[13px] font-bold uppercase tracking-wide" style={{ color: "rgba(60,60,67,0.6)" }}>
        {title}
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Chips({ items, empty }: { items: string[]; empty: string }) {
  if (items.length === 0) return <p className="text-[14px] text-stone-500">{empty}</p>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((t) => (
        <span key={t} className="rounded-full px-3 py-1 text-[13px] font-medium" style={{ background: "#F2F2F7" }}>
          {t}
        </span>
      ))}
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl p-3" style={{ background: "#F2F2F7" }}>
      <div className="text-[12px] font-semibold" style={{ color: "rgba(60,60,67,0.6)" }}>{label}</div>
      <div className="mt-0.5 text-[20px] font-extrabold">{value}</div>
      {hint && <div className="text-[11.5px]" style={{ color: "rgba(60,60,67,0.55)" }}>{hint}</div>}
    </div>
  );
}

/** Perfil anónimo completo de un MysterFoodie. Solo alias y hábitos agregados: nunca nombre, foto, contacto ni CP. */
export default function MysterfoodieProfileView({ profile: p }: { profile: MysterfoodieProfile }) {
  const maxWord = Math.max(1, ...p.words.map((w) => w.count));
  return (
    <div className="space-y-3.5">
      <div className="card p-5">
        <p className="text-[12px] font-bold uppercase tracking-wide" style={{ color: "#F24444" }}>{p.rankLabel} · perfil anónimo</p>
        <h1 className="heading mt-1 text-3xl text-ink">{p.alias}</h1>
        <p className="mt-1 text-[14px] text-stone-500">
          {p.visits} {p.visits === 1 ? "visita" : "visitas"} con MysterFoodie
          {p.monthsActive >= 1 ? ` · ${p.monthsActive} ${p.monthsActive === 1 ? "mes" : "meses"} en el equipo` : ""}
          {p.strictness.label ? ` · ${p.strictness.label}` : ""}
        </p>
      </div>

      <Section title="Palabras que más usa en sus reseñas">
        {p.words.length === 0 ? (
          <p className="text-[14px] text-stone-500">Aún no tiene suficientes reseñas para detectar palabras frecuentes.</p>
        ) : (
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            {p.words.map((w) => (
              <span key={w.word} className="font-semibold" style={{ fontSize: `${13 + Math.round((w.count / maxWord) * 13)}px`, opacity: 0.55 + (w.count / maxWord) * 0.45 }}>
                {w.word}
              </span>
            ))}
          </div>
        )}
        {(p.likes.good.length > 0 || p.likes.improve.length > 0) && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <div className="text-[12px] font-semibold" style={{ color: "#1E8E4E" }}>Lo que más destaca</div>
              <Chips items={p.likes.good.map((g) => g.tag)} empty="—" />
            </div>
            <div>
              <div className="text-[12px] font-semibold" style={{ color: "#C7301E" }}>Lo que más señala para mejorar</div>
              <Chips items={p.likes.improve.map((g) => g.tag)} empty="—" />
            </div>
          </div>
        )}
      </Section>

      <Section title="Sus gustos">
        <div className="space-y-3">
          <div>
            <div className="text-[12px] font-semibold text-stone-500">Tipos de cocina</div>
            <Chips items={p.tastes.cuisines} empty="Aún no los ha indicado." />
          </div>
          <div>
            <div className="text-[12px] font-semibold text-stone-500">Platillos favoritos</div>
            <Chips items={p.tastes.dishes} empty="Aún no los ha indicado." />
          </div>
        </div>
      </Section>

      <Section title="Con quién sale y cuánto consume">
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <Stat label="Personas por salida" value={p.party.avg != null ? p.party.avg.toFixed(1) : "—"} hint={p.party.usual ? `Lo más común: ${p.party.usual}` : undefined} />
          <Stat label="Sale solo/a" value={p.party.soloPct != null ? `${p.party.soloPct}%` : "—"} hint={p.party.groupPct != null ? `Grupos de 4+: ${p.party.groupPct}%` : undefined} />
          <Stat label="Cuenta promedio" value={money(p.consumption.avgTicket)} hint={p.consumption.maxTicket ? `La más alta: ${money(p.consumption.maxTicket)}` : undefined} />
          <Stat label="Por persona" value={money(p.consumption.avgPerPerson)} />
        </div>
        <p className="mt-3 text-[13px] text-stone-500">
          Total consumido en sus visitas registradas: <strong>{money(p.consumption.total)}</strong>
          {p.consumption.samples > 0 ? ` (${p.consumption.samples} cuentas con total capturado)` : " (aún sin totales capturados)"}.
        </p>
      </Section>

      <Section title="Sector y por dónde consume">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <div className="text-[12px] font-semibold text-stone-500">Sector que representa</div>
            <p className="mt-1 text-[15px] font-bold">{p.sector.label ?? "Sin definir"}</p>
          </div>
          <div>
            <div className="text-[12px] font-semibold text-stone-500">Cuándo suele salir</div>
            <p className="mt-1 text-[15px] font-bold">
              {p.habits.day ? `${p.habits.day}${p.habits.slot ? `, en la ${p.habits.slot}` : ""}` : "Sin datos"}
            </p>
          </div>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <div className="text-[12px] font-semibold text-stone-500">Tipos de negocio que visita</div>
            <Chips items={p.visitedTypes.map((t) => `${t.label} (${t.count})`)} empty="Sin datos" />
          </div>
          <div>
            <div className="text-[12px] font-semibold text-stone-500">Ciudades donde consume</div>
            <Chips items={p.cities.map((c) => `${c.label} (${c.count})`)} empty="Sin datos" />
          </div>
        </div>
      </Section>

      <p className="px-1 text-[12px] leading-snug text-stone-400">
        Perfil anónimo: se basa en las visitas y respuestas de este MysterFoodie. No incluye su nombre, foto ni datos de contacto.
      </p>
    </div>
  );
}
