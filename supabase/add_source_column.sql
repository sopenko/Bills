-- Add source and source_document columns to bills table
-- Run this in the Supabase SQL Editor

-- Add source column (tracks where the bill came from)
ALTER TABLE bills ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual';

-- Add source_document column (tracks the specific file/connection name)
ALTER TABLE bills ADD COLUMN IF NOT EXISTS source_document text;

-- Update existing paid bills to mark as bank_statement (since those likely came from imports)
UPDATE bills SET source = 'bank_statement' WHERE paid = true AND source = 'manual';

-- Source values:
-- 'manual' - Manually entered bills
-- 'bank_statement' - Imported from PDF bank statement
-- 'credit_card' - Imported from credit card statement
-- 'invoice' - Imported from PDF invoice
-- 'plaid' - Imported via Plaid bank connection

-- source_document stores:
-- For bank_statement/credit_card/invoice: the PDF filename
-- For plaid: the bank/institution name
