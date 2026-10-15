# MeteoX · Estado de Cloudflare (15/10/2026)

## Preparado y verificado

- La cuenta Cloudflare conectada está accesible.
- D1 `meteo-x-db` creada correctamente.
- UUID de la base: `49428b5a-ba52-4f90-a3af-52f54f19c431` (identificador de recurso, no credencial).
- Tablas `observations` y `station_state` inicializadas, junto con su registro de estado.
- Consulta a D1 verificada: no hay lecturas reales todavía.
- `wrangler.toml` apunta ahora a la base real.
- La web pública continúa en GitHub Pages; los cambios anteriores no modifican la interfaz.

## Pendiente antes de recibir datos reales

1. Disponer del GW1200/WS69 configurado y visible en Ecowitt.net con salida 4G.
2. Configurar en **Cloudflare Workers Secrets** las variables:
   - `ECOWITT_APPLICATION_KEY`
   - `ECOWITT_API_KEY`
   - `ECOWITT_MAC`
   - `ADMIN_TOKEN` (mínimo 24 caracteres aleatorios)
3. Publicar `src/worker.mjs` con Wrangler y el binding `DB`, tal como indica `wrangler.toml`.
4. Verificar `/api/health`, `/api/latest`, la recolección cada 5 minutos y la frescura de los timestamps.
5. Conectar el panel publicado al endpoint HTTPS del Worker. No agregar tokens al repositorio ni a URLs públicas.

**Advertencia:** la creación de D1 no significa que el Worker esté desplegado ni que la estación esté conectada. El panel sigue en simulación hasta completar estas acciones.

## Verificación de cambios

Consultar GitHub Actions: `https://github.com/miqueas80/MeteoX/actions`.

Sin modificaciones de otros Workers Cloudflare como los de NEXUS-X.
