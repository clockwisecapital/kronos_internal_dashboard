// Security Downside API Route - Calculate MA distance for all holdings
import { NextResponse } from 'next/server'
import { createClient } from '@/app/utils/supabase/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface SecurityDownsideRow {
  ticker: string
  weight: number
  ma9d: number | null
  ma50d: number | null
  ma100d: number | null
  ma200d: number | null
}

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
 * Note: days parameter is calendar days, but we need trading days
 * 200 trading days ≈ 280 calendar days (accounting for weekends/holidays)
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
    console.log('=== Security Downside API: Calculating MA distances ===')
    const supabase = await createClient()

    const { data: dateData, error: dateError } = await supabase
      .from('holdings')
      .select('date')
      .order('date', { ascending: false })
      .limit(1)

    if (dateError || !dateData || dateData.length === 0) {
      throw new Error('No holdings data available')
    }

    const latestDate = dateData[0].date

    const { data: holdings, error: holdingsError } = await supabase
      .from('holdings')
      .select('stock_ticker, market_value')
      .eq('date', latestDate)
      .order('market_value', { ascending: false })
      .limit(5000)

    if (holdingsError || !holdings || holdings.length === 0) {
      throw new Error('Failed to fetch holdings')
    }

    const uniqueHoldingsMap = new Map()
    holdings.forEach(h => {
      if (!uniqueHoldingsMap.has(h.stock_ticker)) {
        uniqueHoldingsMap.set(h.stock_ticker, h.market_value)
      }
    })

    const totalValue = Array.from(uniqueHoldingsMap.values()).reduce((sum, val) => sum + val, 0)
    
    const results: SecurityDownsideRow[] = []
    
    for (const [ticker, marketValue] of uniqueHoldingsMap.entries()) {
      // Skip cash positions
      if (ticker.toUpperCase().includes('CASH') || 
          ticker.toUpperCase().includes('EQUIVALENTS') || 
          ticker === 'FGXXX') {
        continue
      }

      const weight = (marketValue / totalValue) * 100

      console.log(`Fetching historical data for ${ticker}...`)
      
      // Fetch 365 calendar days (~250 trading days) to ensure 200D MA calculation
      const prices = await fetchHistoricalPrices(ticker, 365)

      if (prices.length === 0) {
        // If no data, add row with nulls
        results.push({
          ticker,
          weight,
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
        ticker,
        weight,
        ma9d,
        ma50d,
        ma100d,
        ma200d
      })
    }

    results.sort((a, b) => b.weight - a.weight)

    console.log(`Calculated MA distances for ${results.length} securities`)

    return NextResponse.json({
      success: true,
      data: results,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Security Downside API error:', error)
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to calculate security downside'
      },
      { status: 500 }
    )
  }
}
