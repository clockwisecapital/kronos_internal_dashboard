// Portfolio API Route - Net Weight Calculations (Holdings, Weightings, Net Weight)
// Implements client formula: Net Weight = Holding Weight - Effective Short
// Effective Short = F×G + K×L + P×Q + R×S + T×U (index shorts × stock's index weight)

import { NextResponse } from 'next/server'
import { createClient } from '@/app/utils/supabase/server'
import { createServiceRoleClient } from '@/app/utils/supabase/service-role'
import {
  getLatestHoldingsDate,
  deduplicateByTicker,
} from '@/lib/utils/holdings'
import {
  calculateIndexShortTotals,
  calculateStockEffectiveShort,
  calculateStockEffectiveShortBreakdown,
  calculateInverseETFContributions,
  IndexShortTotals,
  ShortBreakdown,
  StockWeights,
  isInverseETF,
  getLeverageMultiplier
} from '@/lib/utils/shorts'
import { fetchQuotesInBatches } from '@/lib/services/yahooFinance'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface HoldingWithWeight {
  ticker: string
  shares: number
  market_value: number
  weight: number
}

interface WeightingData {
  ticker: string
  name: string
  spy: number | null
  qqq: number | null
  dow: number | null
  soxx: number | null
  smh: number | null
  arkk: number | null
  [key: string]: any
}

interface NetWeightRow {
  ticker: string
  name: string
  shares: number
  market_value: number
  holding_weight: number
  // Individual inverse ETF contributions
  sqqq: number
  qid: number
  psq: number
  short_qqq: number  // Sum of above
  weight_in_qqq: number | null
  spxu: number
  sds: number
  sh: number
  short_spy: number  // Sum of above
  weight_in_spy: number | null
  sdow: number
  dxd: number
  dog: number
  short_dow: number  // Sum of above
  weight_in_dow: number | null
  soxs: number
  weight_in_soxx: number | null
  sark: number
  weight_in_sark: number | null
  effective_short: number
  net_weight: number
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient()

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
      .limit(5000)

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

    console.log(`Net Weight Calculations: Loaded ${holdings.length} holdings from date: ${latestDate}`)
    
    // Deduplicate holdings
    const holdingsToUse = deduplicateByTicker(holdings as any[])
    
    if (holdingsToUse.length !== holdings.length) {
      console.log(`De-duplicated: ${holdings.length} → ${holdingsToUse.length} holdings`)
    }

    // Fetch real-time prices from Yahoo Finance (like Holdings page does)
    console.log('Fetching real-time prices for weight calculations...')
    const tickers = holdingsToUse.map(h => h.stock_ticker)
    let pricesMap = new Map<string, { current: number; previousClose: number }>()
    
    try {
      const prices = await fetchQuotesInBatches(tickers, 10)
      pricesMap = new Map(
        prices.map(p => [
          p.ticker, 
          { current: p.currentPrice, previousClose: p.previousClose }
        ])
      )
      console.log(`Loaded ${pricesMap.size} real-time prices from Yahoo Finance`)
    } catch (priceError) {
      console.error('Error fetching real-time prices:', priceError)
      console.log('Falling back to stored market_value from database')
    }

    // Calculate real-time market values using current prices
    const holdingsWithRealtimeValues = holdingsToUse.map(h => {
      const priceData = pricesMap.get(h.stock_ticker)
      const realtimePrice = priceData?.current
      const calculated_market_value = realtimePrice 
        ? (realtimePrice * h.shares) 
        : h.market_value  // Fallback to stored value if price unavailable
      return {
        ...h,
        realtimePrice,
        calculated_market_value
      }
    })

    // Sum real-time market values to get total portfolio value
    const totalMarketValue = holdingsWithRealtimeValues.reduce((sum, h) => sum + h.calculated_market_value, 0)
    
    console.log(`Total Market Value: Stored=$${holdingsToUse.reduce((sum, h) => sum + h.market_value, 0).toLocaleString()}, Realtime=$${totalMarketValue.toLocaleString()}`)
    
    // Calculate weights using real-time values
    const holdingsWithWeights: HoldingWithWeight[] = holdingsWithRealtimeValues.map(h => ({
      ticker: h.stock_ticker,
      shares: h.shares,
      market_value: h.calculated_market_value,  // Use real-time calculated value
      weight: (h.calculated_market_value / totalMarketValue) * 100
    }))

    const indexShortTotals: IndexShortTotals = calculateIndexShortTotals(holdingsWithWeights)
    
    console.log('Index Short Totals:', indexShortTotals)
    console.log(`  QQQ shorts: ${indexShortTotals.qqq.toFixed(2)}%`)
    console.log(`  SPY shorts: ${indexShortTotals.spy.toFixed(2)}%`)
    console.log(`  DOW shorts: ${indexShortTotals.dow.toFixed(2)}%`)
    console.log(`  SOXX shorts: ${indexShortTotals.soxx.toFixed(2)}%`)
    console.log(`  ARKK shorts: ${indexShortTotals.arkk.toFixed(2)}%`)
    
    // Check for SBIT in holdings
    const sbitHolding = holdingsWithWeights.find(h => h.ticker.toUpperCase() === 'SBIT')
    console.log('=== SBIT API CHECK ===')
    console.log('SBIT in holdings?', sbitHolding ? 'YES' : 'NO')
    if (sbitHolding) {
      console.log('SBIT details:', sbitHolding)
      console.log('SBIT weight:', sbitHolding.weight.toFixed(4) + '%')
      console.log('SBIT effective (2x):', (sbitHolding.weight * 2).toFixed(4) + '%')
    }
    console.log('All tickers:', holdingsWithWeights.map(h => h.ticker).join(', '))
    console.log('======================')

    // Fetch weightings from weightings_universe table directly using service role client
    console.log('Fetching weightings from weightings_universe...')
    const supabaseServiceRole = createServiceRoleClient()
    const { data: weightingsData, error: weightingsError } = await supabaseServiceRole
      .from('weightings_universe')
      .select('"Ticker", "Name", "SPY", "QQQ", "SOXX", "SMH", "ARKK"')
      .limit(5000)

    if (weightingsError) {
      console.error('Error fetching weightings:', weightingsError)
      throw new Error(`Failed to fetch weightings: ${weightingsError.message}`)
    }

    console.log(`Fetched ${weightingsData?.length || 0} weightings from weightings_universe`)

    // Normalize and map weightings data
    const weightingsMap = new Map<string, WeightingData>()
    if (weightingsData) {
      weightingsData.forEach((item: any) => {
        const normalized: WeightingData = {
          ticker: item.Ticker,
          name: item.Name,
          spy: item.SPY && item.SPY !== '-' ? parseFloat(item.SPY) : null,
          qqq: item.QQQ && item.QQQ !== '-' ? parseFloat(item.QQQ) : null,
          dow: null,  // DOW/DIA column not available in weightings_universe
          soxx: item.SOXX && item.SOXX !== '-' ? parseFloat(item.SOXX) : null,
          smh: item.SMH && item.SMH !== '-' ? parseFloat(item.SMH) : null,
          arkk: item.ARKK && item.ARKK !== '-' ? parseFloat(item.ARKK) : null
        }
        weightingsMap.set(normalized.ticker.toUpperCase(), normalized)
      })
    }

    const netWeightRows: NetWeightRow[] = holdingsWithWeights.map(holding => {
      const weightingData = weightingsMap.get(holding.ticker.toUpperCase())
      const stockWeights: StockWeights = {
        qqq: weightingData?.qqq || null,
        spy: weightingData?.spy || null,
        dow: weightingData?.dow || null,
        soxx: weightingData?.soxx || null,
        smh: weightingData?.smh || null,
        arkk: weightingData?.arkk || null
      }

      // Calculate individual inverse ETF contributions for this stock
      const contributions = calculateInverseETFContributions(holdingsWithWeights, stockWeights)
      
      // Sum up contributions by index
      const short_qqq = contributions.sqqq + contributions.qid + contributions.psq
      const short_spy = contributions.spxu + contributions.sds + contributions.sh
      const short_dow = contributions.sdow + contributions.dxd + contributions.dog
      const short_soxx = contributions.soxs
      const short_sark = contributions.sark
      
      const effectiveShort = short_qqq + short_spy + short_dow + short_soxx + short_sark
      
      // Calculate net weight: for inverse ETFs, use negative leverage; for stocks, subtract effective short
      let netWeight: number
      if (isInverseETF(holding.ticker)) {
        const leverageMultiplier = getLeverageMultiplier(holding.ticker) || 1
        netWeight = holding.weight * leverageMultiplier * -1
      } else {
        netWeight = holding.weight - effectiveShort
      }

      return {
        ticker: holding.ticker,
        name: weightingData?.name || holding.ticker,
        shares: holding.shares,
        market_value: holding.market_value,
        holding_weight: holding.weight,
        // Individual inverse ETF contributions
        sqqq: contributions.sqqq,
        qid: contributions.qid,
        psq: contributions.psq,
        short_qqq,
        weight_in_qqq: stockWeights.qqq ?? null,
        spxu: contributions.spxu,
        sds: contributions.sds,
        sh: contributions.sh,
        short_spy,
        weight_in_spy: stockWeights.spy ?? null,
        sdow: contributions.sdow,
        dxd: contributions.dxd,
        dog: contributions.dog,
        short_dow,
        weight_in_dow: stockWeights.dow ?? null,
        soxs: contributions.soxs,
        weight_in_soxx: stockWeights.soxx ?? stockWeights.smh ?? null,
        sark: contributions.sark,
        weight_in_sark: stockWeights.arkk ?? null,
        effective_short: effectiveShort,
        net_weight: netWeight
      }
    })

    // Sort by holding weight (largest positions first)
    const sortedRows = netWeightRows.sort((a, b) => {
      return b.holding_weight - a.holding_weight
    })

    // Log verification for first 5 stocks
    console.log('\n=== NET WEIGHT VERIFICATION (First 5) ===')
    sortedRows.slice(0, 5).forEach(row => {
      console.log(`[${row.ticker}]`)
      console.log(`  Holding: ${row.holding_weight.toFixed(2)}%`)
      console.log(`  SQQQ: ${row.sqqq.toFixed(4)}%, QID: ${row.qid.toFixed(4)}%, PSQ: ${row.psq.toFixed(4)}%`)
      console.log(`  SHORT QQQs: ${row.short_qqq.toFixed(4)}%`)
      console.log(`  Eff Short: ${row.effective_short.toFixed(4)}%`)
      console.log(`  Net: ${row.net_weight.toFixed(2)}%`)
    })
    console.log('=========================================\n')

    console.log(`Net Weight Calculations: Calculated ${sortedRows.length} rows`)

    return NextResponse.json({
      success: true,
      data: {
        date: latestDate,
        totalMarketValue,
        indexShortTotals,  // Include short totals for summary display
        rows: sortedRows
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Net Weight Calculations API error:', error)
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fetch net weight calculations',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}
