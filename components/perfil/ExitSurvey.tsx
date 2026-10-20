"use client";

import { Pix } from "@/components/ui/Pix";
import { useState } from "react";
import Link from "next/link";
import { friendlyError } from "@/lib/friendlyError";

const WORDS = ["", "Muy mala", "Mala", "Regular", "Buena", "Excelente"];

/**
 * Hoja de salida: calificación y comentario "obligatorios" para eliminar la
 * cuenta. Es un obligatorio suave a propósito: si faltan campos se avisa una
 * vez ("Por favor llena todos los campos"), pero si la persona insiste en
 * eliminar, se procesa igual con lo que haya llenado (nunca se la retiene).
 */
export default function ExitSurvey({ name }: { name: string }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [warned, setWarned] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const incomplete = rating === 0 || !comment.trim();

  async function submit() {
    if (incomplete && !warned) {
      setWarned(true);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating: rating || null, comment }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "No se pudo eliminar la cuenta.");
        setBusy(false);
        return;
      }
      setDone(true);
    } catch (err) {
      setError(friendlyError(err));
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="card mx-auto max-w-md p-6 text-center">
        <div aria-hidden><Pix e="👋" size={48} /></div>
        <h1 className="heading mt-3 text-2xl font-bold">Tu cuenta fue eliminada</h1>
        <p className="mt-2 text-sm text-stone-500">Gracias por tu tiempo y por tus comentarios. Te enviamos un correo de confirmación.</p>
        <a href="https://mysterfoodie.com" className="btn-primary mt-5 inline-flex text-sm">
          Ir a mysterfoodie.com
        </a>
      </div>
    );
  }

  return (
    <div className="card mx-auto max-w-md p-5">
      <h1 className="heading text-2xl font-bold">Antes de irte{name ? `, ${name.split(" ")[0]}` : ""}</h1>
      <p className="mt-1 text-sm text-stone-500">Tu opinión nos ayuda a mejorar. Cuéntanos cómo fue tu experiencia.</p>

      <div className="mt-5">
        <div className="text-sm font-medium text-ink">¿Cómo calificas tu experiencia?</div>
        <div className="mt-2 flex items-center gap-1" role="group" aria-label="Calificación">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setRating(n === rating ? 0 : n)}
              aria-label={`${n} de 5`}
              className="flex h-11 w-11 items-center justify-center"
            >
              <svg width="32" height="32" viewBox="0 0 24 24">
                <path
                  d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7-6.2-3.8L6 21l1.6-7L2.2 9.2l7.1-.6L12 2z"
                  fill={n <= rating ? "#F24444" : "rgba(60,60,67,0.15)"}
                />
              </svg>
            </button>
          ))}
          {rating > 0 && <span className="ml-2 text-sm font-semibold text-brand-600">{WORDS[rating]}</span>}
        </div>
      </div>

      <label className="mt-4 block">
        <span className="text-sm font-medium text-ink">¿Qué podríamos mejorar?</span>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={4}
          maxLength={2000}
          className="input mt-2"
          placeholder="Cuéntanos con confianza: lo que te gustó, lo que no y por qué te vas."
          style={{ fontSize: 16 }}
        />
      </label>

      {warned && incomplete && (
        <p className="mt-3 rounded-xl px-3.5 py-2.5 text-sm font-medium" style={{ background: "rgba(255,149,0,0.12)", color: "#9A5B00" }}>
          Por favor llena todos los campos.
        </p>
      )}
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      <button
        type="button"
        onClick={submit}
        disabled={busy}
        className="mt-5 flex min-h-[50px] w-full items-center justify-center rounded-2xl text-[15.5px] font-bold text-white disabled:opacity-60"
        style={{ background: "#F24444" }}
      >
        {busy ? "Eliminando…" : "Eliminar mi cuenta"}
      </button>
      <Link href="/perfil" className="mt-3 block py-2 text-center text-sm font-semibold text-stone-500 hover:text-ink">
        Mejor me quedo
      </Link>
    </div>
  );
}
