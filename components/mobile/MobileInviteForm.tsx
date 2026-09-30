"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

type RoleOption = "sibarita" | "agente";

const ROLE_OPTIONS: { value: RoleOption; label: string; desc: string }[] = [
  { value: "sibarita", label: "Sibarita", desc: "Da de alta negocios y hace visitas libremente." },
  { value: "agente", label: "Foodie", desc: "Solo hace las visitas que le asignes." },
];

/**
 * Invitar Sibaritas y Foodies directamente desde el Perfil móvil (solo
 * admin). Reusa el mismo endpoint /api/admin/usuarios que el panel de
 * escritorio en /admin/usuarios.
 */
export default function MobileInviteForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<RoleOption>("sibarita");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/usuarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, fullName: fullName || null, role }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: data.error || "No se pudo invitar" });
        return;
      }
      setMessage({ type: "ok", text: `Invitación enviada a ${email}` });
      setEmail("");
      setFullName("");
      router.refresh();
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Error de red" });
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mf-tap card mx-5 mb-5 flex w-[calc(100%-40px)] items-center gap-3 px-4 py-3.5 text-left"
      >
        <div
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-lg"
          style={{ background: "rgba(242,68,68,0.12)" }}
        >
          ✉️
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-bold">Invitar Sibarita o Foodie</div>
          <div className="text-[12px]" style={{ color: "rgba(60,60,67,0.55)" }}>
            Envía una invitación por correo
          </div>
        </div>
        <svg width="18" height="18" viewBox="0 0 24 24">
          <path d="M9 6l6 6-6 6" stroke="rgba(60,60,67,0.35)" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="card mx-5 mb-5 p-[18px]">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-[15px] font-bold">Invitar usuario</div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="mf-tap -m-2 p-2 text-[13px]"
          style={{ color: "rgba(60,60,67,0.5)" }}
        >
          Cerrar
        </button>
      </div>

      <div className="space-y-3">
        <label className="block">
          <span className="text-[13px] font-medium" style={{ color: "rgba(60,60,67,0.6)" }}>
            Correo
          </span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1.5 w-full rounded-[14px] px-3.5 py-3"
            style={{ background: "#F2F2F7", fontSize: 16 }}
            placeholder="persona@correo.com"
            inputMode="email"
            autoCapitalize="none"
            autoCorrect="off"
            enterKeyHint="next"
          />
        </label>

        <label className="block">
          <span className="text-[13px] font-medium" style={{ color: "rgba(60,60,67,0.6)" }}>
            Nombre (opcional)
          </span>
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="mt-1.5 w-full rounded-[14px] px-3.5 py-3"
            style={{ background: "#F2F2F7", fontSize: 16 }}
            type="text"
            autoComplete="name"
            enterKeyHint="done"
          />
        </label>

        <div>
          <span className="text-[13px] font-medium" style={{ color: "rgba(60,60,67,0.6)" }}>
            Rol
          </span>
          <div className="mt-1.5 space-y-2">
            {ROLE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setRole(opt.value)}
                className="mf-tap flex w-full items-center gap-3 rounded-[14px] px-3.5 py-3 text-left"
                style={{
                  background: role === opt.value ? "rgba(242,68,68,0.1)" : "#F2F2F7",
                  border: role === opt.value ? "1.5px solid #F24444" : "1.5px solid transparent",
                }}
              >
                <div className="min-w-0 flex-1">
                  <div className="text-[14.5px] font-bold">{opt.label}</div>
                  <div className="text-[11.5px]" style={{ color: "rgba(60,60,67,0.55)" }}>
                    {opt.desc}
                  </div>
                </div>
                {role === opt.value && (
                  <svg width="20" height="20" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" fill="#F24444" />
                    <path d="M8 12.5l2.5 2.5L16 9" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </div>

        {message && (
          <p className="text-[13px]" style={{ color: message.type === "ok" ? "#34C759" : "#FF3B30" }}>
            {message.text}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="mf-tap w-full rounded-[14px] py-3.5 text-center text-[15px] font-bold text-white disabled:opacity-50"
          style={{ background: "#F24444" }}
        >
          {submitting ? "Enviando..." : "Enviar invitación"}
        </button>
      </div>
    </form>
  );
}
