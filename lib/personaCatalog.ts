/**
 * Perfil anónimo del MysterFoodie: niveles, bloques y preguntas.
 *
 * Dos niveles que compra un negocio (precios en MXN, sin IVA):
 *  - ID ($350): lo que sale de sus visitas y reseñas (gustos y palabras, consumo y salidas, sector por código postal).
 *  - Passport ($700): el ID + el "buyer persona" completo (demografía, estilo de vida, movilidad y medios).
 * Cada MysterFoodie decide qué BLOQUES comparte; por cada bloque compartido gana un porcentaje fijo del "escalón" de precio
 * al que pertenece el bloque (ID = $350, Passport = los otros $350). Los porcentajes se editan aquí, en un solo lugar.
 * Nunca se guardan documentos: pasaporte y visa son solo sí/no, la edad va en rangos y el auto por categoría.
 */
export type TierKey = "id" | "passport";
export type BlockKey = "gustos" | "consumo" | "sector" | "demografia" | "estilo_vida" | "movilidad" | "medios";

export const TIERS: Record<TierKey, { label: string; price: number; tagline: string }> = {
  id: { label: "ID", price: Number(process.env.MYSTERFOODIE_PROFILE_PRICE_MXN) || 350, tagline: "Gustos, palabras, consumo y sector" },
  passport: { label: "Passport", price: 700, tagline: "El buyer persona completo: estilo de vida, demografía, movilidad y medios" },
};

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
  { key: "gustos", tier: "id", label: "Gustos y palabras", desc: "Tipos de cocina, platillos favoritos y las palabras que más usa en sus reseñas.", pct: 8, fields: [] },
  { key: "consumo", tier: "id", label: "Consumo y salidas", desc: "Con cuántas personas sale, cuenta promedio, totales, dónde consume y cuándo suele salir.", pct: 8, fields: [] },
  { key: "sector", tier: "id", label: "Sector", desc: "Zona económicamente activa o desacelerada, según su código postal (nunca se muestra el código).", pct: 6, fields: [] },
  {
    key: "demografia", tier: "passport", label: "Demografía", desc: "Rango de edad, escolaridad, ocupación y con quién vive.", pct: 8,
    fields: [
      { key: "edad", label: "Rango de edad", kind: "one", options: ["18 a 24", "25 a 34", "35 a 44", "45 a 54", "55 o más"] },
      { key: "escolaridad", label: "Escolaridad", kind: "one", options: ["Preparatoria o menos", "Técnica", "Licenciatura", "Posgrado", NO] },
      { key: "ocupacion", label: "Ocupación", kind: "one", options: ["Estudiante", "Empleado/a", "Profesional independiente", "Emprendedor/a", "Servicio público, salud o educación", "Hogar", "Jubilado/a", NO] },
      { key: "hogar", label: "Con quién vive", kind: "one", options: ["Solo/a", "En pareja", "Familia con hijos", "Con familia o roomies", NO] },
    ],
  },
  {
    key: "estilo_vida", tier: "passport", label: "Estilo de vida", desc: "Qué tanto come fuera, cuánto gasta por persona, su dieta, intereses y con quién sale.", pct: 8,
    fields: [
      { key: "frecuencia", label: "Veces al mes que come fuera", kind: "one", options: ["1 a 2", "3 a 5", "6 a 10", "Más de 10"] },
      { key: "gasto", label: "Gasto habitual por persona", kind: "one", options: ["Menos de $150", "$150 a $300", "$300 a $600", "Más de $600"] },
      { key: "dieta", label: "Alimentación", kind: "one", options: ["Come de todo", "Vegetariana", "Vegana", "Sin gluten", "Baja en carbohidratos", "Otra"] },
      { key: "intereses", label: "Intereses", kind: "many", options: ["Fitness y deporte", "Viajes", "Música y conciertos", "Cine y series", "Cocinar en casa", "Mascotas", "Vida nocturna", "Café de especialidad", "Arte y cultura", "Videojuegos", "Playa y aire libre"] },
      { key: "salidas", label: "Con quién suele salir", kind: "many", options: ["Pareja", "Amigos", "Familia", "Compañeros de trabajo", "Solo/a"] },
    ],
  },
  {
    key: "movilidad", tier: "passport", label: "Movilidad y viajes", desc: "Auto que maneja, pasaporte o visa vigentes (solo sí/no) y su mood viajero (Pueblos Mágicos, EuroTrip, Beach Babe…).", pct: 8,
    fields: [
      { key: "auto", label: "Vehículo que maneja", kind: "one", options: ["No maneja o no tiene", "Moto", "Sedán o compacto", "Crossover", "SUV mediana", "SUV grande", "Pickup o utilitario", "Auto de confort", "Híbrido o eléctrico", "Auto de lujo", "Deportivo", "Exótico"] },
      { key: "pasaporte", label: "¿Tiene pasaporte vigente?", kind: "one", options: ["Sí", "No"] },
      { key: "visa", label: "¿Tiene alguna visa vigente?", kind: "one", options: ["Sí", "No"] },
      { key: "moods", label: "¿Qué tipos de viaje has hecho? (tu mood viajero)", kind: "many", options: TRAVEL_MOODS.map((m) => m.label) },
      { key: "viajes", label: "Viajes por placer al año", kind: "one", options: ["Ninguno", "1", "2 a 3", "4 o más"] },
    ],
  },
  {
    key: "medios", tier: "passport", label: "Medios y relación con el medio", desc: "Redes que usa, cómo descubre restaurantes y qué tanto publica reseñas.", pct: 8,
    fields: [
      { key: "redes", label: "Redes que usa a diario", kind: "many", options: ["Instagram", "TikTok", "Facebook", "YouTube", "X", "LinkedIn", "WhatsApp (canales)", "Pinterest"] },
      { key: "descubre", label: "Cómo descubre dónde comer", kind: "many", options: ["Instagram o TikTok", "Google Maps", "Recomendación de amigos", "Apps de entrega", "Reseñas en línea", "Medios locales", "Pasa por ahí"] },
      { key: "apps", label: "Apps de entrega que usa", kind: "many", options: ["Uber Eats", "Rappi", "DiDi Food", "Ninguna"] },
      { key: "resenas", label: "¿Publica reseñas?", kind: "one", options: ["Nunca", "A veces", "Casi siempre"] },
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

/** Limpia lo que llega del cliente: solo bloques, preguntas y opciones del catálogo. */
export function sanitizePersona(raw: unknown): Persona {
  const out: Persona = {};
  if (!raw || typeof raw !== "object") return out;
  for (const b of BLOCKS) {
    const src = (raw as Record<string, unknown>)[b.key];
    if (!src || typeof src !== "object") continue;
    const block: Record<string, string | string[]> = {};
    for (const f of b.fields) {
      const v = (src as Record<string, unknown>)[f.key];
      if (f.kind === "one") {
        if (typeof v === "string" && f.options.includes(v)) block[f.key] = v;
      } else if (Array.isArray(v)) {
        const picked = [...new Set(v.filter((x): x is string => typeof x === "string" && f.options.includes(x)))];
        if (picked.length) block[f.key] = picked;
      }
    }
    if (Object.keys(block).length) out[b.key] = block;
  }
  return out;
}

/** ¿El bloque tiene todas sus preguntas respondidas? (los de ID no tienen preguntas: siempre completos) */
export function isBlockComplete(key: BlockKey, persona: Persona): boolean {
  const b = BLOCK_BY_KEY[key];
  const data = persona[key] ?? {};
  return b.fields.every((f) => (f.kind === "one" ? typeof data[f.key] === "string" : Array.isArray(data[f.key]) && (data[f.key] as string[]).length > 0));
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
