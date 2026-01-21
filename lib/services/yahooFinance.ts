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
 * Check if today is a trading day based on market state
 * Returns true if market is open, in pre-market, or closed (but was open today)
 * Returns false only if we can't determine (UNKNOWN state)
 * 
 * Note: This function is intentionally permissive. It's better to show a small
 * 1-day return than to incorrectly show 0% on a trading day.
 * Updated: 2026-01-21 to fix 1-day returns showing 0% during market hours
 */
export function isTradingDay(marketState: string): boolean {
  // Market states: REGULAR, PRE, POST, CLOSED, PREPRE, POSTPOST
  // On trading days: PRE -> REGULAR -> POST -> CLOSED
  // We include PRE because that's still a trading day (just before market open)
  
  // Only return false if we truly don't know the state
  return marketState !== 'UNKNOWN'
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
 * Get price from N TRADING days ago
 * Returns the close price from N trading days prior (excludes weekends/holidays)
 * Use this for 1-day and 5-day returns
 */
export async function fetchPriceNDaysAgo(ticker: string, daysAgo: number): Promise<number | null> {
  try {
    // Fetch more days than needed to account for weekends/holidays
    const range = daysAgo <= 7 ? '1mo' : daysAgo <= 90 ? '3mo' : '2y'
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
 * Get price from N CALENDAR days ago
 * Returns the close price from the closest trading day to N calendar days ago
 * Use this for 30-day, 90-day, and 1-year returns
 */
export async function fetchPriceCalendarDaysAgo(ticker: string, calendarDays: number): Promise<number | null> {
  try {
    // Calculate target date: today - N calendar days
    const now = new Date()
    const targetDate = new Date(now)
    targetDate.setDate(targetDate.getDate() - calendarDays)
    
    // Fetch historical data with enough range
    const range = calendarDays <= 45 ? '3mo' : calendarDays <= 120 ? '6mo' : '2y'
    const historicalData = await fetchHistoricalData(ticker, range)
    
    if (!historicalData || !historicalData.timestamp || !historicalData.indicators?.quote?.[0]?.close) {
      return null
    }
    
    const timestamps = historicalData.timestamp as number[]
    const closes = historicalData.indicators.quote[0].close as number[]
    
    // Find the closest trading day to the target date
    const targetTimestamp = Math.floor(targetDate.getTime() / 1000)
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
    console.error(`Error fetching price ${calendarDays} calendar days ago for ${ticker}:`, error)
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
 * Uses Yahoo's 'ytd' range to get the first trading day of the current year
 */
export async function fetchPriceEndOfLastYear(ticker: string): Promise<number | null> {
  try {
    // Use Yahoo's built-in 'ytd' range which starts from first trading day of current year
    const historicalData = await fetchHistoricalData(ticker, 'ytd')
    
    if (!historicalData || !historicalData.timestamp || !historicalData.indicators?.quote?.[0]?.close) {
      return null
    }
    
    const closes = historicalData.indicators.quote[0].close as number[]
    
    // First entry in YTD data is the first trading day of the year
    // This is the closing price from the last trading day of previous year
    return closes[0] || null
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
    // BUG FIX #1: Use calendar days instead of trading days for 30, 90, 365 day lookbacks
    const [price30, price90, price365, maxDD] = await Promise.all([
      fetchPriceCalendarDaysAgo(ticker, 30),
      fetchPriceCalendarDaysAgo(ticker, 90),
      fetchPriceCalendarDaysAgo(ticker, 365),
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

/**
 * Batch fetch historical prices for multiple tickers with rate limiting
 * Processes tickers in small batches to avoid overwhelming the system and Yahoo Finance API
 * 
 * @param tickers - Array of ticker symbols to fetch
 * @param batchSize - Number of tickers to process in parallel (default: 10)
 * @param delayMs - Delay between batches in milliseconds (default: 500ms)
 * @returns Map of ticker to historical price data
 */
export async function fetchHistoricalPricesInBatches(
  tickers: string[],
  batchSize: number = 10,
  delayMs: number = 500
): Promise<Map<string, {
  currentPrice: number
  price30DaysAgo: number | null
  price90DaysAgo: number | null
  price365DaysAgo: number | null
  maxDrawdown: number | null
}>> {
  const results = new Map()
  
  // Filter out invalid tickers
  const validTickers = tickers.filter(ticker => {
    const upperTicker = ticker.toUpperCase()
    return !upperTicker.includes('CASH') && 
           !upperTicker.includes('MONEY') && 
           !upperTicker.includes('&') &&
           !upperTicker.includes('OTHER') &&
           ticker.length > 0
  })
  
  console.log(`📊 Fetching historical prices for ${validTickers.length} tickers in batches of ${batchSize}`)
  
  // Split into batches
  const batches: string[][] = []
  for (let i = 0; i < validTickers.length; i += batchSize) {
    batches.push(validTickers.slice(i, i + batchSize))
  }
  
  console.log(`   Processing ${batches.length} batches...`)
  
  // Process each batch
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i]
    const batchNum = i + 1
    
    if (batchNum % 10 === 0 || batchNum === batches.length) {
      console.log(`   Batch ${batchNum}/${batches.length} (${results.size}/${validTickers.length} tickers fetched)`)
    }
    
    // Fetch all tickers in this batch in parallel
    const batchPromises = batch.map(ticker => 
      fetchHistoricalPricesForScoring(ticker)
        .then(data => ({ ticker, data }))
        .catch(error => {
          console.error(`   Error fetching ${ticker}:`, error.message)
          return { 
            ticker, 
            data: {
              currentPrice: 0,
              price30DaysAgo: null,
              price90DaysAgo: null,
              price365DaysAgo: null,
              maxDrawdown: null
            }
          }
        })
    )
    
    const batchResults = await Promise.allSettled(batchPromises)
    
    // Store results
    batchResults.forEach(result => {
      if (result.status === 'fulfilled' && result.value) {
        results.set(result.value.ticker, result.value.data)
      }
    })
    
    // Delay between batches (except for the last one)
    if (i < batches.length - 1) {
      await new Promise(resolve => setTimeout(resolve, delayMs))
    }
  }
  
  console.log(`✅ Fetched historical prices for ${results.size} tickers`)
  
  return results
}
