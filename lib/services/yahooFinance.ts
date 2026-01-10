// Yahoo Finance Service for Real-Time Stock Prices

// Direct HTTP approach - more reliable than yahoo-finance2 with Next.js
const YAHOO_FINANCE_API = 'https://query2.finance.yahoo.com/v8/finance/chart'

export interface StockQuote {
  symbol: string
  regularMarketPrice: number
  currency: string
  regularMarketChange: number
  regularMarketChangePercent: number
  regularMarketTime: Date
  marketState: string
}

export interface PriceData {
  ticker: string
  currentPrice: number
  previousClose: number
  currency: string
  change: number
  changePercent: number
  timestamp: Date
  marketState: string
  error?: string
}

/**
 * Fetch real-time quote for a single ticker using Yahoo Finance API
 */
export async function fetchQuote(ticker: string): Promise<PriceData | null> {
  try {
    const url = `${YAHOO_FINANCE_API}/${ticker}?interval=1d&range=1d`
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0'
      }
    })
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    
    const data = await response.json()
    
    const result = data?.chart?.result?.[0]
    const meta = result?.meta
    
    if (!meta || !meta.regularMarketPrice) {
      console.warn(`No price data for ${ticker}`)
      return null
    }

    return {
      ticker: ticker,
      currentPrice: meta.regularMarketPrice,
      previousClose: meta.previousClose || meta.chartPreviousClose || 0,
      currency: meta.currency || 'USD',
      change: meta.regularMarketPrice - meta.previousClose || 0,
      changePercent: ((meta.regularMarketPrice - meta.previousClose) / meta.previousClose * 100) || 0,
      timestamp: new Date(meta.regularMarketTime * 1000),
      marketState: meta.marketState || 'UNKNOWN'
    }
  } catch (error) {
    console.error(`Error fetching quote for ${ticker}:`, error)
    return {
      ticker,
      currentPrice: 0,
      previousClose: 0,
      currency: 'USD',
      change: 0,
      changePercent: 0,
      timestamp: new Date(),
      marketState: 'ERROR',
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Fetch quotes for multiple tickers in parallel
 * Filters out invalid tickers (like "Cash&Other")
 */
export async function fetchMultipleQuotes(tickers: string[]): Promise<PriceData[]> {
  // Filter out non-stock tickers
  const validTickers = tickers.filter(ticker => {
    // Remove cash, money market, and other non-stock entries
    const upperTicker = ticker.toUpperCase()
    return !upperTicker.includes('CASH') && 
           !upperTicker.includes('MONEY') && 
           !upperTicker.includes('&') &&
           ticker.length > 0 &&
           ticker.length <= 5 // Most stock tickers are 1-5 chars
  })

  console.log(`Fetching quotes for ${validTickers.length} valid tickers out of ${tickers.length} total`)

  // Fetch all quotes in parallel with error handling
  const quotePromises = validTickers.map(ticker => fetchQuote(ticker))
  const results = await Promise.allSettled(quotePromises)

  // Extract successful results
  const quotes: PriceData[] = []
  results.forEach((result, index) => {
    if (result.status === 'fulfilled' && result.value) {
      quotes.push(result.value)
    } else if (result.status === 'rejected') {
      console.error(`Failed to fetch quote for ${validTickers[index]}:`, result.reason)
    }
  })

  return quotes
}

/**
 * Batch fetch with rate limiting (to avoid API throttling)
 * Splits large requests into smaller batches
 */
export async function fetchQuotesInBatches(
  tickers: string[], 
  batchSize: number = 10
): Promise<PriceData[]> {
  const batches: string[][] = []
  
  for (let i = 0; i < tickers.length; i += batchSize) {
    batches.push(tickers.slice(i, i + batchSize))
  }

  console.log(`Fetching ${tickers.length} tickers in ${batches.length} batches of ${batchSize}`)

  const allQuotes: PriceData[] = []
  
  for (const batch of batches) {
    const batchQuotes = await fetchMultipleQuotes(batch)
    allQuotes.push(...batchQuotes)
    
    // Small delay between batches to avoid rate limiting
    if (batches.length > 1) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }

  return allQuotes
}

/**
 * Get historical data for a ticker
 */
export async function fetchHistoricalData(
  ticker: string,
  period: '1d' | '5d' | '1mo' | '3mo' | '6mo' | '1y' | '2y' | '5y' | '10y' | 'ytd' | 'max' = '1mo'
) {
  try {
    const url = `${YAHOO_FINANCE_API}/${ticker}?interval=1d&range=${period}`
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0'
      }
    })
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
    
    const data = await response.json()
    return data?.chart?.result?.[0]
  } catch (error) {
    console.error(`Error fetching historical data for ${ticker}:`, error)
    return null
  }
}

/**
 * Get price from N days ago
 * Returns the close price from N trading days prior
 */
export async function fetchPriceNDaysAgo(ticker: string, daysAgo: number): Promise<number | null> {
  try {
    // Fetch more days than needed to account for weekends/holidays
    const range = daysAgo <= 7 ? '1mo' : '3mo'
    const historicalData = await fetchHistoricalData(ticker, range)
    
    if (!historicalData || !historicalData.timestamp || !historicalData.indicators?.quote?.[0]?.close) {
      return null
    }
    
    const timestamps = historicalData.timestamp as number[]
    const closes = historicalData.indicators.quote[0].close as number[]
    
    // Count backwards exactly N trading days from the most recent day
    // Start from the second-to-last element (skip today's close)
    let tradingDaysBack = 0
    let targetIndex = closes.length - 1
    
    // Find the index that's exactly N trading days ago
    for (let i = closes.length - 2; i >= 0 && tradingDaysBack < daysAgo; i--) {
      if (closes[i] !== null && closes[i] !== undefined) {
        tradingDaysBack++
        targetIndex = i
      }
    }
    
    return closes[targetIndex] || null
  } catch (error) {
    console.error(`Error fetching price ${daysAgo} days ago for ${ticker}:`, error)
    return null
  }
}

/**
 * Get price at end of last month
 * Handles weekends by using last Friday if month-end falls on weekend
 */
export async function fetchPriceEndOfLastMonth(ticker: string): Promise<number | null> {
  try {
    const now = new Date()
    const lastDayOfPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0)
    
    // If last day is weekend, go back to Friday
    const dayOfWeek = lastDayOfPrevMonth.getDay()
    if (dayOfWeek === 0) { // Sunday
      lastDayOfPrevMonth.setDate(lastDayOfPrevMonth.getDate() - 2)
    } else if (dayOfWeek === 6) { // Saturday
      lastDayOfPrevMonth.setDate(lastDayOfPrevMonth.getDate() - 1)
    }
    
    const historicalData = await fetchHistoricalData(ticker, '3mo')
    
    if (!historicalData || !historicalData.timestamp || !historicalData.indicators?.quote?.[0]?.close) {
      return null
    }
    
    const timestamps = historicalData.timestamp as number[]
    const closes = historicalData.indicators.quote[0].close as number[]
    
    // Find closest timestamp to target date
    const targetTimestamp = Math.floor(lastDayOfPrevMonth.getTime() / 1000)
    let closestIndex = 0
    let minDiff = Math.abs(timestamps[0] - targetTimestamp)
    
    for (let i = 1; i < timestamps.length; i++) {
      const diff = Math.abs(timestamps[i] - targetTimestamp)
      if (diff < minDiff) {
        minDiff = diff
        closestIndex = i
      }
    }
    
    return closes[closestIndex] || null
  } catch (error) {
    console.error(`Error fetching end of month price for ${ticker}:`, error)
    return null
  }
}

/**
 * Get price at end of last quarter
 * Quarters end on: Mar 31 (Q1), Jun 30 (Q2), Sep 30 (Q3), Dec 31 (Q4)
 * Handles weekends by using last Friday if quarter-end falls on weekend
 */
export async function fetchPriceEndOfLastQuarter(ticker: string): Promise<number | null> {
  try {
    const now = new Date()
    const currentMonth = now.getMonth() // 0-11
    const currentYear = now.getFullYear()
    
    // Determine end of last quarter
    let lastQuarterEndDate: Date
    
    if (currentMonth < 3) {
      // Currently in Q1 → Last quarter was Q4 of previous year (Dec 31)
      lastQuarterEndDate = new Date(currentYear - 1, 11, 31)
    } else if (currentMonth < 6) {
      // Currently in Q2 → Last quarter was Q1 (Mar 31)
      lastQuarterEndDate = new Date(currentYear, 2, 31)
    } else if (currentMonth < 9) {
      // Currently in Q3 → Last quarter was Q2 (Jun 30)
      lastQuarterEndDate = new Date(currentYear, 5, 30)
    } else {
      // Currently in Q4 → Last quarter was Q3 (Sep 30)
      lastQuarterEndDate = new Date(currentYear, 8, 30)
    }
    
    // If last day is weekend, go back to Friday
    const dayOfWeek = lastQuarterEndDate.getDay()
    if (dayOfWeek === 0) { // Sunday
      lastQuarterEndDate.setDate(lastQuarterEndDate.getDate() - 2)
    } else if (dayOfWeek === 6) { // Saturday
      lastQuarterEndDate.setDate(lastQuarterEndDate.getDate() - 1)
    }
    
    const historicalData = await fetchHistoricalData(ticker, '6mo')
    
    if (!historicalData || !historicalData.timestamp || !historicalData.indicators?.quote?.[0]?.close) {
      return null
    }
    
    const timestamps = historicalData.timestamp as number[]
    const closes = historicalData.indicators.quote[0].close as number[]
    
    // Find closest timestamp to target date
    const targetTimestamp = Math.floor(lastQuarterEndDate.getTime() / 1000)
    let closestIndex = 0
    let minDiff = Math.abs(timestamps[0] - targetTimestamp)
    
    for (let i = 1; i < timestamps.length; i++) {
      const diff = Math.abs(timestamps[i] - targetTimestamp)
      if (diff < minDiff) {
        minDiff = diff
        closestIndex = i
      }
    }
    
    return closes[closestIndex] || null
  } catch (error) {
    console.error(`Error fetching end of quarter price for ${ticker}:`, error)
    return null
  }
}

/**
 * Get price at end of last year (December 31st)
 * Handles weekends by using last Friday if year-end falls on weekend
 */
export async function fetchPriceEndOfLastYear(ticker: string): Promise<number | null> {
  try {
    const now = new Date()
    const lastDayOfPrevYear = new Date(now.getFullYear() - 1, 11, 31)
    
    // If last day is weekend, go back to Friday
    const dayOfWeek = lastDayOfPrevYear.getDay()
    if (dayOfWeek === 0) { // Sunday
      lastDayOfPrevYear.setDate(lastDayOfPrevYear.getDate() - 2)
    } else if (dayOfWeek === 6) { // Saturday
      lastDayOfPrevYear.setDate(lastDayOfPrevYear.getDate() - 1)
    }
    
    const historicalData = await fetchHistoricalData(ticker, '1y')
    
    if (!historicalData || !historicalData.timestamp || !historicalData.indicators?.quote?.[0]?.close) {
      return null
    }
    
    const timestamps = historicalData.timestamp as number[]
    const closes = historicalData.indicators.quote[0].close as number[]
    
    // Find closest timestamp to target date
    const targetTimestamp = Math.floor(lastDayOfPrevYear.getTime() / 1000)
    let closestIndex = 0
    let minDiff = Math.abs(timestamps[0] - targetTimestamp)
    
    for (let i = 1; i < timestamps.length; i++) {
      const diff = Math.abs(timestamps[i] - targetTimestamp)
      if (diff < minDiff) {
        minDiff = diff
        closestIndex = i
      }
    }
    
    return closes[closestIndex] || null
  } catch (error) {
    console.error(`Error fetching end of year price for ${ticker}:`, error)
    return null
  }
}

/**
 * Calculate maximum drawdown over last 252 trading days (52 weeks)
 * Returns the worst peak-to-trough decline as a negative percentage
 */
export async function calculateMaxDrawdown(ticker: string, tradingDays: number = 252): Promise<number | null> {
  try {
    // Fetch 2 years of data to ensure we have at least 252 trading days
    const historicalData = await fetchHistoricalData(ticker, '2y')
    
    if (!historicalData || !historicalData.timestamp || !historicalData.indicators?.quote?.[0]?.close) {
      return null
    }
    
    const closes = (historicalData.indicators.quote[0].close as number[])
      .filter((price: number | null) => price !== null && price !== undefined) as number[]
    
    if (closes.length === 0) {
      return null
    }
    
    // Take last N trading days
    const prices = closes.slice(-Math.min(tradingDays, closes.length))
    
    if (prices.length < 2) {
      return null
    }
    
    // Calculate running peak (cumulative maximum)
    let runningPeak = prices[0]
    let maxDrawdown = 0
    
    for (let i = 1; i < prices.length; i++) {
      runningPeak = Math.max(runningPeak, prices[i])
      const drawdown = (prices[i] / runningPeak) - 1.0 // Negative value
      maxDrawdown = Math.min(maxDrawdown, drawdown) // Most negative
    }
    
    return maxDrawdown
  } catch (error) {
    console.error(`Error calculating max drawdown for ${ticker}:`, error)
    return null
  }
}

/**
 * Fetch comprehensive historical price data for scoring calculations
 * Returns current price, prices from 30/90/365 days ago, and max drawdown
 */
export async function fetchHistoricalPricesForScoring(ticker: string): Promise<{
  currentPrice: number
  price30DaysAgo: number | null
  price90DaysAgo: number | null
  price365DaysAgo: number | null
  maxDrawdown: number | null
}> {
  try {
    // Fetch current price
    const currentQuote = await fetchQuote(ticker)
    const currentPrice = currentQuote?.currentPrice || 0
    
    // Fetch historical prices in parallel
    const [price30, price90, price365, maxDD] = await Promise.all([
      fetchPriceNDaysAgo(ticker, 30),
      fetchPriceNDaysAgo(ticker, 90),
      fetchPriceNDaysAgo(ticker, 365),
      calculateMaxDrawdown(ticker, 252)
    ])
    
    return {
      currentPrice,
      price30DaysAgo: price30,
      price90DaysAgo: price90,
      price365DaysAgo: price365,
      maxDrawdown: maxDD
    }
  } catch (error) {
    console.error(`Error fetching historical prices for scoring for ${ticker}:`, error)
    return {
      currentPrice: 0,
      price30DaysAgo: null,
      price90DaysAgo: null,
      price365DaysAgo: null,
      maxDrawdown: null
    }
  }
}
