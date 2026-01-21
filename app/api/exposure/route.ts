// Exposure API Route - Portfolio Exposure Analysis
// Calculates sector exposure, index vs non-index, core/non-core, risk on/off, and long/short/net

import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/app/utils/supabase/service-role'
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


// Hardcoded GICS sectors and their associated index symbols
const GICS_SECTORS = [
  { sector: 'Information Technology', index: 'xlk' },
  { sector: 'Financials', index: 'xlf' },
  { sector: 'Communication Services', index: 'xlc' },
  { sector: 'Consumer Discretionary', index: 'xly' },
  { sector: 'Consumer Staples', index: 'xlp' },
  { sector: 'Energy', index: 'xle' },
  { sector: 'Health Care', index: 'xlv' },
  { sector: 'Industrials', index: 'xli' },
  { sector: 'Materials', index: 'xlb' },
  { sector: 'Real Estate', index: 'xlre' },
  { sector: 'Utilities', index: 'xlu' }
]


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


export async function GET(request: Request) {
  try {
    const supabase = createServiceRoleClient()
    
    console.log('=== Exposure API: Starting calculations ===')

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
      .limit(5000)

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

    // Fetch weightings from weightings_universe via API
    console.log('Fetching weightings from weightings_universe...')
    let weightingsData: any[] = []
    try {
      const weightingsResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/weightings`)
      const weightingsResult = await weightingsResponse.json()
      
      if (weightingsResult.success && weightingsResult.data) {
        weightingsData = weightingsResult.data
        console.log(`Fetched ${weightingsData.length} weightings from weightings_universe`)
      } else {
        console.warn('Failed to fetch weightings from API:', weightingsResult.message)
      }
    } catch (error) {
      console.warn('Error fetching weightings:', error)
    }

    const weightingsMap = new Map<string, WeightingData>()
    weightingsData.forEach((w: any) => {
      weightingsMap.set(w.ticker.toUpperCase(), w)
    })

    console.log(`Loaded ${weightingsMap.size} weightings`)

    const { data: allGicsData, error: gicsError } = await supabase
      .from('gics_yahoo_finance')
      .select('"Ticker", "GICS Sector", "Risk on/off Score", "Core / Non-Core"')
      .limit(5000)

    if (gicsError) {
      console.warn('Failed to fetch GICS data:', gicsError.message)
    }

    console.log(`Loaded ${allGicsData?.length || 0} rows from gics_yahoo_finance table`)
    
    if (allGicsData && allGicsData.length > 0) {
      console.log('Sample GICS entries:', allGicsData.slice(0, 3).map(g => ({ 
        ticker: g.Ticker, 
        sector: g['GICS Sector'] 
      })))
    }

    // Create a map of ticker -> GICS data
    const tickerToGicsMap = new Map<string, GICSData>()
    allGicsData?.forEach((g: any) => {
      tickerToGicsMap.set(g.Ticker.toUpperCase(), g)
    })

    console.log(`Created ticker-to-GICS map with ${tickerToGicsMap.size} entries`)
    
    // Log a few portfolio tickers to see if they exist in GICS map
    const samplePortfolioTickers = holdingsData.slice(0, 5).map(h => h.stock_ticker.toUpperCase())
    console.log('Sample portfolio tickers:', samplePortfolioTickers.join(', '))
    samplePortfolioTickers.forEach(ticker => {
      const gicsData = tickerToGicsMap.get(ticker)
      if (gicsData) {
        console.log(`  ${ticker}: ${gicsData['GICS Sector']}`)
      } else {
        console.log(`  ${ticker}: NOT FOUND in GICS map`)
      }
    })

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

    const sectorExposureData: Array<{
      sector: string
      index: string
      current_weight: number
      net_weight: number
      holdings: Array<{ ticker: string; weight: number; netWeight: number }>
      allSectorTickers: string[]
    }> = []

    // Initialize cash tracking
    let cashWeight = 0
    
    // Track cash positions first
    holdingsData.forEach(holding => {
      if (isCashPosition(holding.stock_ticker)) {
        cashWeight += holding.weight
      }
    })

    // For each hardcoded GICS sector, calculate weights
    for (const { sector, index } of GICS_SECTORS) {
      // Find all tickers in the database that belong to this sector
      const { data: sectorTickers } = await supabase
        .from('gics_yahoo_finance')
        .select('"Ticker"')
        .eq('"GICS Sector"', sector)

      const allSectorTickers = sectorTickers?.map(t => t.Ticker.toUpperCase()) || []
      
      // Find which holdings belong to this sector
      let sectorCurrentWeight = 0
      let sectorNetWeight = 0
      const sectorHoldings: Array<{ ticker: string; weight: number; netWeight: number }> = []

      holdingsData.forEach(holding => {
        const tickerUpper = holding.stock_ticker.toUpperCase()
        const gicsData = tickerToGicsMap.get(tickerUpper)
        
        if (gicsData?.['GICS Sector'] === sector && !isCashPosition(holding.stock_ticker)) {
          const netWeight = netWeightMap.get(tickerUpper) || 0
          sectorCurrentWeight += holding.weight
          sectorNetWeight += netWeight
          sectorHoldings.push({
            ticker: holding.stock_ticker,
            weight: holding.weight,
            netWeight
          })
        }
      })

      // Only add sector if it has holdings
      if (sectorCurrentWeight > 0) {
        sectorExposureData.push({
          sector,
          index,
          current_weight: sectorCurrentWeight,
          net_weight: sectorNetWeight,
          holdings: sectorHoldings,
          allSectorTickers
        })
      }
    }

    const exposureRows: ExposureRow[] = []

    for (const sectorData of sectorExposureData) {
      // Calculate index weightings by summing ALL tickers in each index that match this GICS Sector
      let spyWeighting = 0
      let qqqWeighting = 0
      let igvWeighting = 0
      let itaWeighting = 0
      let smhWeighting = 0
      let arkkWeighting = 0

      // Sum weights for all tickers in this GICS Sector across all indices
      sectorData.allSectorTickers.forEach(ticker => {
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

      sectorData.holdings.forEach(holding => {
        const weighting = weightingsMap.get(holding.ticker.toUpperCase())
        const qqqWeight = weighting?.qqq || 0
        const { inIndex, notInIndex } = calculateIndexExposure(holding.weight, qqqWeight, 'QQQ')
        inIndexTotal += inIndex
        notInIndexTotal += notInIndex
      })

      exposureRows.push({
        gics: sectorData.sector,
        index: sectorData.index,
        current_weight: sectorData.current_weight,
        net_weight: sectorData.net_weight,
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

    let coreWeight = 0
    let nonCoreWeight = 0

    holdingsData.forEach(holding => {
      if (isCashPosition(holding.stock_ticker)) return
      
      const gics = tickerToGicsMap.get(holding.stock_ticker.toUpperCase())
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

    let riskOnWeight = 0
    let riskOffWeight = 0

    holdingsData.forEach(holding => {
      if (isCashPosition(holding.stock_ticker)) return
      
      const gics = tickerToGicsMap.get(holding.stock_ticker.toUpperCase())
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
    console.log(`GICS Sectors with holdings: ${sectorExposureData.length}`)
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


