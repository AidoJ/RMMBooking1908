-- Pricing System Database Schema Extensions
-- This script adds pricing, discount, and gift card functionality
-- Execute these in order after backing up your database

-- ==================================
-- 1. EXTEND BOOKINGS TABLE
-- ==================================

-- Add pricing fields to bookings table
ALTER TABLE bookings 
ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS tax_rate_amount DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS net_price DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS discount_code VARCHAR(50),
ADD COLUMN IF NOT EXISTS gift_card_code VARCHAR(50),
ADD COLUMN IF NOT EXISTS gift_card_amount DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS quote_only BOOLEAN DEFAULT FALSE;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_bookings_discount_code ON bookings(discount_code);
CREATE INDEX IF NOT EXISTS idx_bookings_gift_card_code ON bookings(gift_card_code);
CREATE INDEX IF NOT EXISTS idx_bookings_quote_only ON bookings(quote_only);

-- ==================================
-- 2. DISCOUNT CODES TABLE
-- ==================================

CREATE TABLE IF NOT EXISTS discount_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) UNIQUE NOT NULL,
  description TEXT,
  discount_type VARCHAR(20) NOT NULL CHECK (discount_type IN ('fixed_amount', 'percentage')),
  discount_value DECIMAL(10,2) NOT NULL,
  minimum_order_amount DECIMAL(10,2) DEFAULT 0,
  maximum_discount_amount DECIMAL(10,2),
  usage_limit INTEGER DEFAULT NULL, -- NULL = unlimited
  usage_count INTEGER DEFAULT 0,
  valid_from TIMESTAMP DEFAULT NOW(),
  valid_until TIMESTAMP,
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES admin_users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_discount_codes_code ON discount_codes(code);
CREATE INDEX IF NOT EXISTS idx_discount_codes_active ON discount_codes(is_active, valid_from, valid_until);

-- ==================================
-- 3. GIFT CARDS TABLE
-- ==================================

CREATE TABLE IF NOT EXISTS gift_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) UNIQUE NOT NULL,
  initial_balance DECIMAL(10,2) NOT NULL,
  current_balance DECIMAL(10,2) NOT NULL,
  purchaser_name VARCHAR(100),
  purchaser_email VARCHAR(255),
  recipient_name VARCHAR(100),
  recipient_email VARCHAR(255),
  message TEXT,
  expires_at TIMESTAMP,
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES admin_users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_gift_cards_code ON gift_cards(code);
CREATE INDEX IF NOT EXISTS idx_gift_cards_active ON gift_cards(is_active, expires_at);
CREATE INDEX IF NOT EXISTS idx_gift_cards_balance ON gift_cards(current_balance);

-- ==================================
-- 4. GIFT CARD TRANSACTIONS TABLE
-- ==================================

CREATE TABLE IF NOT EXISTS gift_card_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gift_card_id UUID NOT NULL REFERENCES gift_cards(id),
  booking_id UUID REFERENCES bookings(id),
  transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('purchase', 'redemption', 'refund', 'expiry')),
  amount DECIMAL(10,2) NOT NULL,
  balance_before DECIMAL(10,2) NOT NULL,
  balance_after DECIMAL(10,2) NOT NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_gift_card_transactions_gift_card ON gift_card_transactions(gift_card_id);
CREATE INDEX IF NOT EXISTS idx_gift_card_transactions_booking ON gift_card_transactions(booking_id);

-- ==================================
-- 5. SYSTEM SETTINGS FOR PRICING
-- ==================================

-- Add GST/tax settings to system_settings
INSERT INTO system_settings (key, value) VALUES
('tax_rate_percentage', '10.0'), -- 10% GST
('tax_included_in_prices', 'false'), -- prices are ex-GST
('currency_code', 'AUD'),
('currency_symbol', '$'),
('gift_card_expiry_months', '24'), -- 2 years default
('discount_code_case_sensitive', 'false')
ON CONFLICT (key) DO NOTHING;

-- ==================================
-- 6. DISCOUNT CODE USAGE TRACKING
-- ==================================

CREATE TABLE IF NOT EXISTS discount_code_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discount_code_id UUID NOT NULL REFERENCES discount_codes(id),
  booking_id UUID NOT NULL REFERENCES bookings(id),
  customer_email VARCHAR(255),
  discount_applied DECIMAL(10,2) NOT NULL,
  used_at TIMESTAMP DEFAULT NOW()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_discount_usage_code ON discount_code_usage(discount_code_id);
CREATE INDEX IF NOT EXISTS idx_discount_usage_booking ON discount_code_usage(booking_id);
CREATE INDEX IF NOT EXISTS idx_discount_usage_email ON discount_code_usage(customer_email);

-- ==================================
-- 7. UPDATE TRIGGERS
-- ==================================

-- Update timestamp triggers for new tables
CREATE OR REPLACE FUNCTION update_timestamp_trigger()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to discount_codes
DROP TRIGGER IF EXISTS update_discount_codes_timestamp ON discount_codes;
CREATE TRIGGER update_discount_codes_timestamp
    BEFORE UPDATE ON discount_codes
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp_trigger();

-- Apply to gift_cards  
DROP TRIGGER IF EXISTS update_gift_cards_timestamp ON gift_cards;
CREATE TRIGGER update_gift_cards_timestamp
    BEFORE UPDATE ON gift_cards
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp_trigger();

-- ==================================
-- 8. SAMPLE DATA (Optional - for testing)
-- ==================================

-- Sample discount codes
INSERT INTO discount_codes (code, description, discount_type, discount_value, minimum_order_amount, usage_limit, valid_until) VALUES
('WELCOME10', '10% off first booking', 'percentage', 10.00, 50.00, NULL, NOW() + INTERVAL '1 year'),
('SAVE20', '$20 off bookings over $100', 'fixed_amount', 20.00, 100.00, NULL, NOW() + INTERVAL '6 months'),
('NEWCLIENT', '$15 off for new clients', 'fixed_amount', 15.00, 0.00, 100, NOW() + INTERVAL '3 months')
ON CONFLICT (code) DO NOTHING;

-- Sample gift card
INSERT INTO gift_cards (code, initial_balance, current_balance, purchaser_name, purchaser_email) VALUES
('GIFT2025001', 100.00, 100.00, 'Test User', 'test@example.com')
ON CONFLICT (code) DO NOTHING;

-- ==================================
-- 9. PRICING CALCULATION VIEWS
-- ==================================

-- View to get booking totals with all pricing components
CREATE OR REPLACE VIEW booking_pricing_summary AS
SELECT 
    b.id,
    b.booking_id,
    b.price as gross_price,
    b.discount_amount,
    b.gift_card_amount,
    b.tax_rate_amount,
    b.net_price,
    (b.price - COALESCE(b.discount_amount, 0)) as price_after_discount,
    ((b.price - COALESCE(b.discount_amount, 0)) * (COALESCE(b.tax_rate_amount, 0) / 100)) as calculated_tax,
    (b.price - COALESCE(b.discount_amount, 0) - COALESCE(b.gift_card_amount, 0)) as amount_due,
    dc.code as discount_code_used,
    dc.discount_type,
    dc.discount_value as discount_code_value,
    gc.code as gift_card_used,
    gc.current_balance as gift_card_balance
FROM bookings b
LEFT JOIN discount_codes dc ON b.discount_code = dc.code
LEFT JOIN gift_cards gc ON b.gift_card_code = gc.code;

COMMENT ON VIEW booking_pricing_summary IS 'Complete pricing breakdown for bookings including discounts, tax, and gift cards';

-- ==================================
-- 10. VALIDATION FUNCTIONS
-- ==================================

-- Function to validate discount code
CREATE OR REPLACE FUNCTION validate_discount_code(
    code_to_check VARCHAR(50),
    order_amount DECIMAL(10,2) DEFAULT 0
)
RETURNS TABLE(
    is_valid BOOLEAN,
    discount_amount DECIMAL(10,2),
    message TEXT
) AS $$
DECLARE
    discount_record discount_codes%ROWTYPE;
    calculated_discount DECIMAL(10,2) := 0;
BEGIN
    -- Find the discount code
    SELECT * INTO discount_record 
    FROM discount_codes 
    WHERE (CASE 
        WHEN (SELECT value FROM system_settings WHERE key = 'discount_code_case_sensitive') = 'true' 
        THEN code = code_to_check
        ELSE UPPER(code) = UPPER(code_to_check)
    END)
    AND is_active = TRUE;
    
    -- Check if code exists
    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 0.00::DECIMAL(10,2), 'Invalid discount code'::TEXT;
        RETURN;
    END IF;
    
    -- Check if code is within validity period
    IF discount_record.valid_from > NOW() THEN
        RETURN QUERY SELECT FALSE, 0.00::DECIMAL(10,2), 'Discount code not yet valid'::TEXT;
        RETURN;
    END IF;
    
    IF discount_record.valid_until IS NOT NULL AND discount_record.valid_until < NOW() THEN
        RETURN QUERY SELECT FALSE, 0.00::DECIMAL(10,2), 'Discount code has expired'::TEXT;
        RETURN;
    END IF;
    
    -- Check usage limit
    IF discount_record.usage_limit IS NOT NULL AND discount_record.usage_count >= discount_record.usage_limit THEN
        RETURN QUERY SELECT FALSE, 0.00::DECIMAL(10,2), 'Discount code usage limit reached'::TEXT;
        RETURN;
    END IF;
    
    -- Check minimum order amount
    IF order_amount < discount_record.minimum_order_amount THEN
        RETURN QUERY SELECT FALSE, 0.00::DECIMAL(10,2), 
            'Order must be at least $' || discount_record.minimum_order_amount::TEXT || ' to use this code'::TEXT;
        RETURN;
    END IF;
    
    -- Calculate discount
    IF discount_record.discount_type = 'percentage' THEN
        calculated_discount := order_amount * (discount_record.discount_value / 100);
    ELSE
        calculated_discount := discount_record.discount_value;
    END IF;
    
    -- Apply maximum discount limit if set
    IF discount_record.maximum_discount_amount IS NOT NULL 
       AND calculated_discount > discount_record.maximum_discount_amount THEN
        calculated_discount := discount_record.maximum_discount_amount;
    END IF;
    
    RETURN QUERY SELECT TRUE, calculated_discount, 'Discount code valid'::TEXT;
END;
$$ LANGUAGE plpgsql;

-- Function to validate gift card
CREATE OR REPLACE FUNCTION validate_gift_card(
    code_to_check VARCHAR(50)
)
RETURNS TABLE(
    is_valid BOOLEAN,
    available_balance DECIMAL(10,2),
    message TEXT
) AS $$
DECLARE
    card_record gift_cards%ROWTYPE;
BEGIN
    -- Find the gift card
    SELECT * INTO card_record 
    FROM gift_cards 
    WHERE UPPER(code) = UPPER(code_to_check)
    AND is_active = TRUE;
    
    -- Check if card exists
    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 0.00::DECIMAL(10,2), 'Invalid gift card code'::TEXT;
        RETURN;
    END IF;
    
    -- Check if card has expired
    IF card_record.expires_at IS NOT NULL AND card_record.expires_at < NOW() THEN
        RETURN QUERY SELECT FALSE, 0.00::DECIMAL(10,2), 'Gift card has expired'::TEXT;
        RETURN;
    END IF;
    
    -- Check if card has balance
    IF card_record.current_balance <= 0 THEN
        RETURN QUERY SELECT FALSE, 0.00::DECIMAL(10,2), 'Gift card has no remaining balance'::TEXT;
        RETURN;
    END IF;
    
    RETURN QUERY SELECT TRUE, card_record.current_balance, 'Gift card valid'::TEXT;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION validate_discount_code IS 'Validates discount codes and calculates discount amount';
COMMENT ON FUNCTION validate_gift_card IS 'Validates gift cards and returns available balance';

-- ==================================
-- COMPLETION MESSAGE
-- ==================================

DO $$
BEGIN
    RAISE NOTICE 'Pricing system database schema has been successfully created/updated!';
    RAISE NOTICE 'Tables created: discount_codes, gift_cards, gift_card_transactions, discount_code_usage';
    RAISE NOTICE 'Bookings table extended with pricing fields';
    RAISE NOTICE 'System settings updated with tax/pricing configuration';
    RAISE NOTICE 'Helper functions and views created for pricing calculations';
END $$;