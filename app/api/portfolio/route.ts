// Portfolio API Route - Net Weight Calculations (Holdings, Weightings, Net Weight)

import { NextResponse } from 'next/server'
import { createClient } from '@/app/utils/supabase/server'
import {
  getLatestHoldingsDate,
  deduplicateByTicker,
  filterValidTickers
} from '@/lib/utils/holdings'
import { calculateShorts } from '@/lib/utils/shorts'

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
  xlk: number | null
  [key: string]: any
}

interface NetWeightRow {
  ticker: string
  name: string
  shares: number
  market_value: number
  holding_weight: number
  shorts: number | null
  benchmark_weight: number | null
  net_weight: number | null
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    
    // Parse query parameters to get selected benchmark (default to SPY)
    const { searchParams } = new URL(request.url)
    const selectedBenchmark = searchParams.get('benchmark') || 'spy'

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

    console.log(`Net Weight Calculations: Loaded ${holdings.length} holdings from date: ${latestDate}`)
    
    // Deduplicate holdings
    const holdingsToUse = deduplicateByTicker(holdings as any[])
    
    if (holdingsToUse.length !== holdings.length) {
      console.log(`De-duplicated: ${holdings.length} → ${holdingsToUse.length} holdings`)
    }

    // 2. Calculate total market value and weights for holdings
    const totalMarketValue = holdingsToUse.reduce((sum, h) => sum + h.market_value, 0)
    
    const holdingsWithWeights: HoldingWithWeight[] = holdingsToUse.map(h => ({
      ticker: h.stock_ticker,
      shares: h.shares,
      market_value: h.market_value,
      weight: (h.market_value / totalMarketValue) * 100
    }))

    // 3. Fetch weightings data from database
    const { data: weightingsData, error: weightingsError } = await supabase
      .from('weightings')
      .select('*')
      .order('ticker', { ascending: true })

    if (weightingsError) {
      console.warn('Failed to fetch weightings:', weightingsError.message)
    }

    console.log(`Fetched ${weightingsData?.length || 0} weightings from database`)

    // 4. Create a map of ticker -> benchmark weight
    const weightingsMap = new Map<string, WeightingData>()
    if (weightingsData) {
      weightingsData.forEach((w: any) => {
        weightingsMap.set(w.ticker.toUpperCase(), w)
      })
    }

    // 5. Calculate net weights (holding weight - benchmark weight) and shorts
    const netWeightRows: NetWeightRow[] = holdingsWithWeights.map(holding => {
      const weightingData = weightingsMap.get(holding.ticker.toUpperCase())
      const benchmarkWeight = weightingData ? (weightingData[selectedBenchmark] || null) : null
      
      // Convert benchmark weight from decimal to percentage if it exists
      const benchmarkWeightPercent = benchmarkWeight !== null ? benchmarkWeight * 100 : null
      
      const netWeight = benchmarkWeightPercent !== null 
        ? holding.weight - benchmarkWeightPercent 
        : null

      // Calculate shorts (leverage-adjusted short exposure)
      const shorts = calculateShorts(holding.ticker, holding.weight)

      return {
        ticker: holding.ticker,
        name: weightingData?.name || holding.ticker,
        shares: holding.shares,
        market_value: holding.market_value,
        holding_weight: holding.weight,
        shorts: shorts,
        benchmark_weight: benchmarkWeightPercent,
        net_weight: netWeight
      }
    })

    // Sort by absolute net weight (largest overweight/underweight first)
    const sortedRows = netWeightRows.sort((a, b) => {
      const absA = a.net_weight !== null ? Math.abs(a.net_weight) : 0
      const absB = b.net_weight !== null ? Math.abs(b.net_weight) : 0
      return absB - absA
    })

    console.log(`Net Weight Calculations: Calculated ${sortedRows.length} rows`)
    console.log(`Selected benchmark: ${selectedBenchmark.toUpperCase()}`)

    return NextResponse.json({
      success: true,
      data: {
        date: latestDate,
        benchmark: selectedBenchmark,
        totalMarketValue,
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

