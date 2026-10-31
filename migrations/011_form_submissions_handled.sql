-- Coach marks a form submission as handled (shown under "Behandlet" in the app).
ALTER TABLE form_submissions ADD COLUMN IF NOT EXISTS handled_at TIMESTAMPTZ;
