CREATE TABLE IF NOT EXISTS water_tanks (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, capacity_l REAL NOT NULL,
 empty_cm REAL NOT NULL, full_cm REAL NOT NULL, low_pct REAL NOT NULL DEFAULT 20,
 token_hash TEXT NOT NULL, created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS water_readings (
 tank_id TEXT NOT NULL REFERENCES water_tanks(id), ts INTEGER NOT NULL,
 distance_cm REAL NOT NULL, percent REAL NOT NULL, liters REAL NOT NULL,
 battery_v REAL, PRIMARY KEY(tank_id,ts)
);
CREATE INDEX IF NOT EXISTS idx_water_readings_tank_ts ON water_readings(tank_id,ts DESC);
