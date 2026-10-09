/**
 * Reduce una foto del celular antes de subirla (las fotos de cámara pesan
 * varios MB): la dibuja en un canvas con el lado mayor limitado y la exporta
 * como JPEG. Solo se usa en el navegador.
 */
export async function compressImage(
  file: File,
  opts: { maxSide?: number; quality?: number; square?: boolean } = {}
): Promise<Blob> {
  const { maxSide = 1600, quality = 0.82, square = false } = opts;

  const bitmap: ImageBitmap | HTMLImageElement = await new Promise((resolve, reject) => {
    if (typeof createImageBitmap === "function") {
      createImageBitmap(file).then(resolve).catch(() => loadViaImg());
    } else {
      loadViaImg();
    }
    function loadViaImg() {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("No pudimos abrir esa imagen. Prueba con una foto JPG o PNG."));
      };
      img.src = url;
    }
  });

  const w = "naturalWidth" in bitmap ? bitmap.naturalWidth : bitmap.width;
  const h = "naturalHeight" in bitmap ? bitmap.naturalHeight : bitmap.height;
  if (!w || !h) throw new Error("La imagen está vacía.");

  let sx = 0;
  let sy = 0;
  let sw = w;
  let sh = h;
  if (square) {
    const side = Math.min(w, h);
    sx = Math.floor((w - side) / 2);
    sy = Math.floor((h - side) / 2);
    sw = side;
    sh = side;
  }
  const scale = Math.min(1, maxSide / Math.max(sw, sh));
  const dw = Math.max(1, Math.round(sw * scale));
  const dh = Math.max(1, Math.round(sh * scale));

  const canvas = document.createElement("canvas");
  canvas.width = dw;
  canvas.height = dh;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Tu navegador no pudo procesar la foto.");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, dw, dh);
  ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, dw, dh);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("No pudimos preparar la foto."))),
      "image/jpeg",
      quality
    );
  });
}
