"use client";

import { PRIVACY_URL, TERMS_URL } from "@/lib/terms";

/** Casilla obligatoria para unirse a la plataforma. */
export default function TermsCheckbox({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 rounded-md border border-stone-200 bg-white p-3 text-sm leading-snug text-ink">
      <input
        type="checkbox"
        required
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer accent-[#f24444]"
      />
      <span>
        Acepto los{" "}
        <a href={TERMS_URL} target="_blank" rel="noopener noreferrer" className="font-semibold text-brand-600 underline">
          términos y condiciones del servicio
        </a>{" "}
        y el{" "}
        <a href={PRIVACY_URL} target="_blank" rel="noopener noreferrer" className="font-semibold text-brand-600 underline">
          Aviso de Privacidad
        </a>
        .
      </span>
    </label>
  );
}
