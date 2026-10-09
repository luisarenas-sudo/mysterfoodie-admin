import type { Metadata } from "next";
import LegalPage, { type LegalSection } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Condiciones del Servicio - MysterFoodie",
  description: "Reglas de uso de la plataforma MysterFoodie.",
};

const CONTACTO = "luis.arenas@flancoizquierdo.com";

const sections: LegalSection[] = [
  {
    title: "Aceptación",
    body: [
      "Al crear una cuenta o usar MysterFoodie (app.mysterfoodie.com) aceptas estas condiciones y el Aviso de Privacidad. Si no estás de acuerdo, por favor no uses la plataforma.",
    ],
  },
  {
    title: "Qué es MysterFoodie",
    body: [
      "MysterFoodie es una plataforma operada por Flanco Izquierdo que permite levantar evaluaciones tipo mystery shopper en restaurantes y bares, compartir un resumen parcial de los resultados con el negocio evaluado, ofrecerle el estudio completo y dar seguimiento a la relación con el negocio.",
    ],
  },
  {
    title: "Cuentas y roles",
    body: [
      "El acceso es por invitación. Cada cuenta tiene un rol (Master Chef, Sibarita, Foodie o cliente) con permisos distintos. Eres responsable de la actividad de tu cuenta y de mantener tus credenciales en secreto.",
      "Los enlaces de invitación y recuperación tienen vigencia limitada y son personales: no los compartas. Podemos suspender o eliminar cuentas que incumplan estas condiciones o que ya no sean necesarias.",
    ],
  },
  {
    title: "Uso aceptable",
    body: [
      "Te comprometes a:",
      [
        "Registrar evaluaciones veraces, objetivas y basadas en visitas reales.",
        "No usar la plataforma para difamar, acosar o dañar a negocios o personas.",
        "No intentar acceder a información o cuentas de otras personas ni vulnerar la seguridad del sistema.",
        "No copiar, revender o divulgar los reportes o la información de la plataforma sin autorización.",
      ],
    ],
  },
  {
    title: "Evaluaciones y reportes",
    body: [
      "Las evaluaciones reflejan la experiencia de una visita específica y son opiniones independientes; no constituyen una auditoría ni una garantía de resultados. El resumen parcial que se comparte con el negocio es informativo; el estudio completo se entrega previo pago conforme a la tarifa vigente.",
    ],
  },
  {
    title: "Pagos, tarifas y ganancias",
    body: [
      "Los pagos de reportes y planes se procesan a través de MercadoPago. Las tarifas y planes vigentes se muestran antes de pagar y pueden cambiar con aviso previo.",
      "Los montos de ganancias que se muestran a Sibaritas y Foodies son estimaciones u objetivos de referencia (por ejemplo, \"hasta\" cierta cantidad al mes); no son un salario ni garantizan ingresos. Las condiciones de pago a cada colaborador se acuerdan directamente con la administración de MysterFoodie.",
    ],
  },
  {
    title: "Propiedad intelectual",
    body: [
      "La marca MysterFoodie, el diseño de la plataforma, los formularios y los reportes son propiedad de Flanco Izquierdo o de sus licenciantes. Se te concede un derecho limitado, no exclusivo y revocable para usar la plataforma conforme a estas condiciones.",
    ],
  },
  {
    title: "Disponibilidad y límite de responsabilidad",
    body: [
      "Procuramos que el servicio esté disponible y funcione correctamente, pero se ofrece \"tal cual\", sin garantía de operación ininterrumpida. En la medida permitida por la ley, Flanco Izquierdo no será responsable por daños indirectos o por decisiones de negocio tomadas con base en las evaluaciones.",
    ],
  },
  {
    title: "Terminación",
    body: [
      "Puedes dejar de usar la plataforma en cualquier momento y solicitar la eliminación de tu cuenta escribiendo al contacto indicado abajo. Podemos suspender el acceso si detectamos un uso contrario a estas condiciones.",
    ],
  },
  {
    title: "Ley aplicable y contacto",
    body: [
      "Estas condiciones se rigen por las leyes de los Estados Unidos Mexicanos. Para cualquier controversia, las partes se someten a los tribunales competentes de Veracruz, México.",
      `Dudas o aclaraciones: ${CONTACTO}.`,
    ],
  },
];

export default function TerminosPage() {
  return (
    <LegalPage
      title="Condiciones del Servicio"
      updated="9 de octubre de 2026"
      intro="Estas condiciones regulan el uso de MysterFoodie. Léelas con calma: son las reglas simples para que las evaluaciones sean útiles, justas y seguras para todos."
      sections={sections}
      other={{ href: "/privacidad", label: "Ver Aviso de Privacidad" }}
    />
  );
}
