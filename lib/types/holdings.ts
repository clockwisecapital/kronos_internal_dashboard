/**
 * Shared Holdings Types
 * TypeScript interfaces for holdings data across the application
 */

/**
 * Base Holding record from database
 * Matches the structure from Holdings Report CSV
 */
export interface Holding {
  id: string
  date: string
  account: string
  stock_ticker: string
  shares: number
  close_price: number
  current_price?: number | null
  market_value: number
  created_at?: string
}

/**
 * Holding with calculated fields
 * Used in UI display with real-time prices and computed metrics
 */
export interface HoldingWithCalculations extends Holding {
  realtime_price?: number | null
  calculated_market_value: number
  calculated_pct_change: number
  calculated_weight: number
  sp_weight?: number | null
  qqq_weight?: number | null
  avg_index_weight?: number | null
  index_ratio?: number | null
}

/**
 * Portfolio-level metrics
 */
export interface PortfolioMetrics {
  nav: number
  totalCash: number
  cashPercentage: number
  cryptoExposure?: number
  totalShares?: number
  avgWeight?: number
}

/**
 * Performance metrics for TIME portfolio and benchmarks
 */
export interface PerformanceMetrics {
  name: string
  daily: number
  wtd: number
  mtd: number
  ytd: number
}

/**
 * Key metric card data
 */
export interface KeyMetric {
  label: string
  value: string
}

/**
 * Real-time price data from Yahoo Finance
 */
export interface PriceData {
  ticker: string
  currentPrice: number
  currency: string
  change: number
  changePercent: number
  timestamp: Date
  marketState: string
  error?: string
}

/**
 * Standardized API Response format
 */
export interface ApiResponse<T> {
  success: boolean
  data?: T
  message?: string
  error?: string
  timestamp: string
}

/**
 * Portfolio API response data
 */
export interface PortfolioData {
  nav: number
  performance: PerformanceMetrics[]
  keyMetrics: KeyMetric[]
  holdings: Array<{
    ticker: string
    weight: number
  }>
}

/**
 * Prices API response data
 */
export interface PricesResponse {
  success: boolean
  prices: PriceData[]
  timestamp: string
}
