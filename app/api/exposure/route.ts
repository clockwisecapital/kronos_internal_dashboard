// Exposure API Route - Portfolio Exposure Analysis
// Calculates sector exposure, index vs non-index, core/non-core, risk on/off, and long/short/net

import { NextResponse } from 'next/server'
import { createClient } from '@/app/utils/supabase/server'
import {
  getLatestHoldingsDate,
  deduplicateByTicker,
} from '@/lib/utils/holdings'
import {
  calculateIndexShortTotals,
  IndexShortTotals,
} from '@/lib/utils/shorts'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// ===== INTERFACES =====

interface HoldingData {
  stock_ticker: string
  shares: number
  market_value: number
  weight: number  // Calculated percentage
}

interface WeightingData {
  ticker: string
  name: string
  spy: number | null
  qqq: number | null
  xlk: number | null
  xlf: number | null
  xlc: number | null
  xly: number | null
  xlp: number | null
  xle: number | null
  xlv: number | null
  xli: number | null
  xlb: number | null
  xlre: number | null
  xlu: number | null
  igv: number | null
  ita: number | null
  soxx: number | null
  smh: number | null
  arkk: number | null
}

interface GICSData {
  Ticker: string
  'Company Name': string | null
  'GICS Sector': string | null
  BENCHMARK1: string | null
  'Risk on/off Score': string | null
  'Core / Non-Core': string | null
}

interface NetWeightData {
  ticker: string
  net_weight: number
}

interface ExposureRow {
  gics: string
  index: string
  current_weight: number
  net_weight: number
  spy_weighting: number
  qqq_weighting: number
  in_index: number
  not_in_index: number
  igv_weighting?: number
  ita_weighting?: number
  smh_weighting?: number
  arkk_weighting?: number
}

interface PortfolioComposition {
  core: number
  non_core: number
}

interface PortfolioBias {
  risk_on: number
  risk_off: number
}

interface PortfolioExposure {
  long: number
  short: number
  net_exposure: number
}

interface ExposureResponse {
  success: boolean
  data: {
    date: string
    sector_exposure: ExposureRow[]
    composition: PortfolioComposition
    bias: PortfolioBias
    exposure: PortfolioExposure
    total_market_value: number
  }
  timestamp: string
}

// ===== HELPER FUNCTIONS =====

// Detect cash positions (money market funds, etc.)
function isCashPosition(ticker: string): boolean {
  const cashTickers = ['SGOV', 'BIL', 'SHV', 'JPST', 'VMFXX', 'SNSXX', 'CASH']
  return cashTickers.includes(ticker.toUpperCase())
}

// Calculate in-index vs non-index exposure for a holding
function calculateIndexExposure(
  holdingWeight: number,
  indexWeight: number | null,
  indexName: string
): { inIndex: number; notInIndex: number } {
  if (indexWeight === null || indexWeight === 0) {
    return { inIndex: 0, notInIndex: holdingWeight }
  }
  
  // If holding weight <= index weight, all in-index
  if (holdingWeight <= indexWeight) {
    return { inIndex: holdingWeight, notInIndex: 0 }
  }
  
  // If holding weight > index weight, split
  return { inIndex: indexWeight, notInIndex: holdingWeight - indexWeight }
}

// ===== MAIN API HANDLER =====

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    
    console.log('=== Exposure API: Starting calculations ===')

    // 1. Fetch latest holdings
    const latestDate = await getLatestHoldingsDate(supabase)
    if (!latestDate) {
      return NextResponse.json({
        success: false,
        message: 'No holdings data available',
        timestamp: new Date().toISOString()
      }, { status: 404 })
    }

    const { data: holdings, error: holdingsError } = await supabase
      .from('holdings')
      .select('*')
      .eq('date', latestDate)
      .order('market_value', { ascending: false })

    if (holdingsError || !holdings || holdings.length === 0) {
      throw new Error('Failed to fetch holdings')
    }

    console.log(`Loaded ${holdings.length} holdings from ${latestDate}`)

    // Deduplicate holdings
    const holdingsToUse = deduplicateByTicker(holdings as any[])
    const totalMarketValue = holdingsToUse.reduce((sum, h) => sum + h.market_value, 0)
    
    const holdingsData: HoldingData[] = holdingsToUse.map(h => ({
      stock_ticker: h.stock_ticker,
      shares: h.shares,
      market_value: h.market_value,
      weight: (h.market_value / totalMarketValue) * 100
    }))

    // 2. Fetch net weights from portfolio API calculations
    const { data: netWeightResponse, error: netWeightError } = await supabase
      .from('holdings')
      .select('stock_ticker')
      .eq('date', latestDate)
      .limit(1)

    // We'll calculate net weights ourselves using the same logic as portfolio route
    const indexShortTotals: IndexShortTotals = calculateIndexShortTotals(
      holdingsData.map(h => ({ ticker: h.stock_ticker, weight: h.weight }))
    )

    console.log('Index Short Totals:', indexShortTotals)

    // 3. Fetch ALL weightings data
    const { data: weightingsData, error: weightingsError } = await supabase
      .from('weightings')
      .select('*')

    if (weightingsError) {
      console.warn('Failed to fetch weightings:', weightingsError.message)
    }

    const weightingsMap = new Map<string, WeightingData>()
    weightingsData?.forEach((w: any) => {
      weightingsMap.set(w.ticker.toUpperCase(), w)
    })

    console.log(`Loaded ${weightingsMap.size} weightings`)

    // 4. Fetch GICS/Yahoo Finance data for benchmark mapping
    const tickers = holdingsData.map(h => h.stock_ticker)
    const { data: gicsData, error: gicsError } = await supabase
      .from('gics_yahoo_finance')
      .select('"Ticker", "Company Name", "GICS Sector", "BENCHMARK1", "Risk on/off Score", "Core / Non-Core"')
      .in('"Ticker"', tickers)

    if (gicsError) {
      console.warn('Failed to fetch GICS data:', gicsError.message)
    }

    const gicsMap = new Map<string, GICSData>()
    gicsData?.forEach((g: any) => {
      gicsMap.set(g.Ticker.toUpperCase(), g)
    })

    console.log(`Loaded GICS data for ${gicsMap.size} tickers`)

    // 5. Calculate net weights for each holding
    const netWeightMap = new Map<string, number>()
    holdingsData.forEach(holding => {
      const weightingData = weightingsMap.get(holding.stock_ticker.toUpperCase())
      const stockWeights = {
        qqq: weightingData?.qqq || 0,
        spy: weightingData?.spy || 0,
        soxx: weightingData?.soxx || weightingData?.smh || 0,
        arkk: weightingData?.arkk || 0
      }

      // Calculate effective short for this stock
      const effectiveShort = 
        (indexShortTotals.qqq * stockWeights.qqq / 100) +
        (indexShortTotals.spy * stockWeights.spy / 100) +
        (indexShortTotals.soxx * stockWeights.soxx / 100) +
        (indexShortTotals.arkk * stockWeights.arkk / 100)

      const netWeight = holding.weight - effectiveShort
      netWeightMap.set(holding.stock_ticker.toUpperCase(), netWeight)
    })

    // 6. Group by benchmark and calculate sector exposure
    const sectorMap = new Map<string, {
      gics: string
      current_weight: number
      net_weight: number
      holdings: Array<{ ticker: string; weight: number; netWeight: number; gics: GICSData | undefined; weighting: WeightingData | undefined }>
    }>()

    // Initialize cash tracking
    let cashWeight = 0

    holdingsData.forEach(holding => {
      const gics = gicsMap.get(holding.stock_ticker.toUpperCase())
      const weighting = weightingsMap.get(holding.stock_ticker.toUpperCase())
      const netWeight = netWeightMap.get(holding.stock_ticker.toUpperCase()) || 0

      // Check if this is a cash position
      if (isCashPosition(holding.stock_ticker)) {
        cashWeight += holding.weight
        return
      }

      const benchmark = gics?.BENCHMARK1 || 'Unknown'
      const gicsSector = gics?.['GICS Sector'] || 'Unknown'

      if (!sectorMap.has(benchmark)) {
        sectorMap.set(benchmark, {
          gics: gicsSector,
          current_weight: 0,
          net_weight: 0,
          holdings: []
        })
      }

      const sector = sectorMap.get(benchmark)!
      sector.current_weight += holding.weight
      sector.net_weight += netWeight
      sector.holdings.push({
        ticker: holding.stock_ticker,
        weight: holding.weight,
        netWeight,
        gics,
        weighting
      })
    })

    // 7. Calculate index weightings for ALL tickers in each benchmark
    // Also calculate in-index vs non-index exposure
    const exposureRows: ExposureRow[] = []

    for (const [benchmark, sector] of sectorMap.entries()) {
      // Calculate index weightings by summing ALL tickers in each index that match this benchmark
      let spyWeighting = 0
      let qqqWeighting = 0
      let igvWeighting = 0
      let itaWeighting = 0
      let smhWeighting = 0
      let arkkWeighting = 0

      // Get all tickers from weightings table that belong to this benchmark
      const { data: allGicsForBenchmark } = await supabase
        .from('gics_yahoo_finance')
        .select('"Ticker"')
        .eq('"BENCHMARK1"', benchmark)

      const benchmarkTickers = allGicsForBenchmark?.map((g: any) => g.Ticker.toUpperCase()) || []

      // Sum weights for all tickers in this benchmark across all indices
      benchmarkTickers.forEach(ticker => {
        const weighting = weightingsMap.get(ticker)
        if (weighting) {
          spyWeighting += weighting.spy || 0
          qqqWeighting += weighting.qqq || 0
          igvWeighting += weighting.igv || 0
          itaWeighting += weighting.ita || 0
          smhWeighting += (weighting.smh || weighting.soxx) || 0
          arkkWeighting += weighting.arkk || 0
        }
      })

      // Calculate in-index vs non-index for QQQ (primary index for exposure analysis)
      let inIndexTotal = 0
      let notInIndexTotal = 0

      sector.holdings.forEach(holding => {
        const qqqWeight = holding.weighting?.qqq || 0
        const { inIndex, notInIndex } = calculateIndexExposure(holding.weight, qqqWeight, 'QQQ')
        inIndexTotal += inIndex
        notInIndexTotal += notInIndex
      })

      exposureRows.push({
        gics: sector.gics,
        index: benchmark,
        current_weight: sector.current_weight,
        net_weight: sector.net_weight,
        spy_weighting: spyWeighting,
        qqq_weighting: qqqWeighting,
        in_index: inIndexTotal,
        not_in_index: notInIndexTotal,
        igv_weighting: igvWeighting,
        ita_weighting: itaWeighting,
        smh_weighting: smhWeighting,
        arkk_weighting: arkkWeighting
      })
    }

    // Sort by current weight descending
    exposureRows.sort((a, b) => b.current_weight - a.current_weight)

    // 8. Add special rows: Hedge, Other, Cash, Total
    const totalCurrentWeight = exposureRows.reduce((sum, row) => sum + row.current_weight, 0)
    const totalNetWeight = exposureRows.reduce((sum, row) => sum + row.net_weight, 0)
    const totalInIndex = exposureRows.reduce((sum, row) => sum + row.in_index, 0)
    const totalNotInIndex = exposureRows.reduce((sum, row) => sum + row.not_in_index, 0)

    // Hedge row (effective shorts - already accounted for in net weights)
    const totalEffectiveShort = Object.values(indexShortTotals).reduce((sum, val) => sum + val, 0)
    exposureRows.push({
      gics: 'Hedge',
      index: '',
      current_weight: 0,  // Blank - already in holdings
      net_weight: 0,      // Blank - already accounted for
      spy_weighting: 0,
      qqq_weighting: 0,
      in_index: 0,
      not_in_index: 0
    })

    // Other row (balance to 100%)
    const otherWeight = 100 - cashWeight - totalCurrentWeight
    exposureRows.push({
      gics: 'Other',
      index: '',
      current_weight: otherWeight,
      net_weight: otherWeight,  // Same as current
      spy_weighting: 0,
      qqq_weighting: 0,
      in_index: 0,
      not_in_index: 0
    })

    // Cash row
    exposureRows.push({
      gics: 'Cash',
      index: '',
      current_weight: cashWeight,
      net_weight: cashWeight,
      spy_weighting: 0,
      qqq_weighting: 0,
      in_index: 0,
      not_in_index: 0
    })

    // Total row
    exposureRows.push({
      gics: 'Total',
      index: '',
      current_weight: 100,
      net_weight: totalNetWeight + otherWeight + cashWeight,
      spy_weighting: 0,
      qqq_weighting: 0,
      in_index: totalInIndex,
      not_in_index: totalNotInIndex
    })

    // 9. Calculate Portfolio Composition (Core/Non-Core)
    let coreWeight = 0
    let nonCoreWeight = 0

    holdingsData.forEach(holding => {
      const gics = gicsMap.get(holding.stock_ticker.toUpperCase())
      const coreNonCore = gics?.['Core / Non-Core']

      if (coreNonCore === 'Core' || coreNonCore === 'CORE') {
        coreWeight += holding.weight
      } else if (coreNonCore === 'Non-Core' || coreNonCore === 'NON-CORE') {
        nonCoreWeight += holding.weight
      }
    })

    const composition: PortfolioComposition = {
      core: coreWeight,
      non_core: nonCoreWeight
    }

    // 10. Calculate Portfolio Bias (Risk On/Off)
    let riskOnWeight = 0
    let riskOffWeight = 0

    holdingsData.forEach(holding => {
      const gics = gicsMap.get(holding.stock_ticker.toUpperCase())
      const riskScore = gics?.['Risk on/off Score']

      if (riskScore === 'Risk On' || riskScore === 'RISK ON') {
        riskOnWeight += holding.weight
      } else if (riskScore === 'Risk Off' || riskScore === 'RISK OFF') {
        riskOffWeight += holding.weight
      }
    })

    const bias: PortfolioBias = {
      risk_on: riskOnWeight,
      risk_off: riskOffWeight
    }

    // 11. Calculate Portfolio Exposure (Long/Short/Net)
    const longWeight = holdingsData
      .filter(h => !isCashPosition(h.stock_ticker))
      .reduce((sum, h) => sum + h.weight, 0)

    const shortWeight = totalEffectiveShort

    const exposure: PortfolioExposure = {
      long: longWeight,
      short: shortWeight,
      net_exposure: longWeight - shortWeight
    }

    console.log('=== Exposure API: Calculations complete ===')
    console.log(`Sectors: ${sectorMap.size}`)
    console.log(`Composition - Core: ${coreWeight.toFixed(2)}%, Non-Core: ${nonCoreWeight.toFixed(2)}%`)
    console.log(`Bias - Risk On: ${riskOnWeight.toFixed(2)}%, Risk Off: ${riskOffWeight.toFixed(2)}%`)
    console.log(`Exposure - Long: ${longWeight.toFixed(2)}%, Short: ${shortWeight.toFixed(2)}%, Net: ${exposure.net_exposure.toFixed(2)}%`)

    return NextResponse.json({
      success: true,
      data: {
        date: latestDate,
        sector_exposure: exposureRows,
        composition,
        bias,
        exposure,
        total_market_value: totalMarketValue
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Exposure API error:', error)
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to calculate exposure',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}

