export type VerdictLevel = "excelente" | "bueno" | "regular" | "critico";

export type Verdict = {
  level: VerdictLevel;
  label: string;
  summary: string;
  color: string;
};

export function getVerdict(score: number): Verdict {
  if (score >= 4.5) {
    return {
      level: "excelente",
      label: "Excelente",
      summary: "Está entre los negocios mejor evaluados del sector. Sigan así.",
      color: "#15803d",
    };
  }
  if (score >= 3.5) {
    return {
      level: "bueno",
      label: "Bueno",
      summary: "Va bien, pero hay detalles puntuales que pulir para destacar más.",
      color: "#ca8a04",
    };
  }
  if (score >= 2.5) {
    return {
      level: "regular",
      label: "Regular",
      summary: "Hay oportunidades claras de mejora en varios indicadores.",
      color: "#c2410c",
    };
  }
  return {
    level: "critico",
    label: "Necesita atencion",
    summary: "Varios indicadores están por debajo de lo esperado en el sector.",
    color: "#dc2626",
  };
}
