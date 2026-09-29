"use client";

export default function BooleanToggle({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="inline-flex overflow-hidden rounded-md border border-stone-300">
      <button
        type="button"
        onClick={() => onChange(true)}
        className={
          "px-4 py-1.5 text-sm font-medium transition-colors " +
          (value ? "bg-brand-gradient text-white" : "bg-white text-stone-600 hover:bg-stone-50")
        }
        aria-pressed={value}
      >
        Sí
      </button>
      <button
        type="button"
        onClick={() => onChange(false)}
        className={
          "border-l border-stone-300 px-4 py-1.5 text-sm font-medium transition-colors " +
          (!value ? "bg-stone-800 text-white" : "bg-white text-stone-600 hover:bg-stone-50")
        }
        aria-pressed={!value}
      >
        No
      </button>
    </div>
  );
}
