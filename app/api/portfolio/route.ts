// Portfolio API Route - NAV, Performance, Metrics, Holdings

import { NextResponse } from 'next/server'
import { createClient } from '@/app/utils/supabase/server'
import { 
  fetchQuote, 
  fetchPriceNDaysAgo, 
  fetchPriceEndOfLastMonth, 
  fetchPriceEndOfLastYear 
} from '@/lib/services/yahooFinance'
import {
  getLatestHoldingsDate,
  deduplicateByTicker,
  detectDuplicates,
  filterValidTickers,
  calculateMarketValue
} from '@/lib/utils/holdings'
import type {
  Holding,
  PerformanceMetrics,
  PortfolioData,
  ApiResponse
} from '@/lib/types/holdings'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  try {
    const supabase = await createClient()

    // 1. Fetch holdings data (get most recent upload only)
    const latestDate = await getLatestHoldingsDate(supabase)
    
    if (!latestDate) {
      return NextResponse.json({
        success: false,
        message: 'No holdings data available',
        timestamp: new Date().toISOString()
      }, { status: 404 })
    }

    // Fetch holdings from the most recent date
    const { data: holdings, error: holdingsError } = await supabase
      .from('holdings')
      .select('*')
      .eq('date', latestDate)
      .order('market_value', { ascending: false })

    if (holdingsError) {
      throw new Error(`Failed to fetch holdings: ${holdingsError.message}`)
    }

    if (!holdings || holdings.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'No holdings data available',
        timestamp: new Date().toISOString()
      }, { status: 404 })
    }

    console.log(`Loaded ${holdings.length} holdings from date: ${latestDate}`)
    
    // Check for duplicates and de-duplicate using shared utilities
    const duplicates = detectDuplicates(holdings)
    const holdingsToUse = deduplicateByTicker(holdings as Holding[])
    
    if (holdingsToUse.length !== holdings.length) {
      console.log(`De-duplicated: ${holdings.length} → ${holdingsToUse.length} holdings`)
    }

    // 2. Get current prices for all holdings (filter out invalid tickers)
    console.log('Fetching current prices for TIME portfolio...')
    const pricesMap = new Map<string, number>()
    
    // Filter valid tickers using shared utility
    const allTickers = holdingsToUse.map(h => h.stock_ticker)
    const validTickers = filterValidTickers(allTickers)
    const validHoldings = holdingsToUse.filter(h => validTickers.includes(h.stock_ticker))
    
    console.log(`Fetching prices for ${validHoldings.length} valid tickers out of ${holdingsToUse.length} total`)
    
    for (const holding of validHoldings) {
      const quoteData = await fetchQuote(holding.stock_ticker)
      if (quoteData && quoteData.currentPrice > 0) {
        pricesMap.set(holding.stock_ticker, quoteData.currentPrice)
      }
    }

    // 3. Calculate NAV: Mirror Holdings tab logic exactly (line 183-185, then 228)
    const holdingsWithCalcs = holdingsToUse.map(h => {
      const realtimePrice = pricesMap.get(h.stock_ticker)
      return {
        ...h,
        calculated_market_value: realtimePrice ? (realtimePrice * h.shares) : 
                                 h.current_price ? (h.current_price * h.shares) : 
                                 h.market_value
      }
    })
    
    // NAV = Sum of calculated_market_value (same as Holdings totalValue)
    const nav = holdingsWithCalcs.reduce((sum, h) => sum + h.calculated_market_value, 0)
    
    console.log(`NAV: $${nav.toLocaleString()} (from ${holdingsWithCalcs.length} holdings)`)

    // 4. Calculate TIME Portfolio Performance
    const timePerformance = await calculateTimePortfolioPerformance(holdingsToUse, pricesMap)

    // 5. Calculate Benchmark Performance (SPY, QQQ, DIA, IWM, SMH)
    const benchmarks = ['SPY', 'QQQ', 'DIA', 'IWM', 'SMH']
    const benchmarkPerformance: PerformanceMetrics[] = []

    for (const benchmark of benchmarks) {
      const perf = await calculateBenchmarkPerformance(benchmark)
      if (perf) {
        benchmarkPerformance.push(perf)
      }
    }

    // 6. Calculate Key Metrics
    const keyMetrics = await calculateKeyMetrics(holdingsToUse)

    // 7. Prepare Holdings with Weights
    const totalMarketValue = holdingsToUse.reduce((sum, h) => sum + h.market_value, 0)
    const holdingsWithWeights = holdingsToUse.map(h => ({
      ticker: h.stock_ticker,
      weight: (h.market_value / totalMarketValue) * 100
    }))

    // 8. Combine all data
    const performanceData = [timePerformance, ...benchmarkPerformance]

    return NextResponse.json<ApiResponse<PortfolioData>>({
      success: true,
      data: {
        nav,
        performance: performanceData,
        keyMetrics,
        holdings: holdingsWithWeights
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Portfolio API error:', error)
    return NextResponse.json<ApiResponse<null>>(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fetch portfolio data',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}

/**
 * Calculate TIME Portfolio Performance
 * Daily: Current Price / Close Price - 1
 * WTD: Current Price / Price 7 days ago - 1
 * MTD: Current Price / Price at end of last month - 1
 * YTD: Current Price / Price at end of last year - 1
 */
async function calculateTimePortfolioPerformance(
  holdings: { stock_ticker: string; market_value: number; close_price: number; shares: number }[],
  pricesMap: Map<string, number>
): Promise<PerformanceMetrics> {
  const totalMarketValue = holdings.reduce((sum, h) => sum + h.market_value, 0)
  
  let dailyReturn = 0
  let wtdReturn = 0
  let mtdReturn = 0
  let ytdReturn = 0
  let validHoldings = 0

  for (const holding of holdings) {
    const currentPrice = pricesMap.get(holding.stock_ticker)
    if (!currentPrice || currentPrice === 0) continue

    const weight = holding.market_value / totalMarketValue
    validHoldings++

    // Daily Return: current_price / close_price - 1
    const holdingDailyReturn = (currentPrice / holding.close_price) - 1
    dailyReturn += holdingDailyReturn * weight

    // WTD Return: current_price / price_7_days_ago - 1
    const price7DaysAgo = await fetchPriceNDaysAgo(holding.stock_ticker, 7)
    if (price7DaysAgo) {
      const holdingWtdReturn = (currentPrice / price7DaysAgo) - 1
      wtdReturn += holdingWtdReturn * weight
    }

    // MTD Return: current_price / price_end_of_last_month - 1
    const priceEndOfLastMonth = await fetchPriceEndOfLastMonth(holding.stock_ticker)
    if (priceEndOfLastMonth) {
      const holdingMtdReturn = (currentPrice / priceEndOfLastMonth) - 1
      mtdReturn += holdingMtdReturn * weight
    }

    // YTD Return: current_price / price_end_of_last_year - 1
    const priceEndOfLastYear = await fetchPriceEndOfLastYear(holding.stock_ticker)
    if (priceEndOfLastYear) {
      const holdingYtdReturn = (currentPrice / priceEndOfLastYear) - 1
      ytdReturn += holdingYtdReturn * weight
    }
  }

  console.log(`TIME Portfolio: Calculated returns for ${validHoldings}/${holdings.length} holdings`)

  return {
    name: 'TIME',
    daily: dailyReturn * 100,
    wtd: wtdReturn * 100,
    mtd: mtdReturn * 100,
    ytd: ytdReturn * 100
  }
}

/**
 * Calculate Benchmark Performance (SPY, QQQ, DIA, IWM, SMH)
 */
async function calculateBenchmarkPerformance(ticker: string): Promise<PerformanceMetrics | null> {
  try {
    // Get current price
    const currentQuote = await fetchQuote(ticker)
    if (!currentQuote || !currentQuote.currentPrice) {
      console.warn(`No current price for ${ticker}`)
      return null
    }

    const currentPrice = currentQuote.currentPrice

    // Daily Return: Using the change from current quote
    const dailyReturn = currentQuote.changePercent

    // WTD Return
    const price7DaysAgo = await fetchPriceNDaysAgo(ticker, 7)
    const wtdReturn = price7DaysAgo ? ((currentPrice / price7DaysAgo) - 1) * 100 : 0

    // MTD Return
    const priceEndOfLastMonth = await fetchPriceEndOfLastMonth(ticker)
    const mtdReturn = priceEndOfLastMonth ? ((currentPrice / priceEndOfLastMonth) - 1) * 100 : 0

    // YTD Return
    const priceEndOfLastYear = await fetchPriceEndOfLastYear(ticker)
    const ytdReturn = priceEndOfLastYear ? ((currentPrice / priceEndOfLastYear) - 1) * 100 : 0

    return {
      name: ticker,
      daily: dailyReturn,
      wtd: wtdReturn,
      mtd: mtdReturn,
      ytd: ytdReturn
    }
  } catch (error) {
    console.error(`Error calculating performance for ${ticker}:`, error)
    return null
  }
}

/**
 * Calculate Key Metrics
 */
async function calculateKeyMetrics(
  holdings: { stock_ticker: string; market_value: number }[]
): Promise<Array<{ label: string; value: string }>> {
  const totalMarketValue = holdings.reduce((sum, h) => sum + h.market_value, 0)

  // Total Cash: Sum of Cash & equivalents + FGXXX
  const cashHoldings = holdings.filter(h => 
    h.stock_ticker.toUpperCase().includes('CASH') || 
    h.stock_ticker === 'FGXXX'
  )
  const totalCash = cashHoldings.reduce((sum, h) => sum + h.market_value, 0)
  const cashPercentage = (totalCash / totalMarketValue) * 100

  // Placeholders for beta calculations (will be implemented later)
  const clockwiseBeta = '0.91x'
  const betaReport3Year = '0.79x'
  const effectiveHedge = '23.9%'
  
  // Crypto Exposure: Look for crypto-related tickers
  const cryptoTickers = holdings.filter(h => 
    ['BTC', 'ETH', 'COIN', 'MSTR'].some(crypto => h.stock_ticker.includes(crypto))
  )
  const cryptoValue = cryptoTickers.reduce((sum, h) => sum + h.market_value, 0)
  const cryptoPercentage = (cryptoValue / totalMarketValue) * 100

  return [
    { label: 'Total Cash', value: `${cashPercentage.toFixed(2)}%` },
    { label: 'Clockwise Beta', value: clockwiseBeta },
    { label: 'Beta Report 3-Yr', value: betaReport3Year },
    { label: 'Effective Hedge', value: effectiveHedge },
    { label: 'Crypto Exposure', value: `${cryptoPercentage.toFixed(1)}%` }
  ]
}
