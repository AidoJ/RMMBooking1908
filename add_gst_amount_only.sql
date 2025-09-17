-- Add only the missing gst_amount field to quotes table
-- (duration_minutes already exists)

ALTER TABLE quotes
ADD COLUMN gst_amount DECIMAL(10,2);

-- Add comment explaining the field
COMMENT ON COLUMN quotes.gst_amount IS 'GST amount (10%) auto-calculated from final amount';