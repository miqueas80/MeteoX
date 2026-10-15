-- Run ONLY if upgrading a v1.0 D1 DB (not if new schema.sql was already applied).
ALTER TABLE observations ADD COLUMN source_ts INTEGER;
