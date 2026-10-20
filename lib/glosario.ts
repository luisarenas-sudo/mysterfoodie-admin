/**
 * "Nuestro mundo": qué significa cada palabra de la marca, en lenguaje de todos los días.
 * Fuente única para los correos de primer contacto, las pantallas de bienvenida y el
 * reporte en línea (la web, mysterfoodie.com/metodologia, tiene su propia versión en
 * Preguntas frecuentes: si cambia una definición, cámbiala allá también).
 * Módulo SIN dependencias de servidor: se usa en pantallas y en correos.
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
};

export const GLOSARIO: Record<GlosarioKey, GlosarioEntry> = {
  mysterfoodie: {
    key: "mysterfoodie",
    term: "MysterFoodie",
    emoji: "🕵️",
    def: "Quien te visita: un profesional de la industria restaurantera que llega como un cliente más, consume, paga su cuenta y evalúa la experiencia con los mismos 52 indicadores. Es un «cliente misterioso» con apellido gastronómico. Todas las personas de nuestro equipo somos MysterFoodies.",
  },
  shopper: {
    key: "shopper",
    term: "Shopper",
    emoji: "🌱",
    def: "El primer rango del equipo: hace las visitas que se le asignan y registra la evaluación desde su celular.",
  },
  sibarita: {
    key: "sibarita",
    term: "Sibarita",
    emoji: "🍷",
    def: "El rango intermedio: además de visitar, añade nuevos negocios y asigna visitas a Shoppers.",
  },
  master_chef: {
    key: "master_chef",
    term: "Master Chef",
    emoji: "👨‍🍳",
    def: "Quien coordina toda la red: administra negocios, equipo y visitas, y da seguimiento a cada resultado.",
  },
  uni: {
    key: "uni",
    term: "MysterFoodie Uni",
    emoji: "🎓",
    def: "Nuestro programa de formación y certificación para quienes quieren evaluar restaurantes y bares con criterio profesional. Estamos preparándolo: quien se apunta a la lista de espera es de los primeros en enterarse.",
  },
  starter: {
    key: "starter",
    term: "Starter",
    emoji: "🥗",
    def: "La entrada: plan mensual para 1 sucursal, con 3 visitas al mes.",
  },
  appetizer: {
    key: "appetizer",
    term: "Appetizer",
    emoji: "🍤",
    def: "El aperitivo: plan mensual para 3 sucursales, con 4 visitas al mes en cada una.",
  },
  main_course: {
    key: "main_course",
    term: "Main course",
    emoji: "🍽️",
    def: "El plato fuerte: plan mensual para 4 a 5 sucursales, con 4 visitas al mes en cada una.",
  },
};

/** Grupos listos para cada tipo de primer contacto. */
export const GLOSARIO_NEGOCIO: GlosarioKey[] = ["mysterfoodie", "starter", "appetizer", "main_course"];
export const GLOSARIO_EQUIPO: GlosarioKey[] = ["mysterfoodie", "master_chef", "sibarita", "shopper", "uni"];

export function glosarioEntries(keys: GlosarioKey[]): GlosarioEntry[] {
  return keys.map((k) => GLOSARIO[k]).filter(Boolean);
}
