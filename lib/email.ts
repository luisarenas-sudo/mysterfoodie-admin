import { Resend } from "resend";
import { getVerdict } from "./verdict";

export type SendResultEmailParams = {
  to: string;
  businessName: string;
  score: number;
  strengths: { label: string; score: number }[];
  opportunities: { label: string; score: number }[];
  reportUrl: string;
};

export type SendEmailOutcome = {
  status: "sent" | "skipped_no_api_key" | "failed";
  providerId?: string;
  error?: string;
};

function renderEmailHtml(params: SendResultEmailParams): string {
  const { businessName, score, strengths, opportunities, reportUrl } = params;
  const verdict = getVerdict(score);
  const strengthItems = strengths
    .map((s) => `<li>${s.label}: ${s.score} de 5</li>`)
    .join("");
  const opportunityItems = opportunities
    .map((o) => `<li>${o.label}: ${o.score} de 5</li>`)
    .join("");

  return `
    <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #222222;">
      <p style="font-size: 12px; font-weight: bold; letter-spacing: 0.08em; color: #f24444; text-transform: uppercase;">MysterFoodie</p>
      <h2 style="color: #222222; margin-top: 4px;">Resultado de tu evaluacion Mystery Shopper</h2>
      <p>Hola equipo de <strong>${businessName}</strong>,</p>
      <p>
        Recientemente realizamos una visita de evaluacion (Mystery Shopper) sin previo aviso
        en tu establecimiento. El promedio general obtenido fue:
      </p>
      <p style="font-size: 28px; font-weight: bold; color: #f24444; margin-bottom: 4px;">${score} de 5 estrellas</p>
      <p style="display: inline-block; font-size: 12px; font-weight: bold; color: ${verdict.color}; border: 1px solid ${verdict.color}; border-radius: 999px; padding: 4px 12px; margin-top: 0;">
        ${verdict.label}
      </p>
      <p style="color: #57534e;">${verdict.summary}</p>
      <p>Algunos puntos que mas destacaron:</p>
      <ul>${strengthItems}</ul>
      <p>Algunas areas con oportunidad de mejora:</p>
      <ul>${opportunityItems}</ul>
      <p>
        Este es solo un resumen general. El reporte completo incluye el detalle de cada
        indicador evaluado, comparativo con el sector y recomendaciones especificas.
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
      subject: `Resultado de tu evaluacion Mystery Shopper - ${params.score} estrellas`,
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
