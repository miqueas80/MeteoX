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

-- Extensión Agua: en bases existentes aplicar migrations/002_water.sql
CREATE TABLE IF NOT EXISTS water_tanks (id TEXT PRIMARY KEY,name TEXT NOT NULL,capacity_l REAL NOT NULL,empty_cm REAL NOT NULL,full_cm REAL NOT NULL,geometry TEXT NOT NULL DEFAULT 'linear' CHECK (geometry IN ('linear','horizontal_cylinder')),low_pct REAL NOT NULL DEFAULT 20,token_hash TEXT NOT NULL,created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS water_readings (tank_id TEXT NOT NULL REFERENCES water_tanks(id),ts INTEGER NOT NULL,distance_cm REAL NOT NULL,percent REAL NOT NULL,liters REAL NOT NULL,battery_v REAL,PRIMARY KEY(tank_id,ts));
CREATE INDEX IF NOT EXISTS idx_water_readings_tank_ts ON water_readings(tank_id,ts DESC);
