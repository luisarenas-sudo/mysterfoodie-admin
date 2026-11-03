/** Enlaces públicos de mysterfoodie.com que usa la app (seguros para componentes de cliente). */
export const PACKAGES_URL = "https://mysterfoodie.com/servicios/#comparativa";
/** Formulario de la web con el switch "Programar mi visita" ya activado ($850 + consumo). */
export const PROGRAM_VISIT_URL = "https://mysterfoodie.com/solicita-visita/?programa=1";

/** Páginas de mysterfoodie.com que los correos enlazan para ampliar cada tema (mismas anclas que construye web/_src/build.py). */
export const WEB_URL = "https://mysterfoodie.com";
export const METODOLOGIA_URL = `${WEB_URL}/metodologia/`;
export const METODOLOGIA_QUIEN_OPINA_URL = `${WEB_URL}/metodologia/#quien-opina`;
export const SERVICIOS_URL = `${WEB_URL}/servicios/`;
export const PERFIL_SERVICIOS_URL = `${WEB_URL}/servicios/#perfil-mysterfoodie`;
export const PRIVACIDAD_PERFIL_URL = `${WEB_URL}/privacidad/#perfil-anonimo`;
export const PREGUNTAS_SOLICITA_URL = `${WEB_URL}/solicita-visita/#preguntas`;
/** Botón de los correos de primer contacto. */
export const METODOLOGIA_BOTON = "Conoce más sobre la metodología, con el respaldo de Flanco Izquierdo®";

/** Bloques «Para saber más» reutilizables (el texto de cada enlace es neutro: sirve igual en «ustedes» que en «tú»). */
export const SABER_MAS = {
  metodologia: { label: "Cómo evaluamos, paso a paso", url: METODOLOGIA_URL },
  quienOpina: { label: "Quiénes somos y cómo trabajamos", url: METODOLOGIA_QUIEN_OPINA_URL },
  reporte: { label: "Qué incluye el reporte completo", url: SERVICIOS_URL },
  preguntas: { label: "Preguntas frecuentes", url: PREGUNTAS_SOLICITA_URL },
  niveles: { label: "Qué incluye cada nivel (ID y Passport)", url: PERFIL_SERVICIOS_URL },
  privacidad: { label: "Cómo cuidamos los datos del perfil anónimo", url: PRIVACIDAD_PERFIL_URL },
} as const;
