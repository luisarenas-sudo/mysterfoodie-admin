import { getSupabaseServiceClient } from "./supabase";
import { BRAND_RED, escapeHtml, renderButton, renderEmailShell, sendHtmlEmail } from "./email";
import { ROLE_LABELS } from "./brand";
import { formatMxn } from "./earningsMatrix";
import { monthLabel } from "./months";
import { getPayoutRows, getReport } from "./payouts";

type Db = ReturnType<typeof getSupabaseServiceClient>;

const esc = escapeHtml;

function statBox(label: string, value: string, strong = false): string {
  return `
    <td width="33%" valign="top" style="padding: 0 4px;">
      <div style="background-color: ${strong ? "#fff5f5" : "#f4f5fa"}; border-radius: 14px; padding: 12px 10px; text-align: center;">
        <p style="margin: 0; font-size: 11px; font-weight: bold; letter-spacing: 0.06em; text-transform: uppercase; color: #6b7280;">${label}</p>
        <p style="margin: 4px 0 0; font-size: 17px; font-weight: bold; color: ${strong ? BRAND_RED : "#111827"};">${value}</p>
      </div>
    </td>`;
}

/** Correo del cierre del mes para el Master Chef: tabla por perfil, lo que hay que depositar y lo que queda a la plataforma. */
export async function renderMonthlyReportEmail(db: Db, month: string, baseUrl: string): Promise<{ subject: string; html: string; text: string } | null> {
  const report = await getReport(db, month);
  if (!report) return null;
  const rows = await getPayoutRows(db, month);
  const label = monthLabel(month);
  const url = `${baseUrl.replace(/\/$/, "")}/finanzas/pagos?mes=${month}`;

  const tableRows = rows
    .map(
      (r) => `
      <tr>
        <td style="padding: 10px 6px; border-bottom: 1px solid #eef0f3; font-size: 14px; color: #111827;">
          <strong>${esc(r.name)}</strong><br /><span style="font-size: 12px; color: #6b7280;">${esc(ROLE_LABELS[r.role] ?? r.role)} · ${r.salesCount} ${r.salesCount === 1 ? "venta" : "ventas"}</span>
        </td>
        <td align="right" style="padding: 10px 6px; border-bottom: 1px solid #eef0f3; font-size: 13px; color: #4b5563;">${formatMxn(r.visitsAmount)}</td>
        <td align="right" style="padding: 10px 6px; border-bottom: 1px solid #eef0f3; font-size: 13px; color: #4b5563;">${formatMxn(r.profilesAmount)}</td>
        <td align="right" style="padding: 10px 6px; border-bottom: 1px solid #eef0f3; font-size: 14px; font-weight: bold; color: #111827;">${formatMxn(r.total)}</td>
      </tr>`
    )
    .join("");

  const table = rows.length
    ? `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; margin: 18px 0 6px;">
      <tr>
        <th align="left" style="padding: 8px 6px; font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase; color: #9ca3af; border-bottom: 2px solid #e5e7eb;">Persona</th>
        <th align="right" style="padding: 8px 6px; font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase; color: #9ca3af; border-bottom: 2px solid #e5e7eb;">Visitas</th>
        <th align="right" style="padding: 8px 6px; font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase; color: #9ca3af; border-bottom: 2px solid #e5e7eb;">Perfiles</th>
        <th align="right" style="padding: 8px 6px; font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase; color: #9ca3af; border-bottom: 2px solid #e5e7eb;">A depositar</th>
      </tr>
      ${tableRows}
      <tr>
        <td colspan="3" style="padding: 12px 6px; font-size: 14px; font-weight: bold; color: #111827;">Total a depositar</td>
        <td align="right" style="padding: 12px 6px; font-size: 16px; font-weight: bold; color: ${BRAND_RED};">${formatMxn(report.toPay)}</td>
      </tr>
    </table>`
    : `<p style="margin: 18px 0; font-size: 15px; line-height: 1.6; color: #4b5563;">Este mes no hay depósitos pendientes: ningún Sibarita ni Shopper tuvo ventas.</p>`;

  const notes: string[] = [];
  if (report.paidAside > 0) notes.push(`${formatMxn(report.paidAside)} de ganancias de perfiles ya se habían pagado por separado (no están en la tabla).`);
  if (report.unpaidPlanAmount > 0) notes.push(`${formatMxn(report.unpaidPlanAmount)} en visitas de planes hechas pero sin cobrar: no reparten ganancia hasta que marques el mes del plan como cobrado.`);
  if (report.unclassified > 0) notes.push(`${report.unclassified} ${report.unclassified === 1 ? "venta no encaja" : "ventas no encajan"} en el reparto y no se ${report.unclassified === 1 ? "le" : "les"} asignó ganancia.`);
  const notesHtml = notes.length ? `<ul style="margin: 12px 0 0; padding-left: 18px; font-size: 13px; line-height: 1.6; color: #6b7280;">${notes.map((n) => `<li>${esc(n)}</li>`).join("")}</ul>` : "";

  const card = `
    <p style="margin: 0 0 6px; font-size: 12px; font-weight: bold; letter-spacing: 0.1em; color: ${BRAND_RED}; text-transform: uppercase;">Reporte de ventas mensual</p>
    <h1 style="margin: 0 0 12px; font-size: 24px; line-height: 1.25; color: #111827;">${esc(label)}</h1>
    <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.6; color: #4b5563;">Cerró el mes. Esto es lo que generó cada perfil, cuánto toca depositar y lo que le queda a la plataforma.</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 0 -4px;"><tr>
      ${statBox("A depositar", formatMxn(report.toPay), true)}
      ${statBox("Plataforma", formatMxn(report.platform))}
      ${statBox("Ventas brutas", formatMxn(report.gross))}
    </tr></table>
    ${table}
    ${notesHtml}
    <p style="margin: 18px 0 18px; font-size: 14px; line-height: 1.6; color: #4b5563;">Cuando deposites, marca la palomita de cada persona en la app para llevar el control. Ellos verán en su Inicio que ya se les pagó.</p>
    ${renderButton(url, "Ver y marcar pagos")}
  `;
  const html = renderEmailShell(card);

  const text =
    `Reporte de ventas mensual: ${label}\n\nA depositar: ${formatMxn(report.toPay)}\nPlataforma: ${formatMxn(report.platform)}\nVentas brutas: ${formatMxn(report.gross)}\n\n` +
    rows.map((r) => `${r.name} (${ROLE_LABELS[r.role] ?? r.role}): visitas ${formatMxn(r.visitsAmount)}, perfiles ${formatMxn(r.profilesAmount)}, total ${formatMxn(r.total)}`).join("\n") +
    `\n\nVer y marcar pagos: ${url}\n`;

  return { subject: `Reporte de ventas de ${label.toLowerCase()}: ${rows.length ? `debes depositar ${formatMxn(report.toPay)}` : "sin depósitos pendientes"}`, html, text };
}

/** Manda el reporte del mes a todos los Master Chef y marca la fecha de envío. Devuelve cuántos correos salieron. */
export async function sendMonthlyReportEmail(db: Db, month: string, baseUrl: string): Promise<{ sent: number; failed: number }> {
  const mail = await renderMonthlyReportEmail(db, month, baseUrl);
  if (!mail) return { sent: 0, failed: 0 };
  const { data: admins } = await db.from("profiles").select("email").eq("role", "admin").not("email", "is", null);
  let sent = 0;
  let failed = 0;
  for (const a of admins ?? []) {
    const to = (a.email as string | null)?.trim();
    if (!to) continue;
    const out = await sendHtmlEmail({ to, subject: mail.subject, html: mail.html, text: mail.text });
    if (out.status === "sent") sent += 1;
    else failed += 1;
  }
  if (sent > 0) await db.from("monthly_payout_reports").update({ email_sent_at: new Date().toISOString() }).eq("month", month);
  return { sent, failed };
}
