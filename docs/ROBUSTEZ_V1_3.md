# MeteoX v1.3 — Robustez rural (software)

No se reescribe el panel meteorológico ni se sustituye la lectura de Ecowitt. Estas mejoras se prueban sin estación física.

## Protecciones y mantenimiento

- **Lecturas ESP32:** máximo una medición por tanque cada 30 segundos. La condición y el guardado se realizan en una sola sentencia SQLite, evitando que solicitudes simultáneas se cuelen entre un SELECT y un INSERT.
- **Rotación de credenciales:** la pantalla Agua incluye **Renovar clave ESP32** para el tanque seleccionado (modo real). Requiere token de administrador y confirmación. La API es `POST /api/water/tanks/<ID>/rotate-token`; devuelve un nuevo token una sola vez y revoca el anterior. **Es obligatorio actualizar el token dentro de la ESP32 tras la rotación**.
- **Retención:** el cron de las 00:00 UTC elimina lecturas de agua de más de 180 días, independientemente de que Ecowitt esté conectado.
- **Datos antiguos:** el total de litros se identifica como **estimado** y advierte si alguna lectura tiene más de 15 minutos. Los datos guardados pueden borrarse desde el navegador sin borrar los registros D1.
- **Sin actuadores:** deliberadamente no se permiten comandos que enciendan bombas, abran válvulas o accionen relés a distancia.

## Verificación

El flujo GitHub Actions comprueba los módulos Node y la sintaxis de ambos scripts de Agua. `npm test` incluye las pruebas de meteorología, calibración, claves, protección de API y nuevas pruebas de concurrencia, retención y renovación de claves.

La consulta de la API requiere Cloudflare Worker desplegado, D1 enlazada, `ADMIN_TOKEN` seguro y configuración física de Ecowitt/ESP32. Ninguna clave se debe incluir en GitHub.

## Límites físicos reales

Las distancias ultrasónicas pueden ser erróneas con espuma, ondas, condensación o mala alineación. Los litros calculados linealmente sólo son válidos para depósitos de sección horizontal constante (por ejemplo, cilindro **vertical**): barriles horizontales y recipientes irregulares necesitan curva de volumen/calibración. No hay validación de precisión, red móvil, energía nocturna o meses de funcionamiento continuo hasta recibir equipo.

**Entrega:** mejora de software; todavía no se certifica como sistema industrial de control de bombas.
