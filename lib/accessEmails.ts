import { sendTemplatedEmail, type SendEmailOutcome } from "./email";
import { ACCESS_TTL_DAYS } from "./accessTokens";

/** Correos del acceso propio, con la misma marca que el resto de los correos. */

function codeBlock(baseUrl: string, code: string): string {
  return (
    `Si el botón no abre, entra a ${baseUrl.replace(/\/$/, "")}/set-password, escribe tu correo y este código de 6 dígitos:\n\n` +
    `${code.split("").join(" ")}\n\n` +
    `Vale ${ACCESS_TTL_DAYS} días y se puede usar una sola vez.`
  );
}

export async function sendInviteEmail(p: {
  to: string;
  name?: string | null;
  roleLabel: string;
  businessName?: string | null;
  url: string;
  code: string;
  baseUrl: string;
}): Promise<SendEmailOutcome> {
  const bodyText =
    `Hola${p.name ? ` ${p.name}` : ""},\n\n` +
    `Te invitaron a MysterFoodie como ${p.roleLabel}${p.businessName ? ` de ${p.businessName}` : ""}. ` +
    `Crea tu contraseña para entrar (o continúa con tu cuenta de Google desde la misma pantalla):\n` +
    `${p.url}\n\n` +
    codeBlock(p.baseUrl, p.code) +
    `\n\nSaludos,\nMysterFoodie`;
  return sendTemplatedEmail({ to: p.to, subject: "Te invitaron a MysterFoodie", bodyText, ctaLabel: "Crear mi contraseña" });
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
