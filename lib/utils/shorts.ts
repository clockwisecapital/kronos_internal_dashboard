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
  '2x': ['QID', 'SDS', 'DXD'],              // Double leveraged inverse (added DXD for DOW)
  '1x': ['SARK', 'PSQ', 'SH', 'DOG']        // Single leveraged inverse (added DOG for DOW)
} as const

/**
 * Map of which underlying index each inverse ETF shorts
 * Used to calculate per-stock effective short exposure
 */
export const INVERSE_ETF_INDEX_MAP = {
  QQQ: ['SQQQ', 'QID', 'PSQ'],      // Nasdaq 100 inverse ETFs
  SPY: ['SPXU', 'SDS', 'SH'],       // S&P 500 inverse ETFs
  DOW: ['SDOW', 'DXD', 'DOG'],      // Dow Jones inverse ETFs
  SOXX: ['SOXS'],                    // Semiconductor inverse ETFs
  ARKK: ['SARK']                     // ARK Innovation inverse ETFs
} as const

/**
 * Total effective shorts by index category
 */
export interface IndexShortTotals {
  qqq: number
  spy: number
  dow: number
  soxx: number
  arkk: number
}

/**
 * Stock's weights in each index (for calculating effective short exposure)
 */
export interface StockWeights {
  qqq?: number | null
  spy?: number | null
  dow?: number | null
  soxx?: number | null
  smh?: number | null
  arkk?: number | null
}

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

/**
 * Calculate total effective shorts by index category
 * 
 * This function sums up all inverse ETF positions and categorizes them
 * by the underlying index they short.
 * 
 * @param holdings - Array of holdings with ticker and weight
 * @returns Object with total effective shorts for each index
 * 
 * @example
 * const holdings = [
 *   { ticker: 'SQQQ', weight: 2.0 },  // 2% × 3x = 6% QQQ shorts
 *   { ticker: 'SPXU', weight: 1.0 },  // 1% × 3x = 3% SPY shorts
 *   { ticker: 'AAPL', weight: 10.0 }  // Not an inverse ETF
 * ]
 * calculateIndexShortTotals(holdings)
 * // Returns: { qqq: 6, spy: 3, dow: 0, soxx: 0, arkk: 0 }
 */
export function calculateIndexShortTotals(
  holdings: Array<{ ticker: string; weight: number }>
): IndexShortTotals {
  const totals: IndexShortTotals = {
    qqq: 0,
    spy: 0,
    dow: 0,
    soxx: 0,
    arkk: 0
  }

  holdings.forEach(holding => {
    const effectiveShort = calculateShorts(holding.ticker, holding.weight)
    if (effectiveShort === null) return

    const ticker = holding.ticker.toUpperCase().trim()
    
    // Categorize by underlying index
    if (INVERSE_ETF_INDEX_MAP.QQQ.includes(ticker as any)) {
      totals.qqq += effectiveShort
    } else if (INVERSE_ETF_INDEX_MAP.SPY.includes(ticker as any)) {
      totals.spy += effectiveShort
    } else if (INVERSE_ETF_INDEX_MAP.DOW.includes(ticker as any)) {
      totals.dow += effectiveShort
    } else if (INVERSE_ETF_INDEX_MAP.SOXX.includes(ticker as any)) {
      totals.soxx += effectiveShort
    } else if (INVERSE_ETF_INDEX_MAP.ARKK.includes(ticker as any)) {
      totals.arkk += effectiveShort
    }
  })

  return totals
}

/**
 * Individual inverse ETF contributions to a stock's short position
 */
export interface InverseETFContributions {
  // QQQ inverse ETFs
  sqqq: number
  qid: number
  psq: number
  // SPY inverse ETFs
  spxu: number
  sds: number
  sh: number
  // DOW inverse ETFs
  sdow: number
  dxd: number
  dog: number
  // Other inverse ETFs
  soxs: number
  sark: number
}

/**
 * Calculate individual inverse ETF contributions to a stock's effective short
 * Shows each inverse ETF's specific contribution to this stock
 * 
 * @param holdings - All portfolio holdings with weights
 * @param stockWeights - This stock's weights in each index
 * @returns Individual contribution from each inverse ETF
 */
export function calculateInverseETFContributions(
  holdings: Array<{ ticker: string; weight: number }>,
  stockWeights: StockWeights
): InverseETFContributions {
  const contributions: InverseETFContributions = {
    sqqq: 0,
    qid: 0,
    psq: 0,
    spxu: 0,
    sds: 0,
    sh: 0,
    sdow: 0,
    dxd: 0,
    dog: 0,
    soxs: 0,
    sark: 0
  }

  holdings.forEach(holding => {
    const ticker = holding.ticker.toUpperCase().trim()
    const effectiveShort = calculateShorts(ticker, holding.weight)
    
    if (effectiveShort === null) return

    // QQQ inverse ETFs - multiply by stock's QQQ weight
    const qqqFactor = (stockWeights.qqq || 0) / 100
    if (ticker === 'SQQQ') contributions.sqqq = effectiveShort * qqqFactor
    else if (ticker === 'QID') contributions.qid = effectiveShort * qqqFactor
    else if (ticker === 'PSQ') contributions.psq = effectiveShort * qqqFactor
    
    // SPY inverse ETFs - multiply by stock's SPY weight
    const spyFactor = (stockWeights.spy || 0) / 100
    if (ticker === 'SPXU') contributions.spxu = effectiveShort * spyFactor
    else if (ticker === 'SDS') contributions.sds = effectiveShort * spyFactor
    else if (ticker === 'SH') contributions.sh = effectiveShort * spyFactor
    
    // DOW inverse ETFs - multiply by stock's DOW weight
    const dowFactor = (stockWeights.dow || 0) / 100
    if (ticker === 'SDOW') contributions.sdow = effectiveShort * dowFactor
    else if (ticker === 'DXD') contributions.dxd = effectiveShort * dowFactor
    else if (ticker === 'DOG') contributions.dog = effectiveShort * dowFactor
    
    // SOXX inverse ETF - multiply by stock's SOXX weight
    const soxxFactor = ((stockWeights.soxx || stockWeights.smh) || 0) / 100
    if (ticker === 'SOXS') contributions.soxs = effectiveShort * soxxFactor
    
    // SARK inverse ETF - multiply by stock's ARKK weight
    const arkkFactor = (stockWeights.arkk || 0) / 100
    if (ticker === 'SARK') contributions.sark = effectiveShort * arkkFactor
  })

  return contributions
}

/**
 * Calculate effective short exposure for a specific stock
 * 
 * This implements the client formula: F×G + K×L + P×Q + R×S + T×U
 * Where each term = (index shorts total) × (stock's weight in that index / 100)
 * 
 * @param indexShortTotals - Total effective shorts by index (from calculateIndexShortTotals)
 * @param stockWeights - Stock's weights in each index (as percentages from weightings table)
 * @returns Effective short exposure as percentage points
 * 
 * @example
 * const shortTotals = { qqq: 10.5, spy: 5.0, dow: 0, soxx: 0, arkk: 0 }
 * const stockWeights = { qqq: 8.8, spy: 7.8, dow: null, soxx: null, arkk: null }
 * calculateStockEffectiveShort(shortTotals, stockWeights)
 * // Returns: (10.5 × 0.088) + (5.0 × 0.078) = 0.924 + 0.390 = 1.314%
 */
export function calculateStockEffectiveShort(
  indexShortTotals: IndexShortTotals,
  stockWeights: StockWeights
): number {
  return calculateStockEffectiveShortBreakdown(indexShortTotals, stockWeights).total
}

/**
 * Breakdown of effective short exposure per index category
 */
export interface ShortBreakdown {
  qqq: number
  spy: number
  dow: number
  soxx: number
  arkk: number
  total: number
}

/**
 * Calculate effective short breakdown for a stock (F×G + K×L + ... )
 */
export function calculateStockEffectiveShortBreakdown(
  indexShortTotals: IndexShortTotals,
  stockWeights: StockWeights
): ShortBreakdown {
  const breakdown: ShortBreakdown = {
    qqq: 0,
    spy: 0,
    dow: 0,
    soxx: 0,
    arkk: 0,
    total: 0
  }

  if (stockWeights.qqq !== null && stockWeights.qqq !== undefined) {
    breakdown.qqq = indexShortTotals.qqq * (stockWeights.qqq / 100)
  }

  if (stockWeights.spy !== null && stockWeights.spy !== undefined) {
    breakdown.spy = indexShortTotals.spy * (stockWeights.spy / 100)
  }

  if (stockWeights.dow !== null && stockWeights.dow !== undefined) {
    breakdown.dow = indexShortTotals.dow * (stockWeights.dow / 100)
  }

  const semiWeight = stockWeights.soxx || stockWeights.smh
  if (semiWeight !== null && semiWeight !== undefined) {
    breakdown.soxx = indexShortTotals.soxx * (semiWeight / 100)
  }

  if (stockWeights.arkk !== null && stockWeights.arkk !== undefined) {
    breakdown.arkk = indexShortTotals.arkk * (stockWeights.arkk / 100)
  }

  breakdown.total = breakdown.qqq + breakdown.spy + breakdown.dow + breakdown.soxx + breakdown.arkk
  return breakdown
}
