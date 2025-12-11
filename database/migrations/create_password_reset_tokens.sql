-- Password Reset Tokens Table
-- Stores temporary tokens for password reset functionality
-- Tokens expire after 1 hour for security

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Partial unique index: Ensure one active (unused) token per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_token_per_user
  ON password_reset_tokens(user_id)
  WHERE used_at IS NULL;

-- Index for fast token lookups (only unused tokens)
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token
  ON password_reset_tokens(token)
  WHERE used_at IS NULL;

-- Index for cleanup of expired tokens
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires
  ON password_reset_tokens(expires_at);

-- Add comments for documentation
COMMENT ON TABLE password_reset_tokens IS 'Stores temporary password reset tokens that expire after 1 hour';
COMMENT ON COLUMN password_reset_tokens.token IS 'Unique token sent in reset email (should be random and long)';
COMMENT ON COLUMN password_reset_tokens.expires_at IS 'Token expiration time (1 hour from creation)';
COMMENT ON COLUMN password_reset_tokens.used_at IS 'Timestamp when token was used (NULL = unused)';

-- Row Level Security (RLS)
ALTER TABLE password_reset_tokens ENABLE ROW LEVEL SECURITY;

-- Policy: No direct access - only via service role functions
CREATE POLICY "password_reset_tokens_service_role_only"
  ON password_reset_tokens
  FOR ALL
  USING (false);

-- Grant access to service role
GRANT ALL ON password_reset_tokens TO service_role;
