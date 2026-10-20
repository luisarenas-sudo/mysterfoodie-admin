/**
 * Nombre anónimo (alias) de cada MysterFoodie: nombre de una especia singular (no mezclas como hierbas provenzales)
 * + apellido de una figura reconocida. Ej.: "Canela Hayek", "Comino Infante". Según el estilo elegido:
 *  - femenino: especia de nombre femenino + apellido de actriz mexicana muy conocida.
 *  - masculino: especia de nombre masculino + apellido de actor mexicano muy conocido.
 *  - no binarie: fruta o verdura que termina en "e" (Chile, Aguacate, Elote…) + apellido de personas reconocidas del
 *    mundo LGBT+ de todo el mundo.
 * La liga pública es go.mysterfoodie.com/<slug>, p. ej. go.mysterfoodie.com/canela-hayek.
 */
export type AliasStyle = "femenino" | "masculino" | "no_binarie";

export const ALIAS_STYLES: { value: AliasStyle; label: string; example: string }[] = [
  { value: "femenino", label: "Femenino", example: "Canela Hayek" },
  { value: "masculino", label: "Masculino", example: "Comino Infante" },
  { value: "no_binarie", label: "No binarie", example: "Chile Mercury" },
];

const NOMBRES: Record<AliasStyle, string[]> = {
  femenino: ["Canela", "Vainilla", "Pimienta", "Cúrcuma", "Mostaza", "Cayena", "Paprika", "Alcaravea", "Amapola", "Albahaca", "Salvia", "Mejorana", "Hierbabuena", "Menta", "Cebollina", "Jamaica", "Chía", "Nigella"],
  masculino: ["Comino", "Clavo", "Azafrán", "Cardamomo", "Jengibre", "Anís", "Achiote", "Orégano", "Laurel", "Romero", "Tomillo", "Eneldo", "Estragón", "Sésamo", "Ajonjolí", "Pimentón", "Sumac", "Cilantro", "Perejil", "Epazote", "Fenogreco", "Tamarindo", "Wasabi"],
  no_binarie: ["Chile", "Tomate", "Jitomate", "Aguacate", "Chayote", "Camote", "Elote", "Zapote", "Tejocote", "Xoconostle", "Nance", "Ejote", "Quelite", "Cacahuate", "Jocote", "Ñame", "Chilacayote", "Huauzontle", "Chicozapote", "Guaje"],
};

const APELLIDOS: Record<AliasStyle, string[]> = {
  femenino: ["Hayek", "Castillo", "Reguera", "Aparicio", "Félix", "Pinal", "Jurado", "Medina", "Bracho", "Barraza", "Castro", "Cantoral", "Guerra", "Talancón", "Sigman", "Tavira", "Souza", "Andere", "Del Río", "Lavín"],
  masculino: ["Infante", "Bernal", "Luna", "Huerta", "Bichir", "Cosío", "Alcázar", "Negrete", "Valdés", "Armendáriz", "Tarso", "Córdova", "Derbez", "Herrera", "Becker", "Méndez", "Bonilla", "Cacho", "Moreno", "Quinn"],
  no_binarie: ["Mercury", "Wilde", "Milk", "Turing", "Baldwin", "Lorde", "Rustin", "Haring", "Almodóvar", "Hockney", "Cox", "Page", "Cumming", "Novo", "Johnson", "Rivera", "Ride", "Bowie", "Kahlo", "Villaurrutia"],
};

export function isAliasStyle(v: unknown): v is AliasStyle {
  return v === "femenino" || v === "masculino" || v === "no_binarie";
}

/** "Canela Hayek" -> "lima-hayek" (sin acentos, minúsculas, guiones). */
export function aliasSlug(alias: string): string {
  return alias
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/ñ/g, "n")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const pick = <T,>(list: T[]): T => list[Math.floor(Math.random() * list.length)];

/** Un alias al azar que no esté en `taken` (conjunto de slugs ya usados). */
export function pickAlias(style: AliasStyle, taken: Set<string>): string {
  for (let i = 0; i < 300; i++) {
    const alias = `${pick(NOMBRES[style])} ${pick(APELLIDOS[style])}`;
    if (!taken.has(aliasSlug(alias))) return alias;
  }
  // Casi imposible: se agrega un número para no repetir.
  let n = 2;
  const base = `${pick(NOMBRES[style])} ${pick(APELLIDOS[style])}`;
  while (taken.has(aliasSlug(`${base} ${n}`))) n++;
  return `${base} ${n}`;
}

/** ¿Es un alias válido de ese estilo (nombre y apellido de las listas)? Evita que el cliente invente uno. */
export function isValidAlias(style: AliasStyle, alias: string): boolean {
  const [nombre, ...rest] = alias.trim().split(/\s+/);
  const apellido = rest.join(" ");
  return NOMBRES[style].includes(nombre) && APELLIDOS[style].includes(apellido);
}
