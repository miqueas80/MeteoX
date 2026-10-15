-- Fresh installs use this schema. Existing v1 installs must run migrations/001_source_time.sql once.
CREATE TABLE IF NOT EXISTS observations (
  ts INTEGER PRIMARY KEY,
  temp_c REAL, humidity_pct REAL, wind_kmh REAL, gust_kmh REAL,
  wind_dir_deg REAL, rain_daily_mm REAL, rain_rate_mmh REAL,
  pressure_hpa REAL, solar_wm2 REAL, uv_index REAL,
  indoor_c REAL, indoor_humidity_pct REAL, source_ts INTEGER
);
CREATE TABLE IF NOT EXISTS station_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  last_poll_ts INTEGER, last_success_ts INTEGER, last_error TEXT
);
INSERT OR IGNORE INTO station_state (id,last_poll_ts,last_success_ts,last_error)
VALUES (1,NULL,NULL,'Todavía no se recibieron mediciones reales');
