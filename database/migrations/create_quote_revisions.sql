-- Create quote_revisions table for audit trail
-- This table stores historical snapshots of quotes AND quote_dates before they are modified

CREATE TABLE IF NOT EXISTS quote_revisions (
  id BIGSERIAL PRIMARY KEY,
  quote_id VARCHAR(50) NOT NULL,
  revision_number INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  modified_by VARCHAR(255),
  change_reason TEXT,

  -- Snapshot of quote data at time of revision
  quote_snapshot JSONB NOT NULL,

  -- Snapshot of quote_dates data at time of revision
  quote_dates_snapshot JSONB NOT NULL,

  -- Summary of what changed in quotes table
  quote_changes JSONB,

  -- Summary of what changed in quote_dates table
  quote_dates_changes JSONB,

  -- Operation type: 'schedule_change', 'financial_change', 'full_update'
  operation_type VARCHAR(50) DEFAULT 'full_update'
);

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_quote_revisions_quote_id ON quote_revisions(quote_id);
CREATE INDEX IF NOT EXISTS idx_quote_revisions_created_at ON quote_revisions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quote_revisions_operation_type ON quote_revisions(operation_type);
CREATE UNIQUE INDEX IF NOT EXISTS idx_quote_revisions_unique ON quote_revisions(quote_id, revision_number);

-- Add revision tracking fields to quotes table
ALTER TABLE quotes
ADD COLUMN IF NOT EXISTS revision_number INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_modified_by VARCHAR(255),
ADD COLUMN IF NOT EXISTS last_modified_at TIMESTAMP WITH TIME ZONE;

-- Add revision tracking fields to quote_dates table
ALTER TABLE quote_dates
ADD COLUMN IF NOT EXISTS revision_number INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_modified_by VARCHAR(255),
ADD COLUMN IF NOT EXISTS last_modified_at TIMESTAMP WITH TIME ZONE;

-- Add comments for documentation
COMMENT ON TABLE quote_revisions IS 'Stores historical snapshots of quotes and quote_dates for audit trail and change tracking';
COMMENT ON COLUMN quote_revisions.quote_snapshot IS 'Complete quote state as JSON before the change';
COMMENT ON COLUMN quote_revisions.quote_dates_snapshot IS 'Complete quote_dates state as JSON before the change';
COMMENT ON COLUMN quote_revisions.quote_changes IS 'Summary of what fields changed in quotes table';
COMMENT ON COLUMN quote_revisions.quote_dates_changes IS 'Summary of what fields changed in quote_dates table';
COMMENT ON COLUMN quote_revisions.operation_type IS 'Type of operation: schedule_change, financial_change, or full_update';
