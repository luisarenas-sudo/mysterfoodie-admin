/**
 * Perfil anónimo del MysterFoodie: niveles, bloques y preguntas.
 *
 * Dos niveles que compra un negocio (precios en MXN, sin IVA):
 *  - ID ($350): lo que sale de sus visitas y reseñas (gustos y palabras, consumo y salidas, sector por código postal).
 *  - Passport ($700): el ID + el "buyer persona" completo (demografía, estilo de vida, movilidad y medios).
 * Cada MysterFoodie decide qué BLOQUES comparte. REPARTO: el MysterFoodie recibe el 50 % del PRECIO (MYSTERFOODIE_SHARE_PCT)
 * repartido entre los bloques que comparte: cada bloque gana su % del "escalón" de precio al que pertenece (ID = $350,
 * Passport = los otros $350); los % de cada escalón suman 50. El negocio, además, paga un CARGO POR USO DE LA PLATAFORMA
 * (PLATFORM_FEE_PCT, 10 % sobre el precio) que NO sale de la parte del MysterFoodie. Todo se edita aquí, en un solo lugar.
 * Nunca se guardan documentos: pasaporte y visa son solo sí/no, la edad va en rangos y el auto por categoría.
 */
export type TierKey = "id" | "passport";
export type BlockKey = "gustos" | "consumo" | "sector" | "demografia" | "estilo_vida" | "movilidad" | "medios";

export const TIERS: Record<TierKey, { label: string; price: number; tagline: string }> = {
  id: { label: "ID", price: Number(process.env.MYSTERFOODIE_PROFILE_PRICE_MXN) || 350, tagline: "Gustos, palabras, consumo y sector" },
  passport: { label: "Passport", price: 700, tagline: "El buyer persona completo: estilo de vida, demografía, movilidad y medios" },
};

/** Parte del precio que se lleva el MysterFoodie (50 %), repartida entre los bloques que comparte. */
export const MYSTERFOODIE_SHARE_PCT = 50;

/** Cargo por uso de la plataforma: % que se SUMA al precio y paga el negocio (no se descuenta al MysterFoodie). */
export const PLATFORM_FEE_PCT = Number(process.env.MYSTERFOODIE_PLATFORM_FEE_PCT) || 10;

export function platformFee(price: number): number {
  return Math.round(price * PLATFORM_FEE_PCT) / 100;
}

/** Precio + cargo por uso de la plataforma (sin IVA). */
export function priceWithFee(price: number): number {
  return Math.round((price + platformFee(price)) * 100) / 100;
}

/** Cuánto vale cada escalón para repartir ganancias (ID = 350; Passport = 700 - 350). */
export const TIER_INCREMENT: Record<TierKey, number> = { id: TIERS.id.price, passport: TIERS.passport.price - TIERS.id.price };

/** Mínimo de visitas de un MysterFoodie para entregar bloques Passport (evita identificar a alguien en una ciudad chica). */
export const MIN_VISITS_PASSPORT = 3;

export type FieldDef = {
  key: string;
  label: string;
  /** "one" = una opción; "many" = varias. */
  kind: "one" | "many";
  options: readonly string[];
  /**
   * Pregunta de seguimiento: solo aparece (y es obligatoria) si la respuesta a `field` (del mismo bloque) incluye alguna de
   * `any`, o si está contestada con algo que no está en `notAny`. Así una respuesta abre otras para afinar el perfil.
   */
  when?: { field: string; any?: string[]; notAny?: string[] };
};

export type BlockDef = {
  key: BlockKey;
  tier: TierKey;
  label: string;
  desc: string;
  /** % del escalón que gana el MysterFoodie por cada venta que incluya este bloque. */
  pct: number;
  /** Preguntas que alimentan el bloque (vacío = sale solo de sus visitas). */
  fields: FieldDef[];
};

const NO = "Prefiero no decir";

/**
 * Moods de viaje: lo que ha vivido la persona. Cada mood pertenece a un grupo y, juntos, definen su "tipo de viajero"
 * (el grupo que más se repite en su selección).
 */
export type MoodGroupKey = "cultural" | "sabor" | "ocio" | "activo";
export const MOOD_GROUPS: Record<MoodGroupKey, { label: string; desc: string }> = {
  cultural: { label: "Explorador cultural", desc: "Le mueven los lugares con historia y destinos nuevos" },
  sabor: { label: "Viajero de sabor", desc: "Viaja con el paladar: lo local, lo callejero y lo gourmet" },
  ocio: { label: "Viajero de ocio y lujo", desc: "Playa, compras y buena vida" },
  activo: { label: "Viajero activo", desc: "Deporte, carretera y aventura" },
};
export const TRAVEL_MOODS: { label: string; group: MoodGroupKey }[] = [
  { label: "Pueblos Mágicos", group: "cultural" },
  { label: "EuroTrip", group: "cultural" },
  { label: "AsiaFan", group: "cultural" },
  { label: "Mochilero Mood", group: "cultural" },
  { label: "TEX MEX", group: "sabor" },
  { label: "Foodie Goodie", group: "sabor" },
  { label: "Tacos & Garnachas", group: "sabor" },
  { label: "Beach Babe", group: "ocio" },
  { label: "Casino Player", group: "ocio" },
  { label: "Shopping Susan", group: "ocio" },
  { label: "Cruise Lover", group: "ocio" },
  { label: "Marathon Bunny", group: "activo" },
  { label: "Road Trip", group: "activo" },
];

/** Tipo de viajero que arman sus moods: el grupo dominante (empata por orden del catálogo) y los moods elegidos. */
export function travelerType(moods: string[]): { type: string; desc: string; moods: string[] } | null {
  const picked = TRAVEL_MOODS.filter((m) => moods.includes(m.label));
  if (picked.length === 0) return null;
  const count = new Map<MoodGroupKey, number>();
  for (const m of picked) count.set(m.group, (count.get(m.group) || 0) + 1);
  const order = Object.keys(MOOD_GROUPS) as MoodGroupKey[];
  const best = [...count.entries()].sort((a, b) => b[1] - a[1] || order.indexOf(a[0]) - order.indexOf(b[0]))[0][0];
  return { type: MOOD_GROUPS[best].label, desc: MOOD_GROUPS[best].desc, moods: picked.map((m) => m.label) };
}

export const BLOCKS: BlockDef[] = [
  { key: "gustos", tier: "id", label: "Gustos y palabras", desc: "Tipos de cocina, platillos favoritos y las palabras que más usa en sus reseñas.", pct: 18, fields: [] },
  { key: "consumo", tier: "id", label: "Consumo y salidas", desc: "Con cuántas personas sale, cuenta promedio, totales, dónde consume y cuándo suele salir.", pct: 18, fields: [] },
  { key: "sector", tier: "id", label: "Sector", desc: "Zona económicamente activa o desacelerada, según su código postal (nunca se muestra el código).", pct: 14, fields: [] },
  {
    key: "demografia", tier: "passport", label: "Demografía", desc: "Rango de edad, escolaridad, ocupación y con quién vive.", pct: 12.5,
    fields: [
      { key: "edad", label: "Rango de edad", kind: "one", options: ["18 a 24", "25 a 34", "35 a 44", "45 a 54", "55 o más"] },
      { key: "escolaridad", label: "Escolaridad", kind: "one", options: ["Preparatoria o menos", "Técnica", "Licenciatura", "Posgrado", NO] },
      { key: "ocupacion", label: "Ocupación", kind: "one", options: ["Estudiante", "Empleado/a", "Profesional independiente", "Emprendedor/a", "Servicio público, salud o educación", "Hogar", "Jubilado/a", NO] },
      { key: "giro", label: "¿En qué giro trabajas?", kind: "one", options: ["Gastronomía", "Comercio", "Servicios profesionales", "Salud y bienestar", "Tecnología", "Creativo o marketing", "Otro"], when: { field: "ocupacion", any: ["Empleado/a", "Profesional independiente", "Emprendedor/a"] } },
      { key: "hogar", label: "Con quién vive", kind: "one", options: ["Solo/a", "En pareja", "Familia con hijos", "Con familia o roomies", NO] },
      { key: "hijos", label: "¿Qué edades tienen tus hijos?", kind: "many", options: ["0 a 5 años", "6 a 12 años", "13 a 17 años", "18 o más"], when: { field: "hogar", any: ["Familia con hijos"] } },
    ],
  },
  {
    key: "estilo_vida", tier: "passport", label: "Estilo de vida", desc: "Qué tanto come fuera, cuánto gasta por persona, su dieta, intereses y con quién sale.", pct: 12.5,
    fields: [
      { key: "frecuencia", label: "Veces al mes que come fuera", kind: "one", options: ["1 a 2", "3 a 5", "6 a 10", "Más de 10"] },
      { key: "gasto", label: "Gasto habitual por persona", kind: "one", options: ["Menos de $150", "$150 a $300", "$300 a $600", "Más de $600"] },
      { key: "dieta", label: "Alimentación", kind: "one", options: ["Come de todo", "Vegetariana", "Vegana", "Sin gluten", "Baja en carbohidratos", "Otra"] },
      { key: "dieta_nivel", label: "¿Qué tan estricta eres con tu alimentación?", kind: "one", options: ["Flexible", "Bastante estricta"], when: { field: "dieta", notAny: ["Come de todo"] } },
      { key: "intereses", label: "Intereses", kind: "many", options: ["Fitness y deporte", "Viajes", "Música y conciertos", "Cine y series", "Cocinar en casa", "Mascotas", "Vida nocturna", "Café de especialidad", "Arte y cultura", "Videojuegos", "Playa y aire libre"] },
      { key: "deporte", label: "¿Qué deporte o actividad haces?", kind: "many", options: ["Gimnasio", "Running", "Ciclismo", "Yoga o pilates", "Natación", "Fútbol", "Pádel o tenis"], when: { field: "intereses", any: ["Fitness y deporte"] } },
      { key: "mascota", label: "¿Sales con tu mascota a comer?", kind: "one", options: ["Siempre busco lugares pet friendly", "A veces", "No"], when: { field: "intereses", any: ["Mascotas"] } },
      { key: "salidas", label: "Con quién suele salir", kind: "many", options: ["Pareja", "Amigos", "Familia", "Compañeros de trabajo", "Solo/a"] },
      { key: "ocasion", label: "¿Cuál es tu ocasión más común?", kind: "many", options: ["Antojo del momento", "Comida casual", "Celebraciones", "Cena romántica", "Reunión de trabajo"], when: { field: "salidas", any: ["Pareja", "Amigos", "Familia", "Compañeros de trabajo"] } },
    ],
  },
  {
    key: "movilidad", tier: "passport", label: "Movilidad y viajes", desc: "Auto que maneja, pasaporte o visa vigentes (solo sí/no) y su mood viajero (Pueblos Mágicos, EuroTrip, Beach Babe…).", pct: 12.5,
    fields: [
      { key: "vehiculo", label: "¿Qué maneja?", kind: "one", options: ["No maneja o no tiene", "Moto", "Auto", "Pickup o utilitario"] },
      { key: "auto", label: "¿Qué tipo de auto?", kind: "one", options: ["Sedán o compacto", "Crossover", "SUV mediana", "SUV grande", "Auto de confort", "Híbrido o eléctrico", "Auto de lujo", "Deportivo", "Exótico"], when: { field: "vehiculo", any: ["Auto"] } },
      { key: "estacionamiento", label: "¿Qué tan importante es el estacionamiento al elegir dónde comer?", kind: "one", options: ["Indispensable", "Me ayuda", "Me da igual"], when: { field: "vehiculo", notAny: ["No maneja o no tiene", "Moto"] } },
      { key: "pasaporte", label: "¿Tiene pasaporte vigente?", kind: "one", options: ["Sí", "No"] },
      { key: "extranjero", label: "¿Has viajado al extranjero en el último año?", kind: "one", options: ["Sí", "No"], when: { field: "pasaporte", any: ["Sí"] } },
      { key: "visa", label: "¿Tiene alguna visa vigente?", kind: "one", options: ["Sí", "No"] },
      { key: "moods", label: "¿Qué tipos de viaje has hecho? (tu mood viajero)", kind: "many", options: TRAVEL_MOODS.map((m) => m.label) },
      { key: "comer_viaje", label: "¿Qué buscas comer cuando viajas?", kind: "many", options: ["Comida local", "Street food", "Restaurantes de autor", "Mariscos", "Cafés y postres", "Mercados"], when: { field: "moods", any: ["Foodie Goodie", "Tacos & Garnachas", "TEX MEX"] } },
      { key: "playa", label: "Tu playa ideal", kind: "one", options: ["Tranquila y vacía", "Con ambiente y beach club", "De pueblito", "Todo incluido"], when: { field: "moods", any: ["Beach Babe"] } },
      { key: "carreras", label: "¿Cuántas carreras corres al año?", kind: "one", options: ["1 a 2", "3 a 5", "6 o más"], when: { field: "moods", any: ["Marathon Bunny"] } },
      { key: "viajes", label: "Viajes por placer al año", kind: "one", options: ["Ninguno", "1", "2 a 3", "4 o más"] },
    ],
  },
  {
    key: "medios", tier: "passport", label: "Medios y relación con el medio", desc: "Redes que usa, cómo descubre restaurantes y qué tanto publica reseñas.", pct: 12.5,
    fields: [
      { key: "redes", label: "Redes que usa a diario", kind: "many", options: ["Instagram", "TikTok", "Facebook", "YouTube", "X", "LinkedIn", "WhatsApp (canales)", "Pinterest"] },
      { key: "descubre", label: "Cómo descubre dónde comer", kind: "many", options: ["Instagram o TikTok", "Google Maps", "Recomendación de amigos", "Apps de entrega", "Reseñas en línea", "Medios locales", "Pasa por ahí"] },
      { key: "contenido", label: "¿Qué contenido de comida sigues?", kind: "many", options: ["Reels de restaurantes", "Recetas", "Foodies locales", "Ofertas y promociones", "Viajes y gastronomía"], when: { field: "redes", any: ["Instagram", "TikTok", "YouTube"] } },
      { key: "apps", label: "Apps de entrega que usa", kind: "many", options: ["Uber Eats", "Rappi", "DiDi Food", "Ninguna"] },
      { key: "pide", label: "¿Qué pides más por app?", kind: "one", options: ["Comida completa", "Antojos y snacks", "Comida rápida", "Café y postres", "Súper"], when: { field: "apps", any: ["Uber Eats", "Rappi", "DiDi Food"] } },
      { key: "resenas", label: "¿Publica reseñas?", kind: "one", options: ["Nunca", "A veces", "Casi siempre"] },
      { key: "donde_resenas", label: "¿Dónde publicas tus reseñas?", kind: "many", options: ["Google Maps", "Instagram", "TikTok", "TripAdvisor", "Facebook"], when: { field: "resenas", notAny: ["Nunca"] } },
    ],
  },
];

export const BLOCK_BY_KEY = Object.fromEntries(BLOCKS.map((b) => [b.key, b])) as Record<BlockKey, BlockDef>;
export const BLOCKS_OF_TIER = (tier: TierKey) => BLOCKS.filter((b) => b.tier === tier);
export const ID_BLOCKS: BlockKey[] = BLOCKS_OF_TIER("id").map((b) => b.key);
export const PASSPORT_BLOCKS: BlockKey[] = BLOCKS_OF_TIER("passport").map((b) => b.key);

export function isBlockKey(v: unknown): v is BlockKey {
  return typeof v === "string" && v in BLOCK_BY_KEY;
}

export type Persona = Partial<Record<BlockKey, Record<string, string | string[]>>>;

type Answers = Record<string, string | string[]>;

/** ¿Esta pregunta aplica según las respuestas? (las de seguimiento dependen de otra respuesta, que a su vez debe aplicar) */
export function isFieldActive(block: BlockDef, f: FieldDef, data: Answers): boolean {
  if (!f.when) return true;
  const parent = block.fields.find((x) => x.key === f.when!.field);
  if (!parent || !isFieldActive(block, parent, data)) return false;
  const raw = data[f.when.field];
  const vals = Array.isArray(raw) ? raw : typeof raw === "string" ? [raw] : [];
  if (vals.length === 0) return false;
  if (f.when.any && !f.when.any.some((x) => vals.includes(x))) return false;
  if (f.when.notAny && vals.every((x) => f.when!.notAny!.includes(x))) return false;
  return true;
}

/** Preguntas de un bloque que aplican con las respuestas actuales (en orden). */
export function activeFields(key: BlockKey, persona: Persona): FieldDef[] {
  const b = BLOCK_BY_KEY[key];
  const data = persona[key] ?? {};
  return b.fields.filter((f) => isFieldActive(b, f, data));
}

/** Respuestas guardadas antes de separar «¿Qué maneja?» de «¿Qué tipo de auto?»: el valor viejo de `auto` pasa a `vehiculo` (+ `auto` si era un auto). */
function migrateVehiculo(src: Record<string, unknown>): Record<string, unknown> {
  if (typeof src.vehiculo === "string" || typeof src.auto !== "string") return src;
  const old = src.auto;
  if (["No maneja o no tiene", "Moto", "Pickup o utilitario"].includes(old)) {
    const { auto: _drop, ...rest } = src;
    void _drop;
    return { ...rest, vehiculo: old };
  }
  return { ...src, vehiculo: "Auto" };
}

/** Limpia lo que llega del cliente: solo bloques, preguntas y opciones del catálogo, y sin respuestas de seguimiento que ya no aplican. */
export function sanitizePersona(raw: unknown): Persona {
  const out: Persona = {};
  if (!raw || typeof raw !== "object") return out;
  for (const b of BLOCKS) {
    let src = (raw as Record<string, unknown>)[b.key];
    if (!src || typeof src !== "object") continue;
    if (b.key === "movilidad") src = migrateVehiculo(src as Record<string, unknown>);
    const block: Answers = {};
    for (const f of b.fields) {
      const v = (src as Record<string, unknown>)[f.key];
      if (f.kind === "one") {
        if (typeof v === "string" && f.options.includes(v)) block[f.key] = v;
      } else if (Array.isArray(v)) {
        const picked = [...new Set(v.filter((x): x is string => typeof x === "string" && f.options.includes(x)))];
        if (picked.length) block[f.key] = picked;
      }
    }
    // Quita las respuestas de seguimiento cuya pregunta padre ya no las activa.
    for (const f of b.fields) if (f.when && !isFieldActive(b, f, block)) delete block[f.key];
    if (Object.keys(block).length) out[b.key] = block;
  }
  return out;
}

/** ¿El bloque tiene todas sus preguntas (las que aplican) respondidas? Los de ID no tienen preguntas: siempre completos. */
export function isBlockComplete(key: BlockKey, persona: Persona): boolean {
  const data = persona[key] ?? {};
  return activeFields(key, persona).every((f) => (f.kind === "one" ? typeof data[f.key] === "string" : Array.isArray(data[f.key]) && (data[f.key] as string[]).length > 0));
}

/** Ganancia por un conjunto de bloques vendidos: cada bloque paga su % del escalón al que pertenece. */
export function earningsForBlocks(blocks: BlockKey[]): number {
  const total = blocks.reduce((a, k) => a + (BLOCK_BY_KEY[k].pct / 100) * TIER_INCREMENT[BLOCK_BY_KEY[k].tier], 0);
  return Math.round(total * 100) / 100;
}

/** Lo que gana un MysterFoodie por una venta de `tier`, dado los bloques que comparte. `onlyIncrement` = solo ese escalón (mejora ID -> Passport). */
export function earningsFor(tier: TierKey, shared: BlockKey[], opts: { onlyIncrement?: boolean } = {}): { amount: number; blocks: BlockKey[] } {
  const tiers: TierKey[] = tier === "passport" ? (opts.onlyIncrement ? ["passport"] : ["id", "passport"]) : ["id"];
  let amount = 0;
  const blocks: BlockKey[] = [];
  for (const t of tiers) {
    for (const b of BLOCKS_OF_TIER(t)) {
      if (!shared.includes(b.key)) continue;
      amount += (b.pct / 100) * TIER_INCREMENT[t];
      blocks.push(b.key);
    }
  }
  return { amount: Math.round(amount * 100) / 100, blocks };
}

export const MAX_EARNINGS_PER_SALE = earningsFor("passport", BLOCKS.map((b) => b.key)).amount;
export const MAX_EARNINGS_ID = earningsFor("id", ID_BLOCKS).amount;

/** Mensaje comercial para Servicios, Mi negocio y correos. */
export const PERFIL_PITCH_TITLE = "Destapa el perfil de tu MysterFoodie";
export const PERFIL_PITCH =
  "Conoce más sobre su estilo de vida, el tipo de restaurantes que frecuenta y sus generalidades demográficas: el buyer persona completo de quien te visitó, con su anonimato garantizado.";
