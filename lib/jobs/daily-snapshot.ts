/**
 * Daily Portfolio Snapshot Job
 * Captures NAV and saves to portfolio_snapshot table for historical tracking
 * This enables risk metric calculations (Sharpe Ratio, Volatility, VaR, Max Drawdown)
 */

import { createClient } from '@/app/utils/supabase/server'
import { fetchQuote } from '@/lib/services/yahooFinance'
import {
  getLatestHoldingsDate,
  deduplicateByTicker,
  filterValidTickers
} from '@/lib/utils/holdings'

export interface SnapshotResult {
  success: boolean
  snapshot_date: string
  nav: number
  total_cash: number
  total_equity: number
  holdings_count: number
  isUpdate?: boolean
  message?: string
}

/**
 * Capture today's portfolio snapshot
 * Reuses NAV calculation logic from /api/portfolio
 */
export async function capturePortfolioSnapshot(): Promise<SnapshotResult> {
  try {
    console.log('=== Daily Snapshot: Starting ===')
    const supabase = await createClient()
    
    const today = new Date().toISOString().split('T')[0]
    console.log(`Capturing snapshot for: ${today}`)

    const { data: existing } = await supabase
      .from('portfolio_snapshot')
      .select('*')
      .eq('snapshot_date', today)
      .single()

    const isUpdate = !!existing
    
    if (existing) {
      console.log('⚠️ Snapshot already exists for today - will update with latest prices')
    }

    const latestDate = await getLatestHoldingsDate(supabase)
    
    if (!latestDate) {
      throw new Error('No holdings data available')
    }

    const { data: holdings, error: holdingsError } = await supabase
      .from('holdings')
      .select('*')
      .eq('date', latestDate)

    if (holdingsError || !holdings || holdings.length === 0) {
      throw new Error(`Failed to fetch holdings: ${holdingsError?.message}`)
    }

    console.log(`Loaded ${holdings.length} holdings from date: ${latestDate}`)

    const holdingsToUse = deduplicateByTicker(holdings)

    const allTickers = holdingsToUse.map(h => h.stock_ticker)
    const validTickers = filterValidTickers(allTickers)
    const tradeableHoldings = holdingsToUse.filter(h => validTickers.includes(h.stock_ticker))

    console.log(`Processing ${tradeableHoldings.length} tradeable securities`)

    const pricesMap = new Map<string, number>()
    
    for (const holding of tradeableHoldings) {
      try {
        const quoteData = await fetchQuote(holding.stock_ticker)
        if (quoteData && quoteData.currentPrice > 0) {
          pricesMap.set(holding.stock_ticker, quoteData.currentPrice)
        } else {
          // Fallback to stored price
          pricesMap.set(holding.stock_ticker, holding.close_price || holding.current_price)
        }
      } catch (error) {
        console.warn(`Failed to fetch price for ${holding.stock_ticker}, using stored price`)
        pricesMap.set(holding.stock_ticker, holding.close_price || holding.current_price)
      }
    }

    console.log(`Fetched prices for ${pricesMap.size} securities`)

    const holdingsWithCalcs = holdingsToUse.map(h => {
      const realtimePrice = pricesMap.get(h.stock_ticker)
      return {
        ...h,
        calculated_market_value: realtimePrice ? (realtimePrice * h.shares) : 
                                 h.current_price ? (h.current_price * h.shares) : 
                                 h.market_value
      }
    })

    const nav = holdingsWithCalcs.reduce((sum, h) => sum + h.calculated_market_value, 0)
    
    // Calculate cash vs equity breakdown
    const cashTickers = ['FGXXX', 'SPAXX', 'VMFXX'] // Common money market funds
    const cashHoldings = holdingsWithCalcs.filter(h => 
      h.stock_ticker.toUpperCase().includes('CASH') || 
      cashTickers.includes(h.stock_ticker.toUpperCase())
    )
    const equityHoldings = holdingsWithCalcs.filter(h => 
      !h.stock_ticker.toUpperCase().includes('CASH') && 
      !cashTickers.includes(h.stock_ticker.toUpperCase())
    )

    const totalCash = cashHoldings.reduce((sum, h) => sum + h.calculated_market_value, 0)
    const totalEquity = equityHoldings.reduce((sum, h) => sum + h.calculated_market_value, 0)

    console.log(`NAV: $${nav.toLocaleString()} (Cash: $${totalCash.toLocaleString()}, Equity: $${totalEquity.toLocaleString()})`)

    const { data: snapshot, error: upsertError } = await supabase
      .from('portfolio_snapshot')
      .upsert({
        snapshot_date: today,
        nav: nav,
        total_cash: totalCash,
        total_equity: totalEquity,
        holdings_count: holdingsToUse.length
      }, {
        onConflict: 'snapshot_date',
        ignoreDuplicates: false // Update if exists
      })
      .select()
      .single()

    if (upsertError) {
      throw new Error(`Failed to save snapshot: ${upsertError.message}`)
    }

    if (isUpdate) {
      console.log('=== Daily Snapshot: Updated (same day) ===')
    } else {
      console.log('=== Daily Snapshot: Created (new day) ===')
    }

    return {
      success: true,
      snapshot_date: today,
      nav: nav,
      total_cash: totalCash,
      total_equity: totalEquity,
      holdings_count: holdingsToUse.length,
      isUpdate // Flag to indicate if this was an update
    }

  } catch (error) {
    console.error('Daily Snapshot Error:', error)
    throw error
  }
}

/**
 * Get snapshot statistics (for monitoring/debugging)
 */
export async function getSnapshotStats() {
  try {
    const supabase = await createClient()
    
    const { data: stats, error } = await supabase
      .from('portfolio_snapshot')
      .select('snapshot_date, nav, created_at, updated_at')
      .order('snapshot_date', { ascending: false })
      .limit(90)

    if (error) throw error

    const latestSnapshot = stats?.[0]
    const lastUpdated = latestSnapshot?.updated_at || latestSnapshot?.created_at

    return {
      total_snapshots: stats?.length || 0,
      oldest_date: stats?.[stats.length - 1]?.snapshot_date,
      newest_date: stats?.[0]?.snapshot_date,
      latest_nav: stats?.[0]?.nav,
      last_updated: lastUpdated,
      last_snapshot_date: latestSnapshot?.snapshot_date
    }
  } catch (error) {
    console.error('Error fetching snapshot stats:', error)
    return null
  }
}
