/**
 * Performance API Route
 * Returns individual holding performance and portfolio contribution data
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/app/utils/supabase/server'
import { fetchQuote } from '@/lib/services/yahooFinance'
import {
  getLatestHoldingsDate,
  deduplicateByTicker,
  filterValidTickers
} from '@/lib/utils/holdings'
import {
  calculateAllHoldingsPerformance,
  calculatePortfolioTotals,
  type HoldingPerformance,
  type PortfolioTotals
} from '@/lib/calculators/performance'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface PerformanceResponse {
  success: boolean
  data?: {
    holdings: HoldingPerformance[]
    totals: PortfolioTotals
  }
  message?: string
  timestamp: string
}

export async function GET() {
  try {
    console.log('=== Performance API: Starting calculation ===')
    const supabase = await createClient()

    // 1. Fetch holdings data
    const latestDate = await getLatestHoldingsDate(supabase)
    
    if (!latestDate) {
      return NextResponse.json<PerformanceResponse>({
        success: false,
        message: 'No holdings data available',
        timestamp: new Date().toISOString()
      }, { status: 404 })
    }

    console.log(`Loading holdings from date: ${latestDate}`)
    
    const { data: holdings, error: holdingsError } = await supabase
      .from('holdings')
      .select('*')
      .eq('date', latestDate)
      .order('market_value', { ascending: false })

    if (holdingsError || !holdings || holdings.length === 0) {
      throw new Error(`Failed to fetch holdings: ${holdingsError?.message || 'No data'}`)
    }

    console.log(`Loaded ${holdings.length} holdings`)
    
    // 2. De-duplicate holdings
    const holdingsToUse = deduplicateByTicker(holdings)
    
    if (holdingsToUse.length !== holdings.length) {
      console.log(`De-duplicated: ${holdings.length} → ${holdingsToUse.length} holdings`)
    }

    // 3. Separate tradeable securities from cash/equivalents
    const allTickers = holdingsToUse.map(h => h.stock_ticker)
    const validTickers = filterValidTickers(allTickers)
    const tradeableHoldings = holdingsToUse.filter(h => validTickers.includes(h.stock_ticker))
    
    console.log(`Found ${tradeableHoldings.length} tradeable securities (out of ${holdingsToUse.length} total)`)

    // 4. Fetch current prices for tradeable holdings
    console.log('Fetching current prices...')
    const pricesMap = new Map<string, number>()
    
    for (const holding of tradeableHoldings) {
      const quoteData = await fetchQuote(holding.stock_ticker)
      if (quoteData && quoteData.currentPrice > 0) {
        pricesMap.set(holding.stock_ticker, quoteData.currentPrice)
      } else {
        // Fallback to stored close_price if current price unavailable
        pricesMap.set(holding.stock_ticker, holding.close_price || holding.current_price)
      }
    }
    
    console.log(`Fetched prices for ${pricesMap.size} tradeable securities`)

    // 5. Calculate NAV using realtime prices (matches Portfolio tab logic)
    const holdingsWithCalcs = holdingsToUse.map(h => {
      const realtimePrice = pricesMap.get(h.stock_ticker)
      return {
        ...h,
        calculated_market_value: realtimePrice ? (realtimePrice * h.shares) : 
                                 h.current_price ? (h.current_price * h.shares) : 
                                 h.market_value
      }
    })
    
    // NAV = Sum of ALL holdings (including cash/equivalents)
    const totalNAV = holdingsWithCalcs.reduce((sum, h) => sum + h.calculated_market_value, 0)
    console.log(`Total NAV: $${totalNAV.toLocaleString()} (from ${holdingsWithCalcs.length} holdings)`)

    // 6. Prepare tradeable securities for performance calculations
    const tradeableWithPricesAndWeights = tradeableHoldings.map(h => {
      const currentPrice = pricesMap.get(h.stock_ticker) || h.close_price || h.current_price
      const weight = (h.market_value / totalNAV) * 100
      
      return {
        ticker: h.stock_ticker,
        currentPrice,
        weight
      }
    })

    // 7. Calculate performance for tradeable securities (in batches to avoid API throttling)
    console.log(`Calculating performance metrics for ${tradeableWithPricesAndWeights.length} tradeable securities...`)
    const performanceData = await calculateAllHoldingsPerformance(
      tradeableWithPricesAndWeights,
      5 // Process 5 holdings at a time
    )

    // 8. Calculate portfolio totals
    const totals = calculatePortfolioTotals(performanceData)
    
    console.log('Portfolio Totals:')
    console.log(`  1-Day:  ${totals.total_contribution_1d.toFixed(2)}%`)
    console.log(`  5-Day:  ${totals.total_contribution_5d.toFixed(2)}%`)
    console.log(`  30-Day: ${totals.total_contribution_30d.toFixed(2)}%`)
    console.log(`  YTD:    ${totals.total_contribution_ytd.toFixed(2)}%`)

    // 9. Sort by weight (largest positions first)
    performanceData.sort((a, b) => b.weight - a.weight)

    console.log('=== Performance API: Calculation complete ===')

    return NextResponse.json<PerformanceResponse>({
      success: true,
      data: {
        holdings: performanceData,
        totals
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Performance API error:', error)
    return NextResponse.json<PerformanceResponse>(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to calculate performance',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}
