-- Atskilt fra 014: Neon HTTP kjører én SQL-setning per forespørsel.
CREATE UNIQUE INDEX IF NOT EXISTS idx_checkins_user_idempotency_key
  ON checkins(user_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
