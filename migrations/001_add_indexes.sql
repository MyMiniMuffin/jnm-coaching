-- Performance indexes for frequently queried columns
-- Run this against your Neon PostgreSQL database

-- Checkins: user_id + created_at for sorted lookups
CREATE INDEX IF NOT EXISTS idx_checkins_user_created ON checkins(user_id, created_at DESC);

-- Checkins: user_id + is_read for unread count in coach dashboard
CREATE INDEX IF NOT EXISTS idx_checkins_user_is_read ON checkins(user_id, is_read) WHERE is_read = false;

-- Gallery images: user_id for filtered lookups
CREATE INDEX IF NOT EXISTS idx_gallery_images_user_id ON gallery_images(user_id);

-- Coaching periods: user_id for filtered lookups
CREATE INDEX IF NOT EXISTS idx_coaching_periods_user_id ON coaching_periods(user_id);

-- Users: username for login lookups
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
