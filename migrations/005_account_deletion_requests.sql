CREATE TABLE IF NOT EXISTS account_deletion_requests (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT UNIQUE REFERENCES users(id) ON DELETE SET NULL,
  contact_email TEXT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_account_deletion_requests_pending
  ON account_deletion_requests(requested_at) WHERE completed_at IS NULL;
