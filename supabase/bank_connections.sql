-- Bank Connections Table for Plaid Integration
-- Run this in the Supabase SQL Editor

CREATE TABLE bank_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id text NOT NULL UNIQUE,
  access_token text NOT NULL,
  institution_name text NOT NULL,
  institution_id text,
  created_at timestamptz DEFAULT now()
);

-- Disable RLS for simplicity (or add policies as needed)
ALTER TABLE bank_connections DISABLE ROW LEVEL SECURITY;

-- Index for faster lookups
CREATE INDEX idx_bank_connections_item_id ON bank_connections(item_id);
