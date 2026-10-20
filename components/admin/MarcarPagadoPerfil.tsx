"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function MarcarPagadoPerfil({ mysterfoodieId, label }: { mysterfoodieId: string; label: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function go() {
    if (!window.confirm(`¿Marcar como pagado lo pendiente de ${label}?`)) return;
    setBusy(true);
    try {
      await fetch("/api/admin/ganancias-perfil", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mysterfoodieId }) });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }
  return (
    <button type="button" onClick={go} disabled={busy} className="rounded-full px-4 py-2 text-[13px] font-bold text-white disabled:opacity-50" style={{ background: "#34C759" }}>
      {busy ? "…" : "Marcar pagado"}
    </button>
  );
}
