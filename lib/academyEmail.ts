import { CATEGORIES, TOTAL_ITEM_COUNT } from "./categories";
import { formatMxn, scenarioByKey, splitForPrice } from "./earningsMatrix";
import { PLAN_CATALOG } from "./planCatalog";
import { VERDICT_BANDS } from "./verdict";
import { BRAND_RED, SUPPORT_EMAIL, escapeHtml, renderButton, renderEmailShell } from "./email";

/**
 * Correo de confirmación de la lista de espera de la Foodie Academy: qué se
 * aprende (los 52 indicadores), la metodología y los esquemas de ganancias.
 * Las cifras salen de las mismas fuentes que la app (categorías, matriz de
 * ganancias, catálogo de planes), así que si cambian, el correo cambia solo.
 */

const mxn = (n: number) => formatMxn(n).replace(" MXN", "");
/** Redondeado a la decena y con "hasta": nunca se promete un ingreso. */
const hasta = (n: number) => `hasta ${mxn(Math.round(n / 10) * 10)}`;

const EJEMPLOS: Record<string, string> = {
  fachada: "anuncio, puerta, pintura, ventanas y estacionamiento",
  ambiente: "limpieza de salón, barra y baños, mobiliario, ventilación y música",
  atencion: "conocimiento del menú, atención a la mesa, uniformes y claridad de la cuenta",
  alimentos: "tiempo y temperatura, sabor y textura, propuesta y precio, órdenes correctas",
  accesibilidad: "sillas altas, rampas, baño accesible y menú en braille",
};

/** Nombre de la categoría tal como lo ve el negocio en mysterfoodie.com. */
const nombreCat = (key: string, label: string) => (key === "alimentos" ? "Alimentos y bebidas" : label);

export const ACADEMY_SUBJECT = "Ya estás en la lista de la Foodie Academy";

export function academyConfirmationEmail(): { subject: string; html: string; text: string } {
  const sc2 = scenarioByKey("2"); // Master Chef vende y el Foodie visita
  const foodieReporte = sc2.foodie;
  const foodiePlan = splitForPrice(sc2, PLAN_CATALOG.starter.pricePerVisit).foodie;
  const sibVendeVisita = scenarioByKey("4").sibarita;
  const sibVendeAsigna = scenarioByKey("5").sibarita;

  const h = (t: string) =>
    `<p style="margin: 26px 0 10px; font-size: 13px; font-weight: bold; letter-spacing: 0.08em; text-transform: uppercase; color: ${BRAND_RED};">${t}</p>`;
  const p = (t: string) => `<p style="margin: 0 0 12px; font-size: 15px; line-height: 1.65; color: #374151;">${t}</p>`;

  const catRows = CATEGORIES.map((c) => {
    const ej = EJEMPLOS[c.key] ?? c.items.slice(0, 4).map((i) => i.label.toLowerCase()).join(", ");
    return `<tr>
      <td style="padding: 8px 12px 8px 0; vertical-align: top; font-size: 22px; font-weight: bold; color: ${BRAND_RED}; width: 44px;">${c.items.length}</td>
      <td style="padding: 8px 0; vertical-align: top; font-size: 14px; line-height: 1.55; color: #374151;"><strong style="color: #111827;">${escapeHtml(nombreCat(c.key, c.label))}</strong><br />${escapeHtml(ej)}</td>
    </tr>`;
  }).join("");

  const bandas = VERDICT_BANDS.map(
    (b) => `<span style="display: inline-block; margin: 0 6px 6px 0; padding: 4px 12px; border-radius: 999px; background: ${b.color}; color: #ffffff; font-size: 12px; font-weight: bold;">${escapeHtml(b.label)} · ${escapeHtml(b.range)}</span>`
  ).join("");

  const earn = (titulo: string, texto: string) =>
    `<tr><td style="padding: 8px 0; font-size: 14px; line-height: 1.55; color: #374151;"><strong style="color: #111827;">${titulo}</strong><br />${texto}</td></tr>`;

  const card = `
    <h1 style="margin: 0 0 8px; font-size: 24px; line-height: 1.25; color: #111827;">¡Qué gusto tenerte en la lista!</h1>
    ${p("Gracias por tu interés en la <strong>Foodie Academy</strong>, el programa donde formamos a los MysterFoodies y Sibaritas que evalúan restaurantes y bares con criterio profesional. En cuanto abramos la primera generación, <strong>este es el correo al que te avisaremos</strong>: no tienes que hacer nada más.")}

    ${h("Lo que aprenderías a calificar")}
    ${p(`Cada visita se evalúa con <strong>${TOTAL_ITEM_COUNT} indicadores en ${CATEGORIES.length} categorías</strong>. Aprenderías a observarlos, a calificarlos con el mismo protocolo y a registrar sugerencias útiles:`)}
    <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%; border-collapse: collapse;">${catRows}</table>

    ${h("Nuestra metodología")}
    ${p("Las visitas son <strong>anónimas</strong>: llegas como cualquier cliente, consumes y vives la experiencia completa, de la fachada a la cuenta. Cada indicador se califica de 1 a 5 (1 es malo, 3 regular y 5 excelente).")}
    ${p("La calificación general es el <strong>promedio de los promedios</strong> de las categorías, no un promedio plano de los indicadores, y se traduce en un veredicto:")}
    <div style="margin: 0 0 6px;">${bandas}</div>
    ${p("Cada visita termina en un reporte claro para el negocio, con seguimiento personalizado de nuestro equipo. Todo bajo nuestro lema: <em>Palabra Foodie, orgullo sibarita: ponemos la boca en el plato y la firma en la verdad.</em>")}

    ${h("Esquemas de ganancias")}
    ${p("Si completas la certificación y cumples los requisitos, podrías acceder a estos esquemas (se paga por reporte entregado):")}
    <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%; border-collapse: collapse;">
      ${earn("Foodie · visitas asignadas", `${hasta(foodieReporte)} por cada reporte completo que se entregue de tu visita. En los planes mensuales, ${hasta(foodiePlan)} por visita, cada mes que el plan siga activo, y tu consumo se reembolsa con el ticket.`)}
      ${earn("Sibarita · abres negocios", `${hasta(sibVendeVisita)} por reporte si das de alta el negocio y lo visitas tú; ${hasta(sibVendeAsigna)} si asignas la visita a un Foodie de tu red.`)}
    </table>
    <p style="margin: 10px 0 0; font-size: 12px; line-height: 1.6; color: #6b7280;">Son ejemplos, no una promesa de ingreso: la cantidad de visitas depende de las asignaciones de cada mes. Los requisitos, costos y fechas de la certificación se anunciarán al abrir la convocatoria.</p>

    <div style="margin: 28px 0 8px;">${renderButton("https://mysterfoodie.com/metodologia/", "Conoce la metodología completa")}</div>
    <p style="margin: 18px 0 0; font-size: 12px; line-height: 1.6; color: #9ca3af;">Dejaste tu correo en mysterfoodie.com. Si no fuiste tú o ya no quieres recibir avisos, responde este correo con la palabra <strong>baja</strong> o escríbenos a <a href="mailto:${SUPPORT_EMAIL}" style="color: #9ca3af;">${SUPPORT_EMAIL}</a>. Tratamos tus datos conforme a nuestro <a href="https://mysterfoodie.com/privacidad/" style="color: #9ca3af;">Aviso de Privacidad</a>.</p>
  `;

  const text = [
    "¡Qué gusto tenerte en la lista de la Foodie Academy!",
    "",
    "En cuanto abramos la primera generación te avisaremos a este correo.",
    "",
    `LO QUE APRENDERÍAS A CALIFICAR: ${TOTAL_ITEM_COUNT} indicadores en ${CATEGORIES.length} categorías`,
    ...CATEGORIES.map((c) => `- ${nombreCat(c.key, c.label)}: ${c.items.length} indicadores (${EJEMPLOS[c.key] ?? ""})`),
    "",
    "METODOLOGÍA: visitas anónimas; cada indicador se califica de 1 a 5; la calificación general es el promedio de los promedios de las categorías. Más en https://mysterfoodie.com/metodologia/",
    "",
    "ESQUEMAS DE GANANCIAS (si completas la certificación y cumples los requisitos; se paga por reporte entregado):",
    `- Foodie: ${hasta(foodieReporte)} por reporte completo entregado; en planes mensuales ${hasta(foodiePlan)} por visita, recurrente.`,
    `- Sibarita: ${hasta(sibVendeVisita)} por reporte si das de alta el negocio y lo visitas tú; ${hasta(sibVendeAsigna)} si asignas la visita a un Foodie.`,
    "Son ejemplos, no una promesa de ingreso. Requisitos, costos y fechas se anunciarán al abrir la convocatoria.",
    "",
    `Para darte de baja responde con la palabra "baja" o escribe a ${SUPPORT_EMAIL}.`,
  ].join("\n");

  return { subject: ACADEMY_SUBJECT, html: renderEmailShell(card), text };
}
