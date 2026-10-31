-- Public form submissions (coaching application, client onboarding).
-- Replaces Netlify Forms after the move to Oracle (Netlify stored them for us).
CREATE TABLE IF NOT EXISTS form_submissions (
  id BIGSERIAL PRIMARY KEY,
  form_name TEXT NOT NULL,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source TEXT NOT NULL DEFAULT 'web'
);
