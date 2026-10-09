"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabaseBrowser";

/**
 * Cambiar contraseña desde Perfil. Si la cuenta ya tiene contraseña se pide la
 * actual (se comprueba iniciando sesión de nuevo); si solo entra con Google, se
 * puede crear una sin pedirla.
 */
export default function SeguridadForm({ email }: { email: string }) {
  const [hasPassword, setHasPassword] = useState<boolean | null>(null);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const supabase = await createSupabaseBrowserClient();
        const { data } = await supabase.auth.getUser();
        setHasPassword((data.user?.identities ?? []).some((i) => i.provider === "email"));
      } catch {
        setHasPassword(true);
      }
    })();
  }, []);

  async function save() {
    setMsg(null);
    if (next.length < 8) return setMsg({ ok: false, text: "La contraseña nueva debe tener al menos 8 caracteres." });
    if (next !== confirm) return setMsg({ ok: false, text: "Las contraseñas nuevas no coinciden." });
    setSaving(true);
    try {
      const supabase = await createSupabaseBrowserClient();
      if (hasPassword) {
        if (!current) throw new Error("Escribe tu contraseña actual.");
        const { error: signErr } = await supabase.auth.signInWithPassword({ email, password: current });
        if (signErr) throw new Error("La contraseña actual no es correcta.");
      }
      const { error } = await supabase.auth.updateUser({ password: next });
      if (error) {
        const m = error.message || "";
        if (/same|different/i.test(m)) throw new Error("La contraseña nueva debe ser distinta a la actual.");
        if (/reauth/i.test(m)) throw new Error("Por seguridad, cierra sesión, vuelve a entrar y repite el cambio.");
        throw new Error(m || "No se pudo cambiar la contraseña.");
      }
      setCurrent("");
      setNext("");
      setConfirm("");
      setHasPassword(true);
      setMsg({ ok: true, text: "Contraseña actualizada." });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "No se pudo cambiar la contraseña." });
    } finally {
      setSaving(false);
    }
  }

  const field = (label: string, value: string, set: (v: string) => void, last = false, auto = "new-password") => (
    <label className="flex min-h-[56px] items-center gap-3 px-4" style={last ? undefined : { borderBottom: "1px solid rgba(60,60,67,0.08)" }}>
      <span className="w-28 flex-shrink-0 text-[15px]">{label}</span>
      <input
        type="password"
        value={value}
        onChange={(e) => set(e.target.value)}
        autoComplete={auto}
        placeholder="••••••••"
        className="min-w-0 flex-1 bg-transparent py-3 text-right text-[16px] outline-none"
      />
    </label>
  );

  return (
    <>
      <div className="mx-5 mb-1.5 px-1 text-[13px] font-semibold uppercase tracking-wide" style={{ color: "rgba(60,60,67,0.6)" }}>
        {hasPassword === false ? "Crear contraseña" : "Cambiar contraseña"}
      </div>
      <div className="card mx-5 mb-2 overflow-hidden">
        {hasPassword && field("Actual", current, setCurrent, false, "current-password")}
        {field("Nueva", next, setNext)}
        {field("Repetir", confirm, setConfirm, true)}
      </div>
      <p className="mx-6 mb-5 text-[12.5px] leading-snug" style={{ color: "rgba(60,60,67,0.55)" }}>
        Mínimo 8 caracteres.
        {hasPassword === false && " Hoy entras solo con Google; con una contraseña también podrás entrar con tu correo."}
      </p>
      {msg && (
        <p
          className="mx-5 mb-4 rounded-[14px] px-4 py-3 text-[13.5px] font-medium"
          style={msg.ok ? { background: "rgba(52,199,89,0.1)", color: "#248A3D" } : { background: "rgba(255,59,48,0.1)", color: "#C7301E" }}
        >
          {msg.text}
        </p>
      )}
      <div className="mx-5 mb-8">
        <button
          type="button"
          disabled={saving || hasPassword === null}
          onClick={save}
          className="mf-tap flex min-h-[52px] w-full items-center justify-center rounded-2xl px-4 text-[16px] font-bold text-white disabled:opacity-50"
          style={{ background: "#F24444" }}
        >
          {saving ? "Guardando…" : "Guardar contraseña"}
        </button>
      </div>
    </>
  );
}
