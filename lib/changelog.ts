/**
 * Bitácora de versiones de la app: hitos del desarrollo, de la más reciente a
 * la más antigua. Se ve en Perfil, tocando 3 veces la abejita del final
 * (components/EasterEggBee.tsx).
 *
 * Para añadir un hito nuevo: agrega una entrada ARRIBA con su versión, fecha
 * (AAAA-MM-DD), un título corto y 2-6 puntos en lenguaje de usuario (qué se
 * puede hacer ahora, no cómo se programó). La versión de arriba es la que se
 * muestra como "actual".
 */
export type ChangelogEntry = {
  version: string;
  /** AAAA-MM-DD */
  date: string;
  title: string;
  emoji: string;
  highlights: string[];
};

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: "0.9.0",
    date: "2026-10-09",
    title: "Appetizer y Main course",
    emoji: "🍴",
    highlights: [
      "Appetizer: 4 visitas al mes en cada una de 3 sucursales, a $650 por visita.",
      "Main course: 4 visitas al mes en cada una de 4 a 5 sucursales, a $600 por visita.",
      "Una sola contratación para toda la cadena: un ticket, un cobro y aviso si alguna sucursal queda fuera de Veracruz – Boca del Río.",
      "Comparativa de planes en Planes: ahorro por volumen, consistencia de la información y margen de error estimado.",
      "El reparto de ganancias sigue la misma regla, proporcional a la tarifa de cada plan.",
    ],
  },
  {
    version: "0.8.0",
    date: "2026-10-09",
    title: "Planes de visitas (segunda etapa)",
    emoji: "🍽️",
    highlights: [
      "Plan Starter (la entrada): 3 visitas al mes por sucursal a $700 cada una, más el reembolso del ticket de consumo.",
      "Contratar un plan desde el negocio: las visitas del mes se generan solas y se asignan a un Foodie.",
      "Al contratar, el negocio recibe un correo con aspecto de ticket de restaurante con los servicios contratados.",
      "Cada visita del plan entrega su reporte completo por correo, con el avance \"visita 2 de 3\" del mes.",
      "Finanzas reparte cada visita de plan con la misma regla de la prospección, proporcional a $700, todos los meses.",
      "Pantalla Planes con avance, cobro del mes y visitas sin Foodie; el dueño ve el avance de su plan en Mi negocio.",
    ],
  },
  {
    version: "0.7.0",
    date: "2026-10-06",
    title: "Finanzas, auditoría y loader",
    emoji: "🐝",
    highlights: [
      "Nuevo diseño de correos: logo completo, tarjeta blanca y firma con el logo simplificado; el mismo estilo en todos.",
      "Palabra Foodie con frase nueva, y textos, nombres de rol y rangos unificados en toda la app.",
      "Finanzas: ganancias reales por mes para cada perfil, con la comisión por uso de la aplicación para Sibaritas y Foodies.",
      "Auditoría de flujo: editar negocios, aviso de duplicados, contacto visible, asignar sin Foodie preseleccionado, agenda desde el reporte y recarga automática tras pagar.",
      "Loader animado con el logo y pantallas de carga al instante.",
      "Esta bitácora secreta.",
    ],
  },
  {
    version: "0.6.0",
    date: "2026-10-04",
    title: "Pruebas de correo",
    emoji: "✉️",
    highlights: [
      "Botones en Automatizaciones para enviarte cada correo de prueba, incluido el reporte completo con su PDF.",
    ],
  },
  {
    version: "0.5.0",
    date: "2026-10-02",
    title: "Pulido y velocidad",
    emoji: "⚡",
    highlights: [
      "Navegación de regreso unificada y pantallas móviles homogéneas.",
      "Accesibilidad como Sí/No y mejoras visuales en el reporte y el correo.",
      "\"Añadido por\" en Negocios y quién creó cada visita en Inicio y en Visitas.",
      "Menos consultas a la base de datos: la app carga más rápido.",
      "Corrección del zoom que se quedaba pegado en la app instalada (iOS).",
    ],
  },
  {
    version: "0.4.0",
    date: "2026-10-01",
    title: "Cuentas, Google y correos",
    emoji: "🔐",
    highlights: [
      "Inicio de sesión con Google y foto de perfil real.",
      "Correos rediseñados, y el PDF del reporte completo llega por correo al confirmarse el pago.",
      "Correo de activación para las cuentas de negocio.",
      "Control de acceso por rol: cada perfil ve solo lo que le toca.",
      "Autoguardado del cuestionario de visita.",
      "Eliminar negocios y visitas, y calculadora de Finanzas para el Master Chef.",
    ],
  },
  {
    version: "0.3.0",
    date: "2026-09-30",
    title: "Identidad y versión móvil",
    emoji: "📱",
    highlights: [
      "Rediseño con la paleta e identidad de MysterFoodie.",
      "Versión móvil completa: Inicio, Negocios, formulario de visita, Visitas, Perfil y reporte público.",
      "Rangos Master Chef, Sibarita y Foodie, con visitas asignadas.",
      "Oportunidades de venta al dar de alta un negocio.",
      "Automatizaciones: correo de asesoría gratuita y agenda con Google Calendar.",
    ],
  },
  {
    version: "0.2.0",
    date: "2026-09-29",
    title: "El cuestionario y el cobro",
    emoji: "📝",
    highlights: [
      "Recuperación de contraseña y un acceso más pulido.",
      "Cuestionario real de ~50 indicadores en 5 categorías, con el nombre del mesero.",
      "Link público del reporte en go.mysterfoodie.com.",
      "Cobro del reporte completo con Mercado Pago.",
      "Estado del correo de cada evaluación, con reenvío a otro correo.",
    ],
  },
  {
    version: "0.1.0",
    date: "2026-09-28",
    title: "Arranque",
    emoji: "🌱",
    highlights: [
      "Nace el proyecto con control de versiones.",
      "Roles y cuentas (admin, agente y cliente) y panel para el dueño del negocio.",
    ],
  },
];

export const APP_VERSION = CHANGELOG[0].version;
