# MysterFoodie 1.0.0: notas del release

Fecha: 7 de noviembre de 2026. Es la primera versión oficial de la app (app.mysterfoodie.com) junto con la web pública (mysterfoodie.com). A partir de aquí se trabaja por versiones.

## 1. Qué es el release 1.0

Un release es el momento en que un conjunto de cambios deja de ser trabajo en curso y se declara listo para usarse de verdad. La 1.0 no es una función nueva: es el compromiso de que lo esencial ya funciona de principio a fin, está alineado entre canales y tiene una base de seguridad razonable.

Lo que incluye:

- **Visita completa**: el Shopper (o Sibarita o Master Chef) llena el asistente de 76 indicadores en celular o escritorio, la visita se guarda al instante y se puede retomar si se corta la conexión.
- **Resultado y primer contacto**: el negocio recibe un correo y un enlace corto (`/r/<código>`) con la calificación general y por categoría. La oferta del reporte completo va primero, con el destacado «Incluye asesoría gratuita de 20 minutos», y después el porqué de los indicadores.
- **Reporte completo**: PDF y vista en línea con el detalle de los 76 indicadores, comentarios del MysterFoodie y ticket de consumo.
- **Cobros**: reporte completo ($850 MXN sin IVA), visita programada y perfil anónimo (ID y Passport) con Mercado Pago, todos por una misma función de cobro.
- **Enviar GRATIS en dos toques** para regalar el reporte como demo.
- **Seguimiento automático por correo**, personalizado según lo que se sabe del negocio (ver sección 2).
- **Equipo**: invitación con QR, aspirantes a Shopper, aceptación de términos con casilla de mayoría de edad y, para el equipo, Acuerdo de colaboración individual.
- **Finanzas**: reparto por venta, ganancias de perfiles y el **reporte de ventas mensual** con control de pagos por persona.
- **Seguridad y estabilidad** de la auditoría pre-release (ver sección 4).

## 2. Las bases de la app

**Quién usa qué (roles)**

| Rol en la app | Nombre visible | Qué hace |
|---|---|---|
| `admin` | Master Chef | Todo: negocios, asignaciones, solicitudes, automatizaciones, finanzas y pagos |
| `sibarita` | Sibarita | Vende y gestiona visitas, invita Shoppers, ve sus ganancias |
| `agente` | Shopper | Levanta visitas asignadas o libres y ve sus ganancias |
| `cliente` | Negocio | Ve su propio negocio, sus reportes y compra perfiles |

**Piezas técnicas**

- **App**: Next.js 15.5 (rutas de página y de API) en app.mysterfoodie.com. El `middleware.ts` protege las páginas; cada ruta `/api` valida su propio acceso con `requireRole()`.
- **Base de datos y acceso**: Supabase (Postgres, Auth y Storage). Las tablas tienen RLS activada sin políticas: solo el servidor, con la llave de servicio, lee y escribe. Hay un bucket privado de tickets (con enlaces firmados) y uno público de avatares.
- **Correos**: Resend. Toda plantilla comparte el mismo marco (`renderEmailShell`) y la misma guía de estilo.
- **Pagos**: Mercado Pago. El webhook nunca confía en lo que le mandan: vuelve a consultar el pago a la API de Mercado Pago. Si configuras `MERCADOPAGO_WEBHOOK_SECRET` también valida la firma.
- **PDF**: pdfkit. **Calendario de asesorías**: Google Calendar. **Enlaces cortos**: go.mysterfoodie.com.
- **Web pública**: sitio estático generado con `python3 _src/build.py` y subido a cPanel; los textos legales y de marca viven ahí y la app solo los enlaza.

**Automatizaciones (crons de Supabase: pg_cron + pg_net, header `x-cron-secret`)**

`plan-visitas`, `followup-emails`, `ticket-emails`, `perfil-oferta`, `recordatorios-reporte`, `perfil-anonimo`, `vip-negocios`, `solicitudes-vencidas`, `activar-cuenta-negocio` y el nuevo `reporte-mensual` (días 1 a 3 de cada mes, 9:00 am CDMX).

**Fuentes de verdad** (en el proyecto de Claude, «Myster Foodie»): guía de estilo de comunicación, metodología, términos y aceptación, seguridad, proceso de venta y VIP, auditoría pre-release y reporte mensual de pagos.

**Reglas que no se rompen**

- Frente al negocio: «ustedes» y «un MysterFoodie»; con personas: «tú».
- Flanco Izquierdo® siempre con ®. El término «mystery shopper» solo en textos legales y de aclaración.
- Los textos de Automatizaciones viven en la base de datos: un cambio de redacción en el código no basta, se propaga con un SQL.
- Lo que se muestra al equipo y al negocio sale de las mismas constantes (precio, 76 indicadores, colores de avisos).

## 3. Lo que normalmente pasa en un release

1. **Congelar el alcance.** Se decide qué entra y se dejan de agregar funciones; solo se aceptan correcciones.
2. **Verificar.** Compilar, probar los flujos críticos de punta a punta (visita, correo, pago de prueba, reporte, pago al equipo) y revisar seguridad y dependencias.
3. **Numerar la versión.** Se usa versionado semántico: `1.0.0` es la primera estable; `1.0.x` son correcciones; `1.x` son funciones nuevas sin romper lo anterior; `2.0` sería un cambio grande.
4. **Registrar los cambios.** Notas de versión en lenguaje de usuario (aquí, la bitácora de la abejita) y este documento para el equipo.
5. **Publicar.** Subir el código (`git push origin master`), que el hosting construya y despliegue, correr los SQL de base de datos pendientes **antes** de que el código nuevo los use, y confirmar las variables de entorno.
6. **Prueba de humo en producción.** Entrar con cada rol, abrir un reporte público, crear una visita de prueba y revisar que los correos y los cobros respondan.
7. **Vigilar.** Las primeras horas y días: errores en los registros del hosting, correos que rebotan, pagos que no se acreditan, avisos de la CSP.
8. **Plan de reversa.** Poder volver a la versión anterior del código (el hosting guarda despliegues previos); los cambios de base de datos de este release solo agregan, así que no estorban si se regresa.
9. **Comunicar.** Avisar al equipo qué cambió y a quién preguntar; los negocios solo notan mejoras, no tienen que hacer nada.
10. **Después del release.** Se atiende lo que aparezca como `1.0.x` y se ordena el siguiente bloque de mejoras.

## 4. Qué cambió en la auditoría pre-release (resumen)

- Next 15.5.29 (corrige la vulnerabilidad crítica), límite de intentos por IP en formularios públicos, secreto de crons con comparación en tiempo constante.
- `reportes/correo` ya no crea cuentas de negocio con correos sin verificar; consultas con correos escapados.
- Webhook de Mercado Pago con firma opcional, sin duplicar pagos y con verificación del monto.
- Cabecera CSP en modo solo informe.
- Colores y textos alineados; el asistente de visita (escritorio y celular) comparte tipos, borrador y envío.
- La abejita de la bitácora de versiones solo la ve el Master Chef.

## 5. Lista de salida de este release

Antes o junto con el push:

- [ ] `git push origin master` en `develop/admin` (lo hace Luis; no hay credenciales en la sesión de Claude).
- [ ] `npm run build` en la máquina de Luis o dejar que el hosting construya, y revisar que termine sin errores (en la sesión de Claude `tsc --noEmit` pasó limpio, pero el build completo no se pudo correr por tiempo).
- [ ] Variables de entorno: `CRON_SECRET`, `MERCADOPAGO_ACCESS_TOKEN`, `RESEND_API_KEY`, `APP_URL`, y opcional `MERCADOPAGO_WEBHOOK_SECRET` (clave secreta de la app en el panel de Mercado Pago > Webhooks).
- [ ] SQL en producción: ya corridos `mayoria_edad`, `acuerdo_colaboracion` y `pagos_mensuales` (con su cron).
- [ ] `npm audit fix` en la máquina de Luis (quedan `sharp` y `source-map-js` en alto; `postcss`/`next` moderado dependen de Next 16).

Prueba de humo (10 minutos):

- [ ] Invitar a un Shopper nuevo (3 casillas) y a un negocio (2 casillas).
- [ ] Levantar una visita desde celular y otra desde escritorio; Enviar GRATIS en dos toques.
- [ ] Abrir `/r/<código>`: oferta arriba, «Incluye 20 minutos», indicadores y Palabra MysterFoodie en viñetas.
- [ ] Pago de prueba en Mercado Pago y comprobar que se desbloquea el reporte y llega el PDF.
- [ ] `/finanzas/pagos?mes=2026-10` → Generar reporte de octubre y revisar las cifras; marcar una palomita y ver el aviso en el Inicio de esa persona.
- [ ] Consola del navegador: revisar avisos de CSP y, si todo está limpio, pasar `Content-Security-Policy-Report-Only` a `Content-Security-Policy` en `next.config.mjs`.

Limpieza pendiente:

- Borrar los zips de despliegue viejos en cPanel (`mf-web-deploy-*`) y en la carpeta local, y las carpetas `node_modules_borrar_manual` y `_to_delete` cuando ya no hagan falta.

## 6. Lo que sigue (después de la 1.0)

- Un solo punto de entrada «Invitar» (usuarios, QR, aspirantes, cuenta de negocio).
- Domicilio, ocupación y tiempos en los nuevos servicios; llamada y pedido misterioso; presencia digital; automatización con Google Maps/Places.
- Límite de intentos en base de datos si el hosting es serverless; subir a Next 16 en una ventana de pruebas.
- Revisión legal en curso: Acuerdo de colaboración, cesión, confidencialidad, datos personales y registro de la marca ante el IMPI.
