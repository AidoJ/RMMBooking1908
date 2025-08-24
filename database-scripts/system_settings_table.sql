-- System Settings Table for Therapist Fee Management
-- This table stores configurable system-wide settings including therapist hourly rates

CREATE TABLE IF NOT EXISTS system_settings (
  id SERIAL PRIMARY KEY,
  setting_key VARCHAR(100) UNIQUE NOT NULL,
  setting_value DECIMAL(10,2),
  setting_type VARCHAR(20) DEFAULT 'decimal',
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default therapist rate settings
INSERT INTO system_settings (setting_key, setting_value, setting_type, description) VALUES
('therapist_rate_business_hours', 90.00, 'decimal', 'Therapist hourly rate during business hours (Mon-Fri 9AM-5PM)'),
('therapist_rate_after_hours', 105.00, 'decimal', 'Therapist hourly rate for after hours and weekends'),
('business_hours_start', 9, 'integer', 'Business hours start time (24-hour format)'),
('business_hours_end', 17, 'integer', 'Business hours end time (24-hour format)')
ON CONFLICT (setting_key) DO NOTHING;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_system_settings_key ON system_settings(setting_key);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_system_settings_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_system_settings_timestamp ON system_settings;
CREATE TRIGGER update_system_settings_timestamp
    BEFORE UPDATE ON system_settings
    FOR EACH ROW
    EXECUTE PROCEDURE update_system_settings_timestamp();