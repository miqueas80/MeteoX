# MeteoX Agua · ESP32 + ultrasonido + 4G

MeteoX ahora tiene dos módulos: **Meteorología** (Ecowitt) y **Agua** (ESP32 + sensor ultrasónico). Comparten la PWA, un servidor Cloudflare Worker y D1. La interfaz meteorológica conserva sus controles actuales.

## Funcionalidad

- Simulación de tres depósitos sin hardware (etiquetada como SIMULACIÓN).
- Modo real con varios tanques: porcentaje, litros estimados, hora de lectura, aviso de nivel bajo y advertencia después de 15 minutos sin datos.
- Históricos de 6, 24 o 168 horas, gráfico y CSV.
- Registro de depósitos con capacidad, calibración de sensor y umbral.
- Una clave distinta por ESP32 y tanque; en D1 solo se almacena hash SHA-256.
- No hay comandos para bombas ni válvulas.

## Instalación D1 (solo una vez)

Para la base `meteo-x-db` ya existente aplicar `migrations/002_water.sql`. En instalaciones nuevas, `schema.sql` ya contiene las tablas.

```sh
npx wrangler d1 execute meteo-x-db --remote --file=./migrations/002_water.sql
```

Esto añade exclusivamente `water_tanks` y `water_readings`; no modifica `observations` ni `station_state` de Ecowitt.

## Flujo

`ESP32 → Wi-Fi router 4G → HTTPS Worker → D1 → panel MeteoX`

El dispositivo debe enviar lecturas con TLS validado. No necesita IP pública ni abrir puertos del router 4G.

1. En la web abrir **Agua → Conexión → ESP32 real**. Cargar la URL HTTPS del Worker y el `ADMIN_TOKEN` configurado en el Worker.
2. Seleccionar **Agregar tanque**. Ingresar nombre, capacidad en litros y distancia entre sensor y agua cuando el tanque está vacío y lleno.
3. Guardar el identificador y **token exclusivo del dispositivo**, que se muestran una sola vez.
4. Programar la ESP32 para enviar un JSON al endpoint con un intervalo de 1–5 minutos:

```http
POST /api/water/ingest/<ID_DEL_TANQUE>
Authorization: Bearer <TOKEN_DEL_DISPOSITIVO>
Content-Type: application/json

{"distance_cm": 58.2, "battery_v": 4.1}
```

La API convierte la distancia en porcentaje con `(distancia_vacio - distancia_actual)/(distancia_vacio - distancia_lleno)` y calcula litros = porcentaje × capacidad. Se rechazan lecturas fuera de calibración ±10 cm y más de una por 30 segundos. `battery_v` es opcional.

**Precauciones:** litros estimados por altura solo son proporcionales en depósitos de sección constante (por ejemplo, cilindros verticales). Barriles horizontales necesitan una curva de calibración volumétrica. Un HC-SR04 común no es impermeable y sus 5 V de señal ECHO no deben conectarse directamente a GPIO de 3,3 V en ESP32. El hardware final sigue pendiente de presupuesto. No existe todavía una función de recuperación/rotación de tokens.

## Endpoints (requieren autenticación)

- `GET /api/water/tanks`: listado y estado (ADMIN_TOKEN).
- `POST /api/water/tanks`: alta, ID y token por única vez (ADMIN_TOKEN).
- `GET /api/water/history?tank=<ID>&hours=24`: histórico hasta 7 días (ADMIN_TOKEN).
- `POST /api/water/ingest/<ID>`: lectura ultrasónica (token del dispositivo).

El backend habilita CORS para `https://miqueas80.github.io` y nunca expone las claves Ecowitt por el frontend.

El modo real **requiere desplegar Worker y configurar credenciales**. No se ha conectado una ESP32 física. Los avisos no son controles de seguridad industrial ni activan relés o bombas.
