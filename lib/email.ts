import { Resend } from "resend";
import { getVerdict } from "./verdict";
import type { CategoryScore } from "./scoring";

export type SendResultEmailParams = {
  to: string;
  businessName: string;
  /** Frase en lenguaje natural del tipo de negocio, ej. "cafetería" (ver businessTypePhrase en lib/categories.ts). */
  businessType?: string;
  /** Nombre del mesero que atendió la visita, capturado al final del formulario. */
  waiterName?: string | null;
  score: number;
  reportUrl: string;
  categoryScores: CategoryScore[];
};

export type SendEmailOutcome = {
  status: "sent" | "skipped_no_api_key" | "failed";
  providerId?: string;
  error?: string;
};

function renderCategoryRows(categoryScores: CategoryScore[]): string {
  return categoryScores
    .filter((c) => c.count > 0)
    .map(
      (c) => `
        <tr>
          <td style="padding: 6px 0; font-size: 14px; color: #44403c;">${c.label}</td>
          <td style="padding: 6px 0; font-size: 14px; color: #222222; font-weight: bold; text-align: right;">${c.average} / 5</td>
        </tr>
      `
    )
    .join("");
}

function renderEmailHtml(params: SendResultEmailParams): string {
  const { businessName, businessType, waiterName, score, reportUrl, categoryScores } = params;
  const verdict = getVerdict(score);
  const visitLocation = businessType ? `tu ${businessType}` : "tu establecimiento";
  const waiterMention = waiterName
    ? `, donde nos atendió <strong>${waiterName}</strong>`
    : "";

  return `
    <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #222222;">
      <p style="font-size: 12px; font-weight: bold; letter-spacing: 0.08em; color: #f24444; text-transform: uppercase;">MysterFoodie</p>
      <h2 style="color: #222222; margin-top: 4px;">Resultado de tu evaluación Mystery Shopper</h2>
      <p>Hola equipo de <strong>${businessName}</strong>,</p>
      <p>
        Recientemente realizamos una visita de evaluación (Mystery Shopper) sin previo aviso
        a ${visitLocation}${waiterMention}. El promedio general obtenido fue:
      </p>
      <p style="font-size: 28px; font-weight: bold; color: #f24444; margin-bottom: 4px;">${score} de 5 estrellas</p>
      <p style="display: inline-block; font-size: 12px; font-weight: bold; color: ${verdict.color}; border: 1px solid ${verdict.color}; border-radius: 999px; padding: 4px 12px; margin-top: 0;">
        ${verdict.label}
      </p>
      <p style="color: #57534e;">${verdict.summary}</p>

      <table style="width: 100%; border-collapse: collapse; margin-top: 16px; border-top: 1px solid #e7e5e4;">
        ${renderCategoryRows(categoryScores)}
      </table>

      <p style="margin-top: 20px;">
        Este es solo un resumen por categoría. El reporte completo incluye el detalle de cada
        uno de los indicadores evaluados dentro de cada categoría, comparativo con el sector y
        recomendaciones específicas.
      </p>
      <p>
        <a href="${reportUrl}" style="background-color: #f24444; background-image: linear-gradient(180deg, #f24444, #f25631); color: #ffffff; padding: 10px 18px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
          Ver reporte y solicitar el detalle completo
        </a>
      </p>
      <p style="font-size: 12px; color: #78716c; margin-top: 32px;">
        MysterFoodie - evaluaciones Mystery Shopper para restaurantes y bares.
      </p>
    </div>
  `;
}

export async function sendResultEmail(
  params: SendResultEmailParams
): Promise<SendEmailOutcome> {
  const apiKey = process.env.RESEND_API_KEY;
  const fromAddress = process.env.RESEND_FROM_EMAIL ?? "reportes@mysterfoodie.com";

  if (!apiKey) {
    return { status: "skipped_no_api_key" };
  }

  try {
    const resend = new Resend(apiKey);
    const result = await resend.emails.send({
      from: fromAddress,
      to: params.to,
      subject: `Resultado de tu evaluación Mystery Shopper - ${params.score} estrellas`,
      html: renderEmailHtml(params),
    });

    if (result.error) {
      return { status: "failed", error: result.error.message };
    }

    return { status: "sent", providerId: result.data?.id };
  } catch (err) {
    return { status: "failed", error: err instanceof Error ? err.message : String(err) };
  }
}
