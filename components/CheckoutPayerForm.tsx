"use client";

import { useState } from "react";
import Image from "next/image";

/**
 * Versión de escritorio del bloque "nombre/correo" que ya existía en
 * MobileReportePublico (donde se arma el link de checkout de MercadoPago
 * con ?nombre=&email= para precargar al comprador). Antes el botón de
 * escritorio era un <a href="/api/checkout?shortCode=..."> fijo, sin pedir
 * estos datos -- esta versión iguala el comportamiento.
 *
 * No repite el crédito de Flanco Izquierdo aquí: la página
 * (app/r/[shortCode]/page.tsx) ya pone un <FlancoCredit /> hasta abajo,
 * después de "Palabra Foodie", y tenerlo duplicado justo debajo del
 * botón de compra se veía mal.
 */
export default function CheckoutPayerForm({
  shortCode,
  price,
}: {
  shortCode: string;
  price: number;
}) {
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");

  const checkoutParams = new URLSearchParams({ shortCode });
  if (nombre.trim()) checkoutParams.set("nombre", nombre.trim());
  if (email.trim()) checkoutParams.set("email", email.trim());
  const checkoutHref = `/api/checkout?${checkoutParams.toString()}`;

  return (
    <div className="mt-4">
      <div className="mx-auto grid max-w-xs gap-2 text-left">
        <input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Tu nombre (opcional)"
          className="input text-sm"
          type="text"
          autoComplete="name"
        />
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Tu correo (opcional, para enviarte el PDF)"
          className="input text-sm"
          type="email"
          autoComplete="email"
        />
      </div>
      <a
        href={checkoutHref}
        className="mt-3 inline-block rounded-md bg-brand-gradient px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90"
      >
        Comprar reporte completo - ${price} MXN
      </a>
      <div className="mt-3 flex justify-center">
        <Image src="/mercadopago-logo.png" alt="Mercado Pago" width={110} height={29} className="opacity-80" />
      </div>
    </div>
  );
}
