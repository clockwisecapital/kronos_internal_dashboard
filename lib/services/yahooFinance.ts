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
    
    // Find the index that's approximately N trading days ago
    const targetIndex = Math.max(0, closes.length - daysAgo - 1)
    
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
