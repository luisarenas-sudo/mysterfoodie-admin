import { NextRequest, NextResponse } from "next/server";
import { ticketEmailContent, ticketEmailVars, TICKET_CTA_LABEL } from "@/lib/ticket";
import { requireRole } from "@/lib/auth";
import { getAutomation, renderTemplate, AUTOMATION_CATALOG, resultadoVars, DEFAULT_RESULTADO_SUBJECT, DEFAULT_RESULTADO_INTRO } from "@/lib/automations";
import { sendResultEmail, sendTemplatedEmail, sendFullReportEmail, formatSlot } from "@/lib/email";
import { buildReportPdf } from "@/lib/reportPdf";
import { CATEGORIES } from "@/lib/categories";
import type { CategoryScore } from "@/lib/scoring";

/**
 * Manda correos de PRUEBA de las automatizaciones al correo del admin
 * que está logueado (nunca a otra dirección: el destino no se recibe del
 * cliente). Usa datos de ejemplo y el mismo mecanismo que producción: si
 * la plantilla está activa se usa el texto editable; si no, el texto
 * original. Asunto con prefijo "[PRUEBA]" para distinguirlos en la bandeja.
 */

const SAMPLE = {
  negocio: "Café La Esquina (prueba)",
  tipoNegocio: "cafetería",
  mesero: "Juan",
  promedio: 4.2,
  foodie: "Ana Foodie",
  ubicacion: "cafetería · Veracruz",
  nota: "Pedir el menú de temporada y revisar tiempos de espera.",
};

function sampleCategoryScores(): CategoryScore[] {
  const averages = [4.5, 4.0, 3.8, 4.4, 4.1, 3.9, 4.3];
  return CATEGORIES.map((c, i) => ({
    key: c.key,
    label: c.label,
    average: averages[i % averages.length],
    count: 5,
  }));
}

type TestResult = { key: string; subject: string; source: "plantilla" | "texto original"; status: string; error?: string };

export async function POST(req: NextRequest) {
  let session;
  try {
    session = await requireRole("admin");
  } catch {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  const to = session.email;
  if (!to) return NextResponse.json({ error: "Tu usuario no tiene correo" }, { status: 400 });

  let body: { key?: string } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const baseUrl = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin).replace(/\/$/, "");
  const reportUrl = `${baseUrl}/r/EJEMPLO`;
  const fechaHora = formatSlot(new Date(Date.now() + 2 * 86400000), new Date(Date.now() + 2 * 86400000 + 20 * 60000));

  // "reporte_completo" no es una automatización editable (el correo con el
  // PDF adjunto que se manda tras el pago), pero también se puede probar.
  const keys = body.key ? [body.key] : [...Object.keys(AUTOMATION_CATALOG), "reporte_completo"];
  const results: TestResult[] = [];

  for (const key of keys) {
    if (key === "reporte_completo") {
      try {
        const catScores = sampleCategoryScores();
        const pdfBuffer = await buildReportPdf({
          businessName: SAMPLE.negocio,
          clientType: "cafeteria",
          city: "Veracruz",
          visitDate: new Date(),
          overallScore: SAMPLE.promedio,
          categoryScores: catScores,
          shortCode: "EJEMPLO",
        });
        const contactWhatsapp = process.env.ADMIN_CONTACT_WHATSAPP;
        const out = await sendFullReportEmail({
          to,
          businessName: SAMPLE.negocio,
          score: SAMPLE.promedio,
          reportUrl,
          whatsappLink: contactWhatsapp ? `https://wa.me/${contactWhatsapp}` : null,
          pdfBuffer,
          pdfFilename: "reporte-completo-EJEMPLO.pdf",
        });
        results.push({ key, subject: `Tu reporte completo de ${SAMPLE.negocio} ya está listo (con PDF)`, source: "texto original", status: out.status, error: out.error });
      } catch (err) {
        results.push({ key, subject: "", source: "texto original", status: "failed", error: err instanceof Error ? err.message : String(err) });
      }
      continue;
    }
    if (!AUTOMATION_CATALOG[key]) {
      results.push({ key, subject: "", source: "texto original", status: "failed", error: "Automatización desconocida" });
      continue;
    }
    const automation = await getAutomation(key);
    const useTemplate = Boolean(automation?.enabled && automation.bodyTemplate);
    const tpl = (t: string | undefined, vars: Record<string, string>, fallback: string) =>
      useTemplate && t ? renderTemplate(t, vars) : fallback;
    const prefix = "[PRUEBA] ";

    try {
      if (key === "resultado_visita") {
        const vars = resultadoVars({ negocio: SAMPLE.negocio, tipoNegocio: SAMPLE.tipoNegocio, mesero: SAMPLE.mesero, promedio: SAMPLE.promedio });
        const subject = prefix + tpl(automation?.subjectTemplate, vars, renderTemplate(DEFAULT_RESULTADO_SUBJECT, vars));
        const introText = tpl(automation?.bodyTemplate, vars, renderTemplate(DEFAULT_RESULTADO_INTRO, vars));
        const out = await sendResultEmail({ to, businessName: SAMPLE.negocio, score: SAMPLE.promedio, reportUrl, categoryScores: sampleCategoryScores(), subject, introText });
        results.push({ key, subject, source: useTemplate ? "plantilla" : "texto original", status: out.status, error: out.error });
        continue;
      }

      let subject = "";
      let bodyText = "";

      if (key === "asesoria_gratuita") {
        const vars = { negocio: SAMPLE.negocio, link_agenda: `${baseUrl}/agendar/EJEMPLO` };
        subject = prefix + renderTemplate(automation?.subjectTemplate || "Asesoría gratuita para {{negocio}}", vars);
        bodyText = renderTemplate(automation?.bodyTemplate || "Hola equipo de {{negocio}}, agenda tu asesoría gratuita aquí: {{link_agenda}}", vars);
      } else if (key === "asignacion_visita") {
        const linkVisitas = `${baseUrl}/nueva-visita`;
        const vars = { foodie: SAMPLE.foodie, negocio: SAMPLE.negocio, ubicacion: SAMPLE.ubicacion, nota: SAMPLE.nota, link_visitas: linkVisitas };
        subject = prefix + tpl(automation?.subjectTemplate, vars, `Nueva visita asignada: ${SAMPLE.negocio}`);
        bodyText = tpl(
          automation?.bodyTemplate,
          vars,
          `Hola ${SAMPLE.foodie},\n\nSe te asignó una nueva visita Mystery Shopper:\n\nNegocio: ${SAMPLE.negocio}\nUbicación: ${SAMPLE.ubicacion}\nNota: ${SAMPLE.nota}\n\nVe tus visitas asignadas aquí:\n${linkVisitas}\n\nSaludos,\nMysterFoodie`
        );
      } else if (key === "confirmacion_cita_negocio" || key === "confirmacion_cita_admin") {
        const vars = { negocio: SAMPLE.negocio, fecha_hora: fechaHora };
        const isAdmin = key === "confirmacion_cita_admin";
        subject = prefix + tpl(automation?.subjectTemplate, vars, `Asesoría confirmada: ${SAMPLE.negocio}`);
        bodyText = tpl(
          automation?.bodyTemplate,
          vars,
          isAdmin
            ? `${SAMPLE.negocio} agendó una asesoría gratuita contigo para:\n\n${fechaHora}\n\nTe llega una invitación de Google Calendar por separado con el enlace de la videollamada.\n\nSaludos,\nMysterFoodie`
            : `Hola equipo de ${SAMPLE.negocio},\n\nTu asesoría gratuita con MysterFoodie quedó agendada para:\n\n${fechaHora}\n\nTe llega una invitación de Google Calendar por separado con el enlace de la videollamada.\n\nSaludos,\nMysterFoodie`
        );
      } else if (key === "activacion_cuenta_negocio") {
        const link = `${baseUrl}/set-password`;
        const vars = { negocio: SAMPLE.negocio, link_acceso: link };
        subject = prefix + tpl(automation?.subjectTemplate, vars, "Activa tu cuenta en MysterFoodie");
        bodyText = tpl(
          automation?.bodyTemplate,
          vars,
          `Hola equipo de ${SAMPLE.negocio},\n\nYa puedes crear tu cuenta en MysterFoodie para ver el historial de visitas de tu negocio, pedir nuevas visitas programadas y revisar tus reportes cuando quieras.\n\nEntra aquí para crear tu contraseña (o puedes continuar con tu cuenta de Google desde la misma pantalla):\n${link}\n\nSaludos,\nMysterFoodie`
        );
      } else if (key === "ticket_oferta" || key === "ticket_aviso") {
        const kind = key === "ticket_oferta" ? "oferta" : "aviso";
        const mail = await ticketEmailContent(
          kind,
          ticketEmailVars({ businessName: SAMPLE.negocio, visitDate: new Date().toISOString(), reportUrl })
        );
        subject = prefix + mail.subject;
        bodyText = mail.bodyText;
      } else if (key === "instagram_dm") {
        // No es un correo: se manda como texto para que veas cómo queda el DM.
        const vars = {
          negocio: SAMPLE.negocio,
          mesero: SAMPLE.mesero,
          mesero_linea: ` Nos atendió ${SAMPLE.mesero}.`,
          promedio: String(SAMPLE.promedio),
          link_reporte: reportUrl,
        };
        subject = prefix + "Mensaje de Instagram (DM de primer contacto)";
        bodyText =
          "Así se vería el texto del DM de Instagram (se copia y pega, no se manda por correo):\n\n" +
          tpl(
            automation?.bodyTemplate,
            vars,
            `Hola equipo de ${SAMPLE.negocio}, hoy los visitamos e hicimos un Mystery Shopper. Nos atendió ${SAMPLE.mesero}. Obtuvimos ${SAMPLE.promedio} estrellas de promedio. Aquí puedes ver el reporte completo: ${reportUrl}`
          );
      }

      const ctaByKey: Record<string, string> = {
        asesoria_gratuita: "Agendar mi asesoría gratuita",
        asignacion_visita: "Ver mis visitas asignadas",
        activacion_cuenta_negocio: "Crear mi cuenta",
        ticket_oferta: TICKET_CTA_LABEL.oferta,
        ticket_aviso: TICKET_CTA_LABEL.aviso,
      };
      const out = await sendTemplatedEmail({ to, subject, bodyText, ctaLabel: ctaByKey[key] });
      results.push({ key, subject, source: useTemplate ? "plantilla" : "texto original", status: out.status, error: out.error });
    } catch (err) {
      results.push({ key, subject: "", source: "texto original", status: "failed", error: err instanceof Error ? err.message : String(err) });
    }
  }

  return NextResponse.json({ to, results });
}
