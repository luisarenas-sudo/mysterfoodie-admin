"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Avatar from "@/components/Avatar";

const TAPS_NEEDED = 3;
const TAP_WINDOW_MS = 1200;
const SHOW_MS = 8000;

/**
 * Tarjeta de identidad de Perfil en computadora. Mismo easter egg que en el celular (IdentityCard): al dar
 * 3 clics seguidos al nombre aparece el nombre anónimo (alias); la foto se vuelve negra y entra el logo de
 * MysterFoodie en blanco, sin fondo. Vuelve sola a los pocos segundos (o con otros 3 clics).
 */
export default function DesktopIdentity({
  displayName,
  avatarUrl,
  email,
  title,
  alias,
  canHaveAlias,
  canChangeAlias = false,
}: {
  displayName: string;
  avatarUrl: string | null;
  email: string;
  title: string;
  alias: string | null;
  canHaveAlias: boolean;
  canChangeAlias?: boolean;
}) {
  const [revealed, setRevealed] = useState(false);
  const taps = useRef({ count: 0, last: 0 });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const onName = () => {
    if (!canHaveAlias) return; // el dueño de un negocio no tiene nombre anónimo
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

  return (
    <div className="mt-6 flex items-center gap-3.5 card p-[18px]">
      <div className="relative h-14 w-14 flex-shrink-0">
        <div style={{ filter: revealed ? "brightness(0)" : "none", transition: "filter 600ms ease" }} className="rounded-full">
          <Avatar displayName={displayName} avatarUrl={avatarUrl} sizeClass="h-14 w-14 text-xl" background={revealed ? "#000" : "#1C1C1E"} />
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/icon-mark-white.png"
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-1/2 h-[38px] w-[38px] object-contain"
          style={{ opacity: revealed ? 1 : 0, transform: `translate(-50%, -50%) scale(${revealed ? 1 : 0.7})`, transition: "opacity 600ms ease, transform 600ms ease" }}
        />
      </div>
      <div className="min-w-0">
        <div onClick={onName} className="select-none truncate text-lg font-bold text-ink">
          {revealed && alias ? alias : displayName}
        </div>
        {revealed && alias ? (
          <div className="mt-0.5 text-sm text-stone-500">
            Tu nombre anónimo
            {canChangeAlias && (
              <>
                {" · "}
                <Link href="/perfil/alias" className="font-semibold text-brand-700 underline">
                  Cambiar
                </Link>
              </>
            )}
          </div>
        ) : revealed && !alias ? (
          <div className="mt-0.5 text-sm text-stone-500">
            Aún no tienes nombre anónimo.{" "}
            <Link href="/perfil/alias" className="font-semibold text-brand-700 underline">
              Crear el mío
            </Link>
          </div>
        ) : (
          <div className="mt-0.5 text-sm font-semibold text-brand-700">{title}</div>
        )}
        <div className="mt-0.5 truncate text-sm text-stone-600">{email}</div>
      </div>
    </div>
  );
}
