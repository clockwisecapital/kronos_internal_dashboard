// Market Downside API Route - Calculate MA distance for major indices
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface MarketDownsideRow {
  index: string
  ma9d: number | null
  ma50d: number | null
  ma100d: number | null
  ma200d: number | null
}

// Major market indices to track
const INDICES = [
  { ticker: 'SPY', name: 'S&P 500' },
  { ticker: 'QQQ', name: 'NASDAQ' },
  { ticker: 'DIA', name: 'Dow Jones' },
  { ticker: 'IWM', name: 'Russell 2000' },
  { ticker: 'SMH', name: 'SMH' }
]

/**
 * Calculate Simple Moving Average
 */
function calculateSMA(prices: number[], period: number): number | null {
  if (prices.length < period) return null
  const relevantPrices = prices.slice(-period)
  const sum = relevantPrices.reduce((acc, price) => acc + price, 0)
  return sum / period
}

/**
 * Calculate distance from MA: (MA - Current Price) / Current Price
 * Negative = below MA (downside)
 * Positive = above MA
 */
function calculateMADistance(currentPrice: number, ma: number | null): number | null {
  if (ma === null) return null
  return ((ma - currentPrice) / currentPrice) * 100
}

/**
 * Fetch historical prices from Yahoo Finance
 */
async function fetchHistoricalPrices(ticker: string, days: number = 365): Promise<number[]> {
  try {
    const endDate = Math.floor(Date.now() / 1000)
    const startDate = endDate - (days * 24 * 60 * 60)
    
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?period1=${startDate}&period2=${endDate}&interval=1d`
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0'
      }
    })

    if (!response.ok) {
      console.warn(`Failed to fetch data for ${ticker}`)
      return []
    }

    const data = await response.json()
    
    if (!data.chart?.result?.[0]?.indicators?.quote?.[0]?.close) {
      console.warn(`No price data for ${ticker}`)
      return []
    }

    // Get closing prices, filter out nulls
    const closes: number[] = data.chart.result[0].indicators.quote[0].close
      .filter((price: number | null) => price !== null)
    
    return closes
  } catch (error) {
    console.error(`Error fetching prices for ${ticker}:`, error)
    return []
  }
}

export async function GET() {
  try {
    console.log('=== Market Downside API: Calculating MA distances for indices ===')
    
    const results: MarketDownsideRow[] = []
    
    // Calculate MA distances for each index
    for (const index of INDICES) {
      console.log(`Fetching historical data for ${index.ticker}...`)
      
      // Fetch 365 calendar days (~250 trading days) to ensure 200D MA calculation
      const prices = await fetchHistoricalPrices(index.ticker, 365)

      if (prices.length === 0) {
        // If no data, add row with nulls
        results.push({
          index: index.name,
          ma9d: null,
          ma50d: null,
          ma100d: null,
          ma200d: null
        })
        continue
      }

      const currentPrice = prices[prices.length - 1]

      // Calculate moving averages
      const ma9 = calculateSMA(prices, 9)
      const ma50 = calculateSMA(prices, 50)
      const ma100 = calculateSMA(prices, 100)
      const ma200 = calculateSMA(prices, 200)

      // Calculate distances from MAs
      const ma9d = calculateMADistance(currentPrice, ma9)
      const ma50d = calculateMADistance(currentPrice, ma50)
      const ma100d = calculateMADistance(currentPrice, ma100)
      const ma200d = calculateMADistance(currentPrice, ma200)

      results.push({
        index: index.name,
        ma9d,
        ma50d,
        ma100d,
        ma200d
      })
    }

    console.log(`Calculated MA distances for ${results.length} indices`)

    return NextResponse.json({
      success: true,
      data: results,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Market Downside API error:', error)
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to calculate market downside'
      },
      { status: 500 }
    )
  }
}
