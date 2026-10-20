import type { MysterfoodieProfile } from "@/lib/mysterfoodieProfile";
import { BLOCK_BY_KEY, BLOCKS_OF_TIER, TIERS, travelerType, type BlockKey } from "@/lib/personaCatalog";
import { BLOCK_EMOJI, optionIcon } from "@/lib/personaUi";
import { businessIcon, cuisineIcon, dishIcon, slotIcon, tagIcon } from "@/lib/iconos";

const money = (n: number | null) =>
  n == null ? "—" : n.toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 });

function Section({ title, icon, children }: { title: string; icon?: string; children: React.ReactNode }) {
  return (
    <section className="card p-4">
      <h2 className="text-[13px] font-bold uppercase tracking-wide" style={{ color: "rgba(60,60,67,0.6)" }}>
        {icon && <span aria-hidden="true">{icon} </span>}{title}
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Chips({ items, empty, icon }: { items: string[]; empty: string; icon?: (t: string) => string }) {
  if (items.length === 0) return <p className="text-[14px] text-stone-500">{empty}</p>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((t) => (
        <span key={t} className="rounded-full px-3 py-1 text-[13px] font-medium" style={{ background: "#F2F2F7" }}>
          {icon && <span aria-hidden="true">{icon(t)} </span>}{t}
        </span>
      ))}
    </div>
  );
}

function Stat({ label, value, hint, icon }: { label: string; value: string; hint?: string; icon?: string }) {
  return (
    <div className="rounded-xl p-3" style={{ background: "#F2F2F7" }}>
      <div className="text-[12px] font-semibold" style={{ color: "rgba(60,60,67,0.6)" }}>{icon && <span aria-hidden="true">{icon} </span>}{label}</div>
      <div className="mt-0.5 text-[20px] font-extrabold">{value}</div>
      {hint && <div className="text-[11.5px]" style={{ color: "rgba(60,60,67,0.55)" }}>{hint}</div>}
    </div>
  );
}

const asArr = (v: string | string[] | undefined): string[] => (Array.isArray(v) ? v : v ? [v] : []);

/** Resumen en una frase del buyer persona, armado con las respuestas compartidas. */
function personaSummary(p: MysterfoodieProfile): string | null {
  const d = p.persona.demografia, e = p.persona.estilo_vida, m = p.persona.movilidad;
  const parts: string[] = [];
  const edad = asArr(d?.edad)[0];
  const ocup = asArr(d?.ocupacion)[0];
  const hogar = asArr(d?.hogar)[0];
  if (edad || ocup) parts.push(`Persona${edad ? ` de ${edad} años` : ""}${ocup && !ocup.startsWith("Prefiero") ? `, ${ocup.toLowerCase()}` : ""}`);
  if (hogar && !hogar.startsWith("Prefiero")) parts.push(`vive ${hogar.toLowerCase()}`);
  const freq = asArr(e?.frecuencia)[0];
  const gasto = asArr(e?.gasto)[0];
  if (freq) parts.push(`come fuera ${freq} veces al mes${gasto ? ` y gasta ${gasto.toLowerCase()} por persona` : ""}`);
  const vehiculo = asArr(m?.vehiculo)[0];
  const auto = asArr(m?.auto)[0];
  if (vehiculo && !vehiculo.startsWith("No maneja")) parts.push(`maneja ${(vehiculo === "Auto" && auto ? auto : vehiculo).toLowerCase()}`);
  const tv = travelerType(asArr(m?.moods));
  if (tv) parts.push(`${tv.type.toLowerCase()}`);
  return parts.length ? `${parts.join("; ")}.` : null;
}

function PersonaBlock({ p, k }: { p: MysterfoodieProfile; k: BlockKey }) {
  const def = BLOCK_BY_KEY[k];
  const data = p.persona[k];
  if (!data) return null;
  const traveler = k === "movilidad" ? travelerType(asArr(data.moods)) : null;
  return (
    <Section title={def.label} icon={BLOCK_EMOJI[k]}>
      {traveler && (
        <div className="mb-4 rounded-xl px-3.5 py-3" style={{ background: "#F2F2F7" }}>
          <div className="text-[12px] font-semibold text-stone-500">Tipo de viajero</div>
          <div className="heading text-[20px]">{traveler.type}</div>
          <div className="text-[13px] text-stone-600">{traveler.desc}</div>
          <div className="mt-2"><Chips items={traveler.moods} empty="—" icon={(t) => optionIcon("movilidad", "moods", t)} /></div>
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {def.fields.map((f) => {
          const vals = asArr(data[f.key]);
          if (vals.length === 0 || f.key === "moods") return null; // los moods ya salen en "Tipo de viajero"
          return (
            <div key={f.key}>
              <div className="text-[12px] font-semibold text-stone-500">{f.label}</div>
              {f.kind === "many" ? <Chips items={vals} empty="—" icon={(t) => optionIcon(k, f.key, t)} /> : <p className="mt-1 text-[15px] font-bold"><span aria-hidden="true">{optionIcon(k, f.key, vals[0])} </span>{vals[0]}</p>}
            </div>
          );
        })}
      </div>
    </Section>
  );
}

/** Perfil anónimo de un MysterFoodie, solo con lo que el nivel comprado incluye y lo que él decidió compartir. */
export default function MysterfoodieProfileView({ profile: p }: { profile: MysterfoodieProfile }) {
  const g = p.gustos;
  const c = p.consumo;
  const maxWord = Math.max(1, ...(g?.words.map((w) => w.count) ?? [1]));
  const summary = p.tier === "passport" ? personaSummary(p) : null;
  const missing = BLOCKS_OF_TIER(p.tier === "passport" ? "passport" : "id").filter((b) => !p.blocks.includes(b.key));
  const missingAll = p.tier === "passport" ? [...BLOCKS_OF_TIER("id").filter((b) => !p.blocks.includes(b.key)), ...missing] : missing;

  return (
    <div className="space-y-3.5">
      <div className="card p-5">
        <p className="text-[12px] font-bold uppercase tracking-wide" style={{ color: "#F24444" }}>
          {p.rankLabel} · perfil {TIERS[p.tier].label}
        </p>
        <h1 className="heading mt-1 text-3xl text-ink">{p.alias}</h1>
        <p className="mt-1 text-[14px] text-stone-500">
          {p.visits} {p.visits === 1 ? "visita" : "visitas"} con MysterFoodie
          {p.monthsActive >= 1 ? ` · ${p.monthsActive} ${p.monthsActive === 1 ? "mes" : "meses"} en el equipo` : ""}
          {c?.strictness.label ? ` · ${c.strictness.label}` : ""}
        </p>
        {summary && <p className="mt-3 rounded-xl px-3.5 py-3 text-[14.5px] font-medium" style={{ background: "#F2F2F7" }}>{summary}</p>}
      </div>

      {g && (
        <>
          <Section title="Palabras que más usa en sus reseñas" icon="💬">
            {g.words.length === 0 ? (
              <p className="text-[14px] text-stone-500">Aún no tiene suficientes reseñas para detectar palabras frecuentes.</p>
            ) : (
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                {g.words.map((w) => (
                  <span key={w.word} className="font-semibold" style={{ fontSize: `${13 + Math.round((w.count / maxWord) * 13)}px`, opacity: 0.55 + (w.count / maxWord) * 0.45 }}>
                    {w.word}
                  </span>
                ))}
              </div>
            )}
            {(g.likes.good.length > 0 || g.likes.improve.length > 0) && (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div>
                  <div className="text-[12px] font-semibold" style={{ color: "#1E8E4E" }}>Lo que más destaca</div>
                  <Chips items={g.likes.good.map((x) => x.tag)} empty="—" icon={tagIcon} />
                </div>
                <div>
                  <div className="text-[12px] font-semibold" style={{ color: "#C7301E" }}>Lo que más señala para mejorar</div>
                  <Chips items={g.likes.improve.map((x) => x.tag)} empty="—" icon={tagIcon} />
                </div>
              </div>
            )}
          </Section>

          <Section title="Sus gustos" icon="🍜">
            <div className="space-y-3">
              <div>
                <div className="text-[12px] font-semibold text-stone-500">Tipos de cocina</div>
                <Chips items={g.tastes.cuisines} empty="Aún no los ha indicado." icon={cuisineIcon} />
              </div>
              <div>
                <div className="text-[12px] font-semibold text-stone-500">Platillos favoritos</div>
                <Chips items={g.tastes.dishes} empty="Aún no los ha indicado." icon={dishIcon} />
              </div>
            </div>
          </Section>
        </>
      )}

      {c && (
        <Section title="Con quién sale y cuánto consume" icon="🧾">
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <Stat icon="👥" label="Personas por salida" value={c.party.avg != null ? c.party.avg.toFixed(1) : "—"} hint={c.party.usual ? `Lo más común: ${c.party.usual}` : undefined} />
            <Stat icon="🧍" label="Sale solo/a" value={c.party.soloPct != null ? `${c.party.soloPct}%` : "—"} hint={c.party.groupPct != null ? `Grupos de 4+: ${c.party.groupPct}%` : undefined} />
            <Stat icon="🧾" label="Cuenta promedio" value={money(c.consumption.avgTicket)} hint={c.consumption.maxTicket ? `La más alta: ${money(c.consumption.maxTicket)}` : undefined} />
            <Stat icon="🍴" label="Por persona" value={money(c.consumption.avgPerPerson)} />
          </div>
          <p className="mt-3 text-[13px] text-stone-500">
            Total consumido en sus visitas registradas: <strong>{money(c.consumption.total)}</strong>
            {c.consumption.samples > 0 ? ` (${c.consumption.samples} cuentas con total capturado)` : " (aún sin totales capturados)"}.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <div className="text-[12px] font-semibold text-stone-500">Cuándo suele salir</div>
              <p className="mt-1 text-[15px] font-bold">{c.habits.day ? <><span aria-hidden="true">{slotIcon(c.habits.slot)} </span>{`${c.habits.day}${c.habits.slot ? `, en la ${c.habits.slot}` : ""}`}</> : "Sin datos"}</p>
            </div>
            <div>
              <div className="text-[12px] font-semibold text-stone-500">Tipos de negocio que visita</div>
              <Chips items={c.visitedTypes.map((t) => `${t.label} (${t.count})`)} empty="Sin datos" icon={(t) => businessIcon(t.replace(/\s*\(\d+\)$/, ""))} />
            </div>
            <div>
              <div className="text-[12px] font-semibold text-stone-500">Ciudades donde consume</div>
              <Chips items={c.cities.map((x) => `${x.label} (${x.count})`)} empty="Sin datos" icon={() => "📍"} />
            </div>
          </div>
        </Section>
      )}

      {p.sector && (
        <Section title="Sector que representa" icon="📍">
          <p className="text-[15px] font-bold">{p.sector.label ?? "Sin definir"}</p>
        </Section>
      )}

      {p.tier === "passport" && (["demografia", "estilo_vida", "movilidad", "medios"] as BlockKey[]).map((k) => <PersonaBlock key={k} p={p} k={k} />)}

      {missingAll.length > 0 && (
        <p className="px-1 text-[12.5px] leading-snug text-stone-500">
          Este MysterFoodie decidió no compartir: {missingAll.map((b) => b.label.toLowerCase()).join(", ")}.
        </p>
      )}
      <p className="px-1 text-[12px] leading-snug text-stone-400">
        Perfil anónimo: se basa en las visitas y respuestas de este MysterFoodie, que decidió qué compartir. No incluye su nombre, foto, datos de contacto ni documentos; rangos y categorías, nunca datos exactos.
      </p>
    </div>
  );
}
