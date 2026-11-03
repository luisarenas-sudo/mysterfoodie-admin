import { Pix } from "@/components/ui/Pix";
import type { MysterfoodieProfile } from "@/lib/mysterfoodieProfile";
import { BLOCK_BY_KEY, BLOCKS_OF_TIER, TIERS, TIER_EMOJI, travelerType, type BlockKey } from "@/lib/personaCatalog";
import { optionIcon } from "@/lib/personaUi";
import { businessIcon, cuisineIcon, dishIcon, slotIcon, tagIcon } from "@/lib/iconos";

/**
 * Perfil anónimo del MysterFoodie como «expediente de investigación» (mismo lenguaje del PDF y la web: etiquetas en monoespaciada,
 * barras negras, foto polaroid con clip). ID (🪪) = hoja sencilla con acento rojo; Passport (👑) = hoja de doble borde con acento morado.
 * Estilos en app/globals.css (.exp-*). Iconos: solo emojis nativos (regla de la app).
 */

const money = (n: number | null) =>
  n == null ? "—" : n.toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 });

function Bar({ children }: { children: React.ReactNode }) {
  return <h2 className="exp-bar">{children}</h2>;
}

function Tags({ items, empty, icon, tone }: { items: string[]; empty: string; icon?: (t: string) => string; tone?: "good" | "warn" }) {
  if (items.length === 0) return <p className="text-[14px]" style={{ color: "#6B6B73" }}>{empty}</p>;
  return (
    <div className="exp-tags">
      {items.map((t) => (
        <span key={t} className={`exp-tag${tone ? ` ${tone}` : ""}`}>
          {icon && <Pix e={icon(t)} size={16} />}
          {t}
        </span>
      ))}
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="exp-stat">
      <div className="v">{value}</div>
      <div className="l">{label}</div>
      {hint && <div className="h">{hint}</div>}
    </div>
  );
}

/** Etiquetas en tercera persona para el negocio (en el cuestionario del MysterFoodie están redactadas como pregunta en segunda persona). */
const LABEL: Record<string, string> = {
  giro: "Giro", hijos: "Edades de sus hijos", dieta_nivel: "Qué tan estricta es", deporte: "Actividad física", mascota: "Sale con su mascota",
  ocasion: "Ocasión más común", salidas: "Suele salir con", vehiculo: "Qué maneja", auto: "Tipo de auto", estacionamiento: "Estacionamiento al elegir",
  pasaporte: "Pasaporte vigente", extranjero: "Viajó al extranjero el último año", visa: "Visa vigente", comer_viaje: "Qué busca comer al viajar",
  playa: "Playa ideal", carreras: "Carreras al año", contenido: "Contenido de comida que sigue", pide: "Qué pide más por app", resenas: "Publica reseñas",
  donde_resenas: "Dónde publica reseñas",
};

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{children}</dd>
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

/** Campos de Movilidad que se muestran combinados (vehículo + auto; pasaporte + viaje + visa). */
const MERGED = new Set(["vehiculo", "auto", "pasaporte", "extranjero", "visa"]);

function PersonaBlock({ p, k }: { p: MysterfoodieProfile; k: BlockKey }) {
  const def = BLOCK_BY_KEY[k];
  const data = p.persona[k];
  if (!data) return null;
  const traveler = k === "movilidad" ? travelerType(asArr(data.moods)) : null;
  const fields = def.fields.filter((f) => f.key !== "moods" && !MERGED.has(f.key) && asArr(data[f.key]).length > 0); // los moods ya salen en «Tipo de viajero»
  const first = (key: string) => asArr(data[key])[0];
  const car = [first("vehiculo"), first("auto")].filter((x): x is string => !!x && !x.startsWith("No maneja"));
  const docs = [
    first("pasaporte") && `Pasaporte: ${first("pasaporte")}`,
    first("extranjero") && `Viajó al extranjero el último año: ${first("extranjero")}`,
    first("visa") && `Visa: ${first("visa")}`,
  ].filter((x): x is string => !!x);
  return (
    <section className="exp-sec">
      <h3 className="exp-h3">{def.label}</h3>
      {traveler && (
        <div className="exp-viajero">
          <b>{traveler.type}</b>
          <span>{traveler.desc}</span>
          <div className="mt-3"><Tags items={traveler.moods} empty="—" icon={(t) => optionIcon("movilidad", "moods", t)} /></div>
        </div>
      )}
      <dl className="exp-kv">
        {k === "movilidad" && first("vehiculo") && (
          <Row label="Qué maneja"><Pix e={optionIcon(k, "vehiculo", first("vehiculo")!)} size={16} /> {car.length ? car.join(" · ") : first("vehiculo")}</Row>
        )}
        {fields.map((f) => {
          const vals = asArr(data[f.key]);
          return (
            <Row key={f.key} label={LABEL[f.key] ?? f.label}>
              {f.kind === "many" ? <Tags items={vals} empty="—" icon={(t) => optionIcon(k, f.key, t)} /> : <><Pix e={optionIcon(k, f.key, vals[0])} size={16} /> {vals[0]}</>}
            </Row>
          );
        })}
        {k === "movilidad" && docs.length > 0 && (
          <Row label="Documentos de viaje"><Tags items={docs} empty="—" icon={(t) => (t.endsWith("Sí") ? "✅" : "➖")} /></Row>
        )}
      </dl>
    </section>
  );
}

/** Perfil anónimo de un MysterFoodie, solo con lo que el nivel comprado incluye y lo que él decidió compartir. */
export default function MysterfoodieProfileView({ profile: p }: { profile: MysterfoodieProfile }) {
  const g = p.gustos;
  const c = p.consumo;
  const maxWord = Math.max(1, ...(g?.words.map((w) => w.count) ?? [1]));
  const passport = p.tier === "passport";
  const summary = passport ? personaSummary(p) : null;
  const missing = BLOCKS_OF_TIER(passport ? "passport" : "id").filter((b) => !p.blocks.includes(b.key));
  const missingAll = passport ? [...BLOCKS_OF_TIER("id").filter((b) => !p.blocks.includes(b.key)), ...missing] : missing;
  const nivel = TIERS[p.tier].label;
  const emoji = TIER_EMOJI[p.tier];

  const sectorRow = p.sector ? (
    <Row label="Sector que representa">
      {p.sector.label ?? "Sin definir"}
    </Row>
  ) : null;

  return (
    <article className={`exp ${passport ? "exp-passport" : "exp-id"}`}>
      <div className="exp-tab"><Pix e={emoji} size={14} /> Nivel {nivel}</div>
      <div className="exp-sheet">
        <div className="exp-sello" aria-hidden="true"><span className="e">{emoji}</span>{passport ? "Passport" : "ID"}</div>

        <header className="exp-head">
          <figure className="exp-polaroid">
            <svg className="clip" width="22" height="62" viewBox="0 0 22 62" fill="none" stroke="#8d8d93" strokeWidth="3" strokeLinecap="round" aria-hidden="true"><path d="M6 52V12a5 5 0 0 1 10 0v36a3 3 0 0 1-6 0V15" /></svg>
            <div className="photo"><img src="/silueta-logo.png" alt="" width={130} height={130} /></div>
            <figcaption><b>FOTO: SILUETA</b>su rostro nunca se muestra</figcaption>
          </figure>
          <div>
            <p className="exp-eyebrow">Expediente anónimo · nivel {nivel}</p>
            <h1 className="exp-alias">{p.alias}</h1>
            <dl className="exp-meta">
              <div><dt>Rango</dt><dd>{p.rankLabel}</dd></div>
              <div><dt>Visitas</dt><dd>{p.visits}</dd></div>
              {p.monthsActive >= 1 && <div><dt>En el equipo</dt><dd>{p.monthsActive} {p.monthsActive === 1 ? "mes" : "meses"}</dd></div>}
              {c?.strictness.label && <div><dt>Cómo califica</dt><dd>{c.strictness.label}</dd></div>}
            </dl>
          </div>
        </header>

        {summary && (
          <section className="exp-sec">
            <Bar>En una frase</Bar>
            <p className="exp-quote">{summary}</p>
          </section>
        )}

        {g && (
          <div className="exp-grid cols2">
            <section>
              <Bar>Sus gustos</Bar>
              <div className="exp-body">
                <h3 className="exp-sub">Tipos de cocina</h3>
                <Tags items={g.tastes.cuisines} empty="Aún no los ha indicado." icon={cuisineIcon} />
                <div className="h-5" />
                <h3 className="exp-sub">Platillos favoritos</h3>
                <Tags items={g.tastes.dishes} empty="Aún no los ha indicado." icon={dishIcon} />
              </div>
            </section>
            <section>
              <Bar>Cómo reseña</Bar>
              <div className="exp-body">
                <h3 className="exp-sub">Palabras que más usa</h3>
                {g.words.length === 0 ? (
                  <p className="text-[14px]" style={{ color: "#6B6B73" }}>Aún no tiene suficientes reseñas para detectar palabras frecuentes.</p>
                ) : (
                  <div className="exp-words">
                    {g.words.map((w) => (
                      <span key={w.word} className="font-semibold" style={{ fontSize: `${14 + Math.round((w.count / maxWord) * 12)}px`, opacity: 0.6 + (w.count / maxWord) * 0.4 }}>
                        {w.word}
                      </span>
                    ))}
                  </div>
                )}
                {g.likes.good.length > 0 && (
                  <>
                    <h3 className="exp-sub">Lo que más destaca</h3>
                    <Tags items={g.likes.good.map((x) => x.tag)} empty="—" icon={tagIcon} tone="good" />
                    <div className="h-5" />
                  </>
                )}
                {g.likes.improve.length > 0 && (
                  <>
                    <h3 className="exp-sub">Lo que señala para mejorar</h3>
                    <Tags items={g.likes.improve.map((x) => x.tag)} empty="—" icon={tagIcon} tone="warn" />
                  </>
                )}
              </div>
            </section>
          </div>
        )}

        {c && (
          <section className="exp-sec">
            <Bar>Con quién sale y cuánto consume</Bar>
            <div className="exp-body">
              <div className="exp-stats">
                <Stat label="Personas por salida" value={c.party.avg != null ? c.party.avg.toFixed(1) : "—"} hint={c.party.usual ? `lo más común: ${c.party.usual}` : undefined} />
                <Stat label="Sale solo/a" value={c.party.soloPct != null ? `${c.party.soloPct}%` : "—"} hint={c.party.groupPct != null ? `grupos de 4+: ${c.party.groupPct}%` : undefined} />
                <Stat label="Cuenta promedio" value={money(c.consumption.avgTicket)} hint={c.consumption.maxTicket ? `la más alta: ${money(c.consumption.maxTicket)}` : undefined} />
                <Stat label="Por persona" value={money(c.consumption.avgPerPerson)} />
              </div>
              <dl className="exp-kv">
                <Row label="Total consumido">
                  {money(c.consumption.total)}
                  <span style={{ fontWeight: 500, color: "#6B6B73" }}>{c.consumption.samples > 0 ? ` · ${c.consumption.samples} cuentas con total capturado` : " · aún sin totales capturados"}</span>
                </Row>
                <Row label="Cuándo suele salir">
                  {c.habits.day ? <><Pix e={slotIcon(c.habits.slot)} size={16} /> {`${c.habits.day}${c.habits.slot ? `, en la ${c.habits.slot}` : ""}`}</> : "Sin datos"}
                </Row>
                <Row label="Tipos de negocio">
                  <Tags items={c.visitedTypes.map((t) => `${t.label} (${t.count})`)} empty="Sin datos" icon={(t) => businessIcon(t.replace(/\s*\(\d+\)$/, ""))} />
                </Row>
                <Row label="Ciudades donde consume">
                  <Tags items={c.cities.map((x) => `${x.label} (${x.count})`)} empty="Sin datos" icon={() => "📍"} />
                </Row>
                {sectorRow}
              </dl>
            </div>
          </section>
        )}

        {!c && sectorRow && (
          <section className="exp-sec">
            <Bar>Sector que representa</Bar>
            <div className="exp-body"><dl className="exp-kv">{sectorRow}</dl></div>
          </section>
        )}

        {passport && (
          <section className="exp-sec">
            <Bar>Passport · el buyer persona</Bar>
            <div className="exp-grid cols2" style={{ marginTop: 22 }}>
              {(["demografia", "estilo_vida", "movilidad", "medios"] as BlockKey[]).map((k) => <PersonaBlock key={k} p={p} k={k} />)}
            </div>
          </section>
        )}

        <footer className="exp-foot">
          {missingAll.length > 0 && <p>Este MysterFoodie decidió no compartir: {missingAll.map((b) => b.label.toLowerCase()).join(", ")}.</p>}
          <p>Perfil anónimo: se basa en las visitas y respuestas de este MysterFoodie, que decidió qué compartir. No incluye su nombre, foto, datos de contacto ni documentos; rangos y categorías, nunca datos exactos.</p>
        </footer>
      </div>
    </article>
  );
}
