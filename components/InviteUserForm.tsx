"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

type Client = { id: string; name: string };
type RoleOption = "admin" | "agente" | "cliente" | "sibarita";

export default function InviteUserForm({ clients }: { clients: Client[] }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<RoleOption>("agente");
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
      setMessage({ type: "ok", text: `Invitación enviada a ${email}` });
      setEmail("");
      setFullName("");
      setClientId("");
      router.refresh();
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Error de red" });
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
      <label className="block">
        <span className="text-sm font-medium text-ink">Rol</span>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as RoleOption)}
          className="input mt-1"
        >
          <option value="agente">Foodie</option>
          <option value="sibarita">Sibarita</option>
          <option value="cliente">Cliente (dueño de negocio)</option>
          <option value="admin">Master Chef</option>
        </select>
      </label>
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
