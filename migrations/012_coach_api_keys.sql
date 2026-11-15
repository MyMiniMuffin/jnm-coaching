-- API keys for the coach API and MCP server (docs/coach-api.md).
-- Only the prefix and a SHA-256 hash of the full key are stored.
CREATE TABLE IF NOT EXISTS coach_api_keys (
  id BIGSERIAL PRIMARY KEY,
  prefix TEXT NOT NULL UNIQUE,
  key_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  scope TEXT NOT NULL DEFAULT 'coach',
  coach_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ
);
