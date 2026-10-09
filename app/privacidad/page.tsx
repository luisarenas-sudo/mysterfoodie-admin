import type { Metadata } from "next";
import LegalPage, { type LegalSection } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Aviso de Privacidad - MysterFoodie",
  description: "Cómo MysterFoodie recaba, usa y protege tus datos personales.",
};

const CONTACTO = "luis.arenas@flancoizquierdo.com";

const sections: LegalSection[] = [
  {
    title: "Quién es el responsable",
    body: [
      "MysterFoodie es una plataforma de evaluaciones tipo mystery shopper operada por Flanco Izquierdo (en adelante, \"nosotros\"), con domicilio en Veracruz, México. Somos responsables del tratamiento de los datos personales que se describen en este aviso.",
      `Para cualquier asunto de privacidad puedes escribirnos a ${CONTACTO}.`,
    ],
  },
  {
    title: "Qué datos recabamos",
    body: [
      "Según cómo uses MysterFoodie, podemos recabar:",
      [
        "Datos de tu cuenta: nombre, correo electrónico, rol (Master Chef, Sibarita, Foodie o cliente) y contraseña (que se guarda cifrada, nunca en texto simple).",
        "Si inicias sesión o creas tu cuenta con Google: tu nombre, correo y foto de perfil que Google comparte con nosotros. No accedemos a tu contraseña de Google ni a otros datos de tu cuenta.",
        "Datos de negocios evaluados: nombre del negocio, giro, nombre y puesto de contacto, teléfono, correo, Instagram, dirección y ciudad.",
        "Datos de las visitas: fecha, calificaciones, observaciones, comentarios y evidencias que registran quienes realizan la evaluación.",
        "Datos de pago de reportes y planes: el estado y monto del pago. Los datos de tarjeta los procesa directamente MercadoPago; nosotros no los vemos ni los almacenamos.",
        "Datos de agenda: horarios que elijas para tu visita o para una llamada, si conectas el calendario.",
        "Datos técnicos mínimos: registros de acceso y de envío de correos necesarios para la seguridad y el seguimiento.",
      ],
    ],
  },
  {
    title: "Para qué usamos tus datos",
    body: [
      "Usamos tus datos para: crear y administrar tu cuenta y tus invitaciones; levantar, calificar y entregar evaluaciones; compartir un resumen parcial del resultado con el negocio evaluado y ofrecerle el estudio completo; procesar pagos; agendar visitas o llamadas; calcular y mostrar ganancias y metas dentro de la plataforma; y enviarte correos de seguimiento, avisos del servicio y recordatorios relacionados con tu actividad.",
      "No vendemos tus datos personales ni los usamos para publicidad de terceros.",
    ],
  },
  {
    title: "Con quién los compartimos",
    body: [
      "Solo con proveedores que nos ayudan a operar el servicio y bajo obligaciones de confidencialidad: Supabase (base de datos y autenticación), GoDaddy (alojamiento), Resend (envío de correos), MercadoPago (pagos), Google (inicio de sesión y calendario) y Short.io (enlaces cortos). También podremos compartir información cuando una autoridad competente lo requiera conforme a la ley.",
      "Los resultados de una evaluación se comparten con el negocio evaluado y con el personal de MysterFoodie que corresponda a su rol.",
    ],
  },
  {
    title: "Cuánto tiempo los conservamos",
    body: [
      "Conservamos tus datos mientras tu cuenta esté activa y durante el tiempo necesario para cumplir las finalidades de este aviso y las obligaciones legales o contables aplicables. Si tu cuenta se elimina, los registros de visitas y negocios que hayas generado pueden conservarse a nombre de la administración de MysterFoodie para dar continuidad al servicio, sin tus datos de acceso.",
    ],
  },
  {
    title: "Tus derechos (ARCO)",
    body: [
      "Tienes derecho a acceder a tus datos, rectificarlos, cancelarlos u oponerte a su uso, así como a revocar tu consentimiento, conforme a la Ley Federal de Protección de Datos Personales en Posesión de los Particulares.",
      `Para ejercerlos, envía un correo a ${CONTACTO} indicando tu nombre, el correo de tu cuenta y qué derecho quieres ejercer. Responderemos en los plazos que marca la ley.`,
    ],
  },
  {
    title: "Seguridad",
    body: [
      "Aplicamos medidas técnicas y administrativas razonables para proteger tus datos: conexiones cifradas, contraseñas cifradas, accesos por rol, enlaces de invitación con vigencia limitada y códigos de verificación. Ningún sistema es infalible, por lo que te recomendamos cuidar tus credenciales.",
    ],
  },
  {
    title: "Cookies y tecnologías similares",
    body: [
      "Usamos cookies estrictamente necesarias para mantener tu sesión iniciada y proteger tu cuenta. No usamos cookies de publicidad.",
    ],
  },
  {
    title: "Cambios a este aviso",
    body: [
      "Podemos actualizar este aviso para reflejar cambios en el servicio o en la ley. Publicaremos la versión vigente en esta misma página con su fecha de actualización.",
    ],
  },
];

export default function PrivacidadPage() {
  return (
    <LegalPage
      title="Aviso de Privacidad"
      updated="9 de octubre de 2026"
      intro="En MysterFoodie nos importa la privacidad de las personas y de los negocios que forman parte de la plataforma. Este aviso explica qué datos recabamos, para qué los usamos y cómo puedes ejercer tus derechos."
      sections={sections}
      other={{ href: "/terminos", label: "Ver Condiciones del Servicio" }}
    />
  );
}
