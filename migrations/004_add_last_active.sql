-- Kjør før aktivitetsindikatoren publiseres.
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ;
