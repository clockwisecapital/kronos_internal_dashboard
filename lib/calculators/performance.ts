/**
 * Performance Calculation Utilities
 * Handles return and contribution calculations for the Performance Tab
 */

import { 
  fetchPriceNDaysAgo, 
  fetchPriceCalendarDaysAgo,
  fetchPriceEndOfLastQuarter, 
  fetchPriceEndOfLastYear,
  isTradingDay
} from '@/lib/services/yahooFinance'

export interface HoldingPerformance {
  ticker: string
  weight: number
  
  // Returns (%)
  return_1d: number
  return_5d: number
  return_30d: number
  return_90d: number
  return_1yr: number
  return_qtd: number
  return_ytd: number
}

/**
 * Calculate return between two prices
 * Formula: (Current Price / Previous Price - 1) * 100
 */
export function calculateReturn(currentPrice: number, previousPrice: number): number {
  if (previousPrice === 0 || !previousPrice) return 0
  return ((currentPrice / previousPrice) - 1) * 100
}

/**
 * Calculate performance metrics for a single holding across all time periods
 */
export async function calculateHoldingPerformance(
  ticker: string,
  currentPrice: number,
  weight: number,
  marketState?: string
): Promise<HoldingPerformance> {
  try {
    console.log(`Calculating performance for ${ticker} (weight: ${weight.toFixed(2)}%)`)
    
    // Fetch historical prices in parallel for efficiency
    // Use TRADING days for 1-day and 5-day
    // Use CALENDAR days for 30-day, 90-day, and 1-year
    const [price1DayAgo, price5DaysAgo, price30DaysAgo, price90DaysAgo, price365DaysAgo, priceEndOfLastQuarter, priceEndOfLastYear] = await Promise.all([
      fetchPriceNDaysAgo(ticker, 1),           // 1 TRADING day
      fetchPriceNDaysAgo(ticker, 5),           // 5 TRADING days
      fetchPriceCalendarDaysAgo(ticker, 30),   // 30 CALENDAR days
      fetchPriceCalendarDaysAgo(ticker, 90),   // 90 CALENDAR days
      fetchPriceCalendarDaysAgo(ticker, 365),  // 365 CALENDAR days (1 year)
      fetchPriceEndOfLastQuarter(ticker),
      fetchPriceEndOfLastYear(ticker)
    ])
    
    // Calculate returns for each period
    let return_1d = price1DayAgo ? calculateReturn(currentPrice, price1DayAgo) : 0
    
    // If today is not a trading day (weekend/holiday), 1-day return should be 0
    if (marketState && !isTradingDay(marketState)) {
      return_1d = 0
    }
    
    const return_5d = price5DaysAgo ? calculateReturn(currentPrice, price5DaysAgo) : 0
    const return_30d = price30DaysAgo ? calculateReturn(currentPrice, price30DaysAgo) : 0
    const return_90d = price90DaysAgo ? calculateReturn(currentPrice, price90DaysAgo) : 0
    const return_1yr = price365DaysAgo ? calculateReturn(currentPrice, price365DaysAgo) : 0
    const return_qtd = priceEndOfLastQuarter ? calculateReturn(currentPrice, priceEndOfLastQuarter) : 0
    const return_ytd = priceEndOfLastYear ? calculateReturn(currentPrice, priceEndOfLastYear) : 0
    
    console.log(`${ticker}: 1D=${return_1d.toFixed(2)}%`)
    
    return {
      ticker,
      weight,
      return_1d,
      return_5d,
      return_30d,
      return_90d,
      return_1yr,
      return_qtd,
      return_ytd
    }
  } catch (error) {
    console.error(`Error calculating performance for ${ticker}:`, error)
    
    // Return zero values on error
    return {
      ticker,
      weight,
      return_1d: 0,
      return_5d: 0,
      return_30d: 0,
      return_90d: 0,
      return_1yr: 0,
      return_qtd: 0,
      return_ytd: 0
    }
  }
}

/**
 * Calculate performance for all holdings in parallel (with rate limiting)
 * Processes holdings in batches to avoid overwhelming the API
 */
export async function calculateAllHoldingsPerformance(
  holdings: Array<{ ticker: string; currentPrice: number; weight: number; marketState?: string }>,
  batchSize: number = 5
): Promise<HoldingPerformance[]> {
  const results: HoldingPerformance[] = []
  
  // Process in batches to avoid API rate limits
  for (let i = 0; i < holdings.length; i += batchSize) {
    const batch = holdings.slice(i, i + batchSize)
    
    console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(holdings.length / batchSize)}`)
    
    const batchResults = await Promise.all(
      batch.map(h => calculateHoldingPerformance(h.ticker, h.currentPrice, h.weight, h.marketState))
    )
    
    results.push(...batchResults)
    
    // Small delay between batches to be respectful to Yahoo Finance API
    if (i + batchSize < holdings.length) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }
  
  return results
}
