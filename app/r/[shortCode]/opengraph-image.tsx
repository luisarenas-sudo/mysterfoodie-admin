import { ImageResponse } from "next/og";
import { readFile } from "fs/promises";
import path from "path";
import { getShareData } from "@/lib/reportShare";

/**
 * Tarjeta social del reporte (se ve al pegar el enlace en el inbox de
 * Instagram, WhatsApp, Facebook, iMessage, etc.): nombre del negocio, su
 * calificación con estrellas, el veredicto y el promedio de cada categoría.
 * Solo datos parciales (los mismos de la vista gratuita).
 */
export const runtime = "nodejs";
export const alt = "Resultado de la evaluación Mystery Shopper de MysterFoodie";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const GOLD = "#F5B301";
const GRAY = "#E5E7EB";
const STAR = "12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26";

async function read(...parts: string[]): Promise<Buffer | null> {
  try {
    return await readFile(path.join(process.cwd(), ...parts));
  } catch {
    return null;
  }
}

/** PNG -> data URI + proporciones (lee el ancho/alto del encabezado IHDR). */
function pngInfo(buf: Buffer | null): { uri: string; ratio: number } | null {
  if (!buf || buf.length < 24) return null;
  const w = buf.readUInt32BE(16);
  const h = buf.readUInt32BE(20);
  if (!w || !h) return null;
  return { uri: `data:image/png;base64,${buf.toString("base64")}`, ratio: w / h };
}

function Stars({ score, size: S }: { score: number; size: number }) {
  return (
    <div style={{ display: "flex" }}>
      {[0, 1, 2, 3, 4].map((i) => {
        const frac = Math.max(0, Math.min(1, score - i));
        return (
          <div key={i} style={{ display: "flex", position: "relative", width: S, height: S, marginRight: 8 }}>
            <svg width={S} height={S} viewBox="0 0 24 24" style={{ position: "absolute", left: 0, top: 0 }}>
              <polygon points={STAR} fill={GRAY} />
            </svg>
            <div style={{ display: "flex", position: "absolute", left: 0, top: 0, width: Math.round(S * frac), height: S, overflow: "hidden" }}>
              <svg width={S} height={S} viewBox="0 0 24 24">
                <polygon points={STAR} fill={GOLD} />
              </svg>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default async function Image({ params }: { params: Promise<{ shortCode: string }> }) {
  const { shortCode } = await params;
  const [data, bold, medium, nan, logoBuf] = await Promise.all([
    getShareData(shortCode),
    read("app", "fonts", "og", "Poppins-Bold.ttf"),
    read("app", "fonts", "og", "Poppins-Medium.ttf"),
    read("app", "fonts", "og", "NanHoloGigawide-Ultra.ttf"),
    read("public", "logo-wordmark.png"),
  ]);

  const fonts: { name: string; data: ArrayBuffer; weight: 400 | 500 | 700 | 800; style: "normal" }[] = [];
  const ab = (b: Buffer) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
  if (bold) fonts.push({ name: "Poppins", data: ab(bold), weight: 700, style: "normal" });
  if (medium) fonts.push({ name: "Poppins", data: ab(medium), weight: 500, style: "normal" });
  if (nan) fonts.push({ name: "NanHolo", data: ab(nan), weight: 800, style: "normal" });
  const family = bold ? "Poppins" : "sans-serif";
  const numFamily = nan ? "NanHolo" : family;

  const logo = pngInfo(logoBuf);
  const logoH = 64;

  const header = (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logo.uri} height={logoH} width={Math.round(logoH * logo.ratio)} alt="" />
      ) : (
        <div style={{ display: "flex", fontSize: 40, fontWeight: 700, color: "#f24444" }}>MysterFoodie</div>
      )}
      <div
        style={{
          display: "flex",
          padding: "10px 22px",
          borderRadius: 999,
          background: "#ffffff",
          border: "2px solid #f1e3dc",
          fontSize: 22,
          fontWeight: 500,
          color: "#6b7280",
        }}
      >
        Resultado de visita Mystery Shopper
      </div>
    </div>
  );

  // Sin datos (enlace inválido): tarjeta de marca genérica.
  if (!data) {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "56px 64px",
            background: "linear-gradient(135deg, #fff7f3 0%, #ffe9e1 100%)",
            fontFamily: family,
          }}
        >
          {header}
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 72, fontWeight: 700, color: "#222222", lineHeight: 1.1 }}>
              Evaluaciones Mystery Shopper
            </div>
            <div style={{ display: "flex", fontSize: 34, fontWeight: 500, color: "#6b7280", marginTop: 14 }}>
              para restaurantes y bares
            </div>
          </div>
          <div style={{ display: "flex", fontSize: 26, fontWeight: 500, color: "#f24444" }}>Palabra Foodie · mysterfoodie.com</div>
        </div>
      ),
      { ...size, fonts }
    );
  }

  const name = data.name.length > 56 ? `${data.name.slice(0, 55)}…` : data.name;
  const nameSize = name.length <= 16 ? 78 : name.length <= 28 ? 62 : 50;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "48px 64px 44px",
          background: "linear-gradient(135deg, #fff7f3 0%, #ffe9e1 100%)",
          fontFamily: family,
        }}
      >
        {header}

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
          <div style={{ display: "flex", flexDirection: "column", width: 690 }}>
            <div style={{ display: "flex", fontSize: nameSize, fontWeight: 700, color: "#222222", lineHeight: 1.08 }}>{name}</div>
            {data.city ? (
              <div style={{ display: "flex", fontSize: 28, fontWeight: 500, color: "#6b7280", marginTop: 10 }}>{data.city}</div>
            ) : null}
            <div style={{ display: "flex", alignItems: "center", marginTop: 26 }}>
              <Stars score={data.score} size={64} />
              <div
                style={{
                  display: "flex",
                  marginLeft: 18,
                  padding: "8px 24px",
                  borderRadius: 999,
                  background: data.verdictColor,
                  color: "#ffffff",
                  fontSize: 30,
                  fontWeight: 700,
                }}
              >
                {data.verdictLabel}
              </div>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              width: 360,
              height: 270,
              borderRadius: 40,
              background: "#ffffff",
              border: `4px solid ${data.verdictColor}`,
            }}
          >
            <div style={{ display: "flex", fontFamily: numFamily, fontSize: 88, color: data.verdictColor, lineHeight: 1 }}>
              {data.score.toFixed(1)}
            </div>
            <div style={{ display: "flex", fontSize: 28, fontWeight: 500, color: "#6b7280", marginTop: 8 }}>de 5 estrellas</div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", width: "100%" }}>
          <div style={{ display: "flex", flexWrap: "wrap", width: "100%" }}>
            {data.cats.map((c) => (
              <div
                key={c.label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "8px 14px",
                  marginRight: 10,
                  marginBottom: 10,
                  borderRadius: 999,
                  background: "#ffffff",
                  border: "2px solid #f1e3dc",
                  fontSize: 20,
                  fontWeight: 500,
                  color: "#374151",
                }}
              >
                <div style={{ display: "flex", width: 12, height: 12, borderRadius: 999, background: c.color, marginRight: 8 }} />
                {c.label}
                <div style={{ display: "flex", marginLeft: 8, fontWeight: 700, color: "#222222" }}>{c.average.toFixed(1)}</div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: 22, fontWeight: 500, color: "#f24444" }}>
            <div style={{ display: "flex" }}>Palabra Foodie · evaluación anónima de 52 indicadores</div>
            <div style={{ display: "flex" }}>mysterfoodie.com</div>
          </div>
        </div>
      </div>
    ),
    { ...size, fonts }
  );
}
