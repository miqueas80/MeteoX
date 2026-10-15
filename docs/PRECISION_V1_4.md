# MeteoX v1.4 — Precisión y continuidad operativa

Esta entrega mejora las mediciones de Agua y el diagnóstico de Meteorología. Se conserva la interfaz principal y las funciones anteriores, sin activar bombas ni válvulas.

## Tanques calibrados y geometría

Al registrar un tanque real, se elige una forma:

- **Sección uniforme (predeterminada):** depósito rectangular o cilindro vertical. Los litros son proporcionales a la altura de agua.
- **Cilindro horizontal:** barril/tanque cilíndrico acostado. Los litros se calculan por **área del segmento circular**, usando el nivel normalizado entre las posiciones VACÍO y LLENO del sensor.

La capacidad en litros, `empty_cm` y `full_cm` se miden físicamente. La fórmula horizontal supone que el sensor detecta la altura real de la superficie, que el tanque es cilíndrico y que la calibración cubre toda la altura del tanque. Se ignora la curvatura de tapas y accesorios; la geometría irregular necesita tabla de calibración volumétrica. Las medidas de ultrasonido también pueden verse afectadas por condensación, espuma o movimiento del agua. No usar la lectura como dispositivo de seguridad.

La API sigue respondiendo `percent` como **porcentaje de volumen**; también calcula `height_percent` como porcentaje de altura en lecturas nuevas. Para tanques existentes, `geometry='linear'` se conserva sin modificar valores históricos.

## Historial completo con muestreo de intervalos

Antes, en 7 días de una ESP32 informando cada 30 segundos había hasta 20.160 puntos por depósito. Una consulta `LIMIT 2100` recuperaba solamente las muestras finales del período.

Ahora `/api/water/history?hours=168` agrupa muestras por intervalos de tiempo de duración adaptativa y selecciona la **última lectura de cada intervalo**, manteniendo distribución a lo largo de todo el rango. La respuesta incluye `sampling_interval_ms` para que el cliente conozca la resolución. No se realizan promedios que disimulen una medición real.

## Diagnóstico conservador de Ecowitt

Si Ecowitt no proporciona una marca de tiempo comprobable del sensor, `/api/health` devuelve `source_age_verifiable:false`, `sensor_time_unverified:true` y `stale:true`, aunque el servidor haya recibido datos hace segundos. **Recepción reciente no prueba frescura física.**

## Migración segura de D1

- **Instalación nueva:** usar `schema.sql`.
- **Instalación existente v1.3:** **respaldar la base** y correr sólo una vez:
  `npx wrangler d1 execute meteo-x-db --remote --file=./migrations/003_tank_geometry.sql`
- La columna añadida es `water_tanks.geometry TEXT NOT NULL DEFAULT 'linear'`, con valores permitidos `linear` y `horizontal_cylinder`.

No ejecutar de nuevo `003_tank_geometry.sql` si la columna ya existe. Asegurarse de que la migración esté aplicada **antes de desplegar el Worker v1.4**. Los datos existentes y tokens no se modifican.

La nueva versión NO conecta hardware por arte de magia: el servidor Worker, sus claves y los ensayos Ecowitt/ESP32 requieren configuración cuando se reciba el equipo.

## Validación

`npm test` y sintaxis Node en CI. Las pruebas adicionales cubren geometría simétrica, compatibilidad vertical, calibración inválida, resolución de histórico y frescura no verificable. No se cargan secretos en el repositorio.

© MeteoX — Desarrollo de software, no controlador industrial certificado.
