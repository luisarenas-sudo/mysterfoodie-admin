"use client";

import { useState } from "react";

const SCALE = [1, 2, 3, 4, 5];

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={
        "h-8 w-8 transition-colors " + (filled ? "fill-brand-500" : "fill-stone-200")
      }
      aria-hidden="true"
    >
      <path d="M12 2.5l2.9 6.06 6.6.78-4.86 4.6 1.27 6.56L12 17.3l-5.91 3.2 1.27-6.56L2.5 9.34l6.6-.78L12 2.5z" />
    </svg>
  );
}

export default function ScoreSelector({
  value,
  onChange,
}: {
  value: number;
  onChange: (score: number) => void;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const displayValue = hovered ?? value;

  return (
    <div className="flex items-center gap-1">
      {SCALE.map((n) => {
        const filled = n <= displayValue;
        return (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n === value ? 0 : n)}
            onMouseEnter={() => setHovered(n)}
            onMouseLeave={() => setHovered(null)}
            className="rounded-sm p-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
            aria-pressed={n === value}
            aria-label={
              n === value
                ? `Quitar calificación de ${n} estrella${n === 1 ? "" : "s"}`
                : `Calificar con ${n} estrella${n === 1 ? "" : "s"}`
            }
            title={n === value ? "Clic para quitar esta calificación" : undefined}
          >
            <StarIcon filled={filled} />
          </button>
        );
      })}
      {value > 0 && (
        <span className="ml-2 text-sm font-medium text-stone-500">{value}/5</span>
      )}
    </div>
  );
}
