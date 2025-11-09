-- Create short_links table for URL shortening
CREATE TABLE IF NOT EXISTS short_links (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  short_code VARCHAR(10) NOT NULL UNIQUE,
  original_url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  click_count INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Indexes
  CONSTRAINT short_code_length CHECK (length(short_code) >= 4)
);

-- Create index for fast lookups
CREATE INDEX idx_short_links_short_code ON short_links(short_code);
CREATE INDEX idx_short_links_expires_at ON short_links(expires_at);

-- Enable RLS
ALTER TABLE short_links ENABLE ROW LEVEL SECURITY;

-- RLS Policies (allow service role full access)
CREATE POLICY "Service role can manage short links"
  ON short_links
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Public can read (for redirects)
CREATE POLICY "Public can read short links"
  ON short_links
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Comment
COMMENT ON TABLE short_links IS 'URL shortening for SMS links and other shortened URLs';
