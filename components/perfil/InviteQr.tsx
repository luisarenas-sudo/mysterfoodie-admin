"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import QRCode from "qrcode";

/**
 * QR de invitación: logo negro pequeño de MysterFoodie al centro (corrección de errores "H" y logo de ~17 % del
 * ancho para que siga leyéndose), con botones para descargar la imagen, compartirla y copiar la liga.
 */
const LOGO_SRC = "/icon-mark-black.png";
const LOGO_RATIO = 0.17; // ancho del logo / ancho del QR (el módulo central blanco es un poco mayor)

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** Dibuja el QR (cuadrado de `size` px con margen blanco) + logo en el centro. */
async function drawQr(ctx: CanvasRenderingContext2D, url: string, x: number, y: number, size: number) {
  const qr = QRCode.create(url, { errorCorrectionLevel: "H" });
  const n = qr.modules.size;
  const quiet = 2;
  const cell = size / (n + quiet * 2);
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(x, y, size, size);
  ctx.fillStyle = "#111111";
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (qr.modules.get(r, c)) ctx.fillRect(x + (c + quiet) * cell, y + (r + quiet) * cell, Math.ceil(cell), Math.ceil(cell));
    }
  }
  const logo = await loadImage(LOGO_SRC);
  if (logo) {
    const lw = size * LOGO_RATIO;
    const pad = lw * 0.28;
    const box = lw + pad * 2;
    const cx = x + size / 2;
    const cy = y + size / 2;
    ctx.fillStyle = "#FFFFFF";
    ctx.beginPath();
    const bx = cx - box / 2;
    const by = cy - box / 2;
    const rad = box * 0.22;
    ctx.moveTo(bx + rad, by);
    ctx.arcTo(bx + box, by, bx + box, by + box, rad);
    ctx.arcTo(bx + box, by + box, bx, by + box, rad);
    ctx.arcTo(bx, by + box, bx, by, rad);
    ctx.arcTo(bx, by, bx + box, by, rad);
    ctx.fill();
    // El PNG tiene márgenes transparentes: se recorta a la marca (78,57)-(438,463) de 512.
    const sx = 78, sy = 57, sw = 360, sh = 406;
    const dh = lw * (sh / sw);
    ctx.drawImage(logo, sx, sy, sw, sh, cx - lw / 2, cy - dh / 2, lw, dh);
  }
}

export default function InviteQr({ url, alias }: { url: string; alias: string }) {
  const view = useRef<HTMLCanvasElement>(null);
  const [copied, setCopied] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    const canvas = view.current;
    if (!canvas) return;
    const size = 640;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (ctx) void drawQr(ctx, url, 0, 0, size);
  }, [url]);

  /** Imagen lista para guardar o mandar: tarjeta blanca con el QR y el nombre anónimo. */
  const buildImage = useCallback(async (): Promise<Blob | null> => {
    const W = 1080;
    const H = 1320;
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = "center";
    ctx.fillStyle = "#F24444";
    ctx.font = "700 44px Arial, Helvetica, sans-serif";
    ctx.fillText("MYSTERFOODIE", W / 2, 110);
    ctx.fillStyle = "#1C1C1E";
    ctx.font = "700 64px Arial, Helvetica, sans-serif";
    ctx.fillText("Te invito a ser Shopper", W / 2, 205);
    await drawQr(ctx, url, 140, 270, 800);
    ctx.fillStyle = "#1C1C1E";
    ctx.font = "700 58px Arial, Helvetica, sans-serif";
    ctx.fillText(alias, W / 2, 1170);
    ctx.fillStyle = "rgba(60,60,67,0.7)";
    ctx.font = "400 34px Arial, Helvetica, sans-serif";
    ctx.fillText(url.replace(/^https?:\/\//, ""), W / 2, 1230);
    return new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/png"));
  }, [url, alias]);

  const fileName = `invitacion-mysterfoodie-${alias.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-")}.png`;
  const message = `${alias} te invita a ser MysterFoodie Shopper. Llena tu solicitud aquí: ${url}`;

  const download = async () => {
    setNote(null);
    const blob = await buildImage();
    if (!blob) return setNote("No se pudo generar la imagen.");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  };

  const share = async () => {
    setNote(null);
    try {
      const blob = await buildImage();
      const file = blob ? new File([blob], fileName, { type: "image/png" }) : null;
      if (file && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text: message });
        return;
      }
      if (navigator.share) {
        await navigator.share({ title: "Invitación MysterFoodie", text: message, url });
        return;
      }
      window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank", "noopener");
    } catch (e) {
      // Cancelar el menú de compartir no es un error.
      if (e instanceof DOMException && e.name === "AbortError") return;
      setNote("Tu navegador no permite compartir desde aquí. Usa «Descargar imagen» o «Copiar liga».");
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setNote("No se pudo copiar. Mantén presionada la liga para copiarla.");
    }
  };

  const btn = "mf-tap flex min-h-[48px] flex-1 items-center justify-center rounded-[14px] px-3 text-[15px] font-semibold";
  return (
    <div className="flex flex-col items-center">
      <canvas ref={view} className="h-auto w-full max-w-[280px] rounded-[18px]" style={{ border: "1px solid rgba(60,60,67,0.12)" }} aria-label={`Código QR de invitación de ${alias}`} />
      <div className="mt-4 flex w-full gap-2.5">
        <button type="button" onClick={download} className={btn} style={{ background: "#F24444", color: "#fff" }}>
          Descargar imagen
        </button>
        <button type="button" onClick={share} className={btn} style={{ background: "rgba(60,60,67,0.08)", color: "#1C1C1E" }}>
          Compartir
        </button>
      </div>
      <button type="button" onClick={copy} className="mf-tap mt-2.5 min-h-[44px] w-full rounded-[14px] px-3 text-[14px] font-semibold" style={{ background: "rgba(60,60,67,0.06)", color: "#1C1C1E" }}>
        {copied ? "¡Liga copiada!" : url.replace(/^https?:\/\//, "") + " · copiar"}
      </button>
      {note && (
        <p className="mt-2 text-center text-[12.5px]" style={{ color: "#C7301E" }}>
          {note}
        </p>
      )}
    </div>
  );
}
