import { CUISINES, DISHES } from "./foodCatalog";

/** Iconos que acompañan los textos del perfil anónimo (vista del negocio y correos). Siempre devuelven uno: nunca queda un texto sin icono. */
const byLabel = (list: { label: string; emoji: string }[], label: string, fallback: string) =>
  list.find((o) => o.label === label)?.emoji ?? fallback;

export const cuisineIcon = (label: string) => byLabel(CUISINES, label, "🍽️");
export const dishIcon = (label: string) => byLabel(DISHES, label, "🍴");

const BUSINESS: Record<string, string> = { restaurante: "🍽️", bar: "🍸", "cafetería": "☕", cafeteria: "☕", otro: "✨" };
export const businessIcon = (label: string) => BUSINESS[label.trim().toLowerCase()] ?? "🏪";

const SLOT: Record<string, string> = { "mañana": "🌅", comida: "🍽️", tarde: "🌇", noche: "🌙" };
export const slotIcon = (slot: string | null) => (slot ? SLOT[slot] ?? "🕒" : "🕒");

const TAGS: Record<string, string> = {
  "Trato excelente": "🤝", "Comida deliciosa": "😋", "Lugar muy limpio": "✨", "Buen ambiente": "🎶", "Servicio rápido": "⚡", "Buena presentación": "🍽️",
  "Servicio lento": "🐌", "Menú desactualizado": "📜", "Falta limpieza": "🧽", "Poca variedad": "🔁", "Ambiente ruidoso": "🔊", "Faltó atención al llegar": "🚪",
};
export const tagIcon = (tag: string) => TAGS[tag] ?? "💬";
