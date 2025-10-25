// Diagnostic API to check for duplicate holdings

import { NextResponse } from 'next/server'
import { createClient } from '@/app/utils/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = await createClient()

    // Get all holdings grouped by date
    const { data: allHoldings, error } = await supabase
      .from('holdings')
      .select('id, date, stock_ticker, shares, market_value')
      .order('date', { ascending: false })
      .order('stock_ticker', { ascending: true })

    if (error) {
      throw new Error(`Failed to fetch holdings: ${error.message}`)
    }

    // Group by date
    const byDate = new Map<string, typeof allHoldings>()
    allHoldings?.forEach(h => {
      const dateKey = h.date
      if (!byDate.has(dateKey)) {
        byDate.set(dateKey, [])
      }
      byDate.get(dateKey)!.push(h)
    })

    // Check for duplicates within each date
    const analysis: Record<string, unknown> = {}
    
    byDate.forEach((holdings, date) => {
      const tickerCounts = new Map<string, number>()
      const tickerShares = new Map<string, number[]>()
      
      holdings.forEach(h => {
        tickerCounts.set(h.stock_ticker, (tickerCounts.get(h.stock_ticker) || 0) + 1)
        
        if (!tickerShares.has(h.stock_ticker)) {
          tickerShares.set(h.stock_ticker, [])
        }
        tickerShares.get(h.stock_ticker)!.push(h.shares)
      })

      const duplicates = Array.from(tickerCounts.entries())
        .filter(([_, count]) => count > 1)
        .map(([ticker, count]) => ({
          ticker,
          count,
          shares: tickerShares.get(ticker),
          totalShares: tickerShares.get(ticker)!.reduce((sum, s) => sum + s, 0)
        }))

      analysis[date] = {
        totalRecords: holdings.length,
        uniqueTickers: new Set(holdings.map(h => h.stock_ticker)).size,
        duplicates: duplicates.length > 0 ? duplicates : 'None',
        sampleTickers: holdings.slice(0, 3).map(h => ({
          ticker: h.stock_ticker,
          shares: h.shares,
          market_value: h.market_value
        }))
      }
    })

    return NextResponse.json({
      success: true,
      totalRecords: allHoldings?.length || 0,
      uniqueDates: byDate.size,
      dates: Array.from(byDate.keys()),
      analysis
    })

  } catch (error) {
    console.error('Holdings debug error:', error)
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to analyze holdings'
      },
      { status: 500 }
    )
  }
}
