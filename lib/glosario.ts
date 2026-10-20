/**
 * Qué significa cada palabra de la marca, en lenguaje de todos los días.
 * SOLO se usa en los correos de PRIMER contacto, y como aclaración entre paréntesis dentro del
 * texto ("Soy tu MysterFoodie (así llamamos a nuestros mystery shoppers calificados)"); nunca como
 * bloque aparte ni dentro de la app. En la web se explica con una nota emergente al pasar el mouse
 * (mysterfoodie.com: TIPS en web/_src/build.py): si cambia una definición, cámbiala allá también.
 * Módulo SIN dependencias de servidor.
 */

export type GlosarioKey =
  | "mysterfoodie"
  | "shopper"
  | "sibarita"
  | "master_chef"
  | "uni"
  | "starter"
  | "appetizer"
  | "main_course";

export type GlosarioEntry = {
  key: GlosarioKey;
  term: string;
  emoji: string;
  /** Qué es y para qué sirve, en una o dos frases. */
  def: string;
  /** Aclaración corta para ponerla entre paréntesis justo después de la palabra. */
  short: string;
};

export const GLOSARIO: Record<GlosarioKey, GlosarioEntry> = {
  mysterfoodie: {
    key: "mysterfoodie",
    term: "MysterFoodie",
    emoji: "🕵️",
    def: "Quien te visita: un profesional de la industria restaurantera que llega como un cliente más, consume, paga su cuenta y evalúa la experiencia con los mismos 52 indicadores. Es un «cliente misterioso» con apellido gastronómico. Todas las personas de nuestro equipo somos MysterFoodies.",
    short: "así llamamos a nuestros mystery shoppers calificados",
  },
  shopper: {
    key: "shopper",
    term: "Shopper",
    emoji: "🌱",
    def: "El primer rango del equipo: hace las visitas que se le asignan y registra la evaluación desde su celular.",
    short: "el primer rango del equipo: hace las visitas que se le asignan",
  },
  sibarita: {
    key: "sibarita",
    term: "Sibarita",
    emoji: "🍷",
    def: "El rango intermedio: además de visitar, añade nuevos negocios y asigna visitas a Shoppers.",
    short: "rango intermedio: visita, da de alta negocios y asigna visitas",
  },
  master_chef: {
    key: "master_chef",
    term: "Master Chef",
    emoji: "👨‍🍳",
    def: "Quien coordina toda la red: administra negocios, equipo y visitas, y da seguimiento a cada resultado.",
    short: "quien coordina toda la red y da seguimiento a cada resultado",
  },
  uni: {
    key: "uni",
    term: "MysterFoodie Uni",
    emoji: "🎓",
    def: "Nuestro programa de formación y certificación para quienes quieren evaluar restaurantes y bares con criterio profesional. Estamos preparándolo: quien se apunta a la lista de espera es de los primeros en enterarse.",
    short: "nuestro programa de formación y certificación, en preparación",
  },
  starter: {
    key: "starter",
    term: "Starter",
    emoji: "🥗",
    def: "La entrada: plan mensual para 1 sucursal, con 3 visitas al mes.",
    short: "plan de entrada: 1 sucursal, 3 visitas al mes",
  },
  appetizer: {
    key: "appetizer",
    term: "Appetizer",
    emoji: "🍤",
    def: "El aperitivo: plan mensual para 3 sucursales, con 4 visitas al mes en cada una.",
    short: "plan de 3 sucursales, 4 visitas al mes en cada una",
  },
  main_course: {
    key: "main_course",
    term: "Main course",
    emoji: "🍽️",
    def: "El plato fuerte: plan mensual para 4 a 5 sucursales, con 4 visitas al mes en cada una.",
    short: "plan de 4 a 5 sucursales, 4 visitas al mes en cada una",
  },
};

/** Grupos listos para cada tipo de primer contacto. */
export const GLOSARIO_NEGOCIO: GlosarioKey[] = ["mysterfoodie", "starter", "appetizer", "main_course"];
export const GLOSARIO_EQUIPO: GlosarioKey[] = ["mysterfoodie", "master_chef", "sibarita", "shopper", "uni"];

export function glosarioEntries(keys: GlosarioKey[]): GlosarioEntry[] {
  return keys.map((k) => GLOSARIO[k]).filter(Boolean);
}

/**
 * Primer contacto: pone la aclaración corta entre paréntesis justo después de la PRIMERA vez que aparece
 * cada palabra (si no aparece, no se agrega nada). Respeta el **negrita** de los textos de plantilla.
 */
export function annotateFirst(text: string, keys: GlosarioKey[] | undefined): string {
  if (!keys || keys.length === 0 || !text) return text;
  let out = text;
  // Primero los términos largos ("MysterFoodie Uni") para que no los gane "MysterFoodie".
  const entries = glosarioEntries(keys).sort((a, b) => b.term.length - a.term.length);
  for (const g of entries) {
    const esc = g.term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // Con "MysterFoodie" no cuenta "Palabra MysterFoodie" (es el lema) ni "MysterFoodie Uni" (otro término).
    const lookbehind = g.key === "mysterfoodie" ? "(?<!Palabra )" : "";
    const lookahead = g.key === "mysterfoodie" ? "(?! Uni)" : "";
    const re = new RegExp(`${lookbehind}\\b${esc}s?${lookahead}(\\*\\*)?(?![\\w@]|\\.\\w)`);
    const m = re.exec(out);
    if (!m) continue;
    const at = m.index + m[0].length;
    // No anotar dos veces lo mismo ni encimar sobre un paréntesis ya existente.
    if (out.slice(at).startsWith(" (")) continue;
    out = out.slice(0, at) + ` (${g.short})` + out.slice(at);
  }
  return out;
}
