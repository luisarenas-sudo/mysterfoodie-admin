import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import { getVerdict, VERDICT_BANDS } from "./verdict";
import type { CategoryScore, Ratings, Flags } from "./scoring";
import { TOTAL_ITEM_COUNT, CATEGORIES, groupCategoryItems, type CategoryItem } from "./categories";
import { FOODIE_PROFILE } from "./brand";

export type ReportPdfParams = {
  businessName: string;
  clientType?: string | null;
  city?: string | null;
  visitDate: Date;
  overallScore: number;
  categoryScores: CategoryScore[];
  shortCode: string;
  /** Foto del ticket de consumo (JPEG/PNG); si viene, se agrega como página. */
  ticketImage?: Buffer | null;
  /** Calificaciones, Sí/No, tipo de menú y comentarios de la visita: con ellos el PDF incluye el detalle de cada indicador. */
  ratings?: Ratings;
  flags?: Flags;
  menuType?: string | null;
  comments?: string | null;
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
  // El pie queda dentro del margen inferior: sin esto pdfkit abre una página nueva por cada pie.
  const prevBottomMargin = doc.page.margins.bottom;
  doc.page.margins.bottom = 0;
  doc
    .fontSize(8)
    .fillColor(LIGHT_MUTED)
    .text("Con el respaldo de Flanco Izquierdo · flancoizquierdo.com", PAGE_MARGIN, bottom, {
      width: doc.page.width - PAGE_MARGIN * 2 - 60,
      align: "left",
      lineBreak: false,
    });
  doc.text(`${pageNumber} / ${pageCount}`, doc.page.width - PAGE_MARGIN - 60, bottom, {
    width: 60,
    align: "right",
    lineBreak: false,
  });
  doc.page.margins.bottom = prevBottomMargin;
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


const STAR_PATH = "M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7-6.2-3.8L6 21l1.6-7L2.2 9.2l7.1-.6L12 2z";
const YES_GREEN = "#248A3D";

function drawStars(doc: PDFKit.PDFDocument, x: number, y: number, value: number) {
  for (let n = 1; n <= 5; n++) {
    doc
      .save()
      .translate(x + (n - 1) * 13, y)
      .scale(0.5)
      .path(STAR_PATH)
      .fill(n <= value ? RED : "#E7E5E4")
      .restore();
  }
}

type DetailRow = { heading: string | null; item: CategoryItem };

/** Mismo agrupado que el reporte en línea: encabezado de grupo/subgrupo antes del primer indicador de cada uno. */
function flattenItems(items: CategoryItem[]): DetailRow[] {
  return groupCategoryItems(items).flatMap((block, blockIdx) =>
    block.kind === "standalone"
      ? block.items.map((item, i) => ({
          item,
          // Los indicadores sueltos que siguen a un grupo llevan su propio encabezado para no confundirse con el grupo anterior.
          heading: blockIdx > 0 && i === 0 ? "General" : (null as string | null),
        }))
      : block.subBlocks.flatMap((sub) =>
          sub.items.map((item, i) => ({
            item,
            heading: i === 0 ? [block.group, sub.subgroup].filter(Boolean).join(": ") : null,
          }))
        )
  );
}

/**
 * Genera el PDF del reporte completo: portada con la calificación
 * general, desglose por categoría y una página de metodología. Se
 * manda por correo (ver lib/email.ts sendFullReportEmail) cuando
 * MercadoPago confirma el pago del reporte completo.
 */
export function buildReportPdf(params: ReportPdfParams): Promise<Buffer> {
  const { businessName, clientType, city, visitDate, overallScore, categoryScores, shortCode, ticketImage, ratings, flags, menuType, comments } = params;

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
      // Con autoFirstPage:false todavía no hay página: se usa el ancho A4 (595.28 pt).
      const contentWidth = 595.28 - PAGE_MARGIN * 2;

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
          `Evaluación anónima realizada por un MysterFoodie: visitó el negocio como cliente real, pagó su cuenta (propina incluida) y calificó ${TOTAL_ITEM_COUNT} indicadores en ${CATEGORIES.length} categorías.`,
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

      // ---------- Detalle por indicador (los 52) + comentarios ----------
      if (ratings) {
        const rowH = 20;
        const limit = doc.page.height - 72;
        const valueX = PAGE_MARGIN + contentWidth - 70;
        let y = 150;
        const startPage = (title: string, note?: string) => {
          doc.addPage();
          drawHeader(doc, logo);
          doc.fontSize(18).fillColor(INK).text(title, PAGE_MARGIN, 150);
          if (note) {
            doc.fontSize(10).fillColor(MUTED).text(note, PAGE_MARGIN, doc.y + 6, { width: contentWidth, lineGap: 3 });
          }
          y = doc.y + 16;
        };
        startPage(
          "Detalle por indicador",
          `Así calificó el MysterFoodie cada uno de los ${TOTAL_ITEM_COUNT} indicadores: de 1 a 5 estrellas (1 es malo, 3 regular y 5 excelente) o con Sí/No cuando solo importa si existe. “No aplica” significa que el indicador no se calificó en esta visita.`
        );

        for (const cat of CATEGORIES) {
          if (y + 70 > limit) startPage("Detalle por indicador");
          doc.fontSize(11).fillColor(RED).text(cat.label.toUpperCase(), PAGE_MARGIN, y, { characterSpacing: 1 });
          y += 22;

          for (const row of flattenItems(cat.items)) {
            const need = rowH + (row.heading ? 20 : 0);
            if (y + need > limit) {
              startPage("Detalle por indicador");
              doc.fontSize(9).fillColor(LIGHT_MUTED).text(`${cat.label} (continúa)`, PAGE_MARGIN, y);
              y += 18;
            }
            if (row.heading) {
              doc
                .fontSize(8.5)
                .fillColor(LIGHT_MUTED)
                .text(row.heading.toUpperCase(), PAGE_MARGIN, y + 6, { characterSpacing: 0.6 });
              y += 20;
            }
            doc.fontSize(10).fillColor(INK).text(row.item.label, PAGE_MARGIN + 8, y + 2, { width: contentWidth - 130, lineBreak: false });

            if (row.item.type === "star") {
              const v = ratings[row.item.key] || 0;
              if (v > 0) drawStars(doc, valueX, y, v);
              else doc.fontSize(9).fillColor(LIGHT_MUTED).text("No aplica", valueX - 10, y + 3, { width: 80, align: "right", lineBreak: false });
            } else if (row.item.type === "boolean") {
              const v = flags?.[row.item.key];
              doc
                .fontSize(10)
                .fillColor(v === true ? YES_GREEN : MUTED)
                .text(v === true ? "Sí" : v === false ? "No" : "No aplica", valueX - 10, y + 2, { width: 80, align: "right", lineBreak: false });
            } else if (row.item.type === "select") {
              const opt = row.item.options?.find((o) => o.value === menuType);
              doc.fontSize(10).fillColor(MUTED).text(opt?.label ?? "—", valueX - 10, y + 2, { width: 80, align: "right", lineBreak: false });
            }
            doc
              .moveTo(PAGE_MARGIN, y + rowH - 3)
              .lineTo(PAGE_MARGIN + contentWidth, y + rowH - 3)
              .lineWidth(0.5)
              .strokeColor("#EEEAE7")
              .stroke();
            y += rowH;
          }
          y += 14;
        }

        if (comments && comments.trim()) {
          startPage("Comentarios y sugerencias del MysterFoodie");
          doc.fontSize(10.5).fillColor(INK).text(comments.trim(), PAGE_MARGIN, y, { width: contentWidth, lineGap: 4 });
        }
      }

      // ---------- Ticket de consumo (si la visita lo tiene) ----------
      if (ticketImage) {
        doc.addPage();
        drawHeader(doc, logo);
        doc.fontSize(18).fillColor(INK).text("Ticket de consumo", PAGE_MARGIN, 150);
        doc
          .fontSize(10)
          .fillColor(MUTED)
          .text("Foto del ticket de la visita, subida por el MysterFoodie.", PAGE_MARGIN, doc.y + 6, { width: contentWidth });
        try {
          const top = doc.y + 18;
          doc.image(ticketImage, PAGE_MARGIN, top, {
            fit: [contentWidth, doc.page.height - top - 70],
            align: "center",
          });
        } catch {
          doc.fontSize(10.5).fillColor(MUTED).text("No se pudo incluir la foto del ticket en este documento.", PAGE_MARGIN, doc.y + 18);
        }
      }

      // ---------- Página 3: metodología ----------
      doc.addPage();
      drawHeader(doc, logo);
      doc.fontSize(18).fillColor(INK).text("¿Cómo funciona Mystery Shopper?", PAGE_MARGIN, 150);

      const methodologyParagraphs = [
        `MysterFoodie evalúa negocios de alimentos y bebidas a través de visitas anónimas realizadas por MysterFoodies: ${FOODIE_PROFILE}. Visitan el negocio como clientes reales, pagando su cuenta con propina incluida, sin que el personal sepa que está siendo evaluado.`,
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
