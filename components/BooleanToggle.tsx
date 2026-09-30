"use client";

export default function BooleanToggle({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="inline-flex overflow-hidden rounded-full border border-black/10 bg-white">
      <button
        type="button"
        onClick={() => onChange(true)}
        className={
          "px-4 py-1.5 text-sm font-medium transition-colors " +
          (value ? "bg-brand-gradient text-white" : "text-stone-600 hover:bg-black/5")
        }
        aria-pressed={value}
      >
        Sí
      </button>
      <button
        type="button"
        onClick={() => onChange(false)}
        className={
          "border-l border-black/10 px-4 py-1.5 text-sm font-medium transition-colors " +
          (!value ? "bg-brand-gradient text-white" : "text-stone-600 hover:bg-black/5")
        }
        aria-pressed={!value}
      >
        No
      </button>
    </div>
  );
}
