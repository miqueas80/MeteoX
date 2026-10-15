# METEO X v1.3 — Plataforma rural (Meteorología + Agua)

**Conservamos los dos módulos independientes en un mismo sistema:** estación Ecowitt GW1201 y monitoreo de depósitos ESP32. Se mantienen el panel meteorológico y la simulación; el hardware y las credenciales reales siguen pendientes.

**Mejoras v1.3:** escritura de lecturas de agua limitada atómicamente a 30 segundos por dispositivo, renovación de credenciales ESP32 desde Agua y API, eliminación diaria de lecturas de agua con más de 180 días, indicación de total estimado cuando hay datos antiguos y botón para borrar datos guardados en ese navegador. Detalles en [docs/ROBUSTEZ_V1_3.md](docs/ROBUSTEZ_V1_3.md).


METEO X es una **PWA propia** para visualizar mediciones del kit **Ecowitt GW1201 (WS69 + GW1200)** en un campo que dispone de router 4G LTE. Es una entrega de código lista para *pruebas y despliegue*, **no una estación física ya conectada**.

## Repositorio GitHub

Proyecto independiente **MeteoX** (sin copiar material escolar ni código de NEXUS-X). La rama `main` ejecuta 12 pruebas automáticas mediante GitHub Actions en cada cambio. La aplicación **no queda publicada automáticamente** por subir el código: el Worker, la base D1 y las claves privadas requieren la configuración descrita en este README.

Repositorio creado en `miqueas80/MeteoX` y código v1.1 cargado en `main`. Actualmente el repositorio es **público**: no se incluyen claves privadas. Para cambiar su visibilidad, hacerlo desde **Settings → General → Danger Zone → Change repository visibility**. El despliegue de Cloudflare y las credenciales de Ecowitt todavía requieren configuración.

## Qué funciona y qué falta

| Función | Estado comprobado |
|---|---|
| Panel web responsive (celular y PC) | ✅ Probaron los dos tamaños de pantalla en navegador automatizado |
| Simulación con etiqueta visible | ✅ Sin hardware ni claves |
| Temperatura, humedad, viento, lluvia, presión, radiación, UV, rumbo | ✅ Visualización y normalización automatizada |
| Gráficos 6 h / 24 h / 7 días y exportación CSV | ✅ Implementado |
| Servidor Ecowitt Cloud API v3 sobre HTTPS | ✅ Código y pruebas con respuestas simuladas, **sin API real todavía** |
| Cron cada 5 minutos y D1 para almacenar 180 días | ✅ Código; **requiere despliegue en Cloudflare** |
| Identificación de datos antiguos y tiempo de origen del sensor | ✅ Con pruebas automatizadas |
| Últimas lecturas reales guardadas en IndexedDB del mismo dispositivo | ✅ Implementado; falta validación en teléfonos físicos |
| PWA abre el panel sin conexión | ✅ Service Worker implementado; instalar desde HTTPS o localhost |
| Alertas visibles con umbrales ajustables | ✅ No son notificaciones remotas ni alerta de emergencias |
| Estación conectada físicamente y campo con 4G | ⏳ A la espera de hardware, cuentas y cobertura |
| Push/SMS, batería, fuentes, monitoreo de energía | ❌ Fuera de alcance de v1.1 |

No utiliza proveedores de IA, no necesita una ESP32 y no obliga a pagar un backend para la lógica del dispositivo; la consulta remota sí necesita un servicio accesible por Internet. Los límites y condiciones de gratuidad de Cloudflare pueden variar.

## Arquitectura

```
WS69 (exterior; panel solar + pilas) --RF--> GW1200 (5 V USB)
                                              |
                                    Wi-Fi de 2,4 GHz
                                              |
                                      Router LTE + SIM
                                              |
                                     Ecowitt Cloud
                                              |
                             Cloudflare Worker (consulta HTTPS)
                               |                |
                              D1           API segura
                                               |
                                         METEO X PWA
                                               |
                                    Caché IndexedDB local
```

Esta implementación consulta Ecowitt Cloud cada 5 min. No necesita abrir puertos entrantes ni IP pública en la SIM. **Al perder 4G no llegan lecturas nuevas a Cloudflare**. El almacenamiento offline de la PWA sólo conserva lecturas previamente descargadas en cada dispositivo; **no respalda mediciones del sensor en el campo durante cortes**. La capacidad de retención propia del gateway o de Ecowitt Cloud debe verificarse con el equipo real.

### Acerca de la frescura de los datos

Cuando Ecowitt informa `data.outdoor.temperature.time` (y/o otras marcas de tiempo de los sensores principales), METEO X usa la marca más antigua de las principales para evaluar actualidad. Si supera **15 minutos**, el servidor rechaza la muestra como no reciente y muestra el motivo del problema. Si Ecowitt no incluye marcas válidas, el panel indica **«Hora del sensor: No verificable»** y no afirma que esa hora física esté confirmada.

`ts` es la hora de *recepción en nuestro servidor*. `source_ts` es la hora de *origen provista por Ecowitt*. No deben confundirse. Si el celular pierde Internet, el panel anuncia **DATOS GUARDADOS**, no «datos en vivo».

## 1. Probar el panel ahora, sin el equipo

- **Más simple:** abrir el archivo `METEO-X-v1.1-Demo.html` incluido en la entrega. Trae los scripts incrustados para que funcione sin instalación y utiliza lecturas simuladas.
- **En PC, modo desarrollo:** con Python 3 disponible, ejecutar:

```sh
cd METEO-X-v1.1
python3 -m http.server 8080 --directory public
```

Abrir http://localhost:8080 en la PC. Para probarlo en un celular dentro de la misma red Wi-Fi, usar `http://IP_DE_LA_PC:8080`, con el firewall configurado. En HTTP sin HTTPS (excepto localhost), la PWA no se instala ni puede registrar Service Worker por las restricciones del navegador.

Se puede alternar entre demo y estación real en **Ajustes**; esta última no funciona sin el servidor publicado y su clave privada. El archivo de demostración por sí solo **no tiene backend**.

## 2. Publicar METEO X en Cloudflare

Requisitos: PC con Node.js moderno, cuenta de Cloudflare, cuenta Ecowitt.net, estación configurada y conectada en Ecowitt Cloud.

1. Crear una copia de seguridad del proyecto y abrir terminal dentro de `METEO-X-v1.1`.

```sh
npm install
npx wrangler login
npx wrangler d1 create meteo-x-db
```

2. Copiar el identificador `database_id` devuelto y sustituir `REEMPLAZAR_POR_ID_REAL_DE_D1` en `wrangler.toml`.

3. **Instalación nueva** (base nueva/que no viene de v1.0):

```sh
npm run db:init
```

   **Actualización desde v1.0 con D1 ya poblada:** no ejecutar `schema.sql` como migración; antes de desplegar el nuevo Worker, hacer backup y ejecutar **una única vez**:

```sh
npx wrangler d1 execute meteo-x-db --remote --file=./migrations/001_source_time.sql
```

   No correr esa migración si `observations` ya tiene columna `source_ts`.

4. Generar credenciales Ecowitt.net de servidor y localizar la MAC del GW1200 (no compartir por chat). Guardar los secretos únicamente en Workers:

```sh
npx wrangler secret put ECOWITT_APPLICATION_KEY
npx wrangler secret put ECOWITT_API_KEY
npx wrangler secret put ECOWITT_MAC
npx wrangler secret put ADMIN_TOKEN
```

   Para `ADMIN_TOKEN` usar al menos **24 caracteres aleatorios** (no el nombre del proyecto ni una contraseña reutilizada). Todas las API de METEO X que devuelven datos meteorológicos reales exigen el header `Authorization: Bearer <ADMIN_TOKEN>`; la web estática es accesible sin clave.

5. Publicar y abrir el dominio que Wrangler devuelva:

```sh
npm test
npm run deploy
```

6. Abrir la URL HTTPS publicada, tocar **Conectar estación**, elegir *Estación Ecowitt real*, ingresar `ADMIN_TOKEN` y guardar. El navegador solo conserva esta clave en **sessionStorage** mientras la sesión esté abierta. No se pasa por URL, no se escribe en D1 y no se incluye en el repositorio.

7. Verificar que los datos aparezcan primero en la web/app oficial Ecowitt y después en METEO X. El cron corre cada cinco minutos y **Actualizar datos** solicita una consulta manual protegida (máximo una cada 90 segundos). Confirmar con al menos 24 horas de pruebas en el campo.

### Seguridad y datos locales

- **Nunca** commitear `ECOWITT_API_KEY`, `ECOWITT_APPLICATION_KEY`, `ECOWITT_MAC` ni `ADMIN_TOKEN`.
- **No reenviar** enlaces de API Ecowitt completos (incluyen claves en query string).
- El Service Worker cachea solo recursos estáticos: **nunca** respuestas `/api/*`.
- IndexedDB guarda las últimas lecturas reales **sin cifrar**, por lo que otra persona con acceso a ese perfil de navegador podría verlas. En celulares compartidos, usar **Ajustes → Borrar historial local** y cerrar la pestaña para borrar el token de sesión.
- No instalar METEO X con certificados inválidos ni habilitar credenciales cruzadas entre dominios.
- Las alertas no son un sistema de prevención de emergencias; contrastar con el SMN.

## 3. Materiales de campo (pendientes de confirmación)

| Material | Comprobación antes de comprar |
|---|---|
| Kit Ecowitt GW1201 | Debe traer **WS69 + GW1200**, compatibles en frecuencia, garantía y país |
| Router 4G LTE | SIM/operador con señal local, Wi-Fi **2,4 GHz**, **alimentación permanente** |
| SIM + plan de datos | Cobertura y estabilidad reales en la ubicación de instalación |
| Fuente de gateway | 5 V USB (comprobar corriente requerida por la unidad) |
| Alimentación router | Según el modelo; no presumir que funciona con el panel solar del WS69 |
| Mástil, abrazaderas y caja | Proteger la electrónica, instalar WS69 expuesto según manual |
| Energía existente de Jeré | Confirmar paneles, baterías, tensión, respaldo nocturno y potencia disponible |

**No comprar baterías, inversores o paneles nuevos todavía**: primero evaluar la instalación de Jeré. La energía del WS69 es independiente de la requerida por GW1200 y router.

## 4. Pruebas

```sh
npm test
node --check public/storage.js
node --check src/worker.mjs
```

Incluye pruebas para conversión de unidades, marcas de tiempo Ecowitt, muestras congeladas, errores sin filtración de claves, bloqueo de lecturas sin token y limitación de solicitudes repetidas.

Faltan pruebas de conexión real contra API Ecowitt, D1 en una cuenta publicada, señal LTE y energía solar. No presentar el servidor como productivo hasta completarlas.

## 5. Estructura

```
public/index.html          Panel web / PWA
public/storage.js         Caché de últimas lecturas en IndexedDB
public/sw.js              Service Worker para recursos estáticos
src/normalize.mjs         Adaptador Cloud API v3 y validación
src/worker.mjs            API privada, sondeo y almacenamiento
schema.sql                Base D1 para instalaciones nuevas
migrations/001_source_time.sql   Actualización v1.0 → v1.1
wrangler.toml             Despliegue Cloudflare
samples/                  Datos ficticios para pruebas
```

Documentación técnica oficial: [Ecowitt Quick Start](https://www.ecowitt.com/api/quickstart/product?id=299), [Cloudflare D1](https://developers.cloudflare.com/d1/), [Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/).

© METEO X — Código propio para desarrollo y pruebas. No incluye claves ni software privativo del fabricante.