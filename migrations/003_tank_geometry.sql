-- MeteoX v1.4: geometry of existing tanks defaults to constant-section.
-- IMPORTANT: Apply once to an existing D1 database; SQLite does not support
-- ADD COLUMN IF NOT EXISTS. New installs already have this field in schema.sql.
ALTER TABLE water_tanks ADD COLUMN geometry TEXT NOT NULL DEFAULT 'linear'
  CHECK (geometry IN ('linear','horizontal_cylinder'));
