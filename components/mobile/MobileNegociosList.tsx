"use client";

import { useState } from "react";
import Link from "next/link";
import type { ClientSummary } from "@/lib/dashboard";
import { avatarColorFor, initialsFor } from "@/lib/ring";
import { getVerdict } from "@/lib/verdict";

export default function MobileNegociosList({
  clients,
  reyId,
}: {
  clients: ClientSummary[];
  reyId: string | null;
}) {
  const [query, setQuery] = useState("");
  const filtered = clients.filter((c) => c.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="md:hidden mf-fade-in min-h-[70vh]" style={{ background: "#F2F2F7" }}>
      <div className="flex items-center justify-between px-5 pb-2 pt-5">
        <div>
          <div className="mb-0.5 text-[10px] font-bold tracking-[1.1px]" style={{ color: "#F24444" }}>
            MYSTERFOODIE
          </div>
          <div className="heading text-[34px] font-bold">Negocios</div>
        </div>
        <Link
          href="/negocios/nuevo"
          aria-label="Nuevo negocio"
          className="mf-tap flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-white"
          style={{ background: "#F24444" }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24">
            <path d="M12 5v14M5 12h14" stroke="#fff" strokeWidth="2.3" fill="none" strokeLinecap="round" />
          </svg>
        </Link>
      </div>

      <div className="px-5 pb-3.5 pt-1.5">
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
                    <div className="flex items-center gap-1">
                      <div className="truncate text-[16px] font-semibold">{c.name}</div>
                      {c.id === reyId && <div className="text-[13px]">👑</div>}
                    </div>
                    <div className="text-[13px]" style={{ color: "rgba(60,60,67,0.55)" }}>
                      {c.type === "restaurante"
                        ? "Restaurante"
                        : c.type === "bar"
                        ? "Bar"
                        : c.type === "cafeteria"
                        ? "Cafetería"
                        : "Negocio"}
                    </div>
                  </div>
                  {verdict && (
                    <div className="text-[15px] font-bold" style={{ color: verdict.color }}>
                      {c.lastScore}
                    </div>
                  )}
                  <svg width="16" height="16" viewBox="0 0 24 24" style={{ opacity: 0.28 }}>
                    <path
                      d="M9 6l6 6-6 6"
                      stroke="#000"
                      strokeWidth="2.2"
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </Link>
                {idx < filtered.length - 1 && (
                  <div className="ml-[72px] h-px" style={{ background: "rgba(60,60,67,0.08)" }} />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
