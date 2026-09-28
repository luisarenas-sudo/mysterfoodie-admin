import { getVerdict } from "@/lib/verdict";

export default function VerdictBadge({
  score,
  size = "md",
}: {
  score: number;
  size?: "sm" | "md";
}) {
  const verdict = getVerdict(score);
  const padding = size === "sm" ? "px-2 py-1 text-xs" : "px-3 py-1.5 text-sm";

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border font-semibold ${padding}`}
      style={{
        color: verdict.color,
        borderColor: verdict.color,
        backgroundColor: `${verdict.color}14`,
      }}
    >
      <span
        aria-hidden="true"
        className="h-2 w-2 rounded-full"
        style={{ backgroundColor: verdict.color }}
      />
      {verdict.label}
    </span>
  );
}
