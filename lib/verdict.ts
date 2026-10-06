export type VerdictLevel = "excelente" | "bueno" | "regular" | "malo" | "muy_malo";

export type Verdict = {
  level: VerdictLevel;
  label: string;
  summary: string;
  color: string;
};

/**
 * Esquema de color tipo semáforo para todas las calificaciones
 * (reporte público e interno): rojo = malo, amarillo = medio,
 * verde = bueno/excelente (5 estrellas). Se mantienen 4 niveles de
 * texto para dar matiz, pero el color colapsa a esas 3 familias.
 */
export function getVerdict(score: number): Verdict {
  if (score >= 4.5) {
    return {
      level: "excelente",
      label: "Excelente",
      summary: "Está entre los negocios mejor evaluados del sector. Sigan así.",
      color: "#15803D", // verde
    };
  }
  if (score >= 3.5) {
    return {
      level: "bueno",
      label: "Bueno",
      summary: "Va bien, pero hay detalles puntuales que pulir para destacar más.",
      color: "#2E9E4F", // verde (más claro)
    };
  }
  if (score >= 2.5) {
    return {
      level: "regular",
      label: "Regular",
      summary: "Hay oportunidades claras de mejora en varios indicadores.",
      color: "#D97706", // amarillo/ámbar
    };
  }
  if (score >= 1.5) {
    return {
      level: "malo",
      label: "Malo",
      summary: "Varios indicadores están por debajo de lo esperado en el sector.",
      color: "#DC2626", // rojo
    };
  }
  return {
    level: "muy_malo",
    label: "Muy malo",
    summary: "Varios indicadores están muy por debajo de lo esperado en el sector.",
    color: "#DC2626", // rojo
  };
}

/**
 * Rangos de calificación con su veredicto, derivados de getVerdict() para
 * que cualquier leyenda (ej. la metodología del PDF) no se desincronice
 * de los umbrales reales.
 */
export const VERDICT_BANDS = [
  { range: "4.5 – 5.0", sample: 5 },
  { range: "3.5 – 4.4", sample: 4 },
  { range: "2.5 – 3.4", sample: 3 },
  { range: "1.5 – 2.4", sample: 2 },
  { range: "0 – 1.4", sample: 1 },
].map((b) => ({ range: b.range, label: getVerdict(b.sample).label, color: getVerdict(b.sample).color }));
