-- Tidspunkt for siste passordbytte. Tokens utstedt før dette avvises.
-- Kjør før funksjonene som leser password_changed_at publiseres.
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ;
