"use client";

export default function SelectChips({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[];
  value: string | undefined;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={
              "rounded-full border px-4 py-1.5 text-sm font-medium transition-colors " +
              (selected
                ? "border-transparent bg-brand-gradient text-white"
                : "border-black/10 bg-white text-stone-600 hover:bg-black/5")
            }
            aria-pressed={selected}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
