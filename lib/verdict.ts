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
