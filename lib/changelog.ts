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
    version: "0.17.0",
    date: "2026-10-20",
    title: "Eliminar cuenta con hoja de salida",
    emoji: "👋",
    highlights: [
      "Cualquier cuenta puede eliminarse desde Perfil (tres toques para evitar accidentes) y dejar una calificación y un comentario de salida.",
      "La baja llega al Master Chef como tarea: ve la hoja de salida y reasigna los negocios y visitas pendientes.",
      "El Perfil se lee mejor: «Perfil del MysterFoodie», con nombre, cargo y correo en ese orden.",
      "El título de la pestaña y la descripción para buscadores ya hablan de MysterFoodie.",
    ],
  },
  {
    version: "0.16.0",
    date: "2026-10-20",
    title: "Todos somos MysterFoodies",
    emoji: "🍽️",
    highlights: [
      "Todas las personas del equipo son MysterFoodies y su rango es su nivel: Shopper (antes Foodie), Sibarita y Master Chef. Así «Foodie» ya no se repite entre la marca y el rango.",
      "Tu Perfil, los correos de invitación y el bienvenido lo dicen claro: «Eres MysterFoodie», «Te invitaron a ser MysterFoodie Shopper».",
      "Los programas llevan la marca: MysterFoodie Academy y Palabra MysterFoodie.",
      "Para los negocios, quien los visita es simplemente «un MysterFoodie» (correo de sin disponibilidad, plan, formulario de la web).",
    ],
  },
  {
    version: "0.15.1",
    date: "2026-10-19",
    title: "Un solo mensaje para el dueño",
    emoji: "💬",
    highlights: [
      "El DM de Instagram y el correo con el resultado ahora dicen lo mismo, con las mismas palabras y la misma voz («Un MysterFoodie visitó su restaurante sin avisar…», «Lo atendió Fermín»). Antes uno hablaba en «nosotros» y el otro en tercera persona.",
      "Una sola acción en ambos: «Ver mi resultado». En el correo, el estudio completo se menciona abajo, con el precio sin IVA, sin presionar.",
      "El nombre de quien te atendió se anota en el paso de Atención, cuando lo estás evaluando, en vez de al final.",
      "En escritorio, «Tu nombre» ya viene con el de tu perfil.",
    ],
  },
  {
    version: "0.15.0",
    date: "2026-10-19",
    title: "Visita más ligera de llenar",
    emoji: "⭐",
    highlights: [
      "Las estrellas ahora se ven grandes y a todo lo ancho, con la etiqueta arriba: ya no se parte el texto y es más fácil acertar con el pulgar. Al calificar aparece la palabra (Malo, Regular, Excelente…).",
      "Cada categoría muestra cuántos indicadores llevas (por ejemplo 9/13) y puedes dejar sin marcar lo que no aplique.",
      "Los Sí/No ahora tienen tres opciones: Sí, No y No aplica. Arrancan sin respuesta, así que «No» ya significa que realmente no lo tienen.",
      "Al cerrar la visita tocas etiquetas rápidas («Trato excelente», «Servicio lento»…) y, si quieres, dejas una nota en cada categoría mientras la tienes fresca.",
      "La pantalla de resultado tiene una sola acción principal: copiar el mensaje y abrir el Instagram del dueño. El correo, el link y demás quedan en «Más opciones».",
      "Arreglo: si dejabas alguna estrella sin calificar, el guardado de calificaciones podía fallar; ahora solo se guarda lo contestado.",
    ],
  },
  {
    version: "0.14.0",
    date: "2026-10-16",
    title: "Auditoría de textos: web y app dicen lo mismo",
    emoji: "🔍",
    highlights: [
      "El PDF del reporte completo ahora trae el detalle de los 52 indicadores (estrellas, Sí/No y tipo de menú) y los comentarios del MysterFoodie, tal como lo prometen la web y los correos.",
      "Un solo perfil del MysterFoodie en web, app, PDF y correos: profesionales de la industria restaurantera con experiencia en servicio, capacitación, ventas y comunicación.",
      "La escala se explica igual en todas partes: casi todos los indicadores van de 1 a 5; los de Sí/No (como accesibilidad) se convierten a esa escala para el promedio.",
      "Marca unificada como «MysterFoodie» (antes «Myster Foodie» en el PDF y algunos textos).",
    ],
  },
  {
    version: "0.13.0",
    date: "2026-10-09",
    title: "Solicita una visita GRATIS y Foodie Academy",
    emoji: "🎁",
    highlights: [
      "Nuevo botón «Solicita una visita GRATIS» en mysterfoodie.com: el negocio llena sus datos, se da de alta solo, recibe un correo de confirmación con el acceso para crear su cuenta y a ti te llega un aviso.",
      "Nueva pantalla Solicitudes (Perfil → Solicitudes de visita): asignas cada negocio a un sibarita, a un Foodie o a ti. Quien la recibe tiene 3 días en exclusiva; los días 4 y 5 aparece en «Disponibles para ti» de todos los Foodies, que pueden tomarla.",
      "Si al quinto día nadie hizo la visita, el negocio recibe un correo: por el momento no hay Foodie, con el enlace a la tabla comparativa de paquetes. Los dos correos se editan en Automatizaciones.",
      "Al compartir un enlace de reporte (Instagram, WhatsApp...) se ve una tarjeta con el nombre del negocio, sus estrellas y su veredicto.",
      "Lista de espera de la Foodie Academy en la web, con correo de confirmación sobre los 52 indicadores, la metodología y los esquemas de ganancias.",
    ],
  },
  {
    version: "0.12.0",
    date: "2026-10-09",
    title: "Ticket de consumo y Perfil con foto",
    emoji: "🧾",
    highlights: [
      "En cada visita ya enviada puedes subir la foto del ticket de consumo (tomarla o elegirla de la galería), cambiarla o quitarla.",
      "3 días después de subirlo, el negocio recibe un correo: si aún no tiene el reporte completo, con la oferta de $850 MXN y el botón a su reporte; si ya lo pagó, solo se le avisa que hay más información en su visita.",
      "El ticket aparece en el reporte público una vez desbloqueado y como página del PDF del reporte completo.",
      "Perfil rediseñado con listas estilo iOS: renglones grandes para el dedo, tarjeta de identidad con tu foto y accesos claros a tus datos, contraseña, herramientas y cerrar sesión.",
      "Nueva pantalla Editar perfil: foto propia en vez de las iniciales (cámara o galería), nombre y teléfono. El login con Google ya no pisa la foto que elijas.",
      "Nueva pantalla Contraseña y acceso: cambiar o crear tu contraseña y conectar Google.",
      "La asesoría gratuita de 20 minutos ahora se incluye solo con el reporte completo: el reporte y la agenda solo la ofrecen a quien ya lo compró, y el correo de la asesoría sale al día siguiente del pago.",
      "Estilo unificado con mysterfoodie.com: los títulos van en Poppins grande y la tipografía de marca (Nan Holo Gigawide) se usa como máximo en un título por página.",
    ],
  },
  {
    version: "0.11.0",
    date: "2026-10-09",
    title: "Acceso de 5 días y bajas de usuarios",
    emoji: "🔑",
    highlights: [
      "Las invitaciones y la recuperación de contraseña ahora valen 5 días (antes caducaban en una hora) y abrir el link ya no lo gasta.",
      "El código de 6 dígitos del correo funciona de verdad, con límite de intentos, y «Pide uno nuevo» manda un correo en el momento.",
      "En Usuarios se ve quién todavía no activa su cuenta y se puede reenviar su invitación.",
      "Eliminar usuarios: se les avisa por correo, sus visitas pasan a Master Chef y sus negocios quedan sin dueño hasta que decidas a quién asignarlos.",
      "Nueva pantalla de Bajas y un pendiente en el inicio para revisar los registros de cada baja.",
      "Desde la invitación se puede «Crear cuenta con Google» con cualquier cuenta de Google; queda ligada al rol de la invitación. Sin invitación, Google ya no deja cuentas vacías.",
      "El correo de invitación ahora explica qué puede hacer cada rol y propone una meta realizable para el primer mes con los lugares que ya visitas.",
    ],
  },
  {
    version: "0.10.0",
    date: "2026-10-09",
    title: "Pendientes y planes más claros",
    emoji: "🔔",
    highlights: [
      "Nuevo espacio de Pendientes en el inicio: visitas asignadas, avisos y cobros por atender, cada uno con su X para quitarlo.",
      "Las visitas de un plan tienen su ventana del mes (por ejemplo «del 8 al 15 de octubre») y se marcan «atrasada» si se pasa; es solo informativo.",
      "Al terminar una visita de plan, el cliente recibe su reporte con el avance «visita 2 de 4» y no le llegan correos de venta.",
      "Finanzas cuenta cada visita de plan contra el cobro del mes de su plan, y el simulador ya permite elegir el precio de cada plan.",
      "Las indicaciones del plan llegan al Foodie y, si cambias el Foodie por default, también se llevan las visitas que seguían sin asignar.",
      "Los negocios con plan activo muestran su insignia en la lista de Negocios.",
    ],
  },
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
