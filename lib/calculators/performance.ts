/**
 * Performance Calculation Utilities
 * Handles return and contribution calculations for the Performance Tab
 */

import { fetchPriceNDaysAgo, fetchPriceEndOfLastYear } from '@/lib/services/yahooFinance'

export interface HoldingPerformance {
  ticker: string
  weight: number
  
  // Returns (%)
  return_1d: number
  return_5d: number
  return_30d: number
  return_ytd: number
  
  // Contributions (%)
  contribution_1d: number
  contribution_5d: number
  contribution_30d: number
  contribution_ytd: number
}

export interface PortfolioTotals {
  total_contribution_1d: number
  total_contribution_5d: number
  total_contribution_30d: number
  total_contribution_ytd: number
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
 * Calculate contribution to portfolio
 * Formula: (Weight / 100) * Return
 */
export function calculateContribution(weightPct: number, returnPct: number): number {
  return (weightPct / 100) * returnPct
}

/**
 * Calculate performance metrics for a single holding across all time periods
 */
export async function calculateHoldingPerformance(
  ticker: string,
  currentPrice: number,
  weight: number
): Promise<HoldingPerformance> {
  try {
    console.log(`Calculating performance for ${ticker} (weight: ${weight.toFixed(2)}%)`)
    
    // Fetch historical prices in parallel for efficiency
    const [price1DayAgo, price5DaysAgo, price30DaysAgo, priceEndOfLastYear] = await Promise.all([
      fetchPriceNDaysAgo(ticker, 1),
      fetchPriceNDaysAgo(ticker, 5),
      fetchPriceNDaysAgo(ticker, 30),
      fetchPriceEndOfLastYear(ticker)
    ])
    
    // Calculate returns for each period
    const return_1d = price1DayAgo ? calculateReturn(currentPrice, price1DayAgo) : 0
    const return_5d = price5DaysAgo ? calculateReturn(currentPrice, price5DaysAgo) : 0
    const return_30d = price30DaysAgo ? calculateReturn(currentPrice, price30DaysAgo) : 0
    const return_ytd = priceEndOfLastYear ? calculateReturn(currentPrice, priceEndOfLastYear) : 0
    
    // Calculate contributions to portfolio
    const contribution_1d = calculateContribution(weight, return_1d)
    const contribution_5d = calculateContribution(weight, return_5d)
    const contribution_30d = calculateContribution(weight, return_30d)
    const contribution_ytd = calculateContribution(weight, return_ytd)
    
    console.log(`${ticker}: 1D=${return_1d.toFixed(2)}%, Contrib=${contribution_1d.toFixed(3)}%`)
    
    return {
      ticker,
      weight,
      return_1d,
      return_5d,
      return_30d,
      return_ytd,
      contribution_1d,
      contribution_5d,
      contribution_30d,
      contribution_ytd
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
      return_ytd: 0,
      contribution_1d: 0,
      contribution_5d: 0,
      contribution_30d: 0,
      contribution_ytd: 0
    }
  }
}

/**
 * Calculate portfolio totals by summing all contributions
 */
export function calculatePortfolioTotals(holdings: HoldingPerformance[]): PortfolioTotals {
  return {
    total_contribution_1d: holdings.reduce((sum, h) => sum + h.contribution_1d, 0),
    total_contribution_5d: holdings.reduce((sum, h) => sum + h.contribution_5d, 0),
    total_contribution_30d: holdings.reduce((sum, h) => sum + h.contribution_30d, 0),
    total_contribution_ytd: holdings.reduce((sum, h) => sum + h.contribution_ytd, 0)
  }
}

/**
 * Calculate performance for all holdings in parallel (with rate limiting)
 * Processes holdings in batches to avoid overwhelming the API
 */
export async function calculateAllHoldingsPerformance(
  holdings: Array<{ ticker: string; currentPrice: number; weight: number }>,
  batchSize: number = 5
): Promise<HoldingPerformance[]> {
  const results: HoldingPerformance[] = []
  
  // Process in batches to avoid API rate limits
  for (let i = 0; i < holdings.length; i += batchSize) {
    const batch = holdings.slice(i, i + batchSize)
    
    console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(holdings.length / batchSize)}`)
    
    const batchResults = await Promise.all(
      batch.map(h => calculateHoldingPerformance(h.ticker, h.currentPrice, h.weight))
    )
    
    results.push(...batchResults)
    
    // Small delay between batches to be respectful to Yahoo Finance API
    if (i + batchSize < holdings.length) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }
  
  return results
}
