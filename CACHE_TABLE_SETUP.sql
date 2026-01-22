-- Yahoo Finance Price Cache Table
-- Run this SQL in your Supabase SQL Editor to create the cache table

-- Create the cache table
CREATE TABLE IF NOT EXISTS public.yahoo_price_cache (
  ticker TEXT PRIMARY KEY,
  current_price NUMERIC NOT NULL,
  price_30d_ago NUMERIC,
  price_90d_ago NUMERIC,
  price_365d_ago NUMERIC,
  max_drawdown NUMERIC,
  fetched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add index for fast lookups by update time (for cache invalidation)
CREATE INDEX IF NOT EXISTS idx_yahoo_cache_updated_at 
  ON public.yahoo_price_cache(updated_at);

-- Enable Row Level Security (RLS)
ALTER TABLE public.yahoo_price_cache ENABLE ROW LEVEL SECURITY;

-- Create policy to allow service role full access
-- (The service role bypasses RLS, but this is for documentation)
CREATE POLICY "Allow service role full access" 
  ON public.yahoo_price_cache
  FOR ALL 
  USING (true) 
  WITH CHECK (true);

-- Grant permissions to service role (if needed)
GRANT ALL ON public.yahoo_price_cache TO service_role;
GRANT ALL ON public.yahoo_price_cache TO postgres;

-- Verify table creation
SELECT 
  COUNT(*) as total_cached_tickers,
  MAX(updated_at) as most_recent_update
FROM public.yahoo_price_cache;
