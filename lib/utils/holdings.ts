/**
 * Shared Holdings Utilities
 * Reusable functions for holdings data processing
 */

import { createClient } from '@/app/utils/supabase/server'

/**
 * De-duplicate holdings by ticker symbol
 * Keeps first occurrence of each ticker
 */
export function deduplicateByTicker<T extends { stock_ticker: string }>(
  holdings: T[]
): T[] {
  const uniqueMap = new Map<string, T>()
  
  holdings.forEach(h => {
    if (!uniqueMap.has(h.stock_ticker)) {
      uniqueMap.set(h.stock_ticker, h)
    }
  })
  
  return Array.from(uniqueMap.values())
}

/**
 * Get latest date from holdings table
 */
export async function getLatestHoldingsDate(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<string | null> {
  const { data, error } = await supabase
    .from('holdings')
    .select('date')
    .order('date', { ascending: false })
    .limit(1)
  
  if (error) {
    console.error('Error fetching latest date:', error)
    return null
  }
  
  return data?.[0]?.date || null
}

/**
 * Calculate market value with price fallback chain
 * Priority: realtime_price > current_price > close_price > fallback
 */
export function calculateMarketValue(
  shares: number,
  realtimePrice?: number | null,
  currentPrice?: number | null,
  closePrice?: number | null,
  fallbackMarketValue?: number
): number {
  const effectivePrice = realtimePrice || currentPrice || closePrice
  
  if (effectivePrice && effectivePrice > 0) {
    return effectivePrice * shares
  }
  
  return fallbackMarketValue || 0
}

/**
 * Calculate percentage change between two prices
 */
export function calculatePercentChange(
  currentPrice: number,
  previousPrice: number
): number {
  if (!previousPrice || previousPrice === 0) return 0
  return ((currentPrice / previousPrice) - 1) * 100
}

/**
 * Filter out invalid tickers for API fetching
 * Removes cash, money market funds, and special characters
 */
export function filterValidTickers(tickers: string[]): string[] {
  return tickers.filter(ticker => {
    const upper = ticker.toUpperCase()
    return !upper.includes('CASH') &&
           !upper.includes('MONEY') &&
           !upper.includes('&') &&
           upper !== 'FGXXX' &&
           ticker.length > 0 &&
           ticker.length <= 5
  })
}

/**
 * Check for duplicate tickers and log warnings
 */
export function detectDuplicates<T extends { stock_ticker: string }>(
  holdings: T[]
): Map<string, number> {
  const tickerCounts = new Map<string, number>()
  
  holdings.forEach(h => {
    const count = tickerCounts.get(h.stock_ticker) || 0
    tickerCounts.set(h.stock_ticker, count + 1)
  })
  
  const duplicates = new Map<string, number>()
  tickerCounts.forEach((count, ticker) => {
    if (count > 1) {
      duplicates.set(ticker, count)
    }
  })
  
  if (duplicates.size > 0) {
    const dupeList = Array.from(duplicates.entries())
      .map(([ticker, count]) => `${ticker} (${count}x)`)
      .join(', ')
    console.warn(`⚠️ DUPLICATE TICKERS: ${dupeList}`)
  }
  
  return duplicates
}
