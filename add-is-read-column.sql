-- Legg til is_read kolonne i checkins-tabellen
-- Kjør dette manuelt i Neon database console

ALTER TABLE checkins ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT FALSE;

-- Marker alle eksisterende innsjekk som lest (valgfritt)
-- UPDATE checkins SET is_read = TRUE;
