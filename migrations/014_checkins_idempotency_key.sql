-- Idempotensnøkkel per utkast, slik at en gjentatt innsending ikke gir dobbel rapport.
-- Kjør før funksjonene som sender idempotency_key publiseres.
ALTER TABLE checkins ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
