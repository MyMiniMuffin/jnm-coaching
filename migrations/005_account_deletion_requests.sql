CREATE TABLE IF NOT EXISTS account_deletion_requests (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT UNIQUE REFERENCES users(id) ON DELETE SET NULL,
  contact_email TEXT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);
