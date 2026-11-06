"use client";

import { COLLAB_URL, PRIVACY_URL, TERMS_URL } from "@/lib/terms";

/** Casillas obligatorias para unirse a la plataforma: ser mayor de 18 años y aceptar los términos. */
export default function TermsCheckbox({
  checked,
  onChange,
  adult,
  onAdultChange,
  collab,
  onCollabChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  adult: boolean;
  onAdultChange: (v: boolean) => void;
  /** Solo cuentas del equipo: casilla del Acuerdo de colaboración. */
  collab?: boolean;
  onCollabChange?: (v: boolean) => void;
}) {
  return (
    <div className="space-y-2">
    <label className="flex cursor-pointer items-start gap-2.5 rounded-md border border-stone-200 bg-white p-3 text-sm leading-snug text-ink">
      <input
        type="checkbox"
        required
        checked={adult}
        onChange={(e) => onAdultChange(e.target.checked)}
        className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer accent-[#f24444]"
      />
      <span>Confirmo que soy mayor de 18 años.</span>
    </label>
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
    {onCollabChange && (
      <label className="flex cursor-pointer items-start gap-2.5 rounded-md border border-stone-200 bg-white p-3 text-sm leading-snug text-ink">
        <input
          type="checkbox"
          required
          checked={Boolean(collab)}
          onChange={(e) => onCollabChange(e.target.checked)}
          className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer accent-[#f24444]"
        />
        <span>
          Acepto el{" "}
          <a href={COLLAB_URL} target="_blank" rel="noopener noreferrer" className="font-semibold text-brand-600 underline">
            Acuerdo de colaboración
          </a>
          .
        </span>
      </label>
    )}
    </div>
  );
}
