/**
 * Textos de marca que se repiten en varias pantallas (reporte público,
 * Perfil, correos, PDF). Viven aquí para que un cambio de redacción se
 * haga una sola vez y no queden versiones distintas por la app.
 */

/** Frase de "Palabra Foodie" (sin comillas; cada pantalla pone las suyas). */
export const PALABRA_FOODIE_QUOTE =
  "Palabra Foodie, orgullo sibarita: ponemos la boca en el plato y la firma en la verdad.";

/** Párrafo de confianza que acompaña a Palabra Foodie en el reporte público. */
export function foodieTrustText(totalItems: number): string {
  return (
    "Nuestros Myster Foodies son perfiles que trabajan dentro de la industria restaurantera y con el " +
    "poder adquisitivo de un cliente real. Visitan el negocio de incógnito, pagan su cuenta y califican " +
    `${totalItems} indicadores de servicio, sabor, limpieza y experiencia — con total honestidad, Palabra Foodie.`
  );
}

/**
 * Nombre visible de cada rol. El valor interno (admin/agente/sibarita/
 * cliente) no cambia: es el que usan middleware, requireRole() y la base
 * de datos; solo se renombra la etiqueta que ve la persona.
 */
export const ROLE_LABELS: Record<string, string> = {
  admin: "Master Chef",
  agente: "Foodie",
  sibarita: "Sibarita",
  cliente: "Cliente",
};
