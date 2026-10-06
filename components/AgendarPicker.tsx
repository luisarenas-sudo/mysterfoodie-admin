"use client";

import { useMemo, useState, type FormEvent } from "react";
import FlancoCredit from "@/components/FlancoCredit";
import { friendlyError } from "@/lib/friendlyError";

export type SlotOption = { startISO: string; endISO: string };

const ACCENT = "#F24444";

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const fmt = new Intl.DateTimeFormat("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "America/Mexico_City",
  });
  const label = fmt.format(d);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function timeLabel(iso: string): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("es-MX", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "America/Mexico_City",
  }).format(d);
}

export default function AgendarPicker({
  shortCode,
  businessName,
  defaultEmail,
  needsPhone,
  slots,
}: {
  shortCode: string;
  businessName: string;
  defaultEmail: string;
  /** true cuando el negocio no tiene teléfono/WhatsApp guardado: se pide antes de poder agendar. */
  needsPhone: boolean;
  slots: SlotOption[];
}) {
  // Copia local de slots: si el POST falla por choque de horario (alguien
  // más agendó ese mismo slot justo antes), lo quitamos de aquí para que no
  // se pueda reintentar el mismo horario ya tomado -- antes quedaba
  // seleccionable y el usuario podía quedarse reintentando en bucle.
  const [availableSlots, setAvailableSlots] = useState(slots);

  const grouped = useMemo(() => {
    const byDay = new Map<string, SlotOption[]>();
    for (const slot of availableSlots) {
      const dayKey = new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Mexico_City",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date(slot.startISO));
      if (!byDay.has(dayKey)) byDay.set(dayKey, []);
      byDay.get(dayKey)!.push(slot);
    }
    return Array.from(byDay.entries());
  }, [availableSlots]);

  const [selected, setSelected] = useState<SlotOption | null>(null);
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState(defaultEmail);
  const [contactPhone, setContactPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!selected) return;
    if (needsPhone && !contactPhone.trim()) {
      setError("Necesitamos un teléfono o WhatsApp para confirmar la cita");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/agendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shortCode,
          slotStartISO: selected.startISO,
          slotEndISO: selected.endISO,
          contactName: contactName || null,
          contactEmail,
          contactPhone: contactPhone.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "No se pudo agendar, intenta con otro horario");
        // Ese horario ya no es válido (lo más común es que alguien más lo
        // haya tomado) -- lo quitamos de la lista y obligamos a elegir otro.
        setAvailableSlots((prev) => prev.filter((s) => s.startISO !== selected.startISO));
        setSelected(null);
        return;
      }
      setConfirmed(true);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (confirmed && selected) {
    return (
      <div className="card mx-auto mt-6 max-w-sm p-6 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full" style={{ background: "rgba(52,199,89,0.14)" }}>
          <span className="text-2xl">✓</span>
        </div>
        <p className="text-[16px] font-bold">¡Quedaste agendado!</p>
        <p className="mt-1 text-[14px]" style={{ color: "rgba(60,60,67,0.6)" }}>
          {dayLabel(selected.startISO)}, {timeLabel(selected.startISO)} - {timeLabel(selected.endISO)} (hora CDMX)
        </p>
        <p className="mt-3 text-[12.5px]" style={{ color: "rgba(60,60,67,0.55)" }}>
          Te llega una invitación de Google Calendar a {contactEmail} con el enlace de la llamada.
        </p>
      </div>
    );
  }

  if (slots.length === 0) {
    return (
      <div className="card mx-auto mt-6 max-w-sm p-6 text-center">
        <p className="text-[14px]" style={{ color: "rgba(60,60,67,0.6)" }}>
          No hay horarios disponibles en los próximos días. Escríbenos directamente y coordinamos un horario.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto mt-4 max-w-sm px-5">
      <p className="text-[13px] font-semibold uppercase tracking-wide" style={{ color: ACCENT }}>
        Asesoría gratuita · 20 min
      </p>
      <p className="mt-1 text-[15px]" style={{ color: "rgba(60,60,67,0.7)" }}>
        Elige un horario para platicar sobre {businessName}.
      </p>

      <div className="mt-4 space-y-4">
        {grouped.map(([dayKey, daySlots]) => (
          <div key={dayKey}>
            <p className="mb-1.5 text-[13px] font-semibold">{dayLabel(daySlots[0].startISO)}</p>
            <div className="flex flex-wrap gap-2">
              {daySlots.map((slot) => {
                const isSelected = selected?.startISO === slot.startISO;
                return (
                  <button
                    key={slot.startISO}
                    type="button"
                    onClick={() => setSelected(slot)}
                    className="rounded-full px-3 py-1.5 text-[13px] font-semibold"
                    style={
                      isSelected
                        ? { background: ACCENT, color: "#fff" }
                        : { background: "#F2F2F7", color: "#222" }
                    }
                  >
                    {timeLabel(slot.startISO)}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {selected && (
        <form onSubmit={handleSubmit} className="card mt-5 space-y-3 p-4">
          <label className="block">
            <span className="text-[12.5px] font-medium" style={{ color: "rgba(60,60,67,0.7)" }}>
              Tu nombre (opcional)
            </span>
            <input
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              className="input mt-1"
              placeholder="Nombre"
            />
          </label>
          <label className="block">
            <span className="text-[12.5px] font-medium" style={{ color: "rgba(60,60,67,0.7)" }}>
              Correo
            </span>
            <input
              type="email"
              required
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              className="input mt-1"
              placeholder="tucorreo@negocio.com"
            />
          </label>
          {needsPhone && (
            <label className="block">
              <span className="text-[12.5px] font-medium" style={{ color: "rgba(60,60,67,0.7)" }}>
                Teléfono o WhatsApp
              </span>
              <input
                type="tel"
                required
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                className="input mt-1"
                placeholder="10 dígitos"
              />
            </label>
          )}
          {error && <p className="text-[13px] text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md py-2.5 text-[14px] font-semibold text-white disabled:opacity-50"
            style={{ background: ACCENT }}
          >
            {submitting
              ? "Agendando..."
              : `Confirmar ${dayLabel(selected.startISO)}, ${timeLabel(selected.startISO)}`}
          </button>
          <div className="text-center">
            <FlancoCredit label="Tus datos solo se usan para esta llamada · Respaldado por Flanco Izquierdo" className="text-[11px]" />
          </div>
        </form>
      )}
    </div>
  );
}
