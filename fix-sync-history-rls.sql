-- Fix RLS policy to allow reading sync history
-- Run this in Supabase SQL Editor

-- Drop the old policy
DROP POLICY IF EXISTS "Allow authenticated users to read sync history" ON sync_history;

-- Create new policy that allows anyone to read (including anon role)
CREATE POLICY "Allow anyone to read sync history"
  ON sync_history
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Verify it worked
SELECT * FROM sync_history ORDER BY sync_date DESC LIMIT 5;
