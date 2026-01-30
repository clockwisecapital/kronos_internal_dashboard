-- Create sync_history table to log all Google Drive syncs
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS sync_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  sync_type VARCHAR(50) NOT NULL, -- 'manual', 'scheduled'
  file_type VARCHAR(50) NOT NULL, -- 'holdings', 'weightings', 'factset', 'all'
  status VARCHAR(20) NOT NULL, -- 'success', 'partial', 'failed'
  files_synced JSONB, -- Array of {file, tab, rowsProcessed, status, error?}
  total_rows INTEGER DEFAULT 0,
  duration_ms INTEGER, -- How long the sync took
  error_message TEXT,
  triggered_by VARCHAR(100), -- 'user@email.com' or 'cron'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_sync_history_sync_date ON sync_history(sync_date DESC);
CREATE INDEX IF NOT EXISTS idx_sync_history_file_type ON sync_history(file_type);
CREATE INDEX IF NOT EXISTS idx_sync_history_status ON sync_history(status);

-- Add RLS policies (if needed)
ALTER TABLE sync_history ENABLE ROW LEVEL SECURITY;

-- Allow ANYONE to read sync history (no auth required for this dashboard)
CREATE POLICY "Allow anyone to read sync history"
  ON sync_history
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Allow service role to insert/update sync history
CREATE POLICY "Allow service role to insert sync history"
  ON sync_history
  FOR INSERT
  TO service_role
  WITH CHECK (true);

COMMENT ON TABLE sync_history IS 'Logs all Google Drive sync operations for audit trail and monitoring';
