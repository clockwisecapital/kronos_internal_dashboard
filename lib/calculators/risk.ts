/**
 * Risk Calculation Utilities
 * Calculates portfolio risk metrics: Sharpe Ratio, Volatility, VaR, Max Drawdown
 */

export interface PortfolioSnapshot {
  snapshot_date: string
  nav: number
}

export interface RiskMetrics {
  sharpeRatio: number | null
  annualizedVolatility: number | null
  var95: number | null
  maxDrawdown: number | null
  daysOfData: number
  requiresDays: number
}

/**
 * Calculate daily returns from NAV snapshots
 */
export function calculateDailyReturns(snapshots: PortfolioSnapshot[]): number[] {
  if (snapshots.length < 2) return []
  
  // Sort by date (oldest first)
  const sorted = [...snapshots].sort((a, b) => 
    new Date(a.snapshot_date).getTime() - new Date(b.snapshot_date).getTime()
  )
  
  const returns: number[] = []
  
  for (let i = 1; i < sorted.length; i++) {
    const prevNav = sorted[i - 1].nav
    const currentNav = sorted[i].nav
    
    if (prevNav > 0) {
      const dailyReturn = (currentNav - prevNav) / prevNav
      returns.push(dailyReturn)
    }
  }
  
  return returns
}

/**
 * Calculate Sharpe Ratio
 * Formula: (Mean Daily Return * 252 - Risk-Free Rate) / (Std Dev * sqrt(252))
 */
export function calculateSharpeRatio(
  dailyReturns: number[],
  riskFreeRate: number = 0.05
): number {
  if (dailyReturns.length === 0) return 0
  
  // Calculate mean daily return
  const mean = dailyReturns.reduce((sum, r) => sum + r, 0) / dailyReturns.length
  
  // Calculate standard deviation
  const variance = dailyReturns.reduce(
    (sum, r) => sum + Math.pow(r - mean, 2),
    0
  ) / dailyReturns.length
  const stdDev = Math.sqrt(variance)
  
  // Annualize (252 trading days per year)
  const annualizedReturn = mean * 252
  const annualizedVolatility = stdDev * Math.sqrt(252)
  
  if (annualizedVolatility === 0) return 0
  
  return (annualizedReturn - riskFreeRate) / annualizedVolatility
}

/**
 * Calculate Annualized Volatility
 * Formula: Std Dev(Daily Returns) * sqrt(252) * 100
 */
export function calculateAnnualizedVolatility(dailyReturns: number[]): number {
  if (dailyReturns.length === 0) return 0
  
  // Calculate mean
  const mean = dailyReturns.reduce((sum, r) => sum + r, 0) / dailyReturns.length
  
  // Calculate variance and std dev
  const variance = dailyReturns.reduce(
    (sum, r) => sum + Math.pow(r - mean, 2),
    0
  ) / dailyReturns.length
  const stdDev = Math.sqrt(variance)
  
  // Annualize and convert to percentage
  return stdDev * Math.sqrt(252) * 100
}

/**
 * Calculate Value at Risk (VaR) at 95% confidence level
 * Formula: Mean - (1.645 * Std Dev)
 */
export function calculateVaR95(dailyReturns: number[]): number {
  if (dailyReturns.length === 0) return 0
  
  // Calculate mean
  const mean = dailyReturns.reduce((sum, r) => sum + r, 0) / dailyReturns.length
  
  // Calculate standard deviation
  const variance = dailyReturns.reduce(
    (sum, r) => sum + Math.pow(r - mean, 2),
    0
  ) / dailyReturns.length
  const stdDev = Math.sqrt(variance)
  
  // VaR at 95% confidence (1.645 std devs)
  return (mean - (1.645 * stdDev)) * 100
}

/**
 * Calculate Maximum Drawdown
 * Formula: Largest peak-to-trough decline in NAV
 */
export function calculateMaxDrawdown(snapshots: PortfolioSnapshot[]): number {
  if (snapshots.length === 0) return 0
  
  // Sort by date (oldest first)
  const sorted = [...snapshots].sort((a, b) => 
    new Date(a.snapshot_date).getTime() - new Date(b.snapshot_date).getTime()
  )
  
  let peak = sorted[0].nav
  let maxDrawdown = 0
  
  for (const snapshot of sorted) {
    const nav = snapshot.nav
    
    // Update peak if we hit a new high
    if (nav > peak) {
      peak = nav
    }
    
    // Calculate drawdown from peak
    const drawdown = ((nav - peak) / peak) * 100
    
    // Track the maximum (most negative) drawdown
    if (drawdown < maxDrawdown) {
      maxDrawdown = drawdown
    }
  }
  
  return maxDrawdown
}

/**
 * Calculate all risk metrics from portfolio snapshots
 * Returns null for metrics if insufficient data
 */
export function calculateRiskMetrics(
  snapshots: PortfolioSnapshot[],
  minDaysRequired: number = 30
): RiskMetrics {
  const daysOfData = snapshots.length
  
  // Not enough data yet
  if (daysOfData < minDaysRequired) {
    return {
      sharpeRatio: null,
      annualizedVolatility: null,
      var95: null,
      maxDrawdown: null,
      daysOfData,
      requiresDays: minDaysRequired
    }
  }
  
  // Calculate daily returns
  const dailyReturns = calculateDailyReturns(snapshots)
  
  // Calculate all metrics
  return {
    sharpeRatio: calculateSharpeRatio(dailyReturns),
    annualizedVolatility: calculateAnnualizedVolatility(dailyReturns),
    var95: calculateVaR95(dailyReturns),
    maxDrawdown: calculateMaxDrawdown(snapshots),
    daysOfData,
    requiresDays: minDaysRequired
  }
}
