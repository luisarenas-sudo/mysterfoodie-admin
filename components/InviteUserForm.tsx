"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { friendlyError } from "@/lib/friendlyError";

type Client = { id: string; name: string };
type RoleOption = "admin" | "agente" | "cliente" | "sibarita";

const ROLE_CHOICES: { value: RoleOption; label: string }[] = [
  { value: "agente", label: "Shopper" },
  { value: "sibarita", label: "Sibarita" },
  { value: "cliente", label: "Cliente (dueño de negocio)" },
  { value: "admin", label: "Master Chef" },
];

/** allowedRoles: sin valor = todos los roles (Master Chef); un Sibarita solo puede invitar Shoppers (el servidor también lo valida). */
export default function InviteUserForm({ clients, allowedRoles }: { clients: Client[]; allowedRoles?: RoleOption[] }) {
  const roleChoices = ROLE_CHOICES.filter((r) => !allowedRoles || allowedRoles.includes(r.value));
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<RoleOption>(roleChoices[0]?.value ?? "agente");
  const [clientId, setClientId] = useState("");
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
        body: JSON.stringify({
          email,
          fullName: fullName || null,
          role,
          clientId: role === "cliente" ? clientId || null : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: data.error || "No se pudo invitar al usuario" });
        return;
      }
      if (data.warning) {
        setMessage({ type: "error", text: data.warning });
      } else {
        setMessage({ type: "ok", text: data.resent ? `Invitación reenviada a ${email} (vale 5 días)` : `Invitación enviada a ${email} (vale 5 días)` });
      }
      setEmail("");
      setFullName("");
      setClientId("");
      router.refresh();
    } catch (err) {
      setMessage({ type: "error", text: friendlyError(err) });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 grid gap-3 sm:grid-cols-2">
      <label className="block">
        <span className="text-sm font-medium text-ink">Correo</span>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="input mt-1"
          placeholder="persona@correo.com"
        />
      </label>
      <label className="block">
        <span className="text-sm font-medium text-ink">Nombre (opcional)</span>
        <input
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="input mt-1"
        />
      </label>
      {roleChoices.length > 1 && (
        <label className="block">
          <span className="text-sm font-medium text-ink">Rol</span>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as RoleOption)}
            className="input mt-1"
          >
            {roleChoices.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
      )}
      {role === "cliente" && (
        <label className="block">
          <span className="text-sm font-medium text-ink">Negocio</span>
          <select
            required
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            className="input mt-1"
          >
            <option value="">Selecciona un negocio</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="sm:col-span-2">
        {message && (
          <p
            className={`mb-2 text-sm ${
              message.type === "ok" ? "text-green-600" : "text-red-600"
            }`}
          >
            {message.text}
          </p>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-brand-gradient px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          {submitting ? "Enviando..." : "Enviar invitación"}
        </button>
      </div>
    </form>
  );
}
