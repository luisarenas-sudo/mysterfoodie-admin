"use client";

import { useState } from "react";
import Link from "next/link";
import VerdictBadge from "@/components/VerdictBadge";
import type { ClientSummary } from "@/lib/dashboard";

/**
 * Lista de negocios de escritorio con buscador -- la versión móvil
 * (MobileNegociosList) ya filtraba por nombre/ciudad; esta versión le da
 * lo mismo a escritorio, útil en cuanto hay más de un puñado de negocios.
 */
export default function NegociosListDesktop({ clients }: { clients: ClientSummary[] }) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const filtered = q
    ? clients.filter(
        (c) => c.name.toLowerCase().includes(q) || (c.city ?? "").toLowerCase().includes(q)
      )
    : clients;

  return (
    <>
      {clients.length > 3 && (
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por nombre o ciudad..."
          className="input mt-6 max-w-sm"
          type="search"
        />
      )}

      <div className="mt-6 grid gap-3">
        {filtered.map((client) => (
          <Link
            key={client.id}
            href={`/negocios/${client.id}`}
            className="flex items-center justify-between card p-4 transition-colors hover:border-brand-300"
          >
            <div>
              <p className="font-semibold text-ink">{client.name}</p>
              <p className="text-sm text-stone-500">
                {client.city || "Sin ciudad"} - {client.visitCount}{" "}
                {client.visitCount === 1 ? "visita" : "visitas"}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {client.lastScore !== null && (
                <>
                  <span className="text-2xl font-bold text-ink">{client.lastScore}</span>
                  <VerdictBadge score={client.lastScore} size="sm" />
                </>
              )}
            </div>
          </Link>
        ))}
        {q && filtered.length === 0 && (
          <p className="text-sm text-stone-500">
            Ningún negocio coincide con &quot;{query.trim()}&quot;.
          </p>
        )}
      </div>
    </>
  );
}
