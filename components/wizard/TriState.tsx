"use client";

export type TriValue = "yes" | "no" | "na" | undefined;

const OPTIONS: { value: Exclude<TriValue, undefined>; label: string }[] = [
  { value: "yes", label: "Sí" },
  { value: "no", label: "No" },
  { value: "na", label: "No aplica" },
];

/**
 * Respuesta de tres estados para los indicadores Sí/No: Sí / No / No aplica.
 * Arranca SIN respuesta (antes arrancaba en "No", y no se podía distinguir
 * "no lo tienen" de "no lo revisé"). Tocar de nuevo la opción activa la quita.
 */
export default function TriState({
  value,
  onChange,
  variant = "mobile",
}: {
  value: TriValue;
  onChange: (value: TriValue) => void;
  variant?: "mobile" | "desktop";
}) {
  const mobile = variant === "mobile";
  return (
    <div
      role="group"
      className={mobile ? "flex w-full gap-1.5" : "inline-flex gap-1.5"}
    >
      {OPTIONS.map((opt) => {
        const active = value === opt.value;
        const color = opt.value === "yes" ? "#34C759" : opt.value === "no" ? "#F24444" : "#8E8E93";
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(active ? undefined : opt.value)}
            className={mobile ? "mf-tap flex-1 rounded-xl text-[14px] font-semibold" : "rounded-full px-4 text-sm font-medium"}
            style={{
              height: mobile ? 42 : 34,
              cursor: "pointer",
              background: active ? color : mobile ? "rgba(118,118,128,0.12)" : "#fff",
              color: active ? "#fff" : "rgba(60,60,67,0.75)",
              border: active || mobile ? "1px solid transparent" : "1px solid rgba(0,0,0,0.1)",
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
