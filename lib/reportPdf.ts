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
  /** Demo gratis (sin pago): marca de agua "GRATIS" muy clara en todas las páginas, a manera de sello CONFIDENCIAL. */
  demo?: boolean;
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

/** Ruta del logo (versión ligera de 420 px). Se pasa como ruta, no como Buffer, para que pdfkit lo incruste una sola vez aunque salga en todas las páginas. */
function logoBuffer(): string | null {
  for (const name of ["logo-wordmark-pdf.png", "logo-wordmark.png"]) {
    const file = path.join(process.cwd(), "public", name);
    if (fs.existsSync(file)) return file;
  }
  return null;
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

/** Marca de agua diagonal "GRATIS" muy clara; va encima del contenido pero con opacidad baja para no estorbar la lectura. */
function drawWatermark(doc: PDFKit.PDFDocument) {
  const prevBottomMargin = doc.page.margins.bottom;
  doc.page.margins.bottom = 0;
  doc.save();
  doc.opacity(0.07);
  doc.fillColor("#222222");
  doc.font("Helvetica-Bold").fontSize(150);
  const cx = doc.page.width / 2;
  const cy = doc.page.height / 2;
  doc.rotate(-35, { origin: [cx, cy] });
  const w = doc.widthOfString("GRATIS");
  doc.text("GRATIS", cx - w / 2, cy - 75, { lineBreak: false });
  doc.restore();
  doc.page.margins.bottom = prevBottomMargin;
}

function drawHeader(doc: PDFKit.PDFDocument, logo: string | null) {
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

/** Estrella centrada en (cx, cy) de lado `size`, girada `rot` grados; `fraction` (0 a 1) la rellena de izquierda a derecha (calificaciones con decimales). */
function drawStarAt(doc: PDFKit.PDFDocument, cx: number, cy: number, size: number, fraction: number, rot: number, fillColor: string) {
  doc.save().translate(cx, cy).rotate(rot).scale(size / 24).translate(-12, -12);
  doc.path(STAR_PATH).fill("#E7E5E4");
  if (fraction > 0) {
    doc.save().rect(0, 0, 24 * Math.min(1, fraction), 24).clip();
    doc.path(STAR_PATH).fill(fillColor);
    doc.restore();
  }
  doc.restore();
}

/** Cinco estrellas en arco alrededor de la calificación (cada una girada hacia afuera), rellenas según el puntaje. */
function drawStarArc(doc: PDFKit.PDFDocument, cx: number, cy: number, radius: number, size: number, score: number, color: string) {
  for (let i = 0; i < 5; i++) {
    const theta = 210 + i * 30; // 270° es arriba (eje y hacia abajo)
    const rad = (theta * Math.PI) / 180;
    drawStarAt(doc, cx + radius * Math.cos(rad), cy + radius * Math.sin(rad), size, Math.max(0, Math.min(1, score - i)), theta - 270, color);
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

      // Referencia del reporte, arriba a la derecha (da aire de expediente)
      doc
        .font("Helvetica-Bold")
        .fontSize(8)
        .fillColor(LIGHT_MUTED)
        .text(`REPORTE N.º ${shortCode.toUpperCase()}`, PAGE_MARGIN, 48, { width: contentWidth, align: "right", characterSpacing: 1.2, lineBreak: false });
      doc.font("Helvetica");

      doc
        .fontSize(10)
        .fillColor(RED)
        .text("REPORTE MYSTERY SHOPPER", PAGE_MARGIN, 150, { characterSpacing: 1.2 });

      doc.font("Helvetica-Bold").fontSize(businessName.length > 38 ? 24 : 30).fillColor(INK).text(businessName, PAGE_MARGIN, 168, { width: contentWidth });
      doc.font("Helvetica");

      const subtitleParts = [clientType, city].filter(Boolean).join(" · ");
      doc
        .fontSize(11)
        .fillColor(MUTED)
        .text(
          `${subtitleParts ? subtitleParts + " · " : ""}Visita del ${formatDate(visitDate)}`,
          PAGE_MARGIN,
          doc.y + 4
        );

      // Tarjeta de calificación general: estrellas en arco alrededor de la calificación + veredicto
      const cardTop = doc.y + 28;
      const cardHeight = 204;
      doc
        .roundedRect(PAGE_MARGIN, cardTop, contentWidth, cardHeight, 14)
        .fillOpacity(1)
        .fillAndStroke("#FAFAF9", "#E7E5E4");

      const halfW = contentWidth / 2;
      const scoreCx = PAGE_MARGIN + halfW / 2;
      const scoreCy = cardTop + 128;
      drawStarArc(doc, scoreCx, scoreCy, 90, 38, overallScore, RED);
      doc
        .font("Helvetica-Bold")
        .fillColor(RED)
        .fontSize(54)
        .text(String(overallScore), PAGE_MARGIN, scoreCy - 30, { width: halfW, align: "center", lineBreak: false });
      doc.font("Helvetica");
      doc
        .fillColor(LIGHT_MUTED)
        .fontSize(12)
        .text("de 5.0", PAGE_MARGIN, scoreCy + 32, { width: halfW, align: "center", lineBreak: false });

      // Divisor vertical entre calificación y veredicto
      doc
        .moveTo(PAGE_MARGIN + halfW, cardTop + 32)
        .lineTo(PAGE_MARGIN + halfW, cardTop + cardHeight - 32)
        .lineWidth(0.6)
        .strokeColor("#E7E5E4")
        .stroke();

      const badgeX = PAGE_MARGIN + halfW + 24;
      const badgeWidth = halfW - 48;
      doc
        .font("Helvetica-Bold")
        .fontSize(8)
        .fillColor(LIGHT_MUTED)
        .text("VEREDICTO", badgeX, cardTop + 50, { width: badgeWidth, align: "center", characterSpacing: 1.4, lineBreak: false });
      doc
        .roundedRect(badgeX, cardTop + 70, badgeWidth, 32, 16)
        .fillOpacity(0.14)
        .fillColor(verdict.color)
        .fill();
      doc
        .fillOpacity(1)
        .fillColor(verdict.color)
        .fontSize(14)
        .text(verdict.label, badgeX, cardTop + 80, { width: badgeWidth, align: "center", lineBreak: false });
      doc.font("Helvetica");
      doc
        .fillColor(MUTED)
        .fontSize(10)
        .text(verdict.summary, badgeX, cardTop + 116, { width: badgeWidth, align: "center", lineGap: 2 });

      // Tres datos de la evaluación
      const statsTop = cardTop + cardHeight + 18;
      const statGap = 12;
      const statW = (contentWidth - statGap * 2) / 3;
      const stats: [string, string][] = [
        [String(TOTAL_ITEM_COUNT), "indicadores evaluados"],
        [String(CATEGORIES.length), "categorías de análisis"],
        ["1", "visita anónima, cuenta pagada"],
      ];
      stats.forEach(([big, label], i) => {
        const x = PAGE_MARGIN + i * (statW + statGap);
        doc.roundedRect(x, statsTop, statW, 64, 12).fillOpacity(1).fillAndStroke("#FFFFFF", "#E7E5E4");
        doc.font("Helvetica-Bold").fontSize(22).fillColor(INK).text(big, x, statsTop + 11, { width: statW, align: "center", lineBreak: false });
        doc.font("Helvetica").fontSize(9).fillColor(MUTED).text(label, x + 8, statsTop + 41, { width: statW - 16, align: "center", lineBreak: false });
      });

      // Caja MysterFoodie: quién hizo la evaluación
      const noteText = `Evaluación anónima realizada por un MysterFoodie: visitó el negocio como cliente real, pagó su cuenta (propina incluida) y calificó ${TOTAL_ITEM_COUNT} indicadores en ${CATEGORIES.length} categorías.`;
      const noteTop = statsTop + 64 + 18;
      const noteInnerW = contentWidth - 40;
      doc.fontSize(10.5);
      const noteH = doc.heightOfString(noteText, { width: noteInnerW, lineGap: 3 });
      const noteBoxH = noteH + 52;
      doc.roundedRect(PAGE_MARGIN, noteTop, contentWidth, noteBoxH, 14).fillOpacity(1).fillAndStroke("#FAFAF9", "#E7E5E4");
      doc.roundedRect(PAGE_MARGIN, noteTop + 16, 4, noteBoxH - 32, 2).fillColor(RED).fill();
      doc
        .font("Helvetica-Bold")
        .fontSize(9)
        .fillColor(RED)
        .text("MYSTERFOODIE", PAGE_MARGIN + 20, noteTop + 16, { characterSpacing: 2, lineBreak: false });
      doc.font("Helvetica").fontSize(10.5).fillColor(MUTED).text(noteText, PAGE_MARGIN + 20, noteTop + 34, { width: noteInnerW, lineGap: 3 });

      // Pie de portada: para quién se preparó el estudio
      const coverBottom = doc.page.height - 112;
      doc.moveTo(PAGE_MARGIN, coverBottom).lineTo(PAGE_MARGIN + contentWidth, coverBottom).lineWidth(0.6).strokeColor("#E7E5E4").stroke();
      doc.font("Helvetica-Bold").fontSize(8).fillColor(LIGHT_MUTED).text("PREPARADO PARA", PAGE_MARGIN, coverBottom + 14, { characterSpacing: 1.4, lineBreak: false });
      doc.font("Helvetica").fontSize(12).fillColor(INK).text(businessName, PAGE_MARGIN, coverBottom + 28, { width: contentWidth * 0.62, lineBreak: false, ellipsis: true });
      doc.font("Helvetica-Bold").fontSize(8).fillColor(LIGHT_MUTED).text("DOCUMENTO CONFIDENCIAL", PAGE_MARGIN, coverBottom + 14, { width: contentWidth, align: "right", characterSpacing: 1.4, lineBreak: false });
      doc.font("Helvetica").fontSize(9).fillColor(MUTED).text("Uso exclusivo del negocio evaluado", PAGE_MARGIN, coverBottom + 29, { width: contentWidth, align: "right", lineBreak: false });

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
        for (let n = 0; n < 5; n++) drawStarAt(doc, PAGE_MARGIN + barMaxWidth + 24 + n * 14, barY + 3.5, 12, Math.max(0, Math.min(1, cat.average - n)), 0, color);

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
        if (params.demo) drawWatermark(doc);
      }

      doc.end();
    } catch (err) {
      reject(err instanceof Error ? err : new Error(String(err)));
    }
  });
}
