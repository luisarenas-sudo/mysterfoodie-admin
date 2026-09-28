"use client";

const SCALE = [1, 2, 3, 4, 5];

export default function ScoreSelector({
  value,
  onChange,
}: {
  value: number;
  onChange: (score: number) => void;
}) {
  return (
    <div className="flex gap-2">
      {SCALE.map((n) => {
        const active = value === n;
        return (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={
              "h-10 w-10 rounded-md border text-sm font-medium transition-colors " +
              (active
                ? "border-brand-500 bg-brand-500 text-white"
                : "border-stone-300 bg-white text-stone-600 hover:border-brand-400")
            }
            aria-pressed={active}
          >
            {n}
          </button>
        );
      })}
    </div>
  );
}
