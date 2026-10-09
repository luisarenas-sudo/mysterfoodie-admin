import { BRAND_RED, escapeHtml, renderButton, renderEmailShell, sendHtmlEmail, sendTemplatedEmail, type SendEmailOutcome } from "./email";
import { inviteContentForRole } from "./inviteContent";
import { ACCESS_TTL_DAYS } from "./accessTokens";

/** Correos del acceso propio, con la misma marca que el resto de los correos. */

function codeBlock(baseUrl: string, code: string): string {
  return (
    `Si el botón no abre, entra a ${baseUrl.replace(/\/$/, "")}/set-password, escribe tu correo y este código de 6 dígitos:\n\n` +
    `${code.split("").join(" ")}\n\n` +
    `Vale ${ACCESS_TTL_DAYS} días y se puede usar una sola vez.`
  );
}

function esc(t: string): string {
  return escapeHtml(t);
}

export function renderInviteHtml(p: {
  name?: string | null;
  invitedBy?: string | null;
  roleLabel: string;
  role: string;
  businessName?: string | null;
  url: string;
  code: string;
  baseUrl: string;
}): string {
  const c = inviteContentForRole(p.role, p.businessName);
  const who = p.invitedBy ? `<strong>${esc(p.invitedBy)}</strong> te invitó` : "Te invitaron";
  const host = p.baseUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");

  const canRows = c.can
    .map(
      (i) => `
      <tr>
        <td width="44" valign="top" style="padding: 10px 0; font-size: 24px; line-height: 1;">${i.emoji}</td>
        <td valign="top" style="padding: 10px 0; border-bottom: 1px solid #eef0f3;">
          <p style="margin: 0; font-size: 15px; font-weight: bold; color: #111827;">${esc(i.title)}</p>
          <p style="margin: 3px 0 0; font-size: 14px; line-height: 1.55; color: #4b5563;">${esc(i.text)}</p>
        </td>
      </tr>`
    )
    .join("");

  const goal = c.goal
    ? `
    <div style="margin: 26px 0 4px; background-color: #fff5f5; border: 1px solid #fcd5d5; border-radius: 18px; padding: 20px 22px;">
      <p style="margin: 0 0 6px; font-size: 12px; font-weight: bold; letter-spacing: 0.1em; color: ${BRAND_RED}; text-transform: uppercase;">Meta realizable</p>
      <p style="margin: 0 0 10px; font-size: 18px; font-weight: bold; line-height: 1.35; color: #111827;">${esc(c.goal.title)}</p>
      <p style="margin: 0; font-size: 14.5px; line-height: 1.65; color: #374151;">${esc(c.goal.body)}</p>
      <p style="margin: 12px 0 0; font-size: 12px; line-height: 1.55; color: #9ca3af;">${esc(c.goal.footnote)}</p>
    </div>`
    : "";

  const steps = c.steps
    .map(
      (t, i) => `
      <tr>
        <td width="34" valign="top" style="padding: 7px 0;">
          <div style="width: 24px; height: 24px; line-height: 24px; border-radius: 12px; background-color: #111827; color: #ffffff; text-align: center; font-size: 13px; font-weight: bold;">${i + 1}</div>
        </td>
        <td valign="top" style="padding: 7px 0; font-size: 14.5px; line-height: 1.55; color: #374151;">${esc(t)}</td>
      </tr>`
    )
    .join("");

  return renderEmailShell(`
    <h2 style="margin: 0 0 14px; font-size: 25px; line-height: 1.25; color: #111827;">Te damos la bienvenida a MysterFoodie</h2>
    <p style="margin: 0 0 18px; font-size: 15px; line-height: 1.6; color: #374151;">Hola${p.name ? ` ${esc(p.name)}` : ""}, ${who} para unirte${p.businessName ? ` con la cuenta de <strong>${esc(p.businessName)}</strong>` : ""}.</p>

    <div style="background-color: #f8f9fb; border: 1px solid #eceef2; border-radius: 18px; padding: 18px 20px;">
      <p style="margin: 0 0 4px; font-size: 12px; font-weight: bold; letter-spacing: 0.1em; color: #8a8f98; text-transform: uppercase;">Tu rol</p>
      <p style="margin: 0; font-size: 20px; font-weight: bold; color: #111827;">${c.emoji} ${esc(p.roleLabel)}</p>
      <p style="margin: 4px 0 0; font-size: 14px; color: #6b7280;">${esc(c.tagline)}</p>
    </div>

    <p style="margin: 20px 0 6px; font-size: 15px; line-height: 1.6; color: #4b5563;">${esc(c.intro)} Esto es lo que podrás hacer:</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">${canRows}</table>
    ${goal}

    <p style="margin: 26px 0 6px; font-size: 16px; font-weight: bold; color: #111827;">Empieza en 3 pasos</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">${steps}</table>

    <div style="margin: 24px 0 0;">${renderButton(p.url, "Crear mi contraseña")}</div>
    <p style="margin: 10px 0 0; text-align: center; font-size: 12.5px; color: #9ca3af;">También puedes continuar con tu cuenta de Google desde esa pantalla.</p>

    <div style="margin: 24px 0 0; border: 1px dashed #d1d5db; border-radius: 16px; padding: 16px 18px; text-align: center;">
      <p style="margin: 0 0 6px; font-size: 13px; line-height: 1.55; color: #6b7280;">¿El botón no abre? Entra a <strong>${esc(host)}/set-password</strong>, escribe tu correo y este código:</p>
      <p style="margin: 0; font-size: 28px; font-weight: bold; letter-spacing: 0.3em; color: #111827;">${esc(p.code)}</p>
      <p style="margin: 6px 0 0; font-size: 12px; color: #9ca3af;">Vale ${ACCESS_TTL_DAYS} días y se usa una sola vez.</p>
    </div>
  `);
}

export async function sendInviteEmail(p: {
  to: string;
  name?: string | null;
  invitedBy?: string | null;
  role: string;
  roleLabel: string;
  businessName?: string | null;
  url: string;
  code: string;
  baseUrl: string;
}): Promise<SendEmailOutcome> {
  const c = inviteContentForRole(p.role, p.businessName);
  const text =
    `Hola${p.name ? ` ${p.name}` : ""},\n\n` +
    `${p.invitedBy ? `${p.invitedBy} te invitó` : "Te invitaron"} a MysterFoodie como ${p.roleLabel}.\n${c.tagline}.\n\n` +
    c.can.map((i) => `- ${i.title}: ${i.text}`).join("\n") +
    (c.goal ? `\n\n${c.goal.title}\n${c.goal.body}\n${c.goal.footnote}` : "") +
    `\n\nCrea tu contraseña aquí:\n${p.url}\n\n` +
    codeBlock(p.baseUrl, p.code) +
    `\n\nSaludos,\nMysterFoodie`;
  return sendHtmlEmail({
    to: p.to,
    subject: `Te invitaron a MysterFoodie como ${p.roleLabel}`,
    html: renderInviteHtml(p),
    text,
  });
}

export async function sendRecoveryEmail(p: {
  to: string;
  name?: string | null;
  url: string;
  code: string;
  baseUrl: string;
}): Promise<SendEmailOutcome> {
  const bodyText =
    `Hola${p.name ? ` ${p.name}` : ""},\n\n` +
    `Recibimos una solicitud para crear una nueva contraseña en MysterFoodie:\n` +
    `${p.url}\n\n` +
    codeBlock(p.baseUrl, p.code) +
    `\n\nSi no fuiste tú, ignora este correo: tu contraseña actual sigue igual.\n\nSaludos,\nMysterFoodie`;
  return sendTemplatedEmail({ to: p.to, subject: "Crea una nueva contraseña en MysterFoodie", bodyText, ctaLabel: "Crear nueva contraseña" });
}

export async function sendRemovalEmail(p: { to: string; name?: string | null }): Promise<SendEmailOutcome> {
  const bodyText =
    `Hola${p.name ? ` ${p.name}` : ""},\n\n` +
    `Tu acceso a MysterFoodie fue dado de baja, así que ya no podrás iniciar sesión.\n\n` +
    `Gracias por tu trabajo. Si crees que se trata de un error, responde este correo o escribe a quien te invitó.\n\n` +
    `Saludos,\nMysterFoodie`;
  return sendTemplatedEmail({ to: p.to, subject: "Tu acceso a MysterFoodie fue dado de baja", bodyText });
}
