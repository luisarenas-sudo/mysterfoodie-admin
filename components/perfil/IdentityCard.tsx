"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Avatar from "@/components/Avatar";

const TAPS_NEEDED = 3;
const TAP_WINDOW_MS = 1200;
const SHOW_MS = 8000;

/**
 * Tarjeta de identidad de Perfil (toda ella lleva a Editar perfil). Easter egg: al tocar 3 veces seguidas el
 * nombre aparece el nombre anónimo (alias) de la persona; la foto se vuelve negra y entra el logo de MysterFoodie
 * en blanco, sin fondo. Vuelve sola a los pocos segundos (o con otros 3 toques).
 */
export default function IdentityCard({
  displayName,
  avatarUrl,
  email,
  rankEmoji,
  rankLabel,
  alias,
  canHaveAlias,
  canChangeAlias = false,
}: {
  displayName: string;
  avatarUrl: string | null;
  email: string;
  rankEmoji?: string;
  rankLabel?: string;
  alias: string | null;
  canHaveAlias: boolean;
  /** Solo perfiles que ya existían antes de la regla de «un solo nombre»: pueden cambiarlo. */
  canChangeAlias?: boolean;
}) {
  const router = useRouter();
  const [revealed, setRevealed] = useState(false);
  const taps = useRef({ count: 0, last: 0 });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const onName = (e: React.MouseEvent) => {
    if (!canHaveAlias) return; // el dueño de un negocio no tiene nombre anónimo: el toque cae a la tarjeta
    e.stopPropagation();
    const now = Date.now();
    const t = taps.current;
    t.count = now - t.last <= TAP_WINDOW_MS ? t.count + 1 : 1;
    t.last = now;
    if (t.count < TAPS_NEEDED) return;
    t.count = 0;
    if (timer.current) clearTimeout(timer.current);
    setRevealed((v) => {
      const next = !v;
      if (next) timer.current = setTimeout(() => setRevealed(false), SHOW_MS);
      return next;
    });
  };

  const go = () => router.push("/perfil/editar");

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={go}
      onKeyDown={(e) => {
        if (e.key === "Enter") go();
      }}
      className="card mf-tap mx-5 mb-6 flex cursor-pointer flex-col items-center px-5 pb-5 pt-6 text-center"
    >
      <div className="relative">
        <div style={{ filter: revealed ? "brightness(0)" : "none", transition: "filter 600ms ease" }} className="rounded-full">
          <Avatar displayName={displayName} avatarUrl={avatarUrl} sizeClass="h-24 w-24 text-3xl" background={revealed ? "#000" : "#1C1C1E"} />
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/icon-mark-white.png"
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-1/2 h-[64px] w-[64px] -translate-x-1/2 -translate-y-1/2 object-contain"
          style={{ opacity: revealed ? 1 : 0, transform: `translate(-50%, -50%) scale(${revealed ? 1 : 0.7})`, transition: "opacity 600ms ease, transform 600ms ease" }}
        />
        <span
          className="absolute -bottom-1 -right-1 flex h-9 w-9 items-center justify-center rounded-full text-[16px]"
          style={{ background: "#F24444", border: "3px solid #fff", opacity: revealed ? 0 : 1, transition: "opacity 300ms ease" }}
          aria-hidden="true"
        >
          📷
        </span>
      </div>
      <div
        onClick={onName}
        className="mt-3.5 max-w-full select-none truncate text-[20px] font-bold"
        style={{ WebkitTapHighlightColor: "transparent", transition: "opacity 300ms ease" }}
      >
        {revealed && alias ? alias : displayName}
      </div>
      {revealed && !alias && (
        <div className="mt-1.5 text-[13px]" style={{ color: "rgba(60,60,67,0.7)" }} onClick={(e) => e.stopPropagation()}>
          Aún no tienes nombre anónimo.{" "}
          <Link href="/perfil/alias" className="font-semibold underline" style={{ color: "#D42F2F" }}>
            Crear el mío
          </Link>
        </div>
      )}
      {revealed && alias && (
        <div className="mt-1 text-[12px]" style={{ color: "rgba(60,60,67,0.55)" }}>
          Tu nombre anónimo
          {canChangeAlias && (
            <>
              {" · "}
              <Link href="/perfil/alias" onClick={(e) => e.stopPropagation()} className="font-semibold underline" style={{ color: "#D42F2F" }}>
                Cambiar
              </Link>
            </>
          )}
        </div>
      )}
      {rankLabel && (
        <div className="mt-2 rounded-full px-3 py-1 text-[12.5px] font-bold" style={{ color: "#D42F2F", background: "rgba(242,68,68,0.1)" }}>
          {rankEmoji} {rankLabel}
        </div>
      )}
      <div className="mt-2 max-w-full truncate text-[14px]" style={{ color: "rgba(60,60,67,0.75)" }}>
        {email}
      </div>
      <div className="mt-3 text-[12.5px]" style={{ color: "rgba(60,60,67,0.5)" }}>
        Toca para cambiar tu foto y tus datos
      </div>
    </div>
  );
}
