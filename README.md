# MysterFoodie - Formulario de evaluacion Mystery Shopper

App para levantar evaluaciones Mystery Shopper en restaurantes y bares: se captura primero
el negocio, luego la calificacion por indicador, y al final se guarda todo, se envia un
correo automatico con el resultado general (pensado para vender el reporte completo), y se
genera un texto listo para copiar y pegar en un DM de Instagram a la cuenta oficial del
negocio visitado, junto con un link corto y publico al reporte resumen.

Tiene cuentas con tres roles (admin, agente y cliente/dueno de negocio) que controlan quien
puede registrar visitas, ver el CRM interno o ver el propio negocio. Ver la seccion "Roles y
cuentas" mas abajo.

## Puesta en marcha

1. `npm install`
2. Crea un proyecto en Supabase y corre `supabase/schema.sql` en el SQL editor (incluye las
   tablas del formulario y la seccion de roles/cuentas al final del archivo).
3. En Supabase, activa Authentication > Providers > Email (basta con la config por default).
4. Copia `.env.example` a `.env.local` y llena las variables:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
   - `RESEND_API_KEY` y `RESEND_FROM_EMAIL` (crea cuenta en resend.com; sin esto el correo
     no se envia pero el resto del flujo funciona igual)
   - `ADMIN_EMAIL` como respaldo cuando el negocio no tenga correo capturado
   - `ADMIN_CONTACT_WHATSAPP` para el boton de "solicitar reporte completo" en la pagina
     publica del reporte
   - `APP_URL` (por ejemplo `http://localhost:3000` en desarrollo, o el dominio real en
     produccion) - se usa para armar los links de los correos de invitacion y del reporte
     publico. Importante: usar `APP_URL`, NO `NEXT_PUBLIC_APP_URL` - en GoDaddy las variables
     `NEXT_PUBLIC_*` quedan vacias porque el build no tiene acceso a los Secrets (solo en
     runtime), asi que esa variable nunca llegaria a tomar el valor configurado.
5. Crea tu propio usuario admin (la primera vez no hay nadie que pueda invitar a nadie):
   en el SQL editor de Supabase, despues de crear tu usuario desde Authentication > Users >
   Invite user (o Add user), corre:
   ```sql
   update profiles set role = 'admin' where email = 'tu-correo@dominio.com';
   ```
   Desde ahi ya puedes invitar al resto del equipo desde `/admin/usuarios` dentro de la app.
6. `npm run dev` y abre `http://localhost:3000`

## Flujo

1. Un agente o admin inicia sesion y se captura el negocio (nombre, tipo, usuario de
   Instagram, correo opcional, ciudad, etc.)
2. Se califican 11 indicadores del sector (1 a 5) mas 4 banderas rapidas de si/no
3. Al enviar: se guarda en Supabase (`clients`, `forms`, `form_ratings`, `form_flags`), se
   calcula el promedio, se intenta enviar el correo (`email_confirmations` guarda el
   resultado del envio), y se muestra en pantalla:
   - El texto para copiar y pegar en el DM de Instagram del negocio
   - Un link directo para abrir el DM (`ig.me/m/usuario`) cuando se capturo el usuario
   - El link corto y publico del reporte resumen (`/r/[codigo]`)

Instagram no permite pre-llenar el texto de un DM desde un link por temas de privacidad,
por eso el flujo es copiar el texto y pegarlo manualmente al abrir el DM.

## Roles y cuentas

Tres roles, controlados por la tabla `profiles` (columna `role`) y aplicados en
`middleware.ts`:

- **admin**: acceso a todo - nueva evaluacion, `/negocios` (CRM interno con todos los
  negocios y su historial completo) y `/admin/usuarios` para invitar gente y asignarles rol.
- **agente** (mystery shopper externo): puede registrar nuevas evaluaciones (`/`) y ver
  `/mis-visitas`, el historial de solo las visitas que el mismo registro (queda guardado en
  `forms.created_by`, listo para calcular comisiones a futuro).
- **cliente** (dueno de negocio): solo ve `/mi-negocio`, que es exactamente la misma vista
  que `/negocios/[id]` (evolucion del promedio, comparativo de indicadores, historial) pero
  amarrada automaticamente a su propio negocio (`profiles.client_id`) - no puede ver otros
  negocios.

`/r/[shortCode]` (el reporte publico por link corto) sigue sin requerir sesion, por diseno.

**Invitar gente**: solo un admin puede hacerlo, desde `/admin/usuarios`. Al invitar se le
pide correo, nombre (opcional) y rol; si el rol es "cliente" tambien se elige a que negocio
de la lista de `clients` queda amarrado. Supabase manda un correo de invitacion con un link
a `/set-password`, donde la persona crea su contrasena y entra directo.

## Panel de negocios (`/negocios`, solo admin)

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

## Control de versiones y limpieza (importante)

Este proyecto vive dentro de una carpeta sincronizada con Google Drive, lo cual generaba dos
problemas reales que se corrigieron:

- **Sin git**: no habia ningun control de versiones. Ya se inicializo un repo local
  (`git init`) con un primer commit del estado tal cual estaba. Falta conectarlo a un
  remoto (GitHub, por ejemplo) para tener respaldo fuera de tu maquina y poder desplegar
  desde ahi (Vercel se conecta directo a un repo de GitHub).
- **Duplicados de conflicto de Drive**: archivos como `page 2.tsx` o `schema 2.sql` eran
  copias viejas que Google Drive genero por conflictos de sincronizacion (normalmente
  porque el mismo archivo se edito en dos lugares casi al mismo tiempo). Rompian
  `tsc`/`next build`. Ya se eliminaron.
- **`node_modules` corrupto** por el mismo motivo (paquetes `@types` duplicados). Se
  reinstalo limpio.
- Se dejo fuera del proyecto (via `.gitignore` y `tsconfig.json`) un CRM interno de ventas
  mas viejo (`app/(dashboard)`, `components/Sidebar.tsx`, `lib/mock-data.ts`,
  `lib/mock-supabase.ts`, `lib/types.ts`, `lib/utils.ts`, `supabase/seed.sql`) que quedo a
  medio hacer, hace referencia a tablas de Supabase (`prospects`, `payments`, `sales`, etc.)
  que no existen en el esquema actual, y no compilaba. Los archivos siguen ahi por si
  quieres rescatar algo, simplemente ya no son parte de la app que corre.

Recomendacion fuerte: en algun momento saca este proyecto de Google Drive y trabaja desde
una carpeta local normal con git + GitHub. Un proyecto de Next.js con miles de archivos
chiquitos en `node_modules` sincronizandose por Drive es fragil - es justo lo que causo los
duplicados y la corrupcion que se arreglaron aqui, y puede volver a pasar.

## Lo que falta para la vision completa

Este build cubre el flujo de captura y venta inicial del reporte, y las cuentas con rol
(admin / agente / cliente) con su panel de negocio para el cliente. Quedan pendientes, como
siguientes pasos, las piezas que requieren decisiones tuyas antes de programarlas (proveedor
de pagos, reglas de comision, etc.):

- Pasarela de pago para cobrar el reporte completo y dividir la comision entre tu y el
  agente que hizo la visita (hoy el boton de "solicitar reporte completo" solo abre un
  WhatsApp de contacto para cerrar la venta a mano). Ya quedo elegido MercadoPago como
  proveedor, consistente con el sitio en produccion - falta conectar llaves reales.
- Automatizacion mensual de correos personalizados segun las banderas capturadas (ej. si
  `menu_actualizado` sale en falso, ofrecer el servicio de rediseno de menu)
- Universidad Foodie: contenido de capacitacion, solicitud de acceso y cobro de la
  certificacion para operar como agente MysterFoodie
- Calculo de comisiones por agente (ya queda guardado que agente registro cada visita via
  `forms.created_by` y `/mis-visitas`, falta la logica de calculo y pago)

Las tablas de `clients` y `forms` ya quedan listas para conectarse a un panel de reportes
mas adelante (esa parte se puede retomar del scaffold anterior descrito en la memoria del
proyecto).
