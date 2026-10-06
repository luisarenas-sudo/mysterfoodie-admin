import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import { getVerdict, VERDICT_BANDS } from "./verdict";
import type { CategoryScore } from "./scoring";
import { TOTAL_ITEM_COUNT, CATEGORIES } from "./categories";

export type ReportPdfParams = {
  businessName: string;
  clientType?: string | null;
  city?: string | null;
  visitDate: Date;
  overallScore: number;
  categoryScores: CategoryScore[];
  shortCode: string;
};

const RED = "#F24444";
const INK = "#222222";
const MUTED = "#78716C";
const LIGHT_MUTED = "#A8A29E";
const PAGE_MARGIN = 54;

/** Breve descripción de qué se evalúa en cada categoría, basada en los
 * indicadores reales del cuestionario (lib/categories.ts) - no es texto
 * genérico, refleja exactamente lo que el formulario mide. */
const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  fachada: "Primera impresión del negocio: anuncio visible, puerta, pintura, ventanas y estacionamiento.",
  ambiente:
    "Limpieza de salón, barra, terraza y baños; mobiliario, orden, ventilación y música ambiental.",
  atencion:
    "Desempeño del mesero (presentación, conocimiento del menú, atención y acompañamiento a la mesa), uniformes, visita del gerente y rapidez/claridad del pago.",
  alimentos: "Tiempo de entrega, temperatura, presentación y sabor de lo que se ordenó.",
  accesibilidad: "Sillas altas para niños, rampas, baño para sillas de ruedas y menú en braille.",
};

function logoBuffer(): Buffer | null {
  try {
    return fs.readFileSync(path.join(process.cwd(), "public", "logo-wordmark.png"));
  } catch {
    return null;
  }
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "America/Mexico_City",
  }).format(date);
}

function drawFooter(doc: PDFKit.PDFDocument, pageNumber: number, pageCount: number) {
  const bottom = doc.page.height - 38;
  doc
    .fontSize(8)
    .fillColor(LIGHT_MUTED)
    .text("Con el respaldo de Flanco Izquierdo · flancoizquierdo.com", PAGE_MARGIN, bottom, {
      width: doc.page.width - PAGE_MARGIN * 2 - 60,
      align: "left",
    });
  doc.text(`${pageNumber} / ${pageCount}`, doc.page.width - PAGE_MARGIN - 60, bottom, {
    width: 60,
    align: "right",
  });
}

function drawHeader(doc: PDFKit.PDFDocument, logo: Buffer | null) {
  if (logo) {
    try {
      doc.image(logo, PAGE_MARGIN, 40, { width: 88 });
    } catch {
      // si la imagen no se puede decodificar, se sigue sin logo
    }
  }
}

function scoreBarColor(average: number): string {
  return getVerdict(average).color;
}

/**
 * Genera el PDF del reporte completo: portada con la calificación
 * general, desglose por categoría y una página de metodología. Se
 * manda por correo (ver lib/email.ts sendFullReportEmail) cuando
 * MercadoPago confirma el pago del reporte completo.
 */
export function buildReportPdf(params: ReportPdfParams): Promise<Buffer> {
  const { businessName, clientType, city, visitDate, overallScore, categoryScores, shortCode } = params;

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "A4", margin: PAGE_MARGIN, bufferPages: true, autoFirstPage: false });
      const chunks: Buffer[] = [];
      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      const logo = logoBuffer();
      const verdict = getVerdict(overallScore);
      const visibleCategories = categoryScores.filter((c) => c.count > 0);
      const contentWidth = doc.page.width - PAGE_MARGIN * 2;

      // ---------- Página 1: portada / calificación general ----------
      doc.addPage();
      drawHeader(doc, logo);

      doc
        .fontSize(10)
        .fillColor(RED)
        .text("REPORTE MYSTERY SHOPPER", PAGE_MARGIN, 150, { characterSpacing: 1.2 });

      doc.fontSize(26).fillColor(INK).text(businessName, PAGE_MARGIN, 168, { width: contentWidth });

      const subtitleParts = [clientType, city].filter(Boolean).join(" · ");
      doc
        .fontSize(11)
        .fillColor(MUTED)
        .text(
          `${subtitleParts ? subtitleParts + " · " : ""}Visita del ${formatDate(visitDate)}`,
          PAGE_MARGIN,
          doc.y + 4
        );

      // Tarjeta de calificación general
      const cardTop = doc.y + 30;
      const cardHeight = 150;
      doc
        .roundedRect(PAGE_MARGIN, cardTop, contentWidth, cardHeight, 14)
        .fillOpacity(1)
        .fillAndStroke("#FAFAF9", "#E7E5E4");

      doc
        .fillColor(RED)
        .fontSize(54)
        .text(String(overallScore), PAGE_MARGIN, cardTop + 28, { width: contentWidth / 2, align: "center" });
      doc
        .fillColor(LIGHT_MUTED)
        .fontSize(12)
        .text("de 5.0", PAGE_MARGIN, cardTop + 90, { width: contentWidth / 2, align: "center" });

      const badgeX = PAGE_MARGIN + contentWidth / 2 + 20;
      const badgeWidth = contentWidth / 2 - 40;
      doc
        .roundedRect(badgeX, cardTop + 40, badgeWidth, 30, 15)
        .fillOpacity(0.14)
        .fillColor(verdict.color)
        .fill();
      doc
        .fillOpacity(1)
        .fillColor(verdict.color)
        .fontSize(13)
        .text(verdict.label, badgeX, cardTop + 49, { width: badgeWidth, align: "center" });
      doc
        .fillColor(MUTED)
        .fontSize(10)
        .text(verdict.summary, badgeX, cardTop + 86, { width: badgeWidth, align: "center" });

      doc
        .fillColor(MUTED)
        .fontSize(10.5)
        .text(
          `Evaluación anónima realizada por un Myster Foodie: visitó el negocio como cliente real, pagó su cuenta (propina incluida) y calificó ${TOTAL_ITEM_COUNT} indicadores en ${CATEGORIES.length} categorías.`,
          PAGE_MARGIN,
          cardTop + cardHeight + 26,
          { width: contentWidth, align: "left", lineGap: 3 }
        );

      // ---------- Página 2: desglose por categoría ----------
      doc.addPage();
      drawHeader(doc, logo);
      doc.fontSize(18).fillColor(INK).text("Desglose por categoría", PAGE_MARGIN, 150);
      doc
        .fontSize(10.5)
        .fillColor(MUTED)
        .text(
          "La calificación general es el promedio de las categorías con indicadores calificados (no un promedio plano de los indicadores individuales).",
          PAGE_MARGIN,
          doc.y + 6,
          { width: contentWidth, lineGap: 3 }
        );

      let rowY = doc.y + 20;
      const barMaxWidth = 180;

      for (const cat of visibleCategories) {
        const color = scoreBarColor(cat.average);
        const desc = CATEGORY_DESCRIPTIONS[cat.key] ?? "";

        doc.fontSize(13).fillColor(INK).text(cat.label, PAGE_MARGIN, rowY, { continued: false });
        doc
          .fontSize(13)
          .fillColor(color)
          .text(`${cat.average} / 5`, PAGE_MARGIN, rowY, { width: contentWidth, align: "right" });

        const barY = rowY + 20;
        doc.roundedRect(PAGE_MARGIN, barY, barMaxWidth, 7, 3.5).fillColor("#E7E5E4").fill();
        const filledWidth = Math.max(6, (cat.average / 5) * barMaxWidth);
        doc.roundedRect(PAGE_MARGIN, barY, filledWidth, 7, 3.5).fillColor(color).fill();

        doc
          .fontSize(9.5)
          .fillColor(MUTED)
          .text(desc, PAGE_MARGIN, barY + 16, { width: contentWidth, lineGap: 2 });

        rowY = doc.y + 22;
      }

      if (visibleCategories.length === 0) {
        doc
          .fontSize(11)
          .fillColor(MUTED)
          .text("Esta visita no registró indicadores calificados por categoría.", PAGE_MARGIN, rowY);
      }

      // ---------- Página 3: metodología ----------
      doc.addPage();
      drawHeader(doc, logo);
      doc.fontSize(18).fillColor(INK).text("¿Cómo funciona Mystery Shopper?", PAGE_MARGIN, 150);

      const methodologyParagraphs = [
        "MysterFoodie evalúa negocios de alimentos y bebidas a través de visitas anónimas realizadas por Myster Foodies: perfiles que trabajan dentro de la industria restaurantera y visitan el negocio como clientes reales, pagando su propia cuenta con propina incluida, sin que el personal sepa que está siendo evaluado.",
        `Cada visita califica ${TOTAL_ITEM_COUNT} indicadores agrupados en ${CATEGORIES.length} categorías: ${CATEGORIES.slice(0, -1).map((c) => c.label).join(", ")} y ${CATEGORIES[CATEGORIES.length - 1].label}. La calificación general de la visita es el promedio de las calificaciones por categoría (no un promedio plano de todos los indicadores), para que ninguna categoría con muchos indicadores pese más que otra.`,
        "Con la calificación general se asigna un veredicto:",
      ];

      let textY = doc.y + 10;
      for (const p of methodologyParagraphs) {
        doc.fontSize(10.5).fillColor(INK).text(p, PAGE_MARGIN, textY, { width: contentWidth, lineGap: 4 });
        textY = doc.y + 10;
      }

      for (const band of VERDICT_BANDS) {
        doc.circle(PAGE_MARGIN + 4, textY + 5, 4).fillColor(band.color).fill();
        doc
          .fontSize(10.5)
          .fillColor(INK)
          .text(`${band.label}  ·  ${band.range}`, PAGE_MARGIN + 16, textY);
        textY += 20;
      }

      textY += 10;
      doc
        .fontSize(10.5)
        .fillColor(INK)
        .text(
          "El reporte completo (este documento) incluye el detalle de cada indicador evaluado dentro de cada categoría, además del resumen que se publica en el link público del negocio.",
          PAGE_MARGIN,
          textY,
          { width: contentWidth, lineGap: 4 }
        );
      textY = doc.y + 18;

      doc
        .fontSize(10.5)
        .fillColor(INK)
        .text(
          "Este estudio es realizado y respaldado por Flanco Izquierdo, agencia responsable de la operación de MysterFoodie.",
          PAGE_MARGIN,
          textY,
          { width: contentWidth, lineGap: 4 }
        );
      textY = doc.y + 6;
      doc
        .fontSize(10.5)
        .fillColor(RED)
        .text("flancoizquierdo.com", PAGE_MARGIN, textY, { link: "https://flancoizquierdo.com/", underline: true });

      textY = doc.y + 24;
      doc
        .fontSize(9)
        .fillColor(LIGHT_MUTED)
        .text(`Código de reporte: ${shortCode}`, PAGE_MARGIN, textY);

      // ---------- Pie de página en todas las páginas ----------
      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        drawFooter(doc, i - range.start + 1, range.count);
      }

      doc.end();
    } catch (err) {
      reject(err instanceof Error ? err : new Error(String(err)));
    }
  });
}
