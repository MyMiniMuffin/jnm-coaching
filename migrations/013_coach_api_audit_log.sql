-- Every change made through the coach API/MCP: which key, what, for whom, before and after.
-- athlete_id has no foreign key, so the history survives if the athlete is deleted.
CREATE TABLE IF NOT EXISTS coach_api_audit_log (
  id BIGSERIAL PRIMARY KEY,
  key_id BIGINT REFERENCES coach_api_keys(id) ON DELETE SET NULL,
  key_name TEXT NOT NULL,
  action TEXT NOT NULL,
  athlete_id BIGINT NOT NULL,
  before_value JSONB,
  after_value JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
