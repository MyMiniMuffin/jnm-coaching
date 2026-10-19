CREATE INDEX IF NOT EXISTS idx_account_deletion_requests_pending
  ON account_deletion_requests(requested_at) WHERE completed_at IS NULL;
