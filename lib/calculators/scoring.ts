/**
 * Scoring Calculator
 * 
 * This module provides utilities for calculating investment scores based on
 * various financial metrics using percentile ranking within holdings.
 */

// Types & Interfaces

export interface FactSetData {
  Ticker: string
  'EPS EST NTM': string | null // Col 7
  'EPS EST NTM - 30 days ago': string | null // Col 9
  'EPS EST NTM - 90 days ago'?: string | null // Col 10 (optional for backwards compatibility)
  'EPS surprise last qtr': string | null // Col 13
  'Sales LTM': string | null // Col 14
  'Sales EST NTM': string | null // Col 19
  'SALES EST NTM - 30 days ago': string | null // Col 21
  'SALES EST NTM - 90 days ago'?: string | null // Col 22 (optional for backwards compatibility)
  'SALES surprise last qtr': string | null // Col 25
  'EBITDA LTM': string | null // Col 26
  'PRICE': string | null // Col 37
  'Gross Profit LTM': string | null // Col 42
  'ROIC 1 YR': string | null // Col 47
  'ROIC  3YR': string | null // Col 48
  'acrcrurals %': string | null // Col 56
  'FCF': string | null // Col 57
  'Consensus Price Target': string | null // Col 58
  'Total assets': string | null // Col 64
  '2 month vol': string | null // Col 69
  '3 yr beta': string | null // Col 69
  'ND': string | null // Net Debt
  'EV/EBITDA - NTM': string | null // Col 72
  'EV/Sales - NTM': string | null // Col 73
  'P/E NTM': string | null // Col 74
  '52 week high': string | null // Col 87
}

export interface YahooHistoricalData {
  currentPrice: number
  price30DaysAgo: number | null
  price90DaysAgo: number | null
  price365DaysAgo: number | null
  maxDrawdown: number | null
}

export interface ScoreWeights {
  profile_name: string
  category: string
  metric_name: string | null
  metric_weight: number | null
  category_weight: number | null
}

export interface IndividualMetrics {
  // VALUE
  peRatio: number | null
  evEbitda: number | null
  evSales: number | null
  targetPriceUpside: number | null
  
  // MOMENTUM
  return12MEx1M: number | null
  return3M: number | null
  pct52WeekHigh: number | null
  epsSurprise: number | null
  revSurprise: number | null
  ntmEpsChange: number | null
  ntmRevChange: number | null
  
  // QUALITY
  roicTTM: number | null
  grossProfitability: number | null
  accruals: number | null
  fcfToAssets: number | null
  roic3Yr: number | null
  ebitdaMargin: number | null
  
  // RISK
  beta3Yr: number | null
  volatility60Day: number | null
  maxDrawdown: number | null
  financialLeverage: number | null
}

export interface ScoredMetrics extends IndividualMetrics {
  // Percentile scores (0-100)
  peRatioScore: number | null
  evEbitdaScore: number | null
  evSalesScore: number | null
  targetPriceUpsideScore: number | null
  
  return12MEx1MScore: number | null
  return3MScore: number | null
  pct52WeekHighScore: number | null
  epsSurpriseScore: number | null
  revSurpriseScore: number | null
  ntmEpsChangeScore: number | null
  ntmRevChangeScore: number | null
  
  roicTTMScore: number | null
  grossProfitabilityScore: number | null
  accrualsScore: number | null
  fcfToAssetsScore: number | null
  roic3YrScore: number | null
  ebitdaMarginScore: number | null
  
  beta3YrScore: number | null
  volatility60DayScore: number | null
  maxDrawdownScore: number | null
  financialLeverageScore: number | null
}

export interface CompositeScores {
  valueScore: number | null
  momentumScore: number | null
  qualityScore: number | null
  riskScore: number | null
}

export interface TotalScore {
  totalScore: number | null
}

export interface StockScore extends ScoredMetrics, CompositeScores, TotalScore {
  ticker: string
}

// Utility Functions

/**
 * Safely parse a string to a number, returning null if invalid
 */
export function parseNumber(value: string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null
  // Handle FactSet's "#N/A" and other error strings
  const strValue = String(value).trim()
  if (strValue === '#N/A' || strValue === '#N/A N/A' || strValue === 'N/A' || strValue === '#VALUE!' || strValue === '#DIV/0!' || strValue === 'NaN' || strValue === 'nan') return null
  const num = parseFloat(strValue)
  return isNaN(num) ? null : num
}

/**
 * Calculate percentile rank (0-100) for a value within an array
 * Higher percentile = better
 * @param value - The value to rank
 * @param values - Array of all values to compare against
 * @param invertRank - If true, lower values get higher scores (for P/E, volatility, etc.)
 */
export function calculatePercentileRank(
  value: number | null,
  values: (number | null)[],
  invertRank: boolean = false
): number | null {
  if (value === null) return null
  
  // Filter out null values
  const validValues = values.filter((v): v is number => v !== null)
  if (validValues.length === 0) return null
  
  // Count how many values are worse than this one
  const worseCount = validValues.filter(v => {
    if (invertRank) {
      return v > value // For inverted (lower is better), count higher values as worse
    } else {
      return v < value // For normal (higher is better), count lower values as worse
    }
  }).length
  
  // Calculate percentile (0-100 scale)
  const percentile = (worseCount / validValues.length) * 100
  
  return Math.round(percentile * 10) / 10 // Round to 1 decimal place
}

/**
 * Calculate weighted average of scores, excluding null values
 */
export function calculateWeightedAverage(
  scores: (number | null)[],
  weights: number[]
): number | null {
  if (scores.length !== weights.length) {
    console.error('Scores and weights arrays must have the same length')
    return null
  }
  
  let totalWeight = 0
  let weightedSum = 0
  
  for (let i = 0; i < scores.length; i++) {
    if (scores[i] !== null) {
      weightedSum += scores[i]! * weights[i]
      totalWeight += weights[i]
    }
  }
  
  if (totalWeight === 0) return null
  
  return Math.round((weightedSum / totalWeight) * 10) / 10
}

/**
 * Calculate benchmark-relative score (0-100 scale)
 * Compares stock metric against its benchmark
 * @param stockValue - The stock's metric value
 * @param benchmarkValue - The benchmark's metric value
 * @param invertScore - If true, lower is better (for P/E, volatility, etc.)
 */
export function calculateBenchmarkRelativeScore(
  stockValue: number | null,
  benchmarkValue: number | null,
  invertScore: boolean = false
): number | null {
  if (stockValue === null || benchmarkValue === null || benchmarkValue === 0) {
    return null
  }
  
  // Calculate relative performance
  const ratio = stockValue / benchmarkValue
  
  // Convert to 0-100 score
  // If invertScore (lower is better): ratio < 1 is good, ratio > 1 is bad
  // If not inverted (higher is better): ratio > 1 is good, ratio < 1 is bad
  
  let score: number
  if (invertScore) {
    // Lower is better (P/E, EV/EBITDA, volatility, beta, etc.)
    // ratio = 0.8 means stock is 20% better → score = 60
    // ratio = 1.0 means equal → score = 50
    // ratio = 1.2 means stock is 20% worse → score = 40
    if (ratio <= 1) {
      // Better than benchmark: 50-100 scale
      score = 50 + (1 - ratio) * 100
    } else {
      // Worse than benchmark: 0-50 scale
      score = 50 / ratio
    }
  } else {
    // Higher is better (returns, target price upside, etc.)
    // ratio = 1.2 means stock is 20% better → score = 60
    // ratio = 1.0 means equal → score = 50
    // ratio = 0.8 means stock is 20% worse → score = 40
    if (ratio >= 1) {
      // Better than benchmark: 50-100 scale
      score = 50 + (ratio - 1) * 100
    } else {
      // Worse than benchmark: 0-50 scale
      score = 50 * ratio
    }
  }
  
  // Clamp to 0-100
  return Math.max(0, Math.min(100, Math.round(score * 10) / 10))
}

// Metric Extraction Functions

/**
 * Extract all individual metrics from FactSet and Yahoo data
 */
export function extractIndividualMetrics(
  factset: FactSetData,
  yahoo: YahooHistoricalData
): IndividualMetrics {
  const price = parseNumber(factset.PRICE)
  const totalAssets = parseNumber(factset['Total assets'])
  
  // VALUE metrics
  const peRatio = parseNumber(factset['P/E NTM'])
  const evEbitda = parseNumber(factset['EV/EBITDA - NTM'])
  const evSales = parseNumber(factset['EV/Sales - NTM'])
  const targetPrice = parseNumber(factset['Consensus Price Target'])
  const targetPriceUpside = price && targetPrice ? (targetPrice / price) : null
  
  // MOMENTUM metrics
  const return12MEx1M = yahoo.price30DaysAgo && yahoo.price365DaysAgo
    ? (yahoo.price30DaysAgo - yahoo.price365DaysAgo) / yahoo.price365DaysAgo
    : null
  
  const return3M = yahoo.price90DaysAgo
    ? (yahoo.currentPrice - yahoo.price90DaysAgo) / yahoo.price90DaysAgo
    : null
  
  const week52High = parseNumber(factset['52 week high'])
  const pct52WeekHigh = price && week52High ? (price / week52High) : null
  
  // BUG FIX: FactSet returns these as percentages (e.g., 4.099 = 4.099%), so divide by 100
  const epsSurprise = parseNumber(factset['EPS surprise last qtr']) !== null 
    ? parseNumber(factset['EPS surprise last qtr'])! / 100 
    : null
  const revSurprise = parseNumber(factset['SALES surprise last qtr']) !== null 
    ? parseNumber(factset['SALES surprise last qtr'])! / 100 
    : null
  
  // BUG FIX #2: Use 90-day lookback for estimate changes (industry standard)
  const epsNTM = parseNumber(factset['EPS EST NTM'])
  const epsNTM90DaysAgo = parseNumber(factset['EPS EST NTM - 90 days ago'])
  const ntmEpsChange = epsNTM && epsNTM90DaysAgo && epsNTM90DaysAgo !== 0
    ? (epsNTM / epsNTM90DaysAgo)
    : null
  
  const salesNTM = parseNumber(factset['Sales EST NTM'])
  const salesNTM90DaysAgo = parseNumber(factset['SALES EST NTM - 90 days ago'])
  const ntmRevChange = salesNTM && salesNTM90DaysAgo && salesNTM90DaysAgo !== 0
    ? (salesNTM / salesNTM90DaysAgo)
    : null
  
  // QUALITY metrics
  const roicTTM = parseNumber(factset['ROIC 1 YR'])
  
  const grossProfit = parseNumber(factset['Gross Profit LTM'])
  const grossProfitability = grossProfit && totalAssets && totalAssets !== 0
    ? (grossProfit / totalAssets)
    : null
  
  const accruals = parseNumber(factset['acrcrurals %']) // Already a percentage
  
  const fcf = parseNumber(factset.FCF)
  const fcfToAssets = fcf && totalAssets && totalAssets !== 0
    ? (fcf / totalAssets)
    : null
  
  const roic3Yr = parseNumber(factset['ROIC  3YR'])
  
  const ebitda = parseNumber(factset['EBITDA LTM'])
  const sales = parseNumber(factset['Sales LTM'])
  const ebitdaMargin = ebitda && sales && sales !== 0
    ? (ebitda / sales)
    : null
  
  // RISK metrics
  const beta3Yr = parseNumber(factset['3 yr beta'])
  const volatility60Day = parseNumber(factset['2 month vol'])
  const maxDrawdown = yahoo.maxDrawdown
  const netDebt = parseNumber(factset['ND'])
  const ebitdaLTM = parseNumber(factset['EBITDA LTM'])
  const financialLeverage = netDebt && ebitdaLTM && ebitdaLTM !== 0
    ? (netDebt / ebitdaLTM)
    : null
  
  return {
    peRatio,
    evEbitda,
    evSales,
    targetPriceUpside,
    return12MEx1M,
    return3M,
    pct52WeekHigh,
    epsSurprise,
    revSurprise,
    ntmEpsChange,
    ntmRevChange,
    roicTTM,
    grossProfitability,
    accruals,
    fcfToAssets,
    roic3Yr,
    ebitdaMargin,
    beta3Yr,
    volatility60Day,
    maxDrawdown,
    financialLeverage
  }
}

// Scoring Functions

/**
 * Calculate percentile scores for all metrics across all holdings
 */
export function calculatePercentileScores(
  allMetrics: IndividualMetrics[]
): ScoredMetrics[] {
  // Extract arrays of each metric
  const peRatios = allMetrics.map(m => m.peRatio)
  const evEbitdas = allMetrics.map(m => m.evEbitda)
  const evSales = allMetrics.map(m => m.evSales)
  const targetPriceUpsides = allMetrics.map(m => m.targetPriceUpside)
  
  const return12MEx1Ms = allMetrics.map(m => m.return12MEx1M)
  const return3Ms = allMetrics.map(m => m.return3M)
  const pct52WeekHighs = allMetrics.map(m => m.pct52WeekHigh)
  const epsSurprises = allMetrics.map(m => m.epsSurprise)
  const revSurprises = allMetrics.map(m => m.revSurprise)
  const ntmEpsChanges = allMetrics.map(m => m.ntmEpsChange)
  const ntmRevChanges = allMetrics.map(m => m.ntmRevChange)
  
  const roicTTMs = allMetrics.map(m => m.roicTTM)
  const grossProfitabilities = allMetrics.map(m => m.grossProfitability)
  const accruals = allMetrics.map(m => m.accruals)
  const fcfToAssets = allMetrics.map(m => m.fcfToAssets)
  const roic3Yrs = allMetrics.map(m => m.roic3Yr)
  const ebitdaMargins = allMetrics.map(m => m.ebitdaMargin)
  
  const beta3Yrs = allMetrics.map(m => m.beta3Yr)
  const volatility60Days = allMetrics.map(m => m.volatility60Day)
  const maxDrawdowns = allMetrics.map(m => m.maxDrawdown)
  const financialLeverages = allMetrics.map(m => m.financialLeverage)
  
  // Calculate percentile scores for each holding
  return allMetrics.map((metrics) => ({
    ...metrics,
    // VALUE scores (lower P/E, EV/EBITDA, EV/Sales is better)
    peRatioScore: calculatePercentileRank(metrics.peRatio, peRatios, true),
    evEbitdaScore: calculatePercentileRank(metrics.evEbitda, evEbitdas, true),
    evSalesScore: calculatePercentileRank(metrics.evSales, evSales, true),
    targetPriceUpsideScore: calculatePercentileRank(metrics.targetPriceUpside, targetPriceUpsides, false),
    
    // MOMENTUM scores (higher is better)
    return12MEx1MScore: calculatePercentileRank(metrics.return12MEx1M, return12MEx1Ms, false),
    return3MScore: calculatePercentileRank(metrics.return3M, return3Ms, false),
    pct52WeekHighScore: calculatePercentileRank(metrics.pct52WeekHigh, pct52WeekHighs, false),
    epsSurpriseScore: calculatePercentileRank(metrics.epsSurprise, epsSurprises, false),
    revSurpriseScore: calculatePercentileRank(metrics.revSurprise, revSurprises, false),
    ntmEpsChangeScore: calculatePercentileRank(metrics.ntmEpsChange, ntmEpsChanges, false),
    ntmRevChangeScore: calculatePercentileRank(metrics.ntmRevChange, ntmRevChanges, false),
    
    // QUALITY scores (higher is better, except accruals)
    roicTTMScore: calculatePercentileRank(metrics.roicTTM, roicTTMs, false),
    grossProfitabilityScore: calculatePercentileRank(metrics.grossProfitability, grossProfitabilities, false),
    accrualsScore: calculatePercentileRank(metrics.accruals, accruals, true), // Lower accruals is better
    fcfToAssetsScore: calculatePercentileRank(metrics.fcfToAssets, fcfToAssets, false),
    roic3YrScore: calculatePercentileRank(metrics.roic3Yr, roic3Yrs, false),
    ebitdaMarginScore: calculatePercentileRank(metrics.ebitdaMargin, ebitdaMargins, false),
    
    // RISK scores (lower risk is better)
    beta3YrScore: calculatePercentileRank(metrics.beta3Yr, beta3Yrs, true),
    volatility60DayScore: calculatePercentileRank(metrics.volatility60Day, volatility60Days, true),
    maxDrawdownScore: calculatePercentileRank(metrics.maxDrawdown, maxDrawdowns, true),
    financialLeverageScore: calculatePercentileRank(metrics.financialLeverage, financialLeverages, true)
  }))
}

/**
 * Calculate composite scores from individual metric scores using weights
 */
export function calculateCompositeScores(
  scoredMetrics: ScoredMetrics,
  weights: Map<string, { metricWeights: Map<string, number>, categoryWeight: number }>
): CompositeScores {
  // VALUE composite
  const valueWeights = weights.get('VALUE')
  const valueScore = valueWeights ? calculateWeightedAverage(
    [
      scoredMetrics.peRatioScore,
      scoredMetrics.evEbitdaScore,
      scoredMetrics.evSalesScore,
      scoredMetrics.targetPriceUpsideScore
    ],
    [
      valueWeights.metricWeights.get('P/E') || 0,
      valueWeights.metricWeights.get('EV/EBITDA') || 0,
      valueWeights.metricWeights.get('EV/Sales') || 0,
      valueWeights.metricWeights.get('TGT PRICE') || 0
    ]
  ) : null
  
  // MOMENTUM composite
  const momentumWeights = weights.get('MOMENTUM')
  const momentumScore = momentumWeights ? calculateWeightedAverage(
    [
      scoredMetrics.return12MEx1MScore,
      scoredMetrics.return3MScore,
      scoredMetrics.pct52WeekHighScore,
      scoredMetrics.epsSurpriseScore,
      scoredMetrics.revSurpriseScore,
      scoredMetrics.ntmEpsChangeScore,
      scoredMetrics.ntmRevChangeScore
    ],
    [
      momentumWeights.metricWeights.get('12M Return ex 1M') || 0,
      momentumWeights.metricWeights.get('3M Return') || 0,
      momentumWeights.metricWeights.get('52-Week High %') || 0,
      momentumWeights.metricWeights.get('EPS Surprise') || 0,
      momentumWeights.metricWeights.get('Rev Surprise') || 0,
      momentumWeights.metricWeights.get('NTM EPS Change') || 0,
      momentumWeights.metricWeights.get('NTM Rev Change') || 0
    ]
  ) : null
  
  // QUALITY composite
  const qualityWeights = weights.get('QUALITY')
  const qualityScore = qualityWeights ? calculateWeightedAverage(
    [
      scoredMetrics.roicTTMScore,
      scoredMetrics.grossProfitabilityScore,
      scoredMetrics.accrualsScore,
      scoredMetrics.fcfToAssetsScore,
      scoredMetrics.roic3YrScore,
      scoredMetrics.ebitdaMarginScore
    ],
    [
      qualityWeights.metricWeights.get('ROIC TTM') || 0,
      qualityWeights.metricWeights.get('Gross Profitability') || 0,
      qualityWeights.metricWeights.get('Accruals') || 0,
      qualityWeights.metricWeights.get('FCF') || 0,
      qualityWeights.metricWeights.get('ROIC 3-Yr') || 0,
      qualityWeights.metricWeights.get('EBITDA Margin') || 0
    ]
  ) : null
  
  // RISK composite
  const riskWeights = weights.get('RISK')
  const riskScore = riskWeights ? calculateWeightedAverage(
    [
      scoredMetrics.beta3YrScore,
      scoredMetrics.volatility60DayScore,
      scoredMetrics.maxDrawdownScore,
      scoredMetrics.financialLeverageScore
    ],
    [
      riskWeights.metricWeights.get('Beta 3-Yr') || 0,
      riskWeights.metricWeights.get('60-Day Volatility') || 0,
      riskWeights.metricWeights.get('Max Drawdown') || 0,
      riskWeights.metricWeights.get('Financial Leverage') || 0
    ]
  ) : null
  
  return {
    valueScore,
    momentumScore,
    qualityScore,
    riskScore
  }
}

/**
 * Calculate total score from composite scores using category weights
 */
export function calculateTotalScore(
  compositeScores: CompositeScores,
  categoryWeights: Map<string, number>
): TotalScore {
  const totalScore = calculateWeightedAverage(
    [
      compositeScores.valueScore,
      compositeScores.momentumScore,
      compositeScores.qualityScore,
      compositeScores.riskScore
    ],
    [
      categoryWeights.get('VALUE') || 0,
      categoryWeights.get('MOMENTUM') || 0,
      categoryWeights.get('QUALITY') || 0,
      categoryWeights.get('RISK') || 0
    ]
  )
  
  return { totalScore }
}

/**
 * Calculate benchmark-relative scores for VALUE, MOMENTUM, and RISK
 * QUALITY remains as percentile ranking within holdings
 * 
 * @deprecated Use calculateBenchmarkConstituentScores instead for constituent-based ranking
 */
export function calculateBenchmarkRelativeScores(
  stockMetrics: IndividualMetrics,
  benchmarkMetrics: IndividualMetrics
): Partial<ScoredMetrics> {
  return {
    // VALUE scores (lower is better - inverted)
    peRatioScore: calculateBenchmarkRelativeScore(stockMetrics.peRatio, benchmarkMetrics.peRatio, true),
    evEbitdaScore: calculateBenchmarkRelativeScore(stockMetrics.evEbitda, benchmarkMetrics.evEbitda, true),
    evSalesScore: calculateBenchmarkRelativeScore(stockMetrics.evSales, benchmarkMetrics.evSales, true),
    // Target Price Upside: Deprecated - now calculated via constituent-based percentile ranking
    targetPriceUpsideScore: null,
    
    // MOMENTUM scores (higher is better)
    return12MEx1MScore: calculateBenchmarkRelativeScore(stockMetrics.return12MEx1M, benchmarkMetrics.return12MEx1M, false),
    return3MScore: calculateBenchmarkRelativeScore(stockMetrics.return3M, benchmarkMetrics.return3M, false),
    pct52WeekHighScore: calculateBenchmarkRelativeScore(stockMetrics.pct52WeekHigh, benchmarkMetrics.pct52WeekHigh, false),
    // EPS/Rev metrics: ETFs don't have earnings/revenue, will be calculated via percentile ranking
    epsSurpriseScore: null,
    revSurpriseScore: null,
    ntmEpsChangeScore: null,
    ntmRevChangeScore: null,
    
    // QUALITY scores - will be calculated separately using percentile ranking (N/A for now)
    roicTTMScore: null,
    grossProfitabilityScore: null,
    accrualsScore: null,
    fcfToAssetsScore: null,
    roic3YrScore: null,
    ebitdaMarginScore: null,
    
    // RISK scores (lower is better - inverted)
    beta3YrScore: calculateBenchmarkRelativeScore(stockMetrics.beta3Yr, benchmarkMetrics.beta3Yr, true),
    volatility60DayScore: calculateBenchmarkRelativeScore(stockMetrics.volatility60Day, benchmarkMetrics.volatility60Day, true),
    maxDrawdownScore: calculateBenchmarkRelativeScore(stockMetrics.maxDrawdown, benchmarkMetrics.maxDrawdown, true),
    financialLeverageScore: null // Skipped
  }
}

/**
 * Calculate benchmark constituent-based scores for VALUE, MOMENTUM, and RISK
 * Ranks the stock against all constituents in its benchmark (e.g., all stocks in QQQ)
 * 
 * @param stockMetrics - The stock's individual metrics
 * @param constituentMetrics - Array of metrics for all benchmark constituents
 * @returns Partial scored metrics for VALUE, MOMENTUM, and RISK categories
 */
export function calculateBenchmarkConstituentScores(
  stockMetrics: IndividualMetrics,
  constituentMetrics: IndividualMetrics[]
): Partial<ScoredMetrics> {
  // Extract arrays of each metric from constituents
  const peRatios = constituentMetrics.map(m => m.peRatio)
  const evEbitdas = constituentMetrics.map(m => m.evEbitda)
  const evSales = constituentMetrics.map(m => m.evSales)
  const targetPriceUpsides = constituentMetrics.map(m => m.targetPriceUpside)
  
  const return12MEx1Ms = constituentMetrics.map(m => m.return12MEx1M)
  const return3Ms = constituentMetrics.map(m => m.return3M)
  const pct52WeekHighs = constituentMetrics.map(m => m.pct52WeekHigh)
  
  // BUG FIX #3: Add MOMENTUM metrics (EPS/Rev) for benchmark constituent ranking
  const epsSurprises = constituentMetrics.map(m => m.epsSurprise)
  const revSurprises = constituentMetrics.map(m => m.revSurprise)
  const ntmEpsChanges = constituentMetrics.map(m => m.ntmEpsChange)
  const ntmRevChanges = constituentMetrics.map(m => m.ntmRevChange)
  
  // BUG FIX #4: Add QUALITY metrics for benchmark constituent ranking
  const roicTTMs = constituentMetrics.map(m => m.roicTTM)
  const grossProfitabilities = constituentMetrics.map(m => m.grossProfitability)
  const accruals = constituentMetrics.map(m => m.accruals)
  const fcfToAssets = constituentMetrics.map(m => m.fcfToAssets)
  const roic3Yrs = constituentMetrics.map(m => m.roic3Yr)
  const ebitdaMargins = constituentMetrics.map(m => m.ebitdaMargin)
  
  const beta3Yrs = constituentMetrics.map(m => m.beta3Yr)
  const volatility60Days = constituentMetrics.map(m => m.volatility60Day)
  const maxDrawdowns = constituentMetrics.map(m => m.maxDrawdown)
  
  return {
    // VALUE scores (lower is better - inverted)
    peRatioScore: calculatePercentileRank(stockMetrics.peRatio, peRatios, true),
    evEbitdaScore: calculatePercentileRank(stockMetrics.evEbitda, evEbitdas, true),
    evSalesScore: calculatePercentileRank(stockMetrics.evSales, evSales, true),
    // Target Price Upside: Calculated against benchmark constituents (higher is better)
    targetPriceUpsideScore: calculatePercentileRank(stockMetrics.targetPriceUpside, targetPriceUpsides, false),
    
    // MOMENTUM scores (higher is better)
    return12MEx1MScore: calculatePercentileRank(stockMetrics.return12MEx1M, return12MEx1Ms, false),
    return3MScore: calculatePercentileRank(stockMetrics.return3M, return3Ms, false),
    pct52WeekHighScore: calculatePercentileRank(stockMetrics.pct52WeekHigh, pct52WeekHighs, false),
    // BUG FIX #3: Calculate EPS/Rev metrics against benchmark constituents
    epsSurpriseScore: calculatePercentileRank(stockMetrics.epsSurprise, epsSurprises, false),
    revSurpriseScore: calculatePercentileRank(stockMetrics.revSurprise, revSurprises, false),
    ntmEpsChangeScore: calculatePercentileRank(stockMetrics.ntmEpsChange, ntmEpsChanges, false),
    ntmRevChangeScore: calculatePercentileRank(stockMetrics.ntmRevChange, ntmRevChanges, false),
    
    // BUG FIX #4: Calculate QUALITY metrics against benchmark constituents
    roicTTMScore: calculatePercentileRank(stockMetrics.roicTTM, roicTTMs, false),
    grossProfitabilityScore: calculatePercentileRank(stockMetrics.grossProfitability, grossProfitabilities, false),
    accrualsScore: calculatePercentileRank(stockMetrics.accruals, accruals, true), // Lower is better
    fcfToAssetsScore: calculatePercentileRank(stockMetrics.fcfToAssets, fcfToAssets, false),
    roic3YrScore: calculatePercentileRank(stockMetrics.roic3Yr, roic3Yrs, false),
    ebitdaMarginScore: calculatePercentileRank(stockMetrics.ebitdaMargin, ebitdaMargins, false),
    
    // RISK scores (lower is better - inverted)
    beta3YrScore: calculatePercentileRank(stockMetrics.beta3Yr, beta3Yrs, true),
    volatility60DayScore: calculatePercentileRank(stockMetrics.volatility60Day, volatility60Days, true),
    maxDrawdownScore: calculatePercentileRank(stockMetrics.maxDrawdown, maxDrawdowns, true),
    financialLeverageScore: null // Skipped
  }
}

/**
 * Parse score weightings from database into a structured map
 */
export function parseScoreWeightings(
  weightings: ScoreWeights[],
  profileName: string
): {
  weights: Map<string, { metricWeights: Map<string, number>, categoryWeight: number }>,
  categoryWeights: Map<string, number>
} {
  const profileWeightings = weightings.filter(w => w.profile_name === profileName)
  
  const weights = new Map<string, { metricWeights: Map<string, number>, categoryWeight: number }>()
  const categoryWeights = new Map<string, number>()
  
  // Group by category
  const categories = ['VALUE', 'MOMENTUM', 'QUALITY', 'RISK']
  
  for (const category of categories) {
    const categoryRows = profileWeightings.filter(w => w.category === category)
    
    // Get category weight (row where metric_name is NULL)
    const categoryRow = categoryRows.find(w => w.metric_name === null)
    const categoryWeight = categoryRow?.category_weight || 0
    categoryWeights.set(category, categoryWeight)
    
    // Get metric weights
    const metricWeights = new Map<string, number>()
    const metricRows = categoryRows.filter(w => w.metric_name !== null)
    for (const row of metricRows) {
      if (row.metric_name && row.metric_weight !== null) {
        metricWeights.set(row.metric_name, row.metric_weight)
      }
    }
    
    weights.set(category, { metricWeights, categoryWeight })
  }
  
  return { weights, categoryWeights }
}

