/**
 * Inverse ETF Configuration and Calculation Utilities
 * 
 * This file centralizes the logic for calculating leverage-adjusted short exposure
 * from inverse ETFs. Update the INVERSE_ETFS object below to add/remove tickers.
 */

/**
 * Configuration of inverse ETFs by leverage multiplier
 * 
 * To add a new inverse ETF:
 * 1. Add the ticker to the appropriate leverage array
 * 2. The calculation will automatically include it
 * 
 * Examples:
 * - SPXU: 3x inverse S&P 500
 * - SQQQ: 3x inverse Nasdaq 100
 * - QID: 2x inverse Nasdaq 100
 * - SH: 1x inverse S&P 500
 */
export const INVERSE_ETFS = {
  '3x': ['SPXU', 'SQQQ', 'SDOW', 'SOXS'],  // Triple leveraged inverse
  '2x': ['QID', 'SDS'],                     // Double leveraged inverse
  '1x': ['SARK', 'PSQ', 'SH']               // Single leveraged inverse
} as const

/**
 * Calculate leverage-adjusted short exposure for a given ticker
 * 
 * @param ticker - Stock ticker symbol (e.g., 'SQQQ')
 * @param holdingWeight - Portfolio weight as percentage (e.g., 5.0 for 5%)
 * @returns The leverage-adjusted short exposure in percentage points, or null if not an inverse ETF
 * 
 * @example
 * calculateShorts('SQQQ', 5.0)  // Returns 15.0 (5% * 3x leverage)
 * calculateShorts('AAPL', 10.0) // Returns null (not an inverse ETF)
 */
export function calculateShorts(ticker: string, holdingWeight: number): number | null {
  const tickerUpper = ticker.toUpperCase().trim()
  
  // Check 3x leveraged inverse ETFs
  if (INVERSE_ETFS['3x'].includes(tickerUpper as any)) {
    return holdingWeight * 3
  }
  
  // Check 2x leveraged inverse ETFs
  if (INVERSE_ETFS['2x'].includes(tickerUpper as any)) {
    return holdingWeight * 2
  }
  
  // Check 1x inverse ETFs
  if (INVERSE_ETFS['1x'].includes(tickerUpper as any)) {
    return holdingWeight * 1
  }
  
  // Not an inverse ETF
  return null
}

/**
 * Calculate total effective hedge (sum of all shorts exposure) for a portfolio
 * 
 * @param holdings - Array of holdings with ticker and weight
 * @returns Total short exposure as percentage
 * 
 * @example
 * const holdings = [
 *   { ticker: 'SQQQ', weight: 5.0 },
 *   { ticker: 'QID', weight: 2.0 },
 *   { ticker: 'AAPL', weight: 10.0 }
 * ]
 * calculateEffectiveHedge(holdings) // Returns 19.0 (15 + 4 + 0)
 */
export function calculateEffectiveHedge(
  holdings: Array<{ ticker: string; weight: number }>
): number {
  return holdings.reduce((sum, holding) => {
    const shorts = calculateShorts(holding.ticker, holding.weight)
    return shorts !== null ? sum + shorts : sum
  }, 0)
}

/**
 * Check if a ticker is an inverse ETF
 * 
 * @param ticker - Stock ticker symbol
 * @returns true if the ticker is configured as an inverse ETF
 */
export function isInverseETF(ticker: string): boolean {
  return calculateShorts(ticker, 1) !== null
}

/**
 * Get the leverage multiplier for a ticker
 * 
 * @param ticker - Stock ticker symbol
 * @returns The leverage multiplier (1, 2, or 3) or null if not an inverse ETF
 */
export function getLeverageMultiplier(ticker: string): number | null {
  const tickerUpper = ticker.toUpperCase().trim()
  
  if (INVERSE_ETFS['3x'].includes(tickerUpper as any)) return 3
  if (INVERSE_ETFS['2x'].includes(tickerUpper as any)) return 2
  if (INVERSE_ETFS['1x'].includes(tickerUpper as any)) return 1
  
  return null
}

