"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const LABELS = ["Eliminar cuenta", "¿Seguro? Toca otra vez", "Sí, quiero eliminarla"] as const;

/**
 * Botón de baja en tres toques: rojo oscuro -> (otro toque) rojo real -> hoja de salida.
 * Si no se toca por unos segundos vuelve a su estado de reposo, para que no
 * quede "armado" por accidente. La baja en sí ocurre en /perfil/eliminar.
 */
export default function DeleteAccountButton({ variant = "desktop" }: { variant?: "desktop" | "mobile" }) {
  const router = useRouter();
  const [stage, setStage] = useState<0 | 1 | 2>(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  function press() {
    if (timer.current) clearTimeout(timer.current);
    if (stage === 2) {
      router.push("/perfil/eliminar");
      return;
    }
    const next = (stage + 1) as 1 | 2;
    setStage(next);
    timer.current = setTimeout(() => setStage(0), 6000);
  }

  const background = stage === 2 ? "#F24444" : "#7A1F1F";
  const common = { background, color: "#fff", transition: "background 0.2s ease, transform 0.1s ease" } as const;

  if (variant === "mobile") {
    return (
      <button
        type="button"
        onClick={press}
        className="mf-tap mx-5 mt-4 flex min-h-[52px] w-[calc(100%-40px)] items-center justify-center rounded-2xl text-[15.5px] font-bold"
        style={common}
      >
        {LABELS[stage]}
      </button>
    );
  }

  return (
    <button type="button" onClick={press} className="rounded-full px-5 py-2 text-sm font-semibold" style={common}>
      {LABELS[stage]}
    </button>
  );
}
