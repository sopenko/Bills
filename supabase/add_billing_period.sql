-- Add billing_period column to bills table
ALTER TABLE bills ADD COLUMN IF NOT EXISTS billing_period TEXT;

-- Add comment for documentation
COMMENT ON COLUMN bills.billing_period IS 'The service period this bill covers (e.g., Jan 15 - Feb 14, 2025)';
