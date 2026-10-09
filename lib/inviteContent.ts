import { formatMxn, scenarioByKey, splitForPrice } from "./earningsMatrix";
import { PLAN_CATALOG } from "./planCatalog";

/**
 * Qué hace cada rol y cuál es su meta realista del primer mes, para el correo
 * de invitación. Las cifras salen de la misma matriz de ganancias que usa
 * Finanzas (lib/earningsMatrix.ts), así que si cambian las tarifas el correo
 * cambia solo.
 */

export type InviteRoleContent = {
  emoji: string;
  tagline: string;
  intro: string;
  can: { emoji: string; title: string; text: string }[];
  goal: { title: string; body: string; footnote: string } | null;
  steps: string[];
};

const mxn = (n: number) => formatMxn(n).replace(" MXN", "");

export function inviteContentForRole(role: string, businessName?: string | null): InviteRoleContent {
  const sc2 = scenarioByKey("2"); // Master Chef vende y el Foodie visita
  const foodieReport = sc2.foodie; // por reporte entregado
  const foodiePlan = (price: number) => splitForPrice(sc2, price).foodie;
  const sibaritaSelf = scenarioByKey("4").sibarita; // vende y visita él mismo
  const sibaritaAssign = scenarioByKey("5").sibarita; // vende y asigna a un Foodie

  if (role === "agente") {
    const goalVisits = 4;
    return {
      emoji: "🌱",
      tagline: "Visitas de incógnito, pagadas por cada reporte",
      intro: "Como Foodie conviertes una salida a comer en una evaluación profesional.",
      can: [
        { emoji: "🕵️", title: "Visitas de incógnito", text: "Restaurantes, bares y cafeterías que se te asignan; vas como cualquier cliente." },
        { emoji: "📱", title: "Evaluación desde tu celular", text: "Un formulario corto de servicio, sabor, limpieza y experiencia que llenas en minutos." },
        { emoji: "🧾", title: "Tu consumo se recupera", text: "En las visitas de los planes mensuales, lo que consumes se reembolsa con el ticket." },
        {
          emoji: "💸",
          title: "Ganas por cada reporte",
          text: `${mxn(foodieReport)} por reporte entregado. En los planes mensuales, ${mxn(foodiePlan(PLAN_CATALOG.starter.pricePerVisit))}, ${mxn(foodiePlan(PLAN_CATALOG.appetizer.pricePerVisit))} o ${mxn(foodiePlan(PLAN_CATALOG.main_course.pricePerVisit))} por visita, cada mes que el plan siga activo.`,
        },
      ],
      goal: {
        title: `Tu meta del primer mes: ${goalVisits} visitas = ${mxn(foodieReport * goalVisits)} extra`,
        body:
          `Piensa en tus ${goalVisits} salidas normales del mes: el desayuno de siempre, la comida del fin de semana, una cena con amigos, el café de la tarde. ` +
          `Cuéntale a quien te invitó cuáles son; si el lugar es de los que evaluamos, te lo asignamos y esa salida se convierte en una visita pagada. Sin salir de tu rutina.`,
        footnote: "Es un ejemplo, no una promesa de ingreso: se paga por reporte entregado y la cantidad de visitas depende de las asignaciones de cada mes.",
      },
      steps: [
        "Crea tu contraseña con el botón de abajo (o entra con tu cuenta de Google).",
        "Abre app.mysterfoodie.com en tu celular y agrégala a tu pantalla de inicio.",
        "Entra a «Pendientes» en el inicio: ahí te llegan tus visitas asignadas.",
      ],
    };
  }

  if (role === "sibarita") {
    const goalSales = 3;
    return {
      emoji: "🍷",
      tagline: "Abres negocios y ganas por cada reporte vendido",
      intro: "Como Sibarita conviertes los lugares que ya conoces en clientes de MysterFoodie.",
      can: [
        { emoji: "🏪", title: "Das de alta negocios", text: "Los que ya frecuentas o conoces; quedan registrados a tu nombre." },
        { emoji: "📝", title: "Visitas tú mismo", text: "Levantas visitas Mystery Shopper con libertad y compartes el resultado con el negocio." },
        {
          emoji: "💸",
          title: "Ganas por cada reporte vendido",
          text: `${mxn(sibaritaSelf)} si lo vendes y lo visitas tú; ${mxn(sibaritaAssign)} si asignas la visita a un Foodie.`,
        },
        { emoji: "👥", title: "Invitas Foodies", text: "Sumas gente a tu red para repartir las visitas." },
      ],
      goal: {
        title: `Tu meta del primer mes: ${goalSales} negocios con reporte = ${mxn(sibaritaSelf * goalSales)} extra`,
        body:
          `Elige ${goalSales} lugares donde ya eres cliente: tu café, tu restaurante favorito, el bar de los viernes. ` +
          `Dalos de alta, visítalos y comparte el resultado con el dueño; cada vez que un negocio adquiere el estudio completo, ${mxn(sibaritaSelf)} son tuyos.`,
        footnote: "Es un ejemplo, no una promesa de ingreso: se gana cuando el negocio adquiere el reporte, y eso depende de cada dueño.",
      },
      steps: [
        "Crea tu contraseña con el botón de abajo (o entra con tu cuenta de Google).",
        "Abre app.mysterfoodie.com en tu celular y agrégala a tu pantalla de inicio.",
        "Entra a «Negocios» y da de alta el primero que ya frecuentas.",
      ],
    };
  }

  if (role === "admin") {
    return {
      emoji: "👨‍🍳",
      tagline: "Administras toda la red",
      intro: "Como Master Chef das seguimiento a cada negocio y a cada persona de la red.",
      can: [
        { emoji: "👥", title: "Usuarios y rangos", text: "Invitas Sibaritas y Foodies, cambias sus rangos y revisas sus bajas." },
        { emoji: "📍", title: "Asignación de visitas", text: "Asignas cada visita y decides quién es dueño de cada negocio." },
        { emoji: "📅", title: "Planes mensuales", text: "Contratas planes, das seguimiento a sus visitas y marcas los cobros." },
        { emoji: "🔔", title: "Pendientes", text: "Tu inicio junta lo que necesita atención: cobros, correos fallidos y compras." },
      ],
      goal: null,
      steps: [
        "Crea tu contraseña con el botón de abajo (o entra con tu cuenta de Google).",
        "Abre app.mysterfoodie.com en tu celular y agrégala a tu pantalla de inicio.",
        "Revisa «Pendientes» en el inicio.",
      ],
    };
  }

  return {
    emoji: "🏪",
    tagline: "El historial de tu negocio, en un solo lugar",
    intro: businessName
      ? `Con tu cuenta de ${businessName} ves lo que los clientes reales viven en tu negocio.`
      : "Con tu cuenta ves lo que los clientes reales viven en tu negocio.",
    can: [
      { emoji: "⭐", title: "Tus calificaciones", text: "Cada visita Mystery Shopper con su calificación general y por categoría." },
      { emoji: "📄", title: "Tus reportes completos", text: "Abre y descarga el estudio detallado de cada visita que adquiriste." },
      { emoji: "📈", title: "Tu avance", text: "Compara visita contra visita y mira cómo mejora tu negocio mes con mes." },
    ],
    goal: null,
    steps: [
      "Crea tu contraseña con el botón de abajo (o entra con tu cuenta de Google).",
      "Abre app.mysterfoodie.com desde tu celular o computadora.",
      "Revisa la última visita de tu negocio.",
    ],
  };
}
