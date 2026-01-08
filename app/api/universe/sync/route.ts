/**
 * Universe Sync API
 * Syncs holdings from holdings table to universe table
 * Creates universe entries for any tickers that don't exist yet
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/app/utils/supabase/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST() {
  try {
    console.log('=== Universe Sync: Starting ===')
    const supabase = await createClient()

    const { data: holdings, error: holdingsError } = await supabase
      .from('holdings')
      .select('stock_ticker, security_name')
      .order('stock_ticker', { ascending: true })

    if (holdingsError) {
      throw new Error(`Failed to fetch holdings: ${holdingsError.message}`)
    }

    if (!holdings || holdings.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'No holdings found in database'
      }, { status: 404 })
    }

    console.log(`Found ${holdings.length} holdings`)

    const { data: existingUniverse, error: universeError } = await supabase
      .from('universe')
      .select('ticker')

    if (universeError) {
      throw new Error(`Failed to fetch universe: ${universeError.message}`)
    }

    const existingTickers = new Set(existingUniverse?.map(u => u.ticker) || [])
    console.log(`Found ${existingTickers.size} existing universe entries`)

    const uniqueHoldings = Array.from(
      new Map(holdings.map(h => [h.stock_ticker, h])).values()
    )

    console.log(`${uniqueHoldings.length} unique tickers in holdings`)

    const newTickers = uniqueHoldings.filter(h => !existingTickers.has(h.stock_ticker))

    if (newTickers.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'All holdings already exist in universe',
        synced: 0,
        total: uniqueHoldings.length
      })
    }

    console.log(`Adding ${newTickers.length} new tickers to universe`)

    const newUniverseEntries = newTickers.map(h => ({
      ticker: h.stock_ticker,
      name: h.security_name || h.stock_ticker,
      clockwise_val: null,
      pulls_into_val: null,
      gics: null,
      clockwise_sector: null,
      risk_score: null,
      path: null,
      optionality: null,
      core_noncore: null,
      beta_3yr: null,
      beta_1yr: null,
      true_beta_adj: null,
      true_beta: null,
      base_methodology: null,
      base_ticker_3yr_multiple: null,
      base_ticker_ntm_multiple: null,
      base_sector_3yr_multiple: null,
      base_sector_ntm_multiple: null,
      base_clockwise_rel_multiple: null,
      base_metric: null,
      base_target_price: null,
      base_upside_pct: null,
      upside_methodology: null,
      upside_ticker_3yr_multiple: null,
      upside_ticker_ntm_multiple: null,
      upside_sector_3yr_multiple: null,
      upside_sector_ntm_multiple: null,
      upside_clockwise_rel_multiple: null,
      upside_metric: null,
      upside_target_price: null,
      upside_upside_pct: null
    }))

    const { data: inserted, error: insertError } = await supabase
      .from('universe')
      .insert(newUniverseEntries)
      .select()

    if (insertError) {
      throw new Error(`Failed to insert new universe entries: ${insertError.message}`)
    }

    console.log(`=== Universe Sync: Complete - Added ${inserted?.length || 0} entries ===`)

    return NextResponse.json({
      success: true,
      message: `Successfully synced ${inserted?.length || 0} new holdings to universe`,
      synced: inserted?.length || 0,
      total: uniqueHoldings.length,
      new_tickers: newTickers.map(h => h.stock_ticker)
    })

  } catch (error) {
    console.error('Universe Sync error:', error)
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to sync universe'
      },
      { status: 500 }
    )
  }
}
