-- Coach profiles are opt-in: a user creates one once, then flips
-- users.active_mode to switch their whole account between personal and coach views.
CREATE TYPE account_mode AS ENUM ('personal', 'coach');

CREATE TABLE coach_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE users ADD COLUMN active_mode account_mode NOT NULL DEFAULT 'personal';
