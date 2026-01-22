/**
 * Yahoo Finance Cache Service
 * 
 * Caches historical price data in Supabase to reduce API calls and improve performance
 * Cache TTL: 24 hours (historical prices don't change)
 */

import { createServiceRoleClient } from '@/app/utils/supabase/service-role'
import { fetchHistoricalPricesForScoring } from './yahooFinance'

interface CachedPriceData {
  ticker: string
  current_price: number
  price_30d_ago: number | null
  price_90d_ago: number | null
  price_365d_ago: number | null
  max_drawdown: number | null
  fetched_at: string
  updated_at: string
}

const CACHE_TTL_HOURS = 24
const FAILED_TICKER_CACHE = new Map<string, number>() // ticker -> timestamp when it failed
const FAILED_TICKER_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours in milliseconds

/**
 * Initialize cache table if it doesn't exist
 * This function is safe to call multiple times
 */
export async function initializeCacheTable(): Promise<void> {
  const supabase = createServiceRoleClient()
  
  // Check if table exists by trying to query it
  const { error } = await supabase
    .from('yahoo_price_cache')
    .select('ticker')
    .limit(1)
  
  if (error && error.message.includes('does not exist')) {
    console.log('⚠️  yahoo_price_cache table does not exist. Please create it manually in Supabase.')
    console.log('SQL to create table:')
    console.log(`
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

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_yahoo_cache_updated_at ON public.yahoo_price_cache(updated_at);

-- Enable RLS (optional, depends on your security requirements)
ALTER TABLE public.yahoo_price_cache ENABLE ROW LEVEL SECURITY;

-- Policy to allow service role full access
CREATE POLICY "Allow service role full access" ON public.yahoo_price_cache
  FOR ALL USING (true) WITH CHECK (true);
    `)
  }
}

/**
 * Check if cached data is still valid (within TTL)
 */
function isCacheValid(updatedAt: string): boolean {
  const cacheDate = new Date(updatedAt)
  const now = new Date()
  const hoursSinceUpdate = (now.getTime() - cacheDate.getTime()) / (1000 * 60 * 60)
  
  return hoursSinceUpdate < CACHE_TTL_HOURS
}

/**
 * Fetch historical prices with caching
 * - Checks cache first
 * - Only fetches missing/stale tickers from Yahoo
 * - Updates cache with fresh data
 */
export async function fetchHistoricalPricesWithCache(
  tickers: string[]
): Promise<Map<string, {
  currentPrice: number
  price30DaysAgo: number | null
  price90DaysAgo: number | null
  price365DaysAgo: number | null
  maxDrawdown: number | null
}>> {
  const supabase = createServiceRoleClient()
  const results = new Map()
  
  // Normalize tickers to uppercase
  const normalizedTickers = tickers.map(t => t.toUpperCase())
  
  // Filter out known failed tickers (404s that we've seen before)
  const now = Date.now()
  const tickersToFetch = normalizedTickers.filter(ticker => {
    const failedAt = FAILED_TICKER_CACHE.get(ticker)
    if (failedAt && (now - failedAt) < FAILED_TICKER_TTL_MS) {
      // Ticker failed recently, skip it and return zeros
      results.set(ticker, {
        currentPrice: 0,
        price30DaysAgo: null,
        price90DaysAgo: null,
        price365DaysAgo: null,
        maxDrawdown: null
      })
      return false
    }
    return true
  })
  
  const skippedCount = normalizedTickers.length - tickersToFetch.length
  if (skippedCount > 0) {
    console.log(`   ⏭️  Skipped ${skippedCount} tickers (known 404s)`)
  }
  
  console.log(`📊 Fetching prices for ${tickersToFetch.length} tickers (with caching)`)
  
  // Step 1: Try to fetch from cache
  const { data: cachedData, error: cacheError } = await supabase
    .from('yahoo_price_cache')
    .select('*')
    .in('ticker', tickersToFetch)
  
  if (cacheError) {
    console.warn('⚠️  Cache read error (falling back to direct fetch):', cacheError.message)
    // If cache doesn't work, fall back to direct fetch
    return await fetchHistoricalPricesWithoutCache(normalizedTickers)
  }
  
  // Step 2: Separate cached (valid) from missing/stale
  const cachedTickers = new Set<string>()
  const staleOrMissing: string[] = []
  
  if (cachedData) {
    for (const row of cachedData) {
      if (isCacheValid(row.updated_at)) {
        // Valid cache hit
        results.set(row.ticker, {
          currentPrice: parseFloat(row.current_price),
          price30DaysAgo: row.price_30d_ago ? parseFloat(row.price_30d_ago) : null,
          price90DaysAgo: row.price_90d_ago ? parseFloat(row.price_90d_ago) : null,
          price365DaysAgo: row.price_365d_ago ? parseFloat(row.price_365d_ago) : null,
          maxDrawdown: row.max_drawdown ? parseFloat(row.max_drawdown) : null
        })
        cachedTickers.add(row.ticker)
      } else {
        // Stale cache entry
        staleOrMissing.push(row.ticker)
      }
    }
  }
  
  // Find tickers not in cache at all
  for (const ticker of tickersToFetch) {
    if (!cachedTickers.has(ticker) && !staleOrMissing.includes(ticker)) {
      staleOrMissing.push(ticker)
    }
  }
  
  console.log(`   ✅ ${cachedTickers.size} tickers from cache (fresh)`)
  console.log(`   🔄 ${staleOrMissing.length} tickers need fetching (missing or stale)`)
  
  // Step 3: Fetch missing/stale tickers from Yahoo
  if (staleOrMissing.length > 0) {
    const freshData = await fetchHistoricalPricesWithoutCache(staleOrMissing)
    
    // Step 4: Update cache with fresh data
    const cacheUpserts: any[] = []
    
    for (const [ticker, data] of freshData.entries()) {
      results.set(ticker, data)
      
      cacheUpserts.push({
        ticker: ticker,
        current_price: data.currentPrice,
        price_30d_ago: data.price30DaysAgo,
        price_90d_ago: data.price90DaysAgo,
        price_365d_ago: data.price365DaysAgo,
        max_drawdown: data.maxDrawdown,
        updated_at: new Date().toISOString()
      })
    }
    
    // Upsert to cache (insert new or update existing)
    if (cacheUpserts.length > 0) {
      const { error: upsertError } = await supabase
        .from('yahoo_price_cache')
        .upsert(cacheUpserts, { onConflict: 'ticker' })
      
      if (upsertError) {
        console.warn('⚠️  Cache write error (data still returned):', upsertError.message)
      } else {
        console.log(`   ✅ Updated cache with ${cacheUpserts.length} fresh entries`)
      }
    }
  }
  
  console.log(`✅ Total: ${results.size} tickers ready`)
  
  return results
}

/**
 * Fetch without cache (fallback or for cache misses)
 * Uses the existing batched fetch from yahooFinance.ts
 */
async function fetchHistoricalPricesWithoutCache(
  tickers: string[]
): Promise<Map<string, {
  currentPrice: number
  price30DaysAgo: number | null
  price90DaysAgo: number | null
  price365DaysAgo: number | null
  maxDrawdown: number | null
}>> {
  const results = new Map()
  
  // Fetch in batches with rate limiting
  const batchSize = 15
  const delayMs = 400
  const batches: string[][] = []
  
  for (let i = 0; i < tickers.length; i += batchSize) {
    batches.push(tickers.slice(i, i + batchSize))
  }
  
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i]
    
    const batchPromises = batch.map(ticker => 
      fetchHistoricalPricesForScoring(ticker)
        .then(data => ({ ticker, data, success: true }))
        .catch(error => {
          // If it's a 404, cache it to avoid retrying
          if (error.message.includes('404')) {
            FAILED_TICKER_CACHE.set(ticker.toUpperCase(), Date.now())
          }
          // console.error(`   Error fetching ${ticker}:`, error.message) // Suppress noise
          return {
            ticker,
            data: {
              currentPrice: 0,
              price30DaysAgo: null,
              price90DaysAgo: null,
              price365DaysAgo: null,
              maxDrawdown: null
            },
            success: false
          }
        })
    )
    
    const batchResults = await Promise.allSettled(batchPromises)
    
    batchResults.forEach(result => {
      if (result.status === 'fulfilled' && result.value) {
        results.set(result.value.ticker, result.value.data)
      }
    })
    
    // Delay between batches
    if (i < batches.length - 1) {
      await new Promise(resolve => setTimeout(resolve, delayMs))
    }
  }
  
  return results
}

/**
 * Clear stale cache entries (older than TTL)
 * Can be run periodically via cron job
 */
export async function clearStaleCache(): Promise<number> {
  const supabase = createServiceRoleClient()
  
  const cutoffDate = new Date()
  cutoffDate.setHours(cutoffDate.getHours() - CACHE_TTL_HOURS)
  
  const { error, count } = await supabase
    .from('yahoo_price_cache')
    .delete()
    .lt('updated_at', cutoffDate.toISOString())
  
  if (error) {
    console.error('Error clearing stale cache:', error)
    return 0
  }
  
  console.log(`Cleared ${count || 0} stale cache entries`)
  return count || 0
}
