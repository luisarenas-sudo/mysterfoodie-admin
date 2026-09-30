"use client";

import { useState } from "react";
import Link from "next/link";
import type { VisitPickerClient } from "@/lib/dashboard";
import { avatarColorFor, initialsFor } from "@/lib/ring";
import { getVerdict } from "@/lib/verdict";

const TYPE_LABEL: Record<string, string> = {
  restaurante: "Restaurante",
  bar: "Bar",
  cafeteria: "Cafetería",
};

/**
 * Punto de entrada de "Nueva visita" para admin/sibarita: elegir un
 * negocio ya guardado (el más reciente hasta arriba) para visitarlo, o
 * agregar uno nuevo. Tocar un negocio lleva a su detalle (/negocios/[id]),
 * que es el mismo lugar donde luego se decide "Nueva visita a este
 * negocio" o "Asignar a un Foodie" -- un solo lugar para esas acciones,
 * sin importar por dónde se llegó.
 *
 * Es un overlay de pantalla completa (mismo tratamiento que
 * MobileVisitasAsignadas en esta misma ruta para un Foodie, y que el
 * wizard en /nueva-visita/[...]): MobileChrome oculta el tab bar en
 * cualquier /nueva-visita*, así que esta pantalla necesita su propio
 * botón de "Atrás".
 */
export default function MobileNuevaVisitaPicker({ clients }: { clients: VisitPickerClient[] }) {
  const [query, setQuery] = useState("");
  const filtered = clients.filter((c) => c.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="md:hidden fixed inset-0 z-40 flex flex-col mf-push-in" style={{ background: "#F2F2F7" }}>
      <div
        style={{
          background: "rgba(249,249,251,0.95)",
          borderBottom: "1px solid rgba(60,60,67,0.1)",
          paddingTop: "env(safe-area-inset-top)",
        }}
      >
        <div className="flex items-center justify-between px-4 pb-2.5 pt-3.5">
          <Link
            href="/"
            aria-label="Atrás"
            className="mf-tap -my-3 flex w-[46px] flex-shrink-0 items-center py-3"
          >
            <svg width="22" height="22" viewBox="0 0 24 24">
              <path d="M15 6l-6 6 6 6" stroke="#F24444" strokeWidth="2.3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
          <div className="flex-1 truncate text-center text-[16px] font-bold">Nueva visita</div>
          <div className="w-[46px] flex-shrink-0" />
        </div>
      </div>

      <div className="mf-scroll flex-1 overflow-y-auto pb-8 pt-4">
        <div className="px-5 pb-1.5 text-[13.5px]" style={{ color: "rgba(60,60,67,0.55)" }}>
          Elige un negocio para visitar o agrega uno nuevo
        </div>

        <div className="px-5 py-3.5">
          <Link
            href="/negocios/nuevo"
            className="mf-tap flex items-center gap-3 rounded-[16px] px-4 py-3.5 text-white"
            style={{ background: "linear-gradient(180deg,#F24444 0%,#F25631 100%)" }}
          >
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full" style={{ background: "rgba(255,255,255,0.22)" }}>
              <svg width="20" height="20" viewBox="0 0 24 24">
                <path d="M12 5v14M5 12h14" stroke="#fff" strokeWidth="2.3" fill="none" strokeLinecap="round" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[15.5px] font-bold">Agregar nuevo negocio</div>
              <div className="text-[12px]" style={{ color: "rgba(255,255,255,0.85)" }}>
                Dar de alta un prospecto para visitar
              </div>
            </div>
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path d="M9 6l6 6-6 6" stroke="#fff" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        </div>

        <div className="px-5 pb-3.5">
          <div
            className="flex items-center gap-2 rounded-[11px] px-3 py-[9px]"
            style={{ background: "rgba(118,118,128,0.12)" }}
          >
            <svg width="17" height="17" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="7" stroke="rgba(60,60,67,0.6)" strokeWidth="2" fill="none" />
              <path d="M21 21l-4.3-4.3" stroke="rgba(60,60,67,0.6)" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar negocio"
              className="flex-1 bg-transparent text-[16px] outline-none"
              type="search"
              inputMode="search"
              autoCapitalize="none"
              autoCorrect="off"
              enterKeyHint="search"
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <p className="mx-5 text-sm" style={{ color: "rgba(60,60,67,0.55)" }}>
            {clients.length === 0 ? "Aún no hay negocios registrados." : "Sin resultados."}
          </p>
        ) : (
          <>
            <div className="mx-5 mb-1.5 px-1 text-[12px] font-semibold uppercase tracking-wide" style={{ color: "rgba(60,60,67,0.5)" }}>
              Negocios guardados
            </div>
            <div className="card mx-5 overflow-hidden">
              {filtered.map((c, idx) => {
                const verdict = c.lastScore !== null ? getVerdict(c.lastScore) : null;
                return (
                  <div key={c.id}>
                    <Link href={`/negocios/${c.id}`} className="flex items-center gap-3 px-4 py-[13px]">
                      <div
                        className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-[16px] font-semibold text-white"
                        style={{ background: avatarColorFor(c.name) }}
                      >
                        {initialsFor(c.name)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[16px] font-semibold">{c.name}</div>
                        <div className="text-[13px]" style={{ color: "rgba(60,60,67,0.55)" }}>
                          {TYPE_LABEL[c.type] ?? "Negocio"}
                          {c.visitCount === 0 ? " · Sin visitas" : ` · ${c.visitCount} ${c.visitCount === 1 ? "visita" : "visitas"}`}
                        </div>
                      </div>
                      {verdict && (
                        <div className="text-[15px] font-bold" style={{ color: verdict.color }}>
                          {c.lastScore}
                        </div>
                      )}
                      <svg width="16" height="16" viewBox="0 0 24 24" style={{ opacity: 0.28 }}>
                        <path d="M9 6l6 6-6 6" stroke="#000" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </Link>
                    {idx < filtered.length - 1 && (
                      <div className="ml-[72px] h-px" style={{ background: "rgba(60,60,67,0.08)" }} />
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
