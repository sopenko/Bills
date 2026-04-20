-- Add user_id column and enable Row Level Security
-- Run this in the Supabase SQL Editor

-- Step 1: Add user_id column to bills table
ALTER TABLE bills ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);

-- Step 2: Enable Row Level Security
ALTER TABLE bills ENABLE ROW LEVEL SECURITY;

-- Step 3: Create policies for authenticated users

-- Policy: Users can only view their own bills
CREATE POLICY "Users can view own bills" ON bills
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can insert bills with their own user_id
CREATE POLICY "Users can insert own bills" ON bills
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own bills
CREATE POLICY "Users can update own bills" ON bills
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own bills
CREATE POLICY "Users can delete own bills" ON bills
  FOR DELETE
  USING (auth.uid() = user_id);

-- Note: After running this migration:
-- 1. Create an account in the app
-- 2. Existing bills won't have a user_id, so they won't be visible
-- 3. To assign existing bills to your user, run:
--    UPDATE bills SET user_id = 'YOUR_USER_UUID_HERE' WHERE user_id IS NULL;
--
-- You can find your user UUID in the Supabase dashboard under Authentication > Users
