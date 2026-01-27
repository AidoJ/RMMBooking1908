-- Migration: Create therapist_reviews table
-- Purpose: Store Google reviews assigned to individual therapists for display in booking form

-- Create the therapist_reviews table
CREATE TABLE IF NOT EXISTS therapist_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    therapist_id UUID NOT NULL REFERENCES therapist_profiles(id) ON DELETE CASCADE,
    reviewer_name VARCHAR(100) NOT NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    review_text TEXT NOT NULL,
    review_date DATE NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups by therapist
CREATE INDEX idx_therapist_reviews_therapist_id ON therapist_reviews(therapist_id);

-- Create index for active reviews ordered by date (for fetching latest 5)
CREATE INDEX idx_therapist_reviews_active_date ON therapist_reviews(therapist_id, is_active, review_date DESC);

-- Enable Row Level Security
ALTER TABLE therapist_reviews ENABLE ROW LEVEL SECURITY;

-- Policy: Allow public read access to active reviews (for booking form)
CREATE POLICY "Allow public read access to active reviews"
    ON therapist_reviews
    FOR SELECT
    USING (is_active = true);

-- Policy: Allow authenticated users (admins) full access
CREATE POLICY "Allow authenticated users full access"
    ON therapist_reviews
    FOR ALL
    USING (auth.role() = 'authenticated');

-- Policy: Allow service role full access (for API operations)
CREATE POLICY "Allow service role full access"
    ON therapist_reviews
    FOR ALL
    USING (auth.role() = 'service_role');

-- Add comment to table
COMMENT ON TABLE therapist_reviews IS 'Stores Google reviews assigned to individual therapists for display in booking form';

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_therapist_reviews_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_therapist_reviews_updated_at
    BEFORE UPDATE ON therapist_reviews
    FOR EACH ROW
    EXECUTE FUNCTION update_therapist_reviews_updated_at();
