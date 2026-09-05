-- Kjør før funksjonene med den nye innloggingsflyten publiseres.
-- Eksisterende brukere beholder passordet sitt. Nye brukere markeres ved oppretting.
ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT false;
