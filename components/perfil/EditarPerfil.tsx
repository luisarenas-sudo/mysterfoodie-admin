"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Avatar from "@/components/Avatar";
import { compressImage } from "@/lib/imageCompress";

/**
 * Pantalla "Editar perfil": foto (cámara o galería), nombre y teléfono.
 * Botones de 52 px de alto y campos de 16 px (evita el zoom de iOS al enfocar).
 */
export default function EditarPerfil({
  displayName,
  email,
  avatarUrl,
  initialName,
  initialPhone,
}: {
  displayName: string;
  email: string;
  avatarUrl: string | null;
  initialName: string;
  initialPhone: string;
}) {
  const router = useRouter();
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoMsg, setPhotoMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState(initialPhone);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function uploadPhoto(file: File | undefined) {
    if (!file) return;
    setPhotoBusy(true);
    setPhotoMsg(null);
    try {
      const blob = await compressImage(file, { maxSide: 512, quality: 0.86, square: true });
      const fd = new FormData();
      fd.append("file", blob, "perfil.jpg");
      const res = await fetch("/api/perfil/foto", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "No se pudo guardar la foto.");
      setPhotoMsg({ ok: true, text: "Foto actualizada." });
      router.refresh();
    } catch (e) {
      setPhotoMsg({ ok: false, text: e instanceof Error ? e.message : "No se pudo guardar la foto." });
    } finally {
      setPhotoBusy(false);
      if (cameraRef.current) cameraRef.current.value = "";
      if (galleryRef.current) galleryRef.current.value = "";
    }
  }

  async function removePhoto() {
    setPhotoBusy(true);
    setPhotoMsg(null);
    try {
      const res = await fetch("/api/perfil/foto", { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "No se pudo quitar la foto.");
      setPhotoMsg({ ok: true, text: "Listo, ahora se ven tus iniciales." });
      router.refresh();
    } catch (e) {
      setPhotoMsg({ ok: false, text: e instanceof Error ? e.message : "No se pudo quitar la foto." });
    } finally {
      setPhotoBusy(false);
    }
  }

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/perfil", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName: name, phone }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "No se pudo guardar.");
      setMsg({ ok: true, text: "Cambios guardados." });
      router.refresh();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "No se pudo guardar." });
    } finally {
      setSaving(false);
    }
  }

  const note = (m: { ok: boolean; text: string }) => (
    <p
      className="mx-5 mb-4 rounded-[14px] px-4 py-3 text-[13.5px] font-medium"
      style={m.ok ? { background: "rgba(52,199,89,0.1)", color: "#248A3D" } : { background: "rgba(255,59,48,0.1)", color: "#C7301E" }}
    >
      {m.text}
    </p>
  );

  const bigBtn = "flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl px-4 text-[16px] font-bold disabled:opacity-50 mf-tap";

  return (
    <>
      <div className="flex flex-col items-center px-5 pb-5 pt-6">
        <Avatar displayName={displayName} avatarUrl={avatarUrl} sizeClass="h-28 w-28 text-4xl" />
        <div className="mt-3 text-[13px]" style={{ color: "rgba(60,60,67,0.55)" }}>
          {avatarUrl ? "Tu foto de perfil" : "Ahora se ven tus iniciales"}
        </div>
      </div>

      <div className="mx-5 mb-4 flex flex-col gap-2.5">
        <button type="button" disabled={photoBusy} onClick={() => cameraRef.current?.click()} className={bigBtn} style={{ background: "#F24444", color: "#fff" }}>
          {photoBusy ? "Guardando…" : "📷  Tomar foto"}
        </button>
        <button
          type="button"
          disabled={photoBusy}
          onClick={() => galleryRef.current?.click()}
          className={bigBtn}
          style={{ background: "#fff", color: "#F24444", border: "1.5px solid #F24444" }}
        >
          🖼️  Elegir de la galería
        </button>
        {avatarUrl && (
          <button type="button" disabled={photoBusy} onClick={removePhoto} className={bigBtn} style={{ color: "#FF3B30" }}>
            Quitar foto y usar iniciales
          </button>
        )}
      </div>
      {photoMsg && note(photoMsg)}
      <input ref={cameraRef} type="file" accept="image/*" capture="user" className="hidden" onChange={(e) => uploadPhoto(e.target.files?.[0])} />
      <input ref={galleryRef} type="file" accept="image/*" className="hidden" onChange={(e) => uploadPhoto(e.target.files?.[0])} />

      <div className="mx-5 mb-1.5 px-1 text-[13px] font-semibold uppercase tracking-wide" style={{ color: "rgba(60,60,67,0.6)" }}>
        Tus datos
      </div>
      <div className="card mx-5 mb-2 overflow-hidden">
        <label className="flex min-h-[56px] items-center gap-3 px-4" style={{ borderBottom: "1px solid rgba(60,60,67,0.08)" }}>
          <span className="w-24 flex-shrink-0 text-[15px]">Nombre</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            autoComplete="name"
            enterKeyHint="next"
            placeholder="Tu nombre"
            className="min-w-0 flex-1 bg-transparent py-3 text-right text-[16px] outline-none"
          />
        </label>
        <label className="flex min-h-[56px] items-center gap-3 px-4" style={{ borderBottom: "1px solid rgba(60,60,67,0.08)" }}>
          <span className="w-24 flex-shrink-0 text-[15px]">Teléfono</span>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            enterKeyHint="done"
            placeholder="Opcional"
            className="min-w-0 flex-1 bg-transparent py-3 text-right text-[16px] outline-none"
          />
        </label>
        <div className="flex min-h-[56px] items-center gap-3 px-4">
          <span className="w-24 flex-shrink-0 text-[15px]">Correo</span>
          <span className="min-w-0 flex-1 truncate py-3 text-right text-[15px]" style={{ color: "rgba(60,60,67,0.55)" }}>
            {email}
          </span>
        </div>
      </div>
      <p className="mx-6 mb-5 text-[12.5px] leading-snug" style={{ color: "rgba(60,60,67,0.55)" }}>
        El correo es tu acceso y no se cambia desde aquí. Si necesitas otro, escríbenos a hola@mysterfoodie.com.
      </p>

      {msg && note(msg)}
      <div className="mx-5 mb-10">
        <button type="button" disabled={saving || photoBusy} onClick={save} className={bigBtn} style={{ background: "#F24444", color: "#fff" }}>
          {saving ? "Guardando…" : "Guardar cambios"}
        </button>
      </div>
    </>
  );
}
