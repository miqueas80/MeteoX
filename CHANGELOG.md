# Registro de cambios

## METEO X 1.1 — integración preparada y caché local

- Pasa de 7 a 12 pruebas automáticas.
- Almacena hora real que aporta Ecowitt por sensor (`source_ts`) y distingue cuándo se recibió en el servidor (`ts`).
- Rechaza muestras claramente antiguas (>15 min) para evitar falso «en vivo».
- Serializa el sondeo contra Ecowitt (consulta a lo sumo una cada 90 s).
- Evita guardar lecturas duplicadas cuando el sensor no cambió su marca de tiempo.
- Mensajes de estado «datos guardados» y «hora del sensor no verificable».
- Guarda la última semana de historial real descargado en IndexedDB del navegador; opción de borrado.
- Conserva simulación inequívocamente rotulada y nunca mezcla registros reales con ficticios.
- Refuerza error handling sin exponer URL con credenciales.
- Agrega migración D1 para proyectos v1 existentes.

### Riesgos pendientes

- Conexión a Ecowitt Cloud no validada con dispositivo real.
- Backend Cloudflare no desplegado en cuenta del usuario.
- Respaldo eléctrico y cobertura LTE de la finca desconocidos.
- Notificaciones remotas y captura local durante cortes 4G no implementadas.
