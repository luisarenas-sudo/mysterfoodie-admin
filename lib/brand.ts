/**
 * Textos de marca que se repiten en varias pantallas (reporte público,
 * Perfil, correos, PDF). Viven aquí para que un cambio de redacción se
 * haga una sola vez y no queden versiones distintas por la app.
 */

/** Frase de "Palabra MysterFoodie" (sin comillas; cada pantalla pone las suyas). */
export const PALABRA_FOODIE_QUOTE =
  "Palabra MysterFoodie, orgullo sibarita: ponemos la boca en el plato y la firma en la verdad.";

/**
 * Quién es el MysterFoodie, en una sola frase para web, app, PDF y correos
 * (la misma que usa mysterfoodie.com en Nosotros y Metodología).
 */
export const FOODIE_PROFILE =
  "profesionales de la industria restaurantera (alimentos, restauración y entretenimiento) con experiencia en servicio, capacitación, ventas y comunicación";

/** Frase de posicionamiento de los indicadores (web, app, reportes y correos). */
export const LEADING_INDICATORS_CLAIM =
  "Indicadores líderes en el mercado, basados en distintivos y certificaciones actuales además de la metodología de Flanco Izquierdo®.";

/** Bloque de autoridad que se muestra antes del pago en el reporte público (y lo que respalda a los indicadores). */
export const LEADING_INDICATORS_BASIS =
  "Basados en distintivos y certificaciones actuales (como el Distintivo H de Sectur), además de la metodología de Flanco Izquierdo®.";
export const HIGIENE_DISCLAIMER_SHORT = "Higiene es una observación como cliente, inspirada en el Distintivo H: no es una auditoría ni lo sustituye.";

/** Párrafo de confianza que acompaña a Palabra MysterFoodie en el reporte público. */
export function foodieTrustText(totalItems: number): string {
  return (
    `Nuestros MysterFoodies son ${FOODIE_PROFILE}, con el ` +
    "poder adquisitivo de un cliente real. Visitan el negocio de incógnito, pagan su cuenta y califican " +
    `${totalItems} indicadores de servicio, sabor, limpieza y experiencia — con total honestidad, Palabra MysterFoodie. ` +
    LEADING_INDICATORS_CLAIM
  );
}

/**
 * Nombre visible de cada rol. El valor interno (admin/agente/sibarita/
 * cliente) no cambia: es el que usan middleware, requireRole() y la base
 * de datos; solo se renombra la etiqueta que ve la persona.
 */
/**
 * Todas las personas del equipo son MysterFoodies; el rango es su nivel:
 * Shopper (agente) -> Sibarita -> Master Chef (admin). El cliente es el dueño del negocio.
 * "Foodie" ya no se usa como rango (se repetía con la marca).
 */
export function mysterfoodieTitle(role: string): string {
  const label = ROLE_LABELS[role] ?? role;
  return role === "cliente" ? label : `MysterFoodie ${label}`;
}

export const ROLE_LABELS: Record<string, string> = {
  admin: "Master Chef",
  agente: "Shopper",
  sibarita: "Sibarita",
  cliente: "Cliente",
};
