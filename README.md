# MysterFoodie - Formulario de evaluacion Mystery Shopper

App para levantar evaluaciones Mystery Shopper en restaurantes y bares: se captura primero
el negocio, luego la calificacion por indicador, y al final se guarda todo, se envia un
correo automatico con el resultado general (pensado para vender el reporte completo), y se
genera un texto listo para copiar y pegar en un DM de Instagram a la cuenta oficial del
negocio visitado, junto con un link corto y publico al reporte resumen.

## Puesta en marcha

1. `npm install`
2. Crea un proyecto en Supabase y corre `supabase/schema.sql` en el SQL editor.
3. Copia `.env.example` a `.env.local` y llena las variables:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
   - `RESEND_API_KEY` y `RESEND_FROM_EMAIL` (crea cuenta en resend.com; sin esto el correo
     no se envia pero el resto del flujo funciona igual)
   - `ADMIN_EMAIL` como respaldo cuando el negocio no tenga correo capturado
   - `ADMIN_CONTACT_WHATSAPP` para el boton de "solicitar reporte completo" en la pagina
     publica del reporte
4. `npm run dev` y abre `http://localhost:3000`

## Flujo

1. Se captura el negocio (nombre, tipo, usuario de Instagram, correo opcional, ciudad, etc.)
2. Se califican 11 indicadores del sector (1 a 5) mas 4 banderas rapidas de si/no
3. Al enviar: se guarda en Supabase (`clients`, `forms`, `form_ratings`, `form_flags`), se
   calcula el promedio, se intenta enviar el correo (`email_confirmations` guarda el
   resultado del envio), y se muestra en pantalla:
   - El texto para copiar y pegar en el DM de Instagram del negocio
   - Un link directo para abrir el DM (`ig.me/m/usuario`) cuando se capturo el usuario
   - El link corto y publico del reporte resumen (`/r/[codigo]`)

Instagram no permite pre-llenar el texto de un DM desde un link por temas de privacidad,
por eso el flujo es copiar el texto y pegarlo manualmente al abrir el DM.

## Panel de negocios (`/negocios`)

Cada negocio evaluado queda disponible en `/negocios`:

- **Lista de negocios** con su ultima calificacion y veredicto
- **Detalle por negocio** (`/negocios/[id]`) con:
  - Veredicto basico segun el promedio: Excelente (4.5+), Bueno (3.5-4.4), Regular
    (2.5-3.4), Necesita atencion (menos de 2.5) - logica en `lib/verdict.ts`
  - Grafica de evolucion del promedio a lo largo de las visitas (linea)
  - Grafica comparativa de los 11 indicadores: visita actual contra la visita
    anterior (barras horizontales)
  - Historial completo de visitas con link al reporte publico de cada una

El veredicto tambien aparece en el correo automatico y en la pagina publica del reporte
(`/r/[codigo]`), asi que el negocio lo ve incluso antes de comprar el reporte completo.

## Identidad visual

Colores, tipografia y logo salen del manual de marca (`Myster Foodie-Manual de
Identidad_Optimizer.pdf`, en la carpeta raiz de Drive del proyecto):

- Colores: rojo `#f24444` a naranja `#f25631` en gradiente vertical (`bg-brand-gradient`),
  negro `#222222` (`ink`) y blanco. Los veredictos usan una paleta de estado aparte
  (verde/amarillo/naranja/rojo) para que se lean sin ambiguedad, separada del rojo de marca.
- Tipografia: Poppins para texto (via Google Fonts). Para los titulos el manual usa
  "Nan Holo Giga Wide", una fuente de paga que no estaba disponible en este entorno; se usa
  **Fredoka** como sustituto redondeado (clase `heading` en `globals.css`). Si me pasas el
  archivo de la fuente real, la puedo sustituir en `app/layout.tsx`.
- Logo: extraido en alta resolucion directo del PDF del manual (vectorial) y recortado en
  `public/logo-wordmark.png` (wordmark con fondo transparente) y `public/icon-512.png` /
  `public/favicon.ico` / `public/apple-touch-icon.png` (icono en el gradiente de marca).

## Lo que falta para la vision completa

Este build cubre solo el flujo de captura y venta inicial del reporte. Quedan pendientes,
como siguientes pasos, las piezas que describiste y que requieren decisiones tuyas antes de
programarlas (proveedor de pagos, reglas de comision, etc.):

- Pasarela de pago para cobrar el reporte completo y dividir la comision entre tu y el
  agente que hizo la visita (hoy el boton de "solicitar reporte completo" solo abre un
  WhatsApp de contacto para cerrar la venta a mano)
- Cuentas y roles: admin, agentes (mystery shoppers externos) y clientes (duenos de
  negocio), con permisos y colores por rango
- Panel para que el cliente vea sus sucursales, avances y calificaciones a lo largo del
  tiempo
- Automatizacion mensual de correos personalizados segun las banderas capturadas (ej. si
  `menu_actualizado` sale en falso, ofrecer el servicio de rediseno de menu)
- Universidad Foodie: contenido de capacitacion, solicitud de acceso y cobro de la
  certificacion para operar como agente MysterFoodie
- Estructura de agentes bajo el admin, con seguimiento de a quien pertenece cada visita
  para calcular comisiones

Las tablas de `clients` y `forms` ya quedan listas para conectarse a un panel de reportes
mas adelante (esa parte se puede retomar del scaffold anterior descrito en la memoria del
proyecto).
